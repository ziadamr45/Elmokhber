import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  // Faster disconnect detection - detect disconnection within 10 seconds
  pingTimeout: 10000,
  pingInterval: 5000,
  allowEIO3: true,
})

// Session verification helper
async function verifySession(sessionToken: string): Promise<{ valid: boolean; userId?: string }> {
  if (!sessionToken) {
    return { valid: false }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { sessionToken },
      select: { id: true, sessionExpiry: true },
    })

    if (!user) {
      return { valid: false }
    }

    // Check if session is expired
    if (user.sessionExpiry && new Date() > user.sessionExpiry) {
      return { valid: false }
    }

    return { valid: true, userId: user.id }
  } catch (error) {
    console.error('[Session] Error verifying session:', error)
    return { valid: false }
  }
}

// Map socketId to sessionToken for verification
const socketSessions = new Map<string, string>()

// Smart text comparison functions
function normalizeArabic(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Normalize Arabic characters
    .replace(/[آإأ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    // Remove diacritics
    .replace(/[\u064B-\u065F]/g, '')
    // Remove all spaces and punctuation
    .replace(/[\s\-\_\.]/g, '')
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Calculate similarity percentage
function similarity(a: string, b: string): number {
  const normalizedA = normalizeArabic(a)
  const normalizedB = normalizeArabic(b)
  
  if (normalizedA === normalizedB) return 1
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0
  
  const distance = levenshteinDistance(normalizedA, normalizedB)
  const maxLength = Math.max(normalizedA.length, normalizedB.length)
  
  return 1 - distance / maxLength
}

// Common variations for Arabic words
const COMMON_VARIATIONS: Record<string, string[]> = {
  // Countries
  'كندا': ['كنده', 'كند', 'canada'],
  'مصر': ['مصريه', 'مصرية', 'egypt'],
  'السعودية': ['سعوديه', 'سعودية', 'السعوديه', 'saudi'],
  'الإمارات': ['امارات', 'الامارات', 'emirates', 'uae'],
  'فلسطين': ['فلسطني', 'palestine'],
  'الأردن': ['اردن', 'الاردن', 'jordan'],
  // Cities
  'القاهرة': ['قاهره', 'قاهرة', 'القاهره', 'cairo'],
  'الرياض': ['رياض', 'الرياظ', 'riyadh'],
  'دبي': ['دباي', 'dubai'],
  'جدة': ['جده', 'jeddah'],
  'مكة': ['مكه', 'mecca'],
  'المدينة': ['مدينه', 'madinah', 'medina'],
  // Tech
  'اتش بي': ['إتش بي', 'hp', 'h.p', 'اتشبي'],
  'آبل': ['ابل', 'apple', 'أبل'],
  'مايكروسوفت': ['microsoft', 'ms'],
  'جوجل': ['google'],
  // Food
  'كباب': ['كباب'],
  'شاورما': ['شاورمه', 'shawarma'],
  'فلافل': ['فلافيل', 'falafel'],
  'حمص': ['hummus'],
}

// Smart check if guess matches answer
function isCorrectGuess(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeArabic(guess)
  const normalizedAnswer = normalizeArabic(answer)
  
  // Direct match after normalization
  if (normalizedGuess === normalizedAnswer) return true
  
  // Check known variations
  for (const [correct, variations] of Object.entries(COMMON_VARIATIONS)) {
    const normalizedCorrect = normalizeArabic(correct)
    if (normalizedCorrect === normalizedAnswer || normalizedCorrect === normalizedGuess) {
      if (variations.some(v => normalizeArabic(v) === normalizedGuess || normalizeArabic(v) === normalizedAnswer)) {
        return true
      }
    }
  }
  
  // Check both directions in variations
  for (const [correct, variations] of Object.entries(COMMON_VARIATIONS)) {
    const allVariants = [correct, ...variations].map(v => normalizeArabic(v))
    if (allVariants.includes(normalizedGuess) && allVariants.includes(normalizedAnswer)) {
      return true
    }
  }
  
  // Fuzzy matching - accept if 70% similar
  const similarityScore = similarity(guess, answer)
  return similarityScore >= 0.7
}

// Types
interface TitleInfo {
  title: string
  level: number
  color: string
  icon: string
}

interface Player {
  id: string
  name: string
  isHost: boolean
  isReady: boolean
  joinedAt: number
  viewedRole: boolean
  voteFor: string | null
  gold: number
  titleInfo?: TitleInfo
  socketId: string
  disconnected?: boolean // Track if player disconnected
  disconnectedAt?: number // When they disconnected
}

// Title system constants - synced with frontend
const PLAYER_TITLES = [
  { minXP: 0, maxXP: 99, title: 'مبتدئ', level: 1, color: '#9CA3AF', icon: '🌱' },
  { minXP: 100, maxXP: 299, title: 'لاعب عادي', level: 2, color: '#22C55E', icon: '🎮' },
  { minXP: 300, maxXP: 699, title: 'محترف', level: 3, color: '#3B82F6', icon: '⭐' },
  { minXP: 700, maxXP: 1499, title: 'خبير', level: 4, color: '#A855F7', icon: '👑' },
  { minXP: 1500, maxXP: Infinity, title: 'أسطورة', level: 5, color: '#F59E0B', icon: '🔥' },
]

function getTitleFromXP(totalXP: number): TitleInfo {
  const titleInfo = PLAYER_TITLES.find(t => totalXP >= t.minXP && totalXP <= t.maxXP) || PLAYER_TITLES[0]
  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    icon: titleInfo.icon,
  }
}

type GameModeType = 'classic' | 'double-spies' | 'reversed' | 'silent'

interface GameSettings {
  spyCount: number
  gameTime: number
  categoryId: string
  gameMode: GameModeType
}

interface Game {
  id: string
  categoryId: string
  secretWord: string
  spyIds: string[]
  gameMode: GameModeType
  partnerSpyId?: string | null
  knowerId?: string | null
  startedAt: number
  endsAt: number
  voteOpen: boolean
  winner: 'spies' | 'citizens' | null
  finishedReason: string | null
  endedAt: number | null
  guessHistory: Array<{
    playerId: string
    playerName: string
    guess: string
    success: boolean
    at: number
  }>
}

interface Room {
  code: string
  isPublic: boolean
  hostId: string
  createdAt: number
  updatedAt: number
  lastActivityAt: number
  status: 'lobby' | 'running' | 'ended'
  settings: GameSettings
  players: Player[]
  game: Game | null
}

interface PublicRoom {
  code: string
  hostName: string
  playerCount: number
  settings: GameSettings
  createdAt: number
}

// Storage
const rooms = new Map<string, Room>()
const playerRooms = new Map<string, string>() // playerId -> roomCode
const socketToPlayer = new Map<string, { playerId: string, roomCode: string }>() // socketId -> { playerId, roomCode }
const backgroundTimers = new Map<string, { timer: NodeJS.Timeout, playerId: string, roomCode: string }>() // socketId -> timer info

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

const categories = [
  { id: 'places', name: 'أماكن', icon: '📍' },
  { id: 'countries', name: 'دول', icon: '🌍' },
  { id: 'jobs', name: 'وظائف', icon: '💼' },
  { id: 'food', name: 'أكل', icon: '🍽️' },
  { id: 'sports', name: 'رياضة', icon: '⚽' },
  { id: 'movies', name: 'أفلام', icon: '🎬' },
  { id: 'random', name: 'مفاجأة', icon: '🎲' },
]

const categoryWords: Record<string, string[]> = {
  places: ['ملعب', 'مسرح', 'سينما', 'نادي', 'كافيه', 'مكتبة', 'سوق', 'مدرسة', 'محطة قطار', 'فندق', 'مطعم', 'جامعة', 'بنك', 'مطار', 'مستشفى'],
  countries: ['الجزائر', 'تونس', 'فلسطين', 'سوريا', 'العراق', 'عمان', 'البحرين', 'الكويت', 'قطر', 'لبنان', 'الأردن', 'المغرب', 'الإمارات', 'السعودية', 'مصر'],
  jobs: ['حداد', 'نجار', 'حلاق', 'موسيقار', 'رسام', 'صحفي', 'محاسب', 'مبرمج', 'طباخ', 'شرطي', 'طيار', 'معلم', 'محامي', 'مهندس', 'طبيب'],
  food: ['فراخ مشوية', 'سمك', 'برياني', 'مندي', 'ورق عنب', 'محشي', 'جبنة', 'طعمية', 'فتة', 'مقلوبة', 'ملوخية', 'كباب', 'شاورما', 'فلافل', 'كشري'],
  sports: ['رمياية', 'فروسية', 'جودو', 'مصارعة', 'غولف', 'هوكي', 'كرة طائرة', 'جماز', 'ملاكمة', 'كاراتيه', 'جري', 'سباحة', 'تنس', 'كرة السلة', 'كرة القدم'],
  movies: ['تاريخي', 'رومانسي', 'خيال علمي', 'إثارة', 'رعب', 'كوميديا', 'قصة حب', 'رحلة', 'النهاية', 'البداية', 'الأبطال', 'الجريمة والعقاب', 'فروستنيت', 'الأمير الصغير', 'التيتانيك'],
  random: []
}

const getSecretWord = (categoryId: string): string => {
  if (categoryId === 'random') {
    const allWords = Object.values(categoryWords).flat()
    return allWords[Math.floor(Math.random() * allWords.length)]
  }
  const words = categoryWords[categoryId] || categoryWords.places
  return words[Math.floor(Math.random() * words.length)]
}

const shuffleArray = <T>(items: T[]): T[] => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const assignSpyIds = (playerIds: string[], spyCount: number): string[] => {
  return shuffleArray(playerIds).slice(0, spyCount)
}

// Role assignment based on game mode
interface RoleAssignment {
  spyIds: string[]
  partnerSpyId: string | null
  knowerId: string | null
}

const assignRolesByMode = (playerIds: string[], gameMode: GameModeType): RoleAssignment => {
  const shuffled = shuffleArray(playerIds)
  
  switch (gameMode) {
    case 'classic':
    case 'silent': {
      const spyId = shuffled[0]
      return { spyIds: [spyId], partnerSpyId: null, knowerId: null }
    }
    case 'double-spies': {
      const spy1 = shuffled[0]
      const spy2 = shuffled[1]
      return { 
        spyIds: [spy1, spy2], 
        partnerSpyId: spy2, 
        knowerId: null 
      }
    }
    case 'reversed': {
      const knowerId = shuffled[0]
      const spyIds = playerIds.filter(id => id !== knowerId)
      return { spyIds, partnerSpyId: null, knowerId }
    }
    default:
      return { spyIds: [shuffled[0]], partnerSpyId: null, knowerId: null }
  }
}

const getRoomForPlayer = (playerId: string): Room | null => {
  const roomCode = playerRooms.get(playerId)
  if (!roomCode) return null
  return rooms.get(roomCode) || null
}

const emitRoomUpdate = (room: Room) => {
  console.log(`📡 Emitting room update for ${room.code}, status: ${room.status}, players: ${room.players.length}`)
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
      createdAt: r.createdAt
    }))
  console.log(`📡 Emitting public rooms, count: ${publicRooms.length}`)
  io.emit('public-rooms', { rooms: publicRooms })
}

