import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import ZAI from 'z-ai-web-dev-sdk'

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
})

// Types
interface QuizQuestion {
  question: string
  answer: string
  options?: string[]
  type: 'direct' | 'fill-blank' | 'multiple-choice'
}

interface Player {
  id: string
  name: string
  score: number
  matchScore: number // Points earned in current match (temporary)
  isHost: boolean
  isReady: boolean
  hasAnswered: boolean
  answer: string | null
  timeTaken: number
  joinedAt: number
  correctStreak: number // Consecutive correct answers
  answerRank: number // Rank in answering (for speed mode)
  correctThisRound: boolean
  socketId: string // Track socket ID separately
  teamId?: 'A' | 'B' // Team assignment (for team mode)
}

interface Team {
  id: 'A' | 'B'
  name: string
  color: string
}

interface RoomSettings {
  categoryId: string
  mode: 'relaxed' | 'speed'
  roundsTotal: number
  timePerRound: number
  playType: 'solo' | 'teams' // NEW: Solo or Teams mode
}

interface Room {
  code: string
  isPublic: boolean
  hostId: string
  settings: RoomSettings
  status: 'lobby' | 'running' | 'ended'
  currentRound: number
  players: Player[]
  currentQuestion: QuizQuestion | null
  roundStartedAt: number | null
  roundEndsAt: number | null
  previousQuestions: string[]
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  teams: Team[] // NEW: Teams configuration
}

interface PublicRoom {
  code: string
  hostName: string
  playerCount: number
  settings: RoomSettings
  createdAt: number
  teamCount?: { teamA: number; teamB: number }
}

// Storage
const rooms = new Map<string, Room>()
const playerRooms = new Map<string, string>()
const socketToPlayer = new Map<string, string>()

// Categories
const quizCategories = [
  { id: 'history', name: 'التاريخ', icon: '📜' },
  { id: 'geography', name: 'الجغرافيا', icon: '🌍' },
  { id: 'science', name: 'العلوم', icon: '🔬' },
  { id: 'technology', name: 'التكنولوجيا', icon: '💻' },
  { id: 'sports', name: 'الرياضة', icon: '⚽' },
  { id: 'movies', name: 'الأفلام', icon: '🎬' },
  { id: 'music', name: 'الموسيقى', icon: '🎵' },
  { id: 'general', name: 'الثقافة العامة', icon: '📚' },
  { id: 'arabic', name: 'الثقافة العربية', icon: '🕌' },
  { id: 'animals', name: 'الحيوانات', icon: '🦁' },
  { id: 'space', name: 'الفضاء', icon: '🚀' },
  { id: 'economy', name: 'الاقتصاد', icon: '💰' },
  { id: 'literature', name: 'الأدب', icon: '📖' },
]

// Helper functions
const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

const generateId = (): string => {
  return Math.random().toString(36).slice(2, 10)
}

const getRoomForPlayer = (playerId: string): Room | null => {
  const roomCode = playerRooms.get(playerId)
  if (!roomCode) return null
  return rooms.get(roomCode) || null
}

const emitRoomUpdate = (room: Room) => {
  console.log(`Emitting room update for ${room.code}, status: ${room.status}, round: ${room.currentRound}`)
  io.to(room.code).emit('room-update', { room })
}

const emitPublicRooms = () => {
  const publicRooms = Array.from(rooms.values())
    .filter(r => r.isPublic && r.status === 'lobby')
    .map(r => ({
      code: r.code,
      hostName: r.players.find(p => p.id === r.hostId)?.name || 'غير معروف',
      playerCount: r.players.length,
      settings: r.settings,
      createdAt: r.createdAt,
      teamCount: r.settings.playType === 'teams' ? {
        teamA: r.players.filter(p => p.teamId === 'A').length,
        teamB: r.players.filter(p => p.teamId === 'B').length
      } : undefined
    }))
  io.emit('public-rooms', { rooms: publicRooms })
}