// Emit player left event to all other players in room
const emitPlayerLeft = (room: Room, leftPlayer: Player, reason: 'leave' | 'disconnect') => {
  console.log(`📡 Emitting player-left: ${leftPlayer.name} from room ${room.code}`)
  io.to(room.code).emit('player-left', { 
    playerId: leftPlayer.id,
    playerName: leftPlayer.name,
    reason,
    room
  })
}

// Close room and notify all players
const closeRoom = (room: Room, reason: string) => {
  console.log(`🔒 Closing room ${room.code}, reason: ${reason}`)
  
  // Notify all players in the room
  io.to(room.code).emit('room-closed', { 
    roomCode: room.code, 
    reason 
  })
  
  // Make all sockets leave the room
  const sockets = io.sockets.adapter.rooms.get(room.code)
  if (sockets) {
    sockets.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.leave(room.code)
      }
    })
  }
  
  // Clean up player mappings
  for (const player of room.players) {
    playerRooms.delete(player.id)
    socketToPlayer.delete(player.socketId)
  }
  
  // Delete room
  rooms.delete(room.code)
  
  // Update public rooms list
  emitPublicRooms()
  
  console.log(`✅ Room ${room.code} closed and cleaned up`)
}

// Remove player from room completely
const removePlayerFromRoom = (playerId: string, socket: Socket, reason: 'leave' | 'disconnect' = 'disconnect'): { room: Room | null, player: Player | null, roomClosed: boolean } => {
  const mapping = socketToPlayer.get(socket.id)
  if (!mapping) return { room: null, player: null, roomClosed: false }
  
  const { roomCode } = mapping
  const room = rooms.get(roomCode)
  
  if (!room) {
    socketToPlayer.delete(socket.id)
    playerRooms.delete(playerId)
    return { room: null, player: null, roomClosed: false }
  }
  
  const playerIndex = room.players.findIndex(p => p.id === playerId)
  if (playerIndex === -1) {
    socketToPlayer.delete(socket.id)
    playerRooms.delete(playerId)
    return { room: null, player: null, roomClosed: false }
  }
  
  const player = room.players[playerIndex]
  const wasHost = room.hostId === playerId
  
  // Remove player from room
  room.players.splice(playerIndex, 1)
  playerRooms.delete(playerId)
  socketToPlayer.delete(socket.id)
  socket.leave(roomCode)
  
  console.log(`👋 Player ${player.name} removed from room ${roomCode}, reason: ${reason}`)
  
  // If room is empty, delete it immediately
  if (room.players.length === 0) {
    rooms.delete(roomCode)
    emitPublicRooms()
    console.log(`🗑️ Room ${roomCode} deleted (empty)`)
    return { room: null, player, roomClosed: true }
  }
  
  // If host left during running game, close the entire room
  if (wasHost && room.status === 'running') {
    closeRoom(room, 'صاحب الغرفة غادر أثناء اللعب')
    return { room: null, player, roomClosed: true }
  }
  
  // If host left in lobby or ended state, transfer ownership
  if (wasHost) {
    room.hostId = room.players[0].id
    room.players[0].isHost = true
    console.log(`👑 Host transferred to ${room.players[0].name} in room ${roomCode}`)
  }
  
  // Update activity and emit changes
  room.updatedAt = Date.now()
  room.lastActivityAt = Date.now()
  
  // Emit player left event BEFORE room update
  emitPlayerLeft(room, player, reason)
  emitRoomUpdate(room)
  emitPublicRooms()
  
  return { room, player, roomClosed: false }
}