// Close room and notify all players
const closeRoom = (room: Room, reason: string) => {
  console.log(`Closing room ${room.code}, reason: ${reason}`)
  
  io.to(room.code).emit('room-closed', { 
    roomCode: room.code, 
    reason 
  })
  
  const sockets = io.sockets.adapter.rooms.get(room.code)
  if (sockets) {
    sockets.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.leave(room.code)
      }
    })
  }
  
  for (const player of room.players) {
    playerRooms.delete(player.id)
    socketToPlayer.delete(player.socketId)
  }
  
  rooms.delete(room.code)
  emitPublicRooms()
  
  console.log(`Room ${room.code} closed and cleaned up`)
}

// Remove player from room completely
const removePlayerFromRoom = (playerId: string, socket: Socket, reason: 'leave' | 'disconnect' = 'disconnect') => {
  const roomCode = playerRooms.get(playerId)
  if (!roomCode) return null
  
  const room = rooms.get(roomCode)
  if (!room) {
    playerRooms.delete(playerId)
    socketToPlayer.delete(socket.id)
    return null
  }
  
  const playerIndex = room.players.findIndex(p => p.id === playerId)
  if (playerIndex === -1) {
    playerRooms.delete(playerId)
    socketToPlayer.delete(socket.id)
    return null
  }
  
  const player = room.players[playerIndex]
  const wasHost = room.hostId === playerId
  
  room.players.splice(playerIndex, 1)
  playerRooms.delete(playerId)
  socketToPlayer.delete(socket.id)
  socket.leave(roomCode)
  
  console.log(`Player ${player.name} removed from room ${roomCode}, reason: ${reason}`)
  
  if (room.players.length === 0) {
    rooms.delete(roomCode)
    emitPublicRooms()
    console.log(`Room ${roomCode} deleted (empty)`)
    return { room: null, player }
  }
  
  if (wasHost && room.status === 'running') {
    closeRoom(room, 'صاحب الغرفة غادر أثناء اللعب')
    return { room: null, player, roomClosed: true }
  }
  
  if (wasHost) {
    room.hostId = room.players[0].id
    room.players[0].isHost = true
    console.log(`Host transferred to ${room.players[0].name} in room ${roomCode}`)
  }
  
  const now = Date.now()
  room.updatedAt = now
  room.lastActivityAt = now
  emitRoomUpdate(room)
  emitPublicRooms()
  
  return { room, player, roomClosed: false }
}

// Generate question using AI
async function generateQuestion(
  category: string,
  previousQuestions: string[] = []
): Promise<QuizQuestion> {
  try {
    const zai = await ZAI.create()
    const categoryInfo = quizCategories.find(c => c.id === category) || quizCategories[7]

    const previousText = previousQuestions.length > 0
      ? `(أسئلة سبق توليدها (لا تكررها)):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
      : ''

    const prompt = `أنت خبير في إنشاء أسئلة مسابقات ثقافية "${categoryInfo.name}". أنشئ سؤالاً واحداً في فئة
${previousText}
المتطلبات:
1. السؤال يجب أن يكون واضحاً ومفهوماً للعامة
2. الإجابة يجب أن تكون قصيرة ومحددة (كلمة أو كلمتان)
3. اختر نوع السؤال عشوائياً من الأنواع الثلاثة:
   - direct: (سؤال مباشر (مثل: ما عاصمة مصر؟
   - fill-blank: املأ الفراغ (مثل: أكبر دولة عربية مساحة هي ______
   - multiple-choice: اختيار من 4 خيارات

أرجع الإجابة بتنسيق JSON فقط بدون أي نص إضافي:
{
  "question": "نص السؤال",
  "answer": "الإجابة الصحيحة",
  "type": "direct أو fill-blank أو multiple-choice",
  "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"] // في حالة multiple-choice فقط
}`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'أنت مساعد متخصص في إنشاء أسئلة مسابقات ثقافية متنوعة وممتعة. ترد بتنسيق JSON فقط.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
    })

    const content = completion.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as QuizQuestion
    if (!parsed.question || !parsed.answer || !parsed.type) {
      throw new Error('Invalid question format')
    }

    if (parsed.type === 'multiple-choice' && (!parsed.options || parsed.options.length < 2)) {
      parsed.type = 'direct'
      delete parsed.options
    }

    return parsed
  } catch (error) {
    console.error('Error generating question:', error)
    const fallbackQuestions: QuizQuestion[] = [
      { question: 'ما عاصمة المملكة العربية السعودية؟', answer: 'الرياض', type: 'direct' },
      { question: 'كم عدد أركان الإسلام؟', answer: 'خمسة', type: 'direct' },
      { question: 'أكبر قارة في العالم هي قارة ______', answer: 'آسيا', type: 'fill-blank' },
      { question: 'ما هو أكبر كوكب في المجموعة الشمسية؟', answer: 'المشتري', type: 'multiple-choice', options: ['الأرض', 'زحل', 'المشتري', 'المريخ'] }
    ]
    return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)]
  }
}

// Check answer
function checkAnswer(playerAnswer: string, correctAnswer: string): boolean {
  const normalize = (text: string) =>
    text.toLowerCase().trim()
      .replace(/[آإأ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/\s+/g, '')

  const normalizedPlayer = normalize(playerAnswer)
  const normalizedCorrect = normalize(correctAnswer)

  return normalizedPlayer === normalizedCorrect ||
    normalizedCorrect.includes(normalizedPlayer) ||
    normalizedPlayer.includes(normalizedCorrect)
}

// Calculate points based on game mode
function calculatePoints(
  room: Room, 
  player: Player, 
  isCorrect: boolean,
  allCorrectPlayers: Player[],
  playerRank: number
): number {
  if (!isCorrect) return 0

  let points = 0

  if (room.settings.mode === 'relaxed') {
    points = 10

    if (allCorrectPlayers.length === 1) {
      points += 5
    }
    else if (allCorrectPlayers.length === room.players.length) {
      points += 3
    }
  } else if (room.settings.mode === 'speed') {
    if (playerRank === 1) {
      points = 20
    } else if (playerRank === 2) {
      points = 5
    } else {
      points = 2
    }
  }

  if (player.correctStreak >= 5) {
    points += 10
  } else if (player.correctStreak >= 3) {
    points += 5
  }

  return points
}

// Calculate team scores
function calculateTeamScores(room: Room): { teamA: number; teamB: number } {
  const teamA = room.players
    .filter(p => p.teamId === 'A')
    .reduce((sum, p) => sum + p.matchScore, 0)
  
  const teamB = room.players
    .filter(p => p.teamId === 'B')
    .reduce((sum, p) => sum + p.matchScore, 0)
  
  return { teamA, teamB }
}

// Get best player per team
function getBestPlayerPerTeam(room: Room): { teamA: Player | null; teamB: Player | null } {
  const teamAPlayers = room.players.filter(p => p.teamId === 'A')
  const teamBPlayers = room.players.filter(p => p.teamId === 'B')
  
  const teamABest = teamAPlayers.length > 0 
    ? teamAPlayers.reduce((best, p) => p.matchScore > best.matchScore ? p : best, teamAPlayers[0])
    : null
  
  const teamBBest = teamBPlayers.length > 0
    ? teamBPlayers.reduce((best, p) => p.matchScore > best.matchScore ? p : best, teamBPlayers[0])
    : null
  
  return { teamA: teamABest, teamB: teamBBest }
}

// Clean up inactive rooms every 30 seconds
setInterval(() => {
  const now = Date.now()
  const endedRoomMaxAge = 5 * 60 * 1000
  const inactiveRoomMaxAge = 2 * 60 * 1000
  const runningRoomMaxAge = 30 * 60 * 1000

  for (const [code, room] of rooms) {
    let maxAge = inactiveRoomMaxAge
    
    if (room.status === 'ended') {
      maxAge = endedRoomMaxAge
    } else if (room.status === 'running') {
      maxAge = runningRoomMaxAge
    }
    
    const lastActive = room.lastActivityAt || room.updatedAt
    const age = now - lastActive
    
    if (age > maxAge) {
      console.log(`Cleaning up room ${code} (status: ${room.status}, age: ${Math.round(age / 1000)}s, max: ${Math.round(maxAge / 1000)}s)`)
      closeRoom(room, 'انتهت مهلة عدم النشاط')
    }
  }
}, 30 * 1000)

io.on('connection', (socket: Socket) => {
  console.log(`✅ Player connected: ${socket.id}`)
  socket.emit('connected', { id: socket.id })

  // Get public rooms
  socket.on('get-public-rooms', () => {
    const publicRooms = Array.from(rooms.values())
      .filter(r => r.isPublic && r.status === 'lobby')
      .map(r => ({
        code: r.code,
        hostName: r.players.find(p => p.id === r.hostId)?.name || 'غير معروف',
        playerCount: r.players.length,
        settings: r.settings,
        createdAt: r.createdAt,
        teamCount: r.settings.playType === 'teams' ? {
          teamA: r.players.filter(p => p.teamId === 'A').length,
          teamB: r.players.filter(p => p.teamId === 'B').length
        } : undefined
      }))
    socket.emit('public-rooms', { rooms: publicRooms })
  })

  // Get categories
  socket.on('get-categories', () => {
    socket.emit('categories', { categories: quizCategories })
  })

  // Create room
  socket.on('create-room', (data: {
    playerName: string
    isPublic: boolean
    settings: RoomSettings
  }) => {
    const { playerName, isPublic, settings } = data
    console.log(`Creating quiz room for ${playerName} with playType: ${settings?.playType || 'solo'}`)

    const existingRoomCode = playerRooms.get(socket.id)
    if (existingRoomCode) {
      const existingRoom = rooms.get(existingRoomCode)
      if (existingRoom) {
        removePlayerFromRoom(socket.id, socket, 'leave')
      }
    }

    const code = generateRoomCode()
    const playerId = socket.id
    
    const playType = settings?.playType || 'solo'
    
    // Default team assignment for teams mode
    const defaultTeamId: 'A' | 'B' = playType === 'teams' ? 'A' : undefined

    const player: Player = {
      id: playerId,
      name: playerName,
      score: 0,
      matchScore: 0,
      isHost: true,
      isReady: true,
      hasAnswered: false,
      answer: null,
      timeTaken: 0,
      joinedAt: Date.now(),
      correctStreak: 0,
      answerRank: 0,
      correctThisRound: false,
      socketId: socket.id,
      teamId: defaultTeamId
    }

    const now = Date.now()
    const room: Room = {
      code,
      isPublic,
      hostId: playerId,
      settings: {
        categoryId: settings?.categoryId || 'general',
        mode: settings?.mode || 'relaxed',
        roundsTotal: settings?.roundsTotal || 10,
        timePerRound: settings?.timePerRound || 30,
        playType
      },
      status: 'lobby',
      currentRound: 0,
      players: [player],
      currentQuestion: null,
      roundStartedAt: null,
      roundEndsAt: null,
      previousQuestions: [],
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      teams: [
        { id: 'A', name: 'الفريق أ', color: '#22C55E' },
        { id: 'B', name: 'الفريق ب', color: '#F59E0B' }
      ]
    }

    rooms.set(code, room)
    playerRooms.set(playerId, code)
    socketToPlayer.set(socket.id, playerId)
    socket.join(code)

    socket.emit('room-created', { room })
    emitPublicRooms()
    console.log(`✅ Quiz room ${code} created by ${playerName} (${playType} mode)`)
  })

  // Join room
  socket.on('join-room', (data: {
    roomCode: string
    playerName: string
    teamId?: 'A' | 'B'
  }) => {
    const { roomCode, playerName, teamId } = data
    console.log(`${playerName} trying to join quiz room ${roomCode}`)

    const existingRoomCode = playerRooms.get(socket.id)
    if (existingRoomCode) {
      removePlayerFromRoom(socket.id, socket, 'leave')
    }

    const room = rooms.get(roomCode.toUpperCase())
    if (!room) {
      socket.emit('error', { message: 'الغرفة مش موجودة' })
      return
    }

    if (room.status !== 'lobby') {
      socket.emit('error', { message: 'اللعبة بدأت بالفعل' })
      return
    }

    if (room.players.length >= 8) {
      socket.emit('error', { message: 'الغرفة ممتلئة' })
      return
    }

    const playerId = socket.id
    
    // Determine team assignment
    let assignedTeamId: 'A' | 'B' | undefined
    if (room.settings.playType === 'teams') {
      if (teamId) {
        assignedTeamId = teamId
      } else {
        // Auto-assign to team with fewer players
        const teamACount = room.players.filter(p => p.teamId === 'A').length
        const teamBCount = room.players.filter(p => p.teamId === 'B').length
        assignedTeamId = teamACount <= teamBCount ? 'A' : 'B'
      }
    }

    const player: Player = {
      id: playerId,
      name: playerName,
      score: 0,
      matchScore: 0,
      isHost: false,
      isReady: true,
      hasAnswered: false,
      answer: null,
      timeTaken: 0,
      joinedAt: Date.now(),
      correctStreak: 0,
      answerRank: 0,
      correctThisRound: false,
      socketId: socket.id,
      teamId: assignedTeamId
    }

    room.players.push(player)
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    playerRooms.set(playerId, roomCode)
    socketToPlayer.set(socket.id, playerId)
    socket.join(roomCode)

    socket.emit('room-joined', { room })
    emitRoomUpdate(room)
    emitPublicRooms()
    console.log(`✅ ${playerName} joined quiz room ${roomCode} ${assignedTeamId ? `(Team ${assignedTeamId})` : ''}`)
  })

  // Switch team
  socket.on('switch-team', (data: { teamId: 'A' | 'B' }) => {
    const room = getRoomForPlayer(socket.id)
    if (!room) return
    if (room.status !== 'lobby') return
    if (room.settings.playType !== 'teams') return

    const player = room.players.find(p => p.id === socket.id)
    if (!player) return

    const { teamId } = data
    player.teamId = teamId
    
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    
    emitRoomUpdate(room)
    emitPublicRooms()
    console.log(`Player ${player.name} switched to Team ${teamId} in room ${room.code}`)
  })

  // Update team name (host only)
  socket.on('update-team-name', (data: { teamId: 'A' | 'B'; name: string }) => {
    const room = getRoomForPlayer(socket.id)
    if (!room || room.hostId !== socket.id) return
    if (room.status !== 'lobby') return
    if (room.settings.playType !== 'teams') return

    const team = room.teams.find(t => t.id === data.teamId)
    if (team) {
      team.name = data.name.substring(0, 20) // Limit name length
      const now = Date.now()
      room.updatedAt = now
      room.lastActivityAt = now
      emitRoomUpdate(room)
    }
  })

  // Leave room
  socket.on('leave-room', () => {
    const playerId = socket.id
    console.log(`Player ${playerId} leaving quiz room (explicit leave)`)

    const result = removePlayerFromRoom(playerId, socket, 'leave')
    if (result) {
      socket.emit('room-left', { roomCode: playerRooms.get(playerId) || result.player?.id })
    }
  })

  // Update settings
  socket.on('update-settings', (data: { settings: Partial<RoomSettings> }) => {
    const room = getRoomForPlayer(socket.id)
    if (!room || room.hostId !== socket.id) return
    if (room.status !== 'lobby') return

    console.log(`Updating settings for quiz room ${room.code}`)
    room.settings = { ...room.settings, ...data.settings }
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    emitRoomUpdate(room)
  })

  // Start game
  socket.on('start-game', async () => {
    const room = getRoomForPlayer(socket.id)
    if (!room || room.hostId !== socket.id) return
    if (room.status !== 'lobby') return

    // For teams mode, check each team has at least 1 player
    if (room.settings.playType === 'teams') {
      const teamACount = room.players.filter(p => p.teamId === 'A').length
      const teamBCount = room.players.filter(p => p.teamId === 'B').length
      
      if (teamACount < 1 || teamBCount < 1) {
        socket.emit('error', { message: 'كل فريق لازم يكون فيه لاعب واحد على الأقل' })
        return
      }
    } else {
      if (room.players.length < 2) {
        socket.emit('error', { message: 'لازم لاعبين على الأقل' })
        return
      }
    }

    console.log(`Starting quiz game in room ${room.code}`)

    const question = await generateQuestion(room.settings.categoryId, room.previousQuestions)
    const now = Date.now()

    room.currentQuestion = question
    room.previousQuestions.push(question.question)
    room.currentRound = 1
    room.status = 'running'
    room.roundStartedAt = now
    room.roundEndsAt = now + room.settings.timePerRound * 1000
    room.updatedAt = now
    room.lastActivityAt = now

    for (const player of room.players) {
      player.matchScore = 0
      player.hasAnswered = false
      player.answer = null
      player.timeTaken = 0
      player.correctStreak = 0
      player.answerRank = 0
      player.correctThisRound = false
    }

    emitRoomUpdate(room)
    emitPublicRooms()
    console.log(`✅ Quiz game started in room ${room.code}`)
  })

  // Submit answer
  socket.on('submit-answer', async (data: { answer: string }) => {
    const room = getRoomForPlayer(socket.id)
    if (!room || room.status !== 'running' || !room.currentQuestion) return

    const player = room.players.find(p => p.id === socket.id)
    if (!player || player.hasAnswered) return

    const now = Date.now()
    const timeTaken = room.roundStartedAt ? now - room.roundStartedAt : 0

    player.answer = data.answer
    player.timeTaken = timeTaken
    player.hasAnswered = true

    const isCorrect = checkAnswer(data.answer, room.currentQuestion.answer)
    player.correctThisRound = isCorrect
    
    if (isCorrect) {
      player.correctStreak += 1
    } else {
      player.correctStreak = 0
    }

    const answeredPlayers = room.players.filter(p => p.hasAnswered)
    const correctPlayers = answeredPlayers.filter(p => checkAnswer(p.answer || '', room.currentQuestion!.answer))
    
    correctPlayers.sort((a, b) => a.timeTaken - b.timeTaken)
    const playerRank = correctPlayers.findIndex(p => p.id === player.id) + 1
    
    const points = calculatePoints(room, player, isCorrect, correctPlayers, playerRank)
    player.matchScore += points
    player.answerRank = playerRank
    room.updatedAt = now
    room.lastActivityAt = now

    // Include team scores for team mode
    const teamScores = room.settings.playType === 'teams' ? calculateTeamScores(room) : undefined

    socket.emit('answer-result', {
      isCorrect,
      points,
      correctAnswer: room.currentQuestion.answer,
      playerScore: player.matchScore,
      streak: player.correctStreak,
      rank: playerRank,
      teamScores
    })

    emitRoomUpdate(room)

    const allAnswered = room.players.every(p => p.hasAnswered)
    if (allAnswered) {
      setTimeout(() => {
        if (room.status === 'running') {
          advanceToNextRound(room)
        }
      }, 2000)
    }
  })

  // Next round
  socket.on('next-round', async () => {
    const room = getRoomForPlayer(socket.id)
    if (!room || room.hostId !== socket.id) return
    if (room.status !== 'running') return

    advanceToNextRound(room)
  })

  // Play again
  socket.on('play-again', () => {
    const room = getRoomForPlayer(socket.id)
    if (!room || room.hostId !== socket.id) return

    console.log(`Playing again in quiz room ${room.code}`)
    room.status = 'lobby'
    room.currentRound = 0
    room.currentQuestion = null
    room.roundStartedAt = null
    room.roundEndsAt = null
    room.previousQuestions = []
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now

    for (const player of room.players) {
      player.matchScore = 0
      player.hasAnswered = false
      player.answer = null
      player.timeTaken = 0
      player.isReady = true
      player.correctStreak = 0
      player.answerRank = 0
      player.correctThisRound = false
    }

    emitRoomUpdate(room)
    emitPublicRooms()
  })

  // Disconnect
  socket.on('disconnect', (reason) => {
    const playerId = socket.id
    console.log(`❌ Player disconnected: ${playerId}, reason: ${reason}`)

    removePlayerFromRoom(playerId, socket, 'disconnect')
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

// Advance to next round
async function advanceToNextRound(room: Room) {
  console.log(`Advancing to next round in room ${room.code}`)

  if (room.currentRound >= room.settings.roundsTotal) {
    room.status = 'ended'
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    
    const sortedPlayers = [...room.players].sort((a, b) => b.matchScore - a.matchScore)
    
    let winner = null
    let winningTeamId: 'A' | 'B' | null = null
    let teamScores: { teamA: number; teamB: number } | undefined
    
    if (room.settings.playType === 'teams') {
      teamScores = calculateTeamScores(room)
      winningTeamId = teamScores.teamA >= teamScores.teamB ? 'A' : 'B'
      
      // Best player per team
      const bestPlayers = getBestPlayerPerTeam(room)
      
      // Find the winner (best player from winning team)
      winner = winningTeamId === 'A' ? bestPlayers.teamA : bestPlayers.teamB
      
      // Award experience to winning team members
      room.players.forEach(p => {
        if (p.teamId === winningTeamId) {
          p.score += p.matchScore
        }
      })
    } else {
      winner = sortedPlayers[0]
      if (winner) {
        winner.score += winner.matchScore
      }
    }
    
    io.to(room.code).emit('game-ended', {
      room,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        matchScore: winner.matchScore,
        totalScore: winner.score,
        teamId: winner.teamId
      } : null,
      winningTeamId,
      teamScores,
      bestPlayersPerTeam: room.settings.playType === 'teams' ? {
        teamA: getBestPlayerPerTeam(room).teamA ? {
          id: getBestPlayerPerTeam(room).teamA!.id,
          name: getBestPlayerPerTeam(room).teamA!.name,
          matchScore: getBestPlayerPerTeam(room).teamA!.matchScore
        } : null,
        teamB: getBestPlayerPerTeam(room).teamB ? {
          id: getBestPlayerPerTeam(room).teamB!.id,
          name: getBestPlayerPerTeam(room).teamB!.name,
          matchScore: getBestPlayerPerTeam(room).teamB!.matchScore
        } : null
      } : undefined,
      leaderboard: sortedPlayers.map(p => ({
        id: p.id,
        name: p.name,
        matchScore: p.matchScore,
        isWinner: p.id === winner?.id,
        teamId: p.teamId
      }))
    })
    
    emitRoomUpdate(room)
    return
  }

  const question = await generateQuestion(room.settings.categoryId, room.previousQuestions)
  const now = Date.now()

  room.currentQuestion = question
  room.previousQuestions.push(question.question)
  room.currentRound++
  room.roundStartedAt = now
  room.roundEndsAt = now + room.settings.timePerRound * 1000
  room.updatedAt = now
  room.lastActivityAt = now

  for (const player of room.players) {
    player.hasAnswered = false
    player.answer = null
    player.timeTaken = 0
    player.correctThisRound = false
    player.answerRank = 0
  }

  emitRoomUpdate(room)
}

const PORT = 3004
httpServer.listen(PORT, () => {
  console.log(`🎮 Quiz Game server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('Quiz Game server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('Quiz Game server closed')
    process.exit(0)
  })
})