// Clean up inactive rooms every 30 seconds
setInterval(() => {
  const now = Date.now()
  const endedRoomMaxAge = 5 * 60 * 1000 // 5 minutes for ended rooms
  const inactiveRoomMaxAge = 2 * 60 * 1000 // 2 minutes for inactive rooms
  const runningRoomMaxAge = 30 * 60 * 1000 // 30 minutes max for running games

  for (const [code, room] of rooms) {
    let maxAge = inactiveRoomMaxAge
    
    if (room.status === 'ended') {
      maxAge = endedRoomMaxAge
    } else if (room.status === 'running') {
      maxAge = runningRoomMaxAge
    }
    
    // Use lastActivityAt for more accurate activity tracking
    const lastActive = room.lastActivityAt || room.updatedAt
    const age = now - lastActive
    
    if (age > maxAge) {
      console.log(`🧹 Cleaning up room ${code} (status: ${room.status}, age: ${Math.round(age / 1000)}s, max: ${Math.round(maxAge / 1000)}s)`)
      closeRoom(room, 'انتهت مهلة عدم النشاط')
    }
  }
}, 30 * 1000) // Check every 30 seconds

io.on('connection', (socket: Socket) => {
  console.log(``)
  console.log(`========================================`)
  console.log(`✅ NEW SOCKET CONNECTION`)
  console.log(`Socket ID: ${socket.id}`)
  console.log(`Transport: ${socket.conn?.transport?.name}`)
  console.log(`Handshake Query:`, socket.handshake.query)
  console.log(`Handshake Auth:`, socket.handshake.auth ? 'Present' : 'None')
  console.log(`Headers:`, {
    origin: socket.handshake.headers.origin,
    'user-agent': socket.handshake.headers['user-agent']?.substring(0, 50),
  })
  console.log(`========================================`)

  // Session authentication - must be done before any other actions
  socket.on('authenticate', async (data: { sessionToken?: string }) => {
    console.log(`🔑 [Auth] Authentication request from ${socket.id}`)
    const { sessionToken } = data
    
    if (!sessionToken) {
      console.log(`❌ [Auth] No session token provided for ${socket.id}`)
      socket.emit('auth-error', { 
        reason: 'لم يتم توفير رمز الجلسة',
        sessionInvalid: true 
      })
      socket.disconnect(true)
      return
    }

    console.log(`🔑 [Auth] Verifying session for ${socket.id}...`)
    const session = await verifySession(sessionToken)
    
    if (!session.valid) {
      console.log(`❌ [Auth] Invalid session for ${socket.id}`)
      socket.emit('auth-error', { 
        reason: 'تم تسجيل الدخول من جهاز آخر',
        sessionInvalid: true 
      })
      socket.disconnect(true)
      return
    }

    // Store session token for this socket
    socketSessions.set(socket.id, sessionToken)
    console.log(`✅ [Auth] Session verified for ${socket.id}, userId: ${session.userId}`)
    
    // Send connection confirmation
    socket.emit('connected', { id: socket.id, authenticated: true })
    console.log(`✅ [Auth] Sent 'connected' event to ${socket.id}`)
  })

  // Timeout for authentication
  const authTimeout = setTimeout(() => {
    if (!socketSessions.has(socket.id)) {
      console.log(`⏰ [Auth] Authentication timeout for ${socket.id}`)
      socket.emit('auth-error', { 
        reason: 'انتهت مهلة المصادقة',
        sessionInvalid: true 
      })
      socket.disconnect(true)
    }
  }, 10000) // 10 seconds to authenticate

  socket.on('disconnect', () => {
    clearTimeout(authTimeout)
    socketSessions.delete(socket.id)
  })

  // Get public rooms
  socket.on('get-public-rooms', () => {
    console.log(`📋 Player ${socket.id} requested public rooms`)
    const publicRooms = Array.from(rooms.values())
      .filter(r => r.isPublic && r.status === 'lobby')
      .map(r => ({
        code: r.code,
        hostName: r.players.find(p => p.id === r.hostId)?.name || 'غير معروف',
        playerCount: r.players.length,
        settings: r.settings,
        createdAt: r.createdAt
      }))
    socket.emit('public-rooms', { rooms: publicRooms })
  })

  // Create room
  socket.on('create-room', (data: {
    playerName: string
    isPublic: boolean
    settings: GameSettings
    playerGold?: number
  }) => {
    const { playerName, isPublic, settings, playerGold = 0 } = data
    console.log(`🏠 Creating room for ${playerName}, public: ${isPublic}`)

    // Check if player is already in a room
    const existingMapping = socketToPlayer.get(socket.id)
    if (existingMapping) {
      const existingRoom = rooms.get(existingMapping.roomCode)
      if (existingRoom) {
        // Remove from existing room first
        removePlayerFromRoom(existingMapping.playerId, socket, 'leave')
      }
    }

    const code = generateRoomCode()
    const playerId = generateId()

    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: true,
      isReady: true,
      joinedAt: Date.now(),
      viewedRole: false,
      voteFor: null,
      gold: playerGold,
      titleInfo: getTitleFromXP(playerGold),
      socketId: socket.id
    }

    const now = Date.now()
    const room: Room = {
      code,
      isPublic,
      hostId: playerId,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      status: 'lobby',
      settings,
      players: [player],
      game: null
    }

    rooms.set(code, room)
    playerRooms.set(playerId, code)
    socketToPlayer.set(socket.id, { playerId, roomCode: code })

    socket.join(code)
    socket.emit('room-created', { room, playerId })
    emitPublicRooms()

    console.log(`✅ Room ${code} created by ${playerName}`)
  })

  // Join room
  socket.on('join-room', (data: {
    roomCode: string
    playerName: string
    playerGold?: number
  }) => {
    const { roomCode, playerName, playerGold = 0 } = data
    console.log(`🚪 ${playerName} trying to join room ${roomCode}`)

    // Check if player is already in a room
    const existingMapping = socketToPlayer.get(socket.id)
    if (existingMapping) {
      // Leave existing room first
      removePlayerFromRoom(existingMapping.playerId, socket, 'leave')
    }

    const room = rooms.get(roomCode.toUpperCase())
    if (!room) {
      console.log(`❌ Room ${roomCode} not found`)
      socket.emit('error', { message: 'الغرفة مش موجودة' })
      return
    }

    if (room.status !== 'lobby') {
      console.log(`❌ Room ${roomCode} is not in lobby`)
      socket.emit('error', { message: 'اللعبة بدأت بالفعل' })
      return
    }

    if (room.players.length >= 12) {
      console.log(`❌ Room ${roomCode} is full`)
      socket.emit('error', { message: 'الغرفة ممتلئة' })
      return
    }

    const playerId = generateId()
    const player: Player = {
      id: playerId,
      name: playerName,
      isHost: false,
      isReady: true,
      joinedAt: Date.now(),
      viewedRole: false,
      voteFor: null,
      gold: playerGold,
      titleInfo: getTitleFromXP(playerGold),
      socketId: socket.id
    }

    room.players.push(player)
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    playerRooms.set(playerId, roomCode.toUpperCase())
    socketToPlayer.set(socket.id, { playerId, roomCode: roomCode.toUpperCase() })

    socket.join(roomCode.toUpperCase())
    socket.emit('room-joined', { room, playerId })
    
    // Emit player joined event to others
    socket.to(roomCode.toUpperCase()).emit('player-joined', { player, room })
    
    emitRoomUpdate(room)
    emitPublicRooms()

    console.log(`✅ ${playerName} joined room ${roomCode}`)
  })

  // Leave room
  socket.on('leave-room', () => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    console.log(`🚪 Player ${mapping.playerId} leaving room (explicit leave)`)
    removePlayerFromRoom(mapping.playerId, socket, 'leave')
    socket.emit('room-left', { roomCode: mapping.roomCode })
  })

  // Update settings
  socket.on('update-settings', (data: { settings: GameSettings }) => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || room.hostId !== mapping.playerId) return
    if (room.status !== 'lobby') return

    console.log(`⚙️ Updating settings for room ${room.code}`)
    room.settings = data.settings
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    emitRoomUpdate(room)
  })

  // Start game
  socket.on('start-game', () => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || room.hostId !== mapping.playerId) return
    if (room.status !== 'lobby') return

    const minPlayers = room.settings.gameMode === 'double-spies' ? 4 : 3
    if (room.players.length < minPlayers) {
      socket.emit('error', { message: `لازم لا يقل عن ${minPlayers} لاعبين على الأقل` })
      return
    }

    console.log(`🎮 Starting game in room ${room.code}, mode: ${room.settings.gameMode}`)

    const playerIds = room.players.map(p => p.id)
    const roles = assignRolesByMode(playerIds, room.settings.gameMode)
    const secretWord = getSecretWord(room.settings.categoryId)
    const now = Date.now()

    room.game = {
      id: generateId(),
      categoryId: room.settings.categoryId,
      secretWord,
      spyIds: roles.spyIds,
      gameMode: room.settings.gameMode,
      partnerSpyId: roles.partnerSpyId,
      knowerId: roles.knowerId,
      startedAt: now,
      endsAt: now + room.settings.gameTime * 60 * 1000,
      voteOpen: false,
      winner: null,
      finishedReason: null,
      endedAt: null,
      guessHistory: []
    }

    room.status = 'running'
    room.updatedAt = now
    room.lastActivityAt = now

    // Reset player states
    for (const player of room.players) {
      player.viewedRole = false
      player.voteFor = null
    }

    emitRoomUpdate(room)
    emitPublicRooms()

    console.log(`✅ Game started in room ${room.code}, mode: ${room.settings.gameMode}, spies: ${roles.spyIds.length}, word: ${secretWord}`)
  })

  // Get role
  socket.on('get-role', () => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || !room.game) return

    const player = room.players.find(p => p.id === mapping.playerId)
    if (!player) return

    player.viewedRole = true
    room.lastActivityAt = Date.now()

    const isSpy = room.game.spyIds.includes(mapping.playerId)
    const isKnower = room.game.knowerId === mapping.playerId
    
    // For double-spies mode, include partner info
    let partnerSpyName: string | null = null
    if (room.game.gameMode === 'double-spies' && isSpy) {
      const partnerId = room.game.spyIds.find(id => id !== mapping.playerId)
      if (partnerId) {
        const partner = room.players.find(p => p.id === partnerId)
        partnerSpyName = partner?.name || null
      }
    }
    
    // For reversed mode, knower knows the word but is not a spy
    const playerIsKnower = room.game.gameMode === 'reversed' && isKnower
    
    console.log(`🎭 Player ${player.name} viewed role, isSpy: ${isSpy}, isKnower: ${playerIsKnower}`)

    socket.emit('role-revealed', {
      isSpy: isSpy && !playerIsKnower,
      isKnower: playerIsKnower,
      secretWord: (isSpy && !playerIsKnower) ? null : room.game.secretWord,
      partnerSpyName,
      gameMode: room.game.gameMode,
      category: categories.find(c => c.id === room.game?.categoryId)
    })

    emitRoomUpdate(room)
  })

  // Guess word (spy only)
  socket.on('guess-word', (data: { guess: string }) => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || !room.game || room.game.winner) return

    const player = room.players.find(p => p.id === mapping.playerId)
    if (!player) return

    // Only spies can guess
    if (!room.game.spyIds.includes(mapping.playerId)) {
      socket.emit('error', { message: 'أنت مش المخبر!' })
      return
    }

    const guess = data.guess.trim()
    const correct = isCorrectGuess(guess, room.game.secretWord)

    console.log(`🔮 Player ${player.name} guessed: ${guess}, correct: ${correct}`)

    room.game.guessHistory.push({
      playerId: mapping.playerId,
      playerName: player.name,
      guess,
      success: correct,
      at: Date.now()
    })

    if (correct) {
      room.game.winner = 'spies'
      room.game.finishedReason = `${player.name} خمن الكلمة صح!`
      room.game.endedAt = Date.now()
      room.status = 'ended'
    }

    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    emitRoomUpdate(room)
    socket.emit('guess-result', { success: correct })
  })

  // Vote for spy
  socket.on('vote-spy', (data: { playerId: string }) => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || !room.game || room.game.winner) return

    const player = room.players.find(p => p.id === mapping.playerId)
    if (!player) return

    player.voteFor = data.playerId
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now

    console.log(`🗳️ Player ${player.name} voted for ${data.playerId}`)
    emitRoomUpdate(room)
  })

  // Open voting
  socket.on('open-voting', () => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || !room.game) return

    console.log(`🗳️ Opening voting in room ${room.code}`)
    room.game.voteOpen = true
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now
    emitRoomUpdate(room)
  })

  // Calculate votes and end game
  socket.on('calculate-votes', () => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || !room.game || room.game.winner) return

    console.log(`🗳️ Calculating votes in room ${room.code}`)

    // Count votes
    const votes = new Map<string, number>()
    for (const player of room.players) {
      if (player.voteFor) {
        votes.set(player.voteFor, (votes.get(player.voteFor) || 0) + 1)
      }
    }

    // Find most voted
    let maxVotes = 0
    let mostVotedId: string | null = null
    let tie = false

    for (const [playerId, count] of votes) {
      if (count > maxVotes) {
        maxVotes = count
        mostVotedId = playerId
        tie = false
      } else if (count === maxVotes) {
        tie = true
      }
    }

    if (tie || !mostVotedId) {
      // Tie = spies win
      room.game.winner = 'spies'
      room.game.finishedReason = 'التصويت تعادل - المخبر كسب!'
    } else {
      // Check if voted player is a spy
      const isSpy = room.game.spyIds.includes(mostVotedId)
      const votedPlayer = room.players.find(p => p.id === mostVotedId)

      if (isSpy) {
        room.game.winner = 'citizens'
        room.game.finishedReason = `الناس كشفت المخبر: ${votedPlayer?.name}!`
      } else {
        room.game.winner = 'spies'
        room.game.finishedReason = `الناس اتهمت البريء: ${votedPlayer?.name}!`
      }
    }

    room.game.endedAt = Date.now()
    room.status = 'ended'
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now

    emitRoomUpdate(room)
    console.log(`🎮 Game ended in room ${room.code}, winner: ${room.game.winner}`)
  })

  // Play again
  socket.on('play-again', () => {
    const mapping = socketToPlayer.get(socket.id)
    if (!mapping) return
    
    const room = rooms.get(mapping.roomCode)
    if (!room || room.hostId !== mapping.playerId) return

    console.log(`🔄 Playing again in room ${room.code}`)

    room.status = 'lobby'
    room.game = null
    const now = Date.now()
    room.updatedAt = now
    room.lastActivityAt = now

    // Reset players
    for (const player of room.players) {
      player.viewedRole = false
      player.voteFor = null
      player.isReady = true
    }

    emitRoomUpdate(room)
    emitPublicRooms()
  })

  // Manual leave (from app going to background/closing)
  socket.on('manual-leave', () => {
    const mapping = socketToPlayer.get(socket.id)
    console.log(`🚪 Manual leave from ${socket.id}, hadRoom: ${!!mapping}`)
    
    // Cancel any pending background timer
    const bgTimer = backgroundTimers.get(socket.id)
    if (bgTimer) {
      clearTimeout(bgTimer.timer)
      backgroundTimers.delete(socket.id)
    }
    
    if (mapping) {
      removePlayerFromRoom(mapping.playerId, socket, 'leave')
    }
  })

  // User went to background (app minimized, tab switched, phone locked)
  // Start a grace period before removing them
  socket.on('going-background', () => {
    const mapping = socketToPlayer.get(socket.id)
    console.log(`📱 User ${socket.id} went to background`)
    
    if (mapping) {
      // Give user 30 seconds grace period to come back
      const timer = setTimeout(() => {
        console.log(`⏰ Grace period expired for ${socket.id} - removing from room`)
        const currentMapping = socketToPlayer.get(socket.id)
        if (currentMapping) {
          removePlayerFromRoom(currentMapping.playerId, socket, 'disconnect')
        }
        backgroundTimers.delete(socket.id)
      }, 30000) // 30 seconds grace period
      
      backgroundTimers.set(socket.id, { 
        timer, 
        playerId: mapping.playerId, 
        roomCode: mapping.roomCode 
      })
    }
  })

  // User came back to foreground
  socket.on('back-to-foreground', () => {
    console.log(`📱 User ${socket.id} came back to foreground`)
    
    // Cancel the background timer
    const bgTimer = backgroundTimers.get(socket.id)
    if (bgTimer) {
      clearTimeout(bgTimer.timer)
      backgroundTimers.delete(socket.id)
      console.log(`✅ Grace period cancelled for ${socket.id}`)
    }
  })

  // Disconnect
  socket.on('disconnect', (reason) => {
    const mapping = socketToPlayer.get(socket.id)
    console.log(`❌ Player disconnected: ${socket.id}, reason: ${reason}, hadRoom: ${!!mapping}`)
    
    // Cancel any pending background timer
    const bgTimer = backgroundTimers.get(socket.id)
    if (bgTimer) {
      clearTimeout(bgTimer.timer)
      backgroundTimers.delete(socket.id)
    }

    // Remove player from room
    if (mapping) {
      removePlayerFromRoom(mapping.playerId, socket, 'disconnect')
    }
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`🎮 Game Rooms server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('Game Rooms server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('Game Rooms server closed')
    process.exit(0)
  })
})
