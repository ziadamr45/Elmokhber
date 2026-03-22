import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

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
interface TitleInfo {
  title: string
  level: number
  color: string
  icon: string
}

interface OnlineUser {
  id: string
  name: string
  socketId: string
  connectedAt: number
  status: 'online' | 'away' | 'busy'
  title?: TitleInfo
}

interface Notification {
  id: string
  type: 'friend_request' | 'friend_accepted' | 'new_message' | 'room_invite'
  title: string
  content: string
  data?: any
  createdAt: number
}

interface Message {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  content: string
  createdAt: number
}

interface RoomMessage {
  id: string
  roomCode: string
  playerId: string
  playerName: string
  playerTitle?: TitleInfo | null
  content: string
  gameType: string
  createdAt: number
}

interface FriendRequest {
  id: string
  senderId: string
  senderName: string
  receiverId: string
  createdAt: number
}

// Storage
const onlineUsers = new Map<string, OnlineUser>() // userId -> OnlineUser
const userSockets = new Map<string, string>() // userId -> socketId
const socketUsers = new Map<string, string>() // socketId -> userId

// Helper functions
const generateId = (): string => {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// Get online friends for a user
function getOnlineFriends(userId: string): OnlineUser[] {
  // This is a simplified version. In a real app, you'd query the database for friends
  // For now, we just return all online users except the current user
  return Array.from(onlineUsers.values()).filter(u => u.id !== userId)
}

// Emit to specific user by userId
function emitToUser(userId: string, event: string, data: any) {
  const socketId = userSockets.get(userId)
  if (socketId) {
    io.to(socketId).emit(event, data)
    console.log(`[Emit] ${event} -> user:${userId} (socket: ${socketId})`)
    return true
  }
  console.log(`[Emit Failed] ${event} -> user:${userId} (user not online)`)
  return false
}

// Broadcast online users list
function broadcastOnlineUsers() {
  const users = Array.from(onlineUsers.values())
  io.emit('online-users', { users })
}

// Parse JSON body from request
async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// ==================== HTTP ENDPOINTS FOR INTERNAL API ====================

httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  // Skip Socket.io requests - let Socket.io handle them
  if (req.url?.startsWith('/socket.io/')) {
    return // Let Socket.io handle this request
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = req.url?.split('?')[0]

  // POST /notify/friend-request - Send friend request notification
  if (url === '/notify/friend-request' && req.method === 'POST') {
    try {
      const data = await parseBody(req)
      const { requestId, senderId, senderName, receiverId } = data

      console.log(`[HTTP] Friend request notification: ${senderName} -> ${receiverId}`)

      const notification: Notification = {
        id: generateId(),
        type: 'friend_request',
        title: 'طلب صداقة جديد',
        content: `${senderName} أرسل لك طلب صداقة`,
        data: { requestId, senderId },
        createdAt: Date.now()
      }

      const delivered = emitToUser(receiverId, 'notification', notification)
      emitToUser(receiverId, 'friend-request', {
        id: requestId,
        senderId,
        senderName,
        createdAt: Date.now()
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, delivered }))
    } catch (error) {
      console.error('[HTTP] Error in /notify/friend-request:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
    return
  }

  // POST /notify/friend-accepted - Notify sender that their request was accepted
  if (url === '/notify/friend-accepted' && req.method === 'POST') {
    try {
      const data = await parseBody(req)
      const { friendId, friendName, accepterId, accepterName } = data

      console.log(`[HTTP] Friend accepted notification: ${accepterName} accepted ${friendName}'s request`)

      const notification: Notification = {
        id: generateId(),
        type: 'friend_accepted',
        title: 'تم قبول طلب الصداقة',
        content: `${accepterName} قبل طلب صداقتك`,
        data: { friendId: accepterId },
        createdAt: Date.now()
      }

      const delivered = emitToUser(friendId, 'notification', notification)
      emitToUser(friendId, 'friend-accepted', {
        friendId: accepterId,
        friendName: accepterName
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, delivered }))
    } catch (error) {
      console.error('[HTTP] Error in /notify/friend-accepted:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
    return
  }

  // POST /notify/message - Send private message notification
  if (url === '/notify/message' && req.method === 'POST') {
    try {
      const data = await parseBody(req)
      const { messageId, senderId, senderName, receiverId, content } = data

      console.log(`[HTTP] Message notification: ${senderName} -> ${receiverId}`)

      const message: Message = {
        id: messageId,
        senderId,
        senderName,
        receiverId,
        content,
        createdAt: Date.now()
      }

      emitToUser(receiverId, 'message', message)
      emitToUser(senderId, 'message-sent', message)

      const notification: Notification = {
        id: generateId(),
        type: 'new_message',
        title: 'رسالة جديدة',
        content: `${senderName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        data: { senderId, messageId },
        createdAt: Date.now()
      }

      const delivered = emitToUser(receiverId, 'notification', notification)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, delivered }))
    } catch (error) {
      console.error('[HTTP] Error in /notify/message:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
    return
  }

  // POST /notify/room-message - Send room message
  if (url === '/notify/room-message' && req.method === 'POST') {
    try {
      const data = await parseBody(req)
      const { messageId, roomCode, playerId, playerName, content, gameType } = data

      console.log(`[HTTP] Room message: ${playerName} in ${roomCode}`)

      const message: RoomMessage = {
        id: messageId,
        roomCode,
        playerId,
        playerName,
        content,
        gameType,
        createdAt: Date.now()
      }

      io.to(`room:${roomCode}`).emit('room-message', message)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
    } catch (error) {
      console.error('[HTTP] Error in /notify/room-message:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
    return
  }

  // POST /notify/room-invite - Send room invite notification
  if (url === '/notify/room-invite' && req.method === 'POST') {
    try {
      const data = await parseBody(req)
      const { inviteId, senderId, senderName, receiverId, roomCode, gameType } = data

      console.log(`[HTTP] Room invite: ${senderName} -> ${receiverId}: ${roomCode}`)

      const notification: Notification = {
        id: generateId(),
        type: 'room_invite',
        title: 'دعوة للانضمام لغرفة',
        content: `${senderName} يدعوك للانضمام للغرفة ${roomCode}`,
        data: { inviteId, senderId, roomCode, gameType },
        createdAt: Date.now()
      }

      const delivered = emitToUser(receiverId, 'notification', notification)
      emitToUser(receiverId, 'room-invite', {
        id: inviteId,
        senderId,
        senderName,
        roomCode,
        gameType
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, delivered }))
    } catch (error) {
      console.error('[HTTP] Error in /notify/room-invite:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
    return
  }

  // GET /online-users - Get list of online users
  if (url === '/online-users' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      users: Array.from(onlineUsers.values()),
      count: onlineUsers.size
    }))
    return
  }

  // GET /health - Health check
  if (url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', connections: onlineUsers.size }))
    return
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

// ==================== SOCKET.IO EVENTS ====================

io.on('connection', (socket: Socket) => {
  console.log(`✅ Client connected: ${socket.id}`)

  // Send connection confirmation immediately
  socket.emit('connected', { id: socket.id })
  
  // Also emit 'connect' event for clients that listen to it
  socket.emit('connect', { id: socket.id })

  // User authentication/registration
  socket.on('authenticate', (data: { userId: string; userName: string; userTitle?: TitleInfo }) => {
    const { userId, userName, userTitle } = data

    // Remove any existing socket for this user
    const existingSocketId = userSockets.get(userId)
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existingSocketId)
      if (existingSocket) {
        existingSocket.disconnect(true)
      }
      socketUsers.delete(existingSocketId)
    }

    // Register user
    const onlineUser: OnlineUser = {
      id: userId,
      name: userName,
      socketId: socket.id,
      connectedAt: Date.now(),
      status: 'online',
      title: userTitle
    }

    onlineUsers.set(userId, onlineUser)
    userSockets.set(userId, socket.id)
    socketUsers.set(socket.id, userId)

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`)

    // Confirm authentication
    socket.emit('authenticated', {
      success: true,
      user: onlineUser,
      onlineUsers: Array.from(onlineUsers.values())
    })

    // Notify friends that user is online
    socket.broadcast.emit('user-online', { user: onlineUser })

    // Broadcast updated online users
    broadcastOnlineUsers()

    console.log(`✅ User authenticated: ${userName} (${userId})`)
  })

  // Update user status
  socket.on('update-status', (data: { status: 'online' | 'away' | 'busy' }) => {
    const userId = socketUsers.get(socket.id)
    if (!userId) return

    const user = onlineUsers.get(userId)
    if (user) {
      user.status = data.status
      onlineUsers.set(userId, user)
      socket.broadcast.emit('user-status-changed', {
        userId,
        status: data.status
      })
      broadcastOnlineUsers()
    }
  })

  // ==================== FRIEND REQUESTS (via socket) ====================

  // Listen for new friend request (from API after database insert)
  socket.on('friend-request-sent', (data: {
    requestId: string
    senderId: string
    senderName: string
    receiverId: string
  }) => {
    const { requestId, senderId, senderName, receiverId } = data

    // Send only friend-request event, NOT notification (to avoid duplicates)
    emitToUser(receiverId, 'friend-request', {
      id: requestId,
      user: {
        id: senderId,
        name: senderName
      },
      createdAt: Date.now()
    })

    console.log(`[Friend Request] ${senderName} -> ${receiverId}`)
  })

  // Friend request accepted
  socket.on('friend-request-accepted', (data: {
    friendId: string
    friendName: string
    accepterId: string
    accepterName: string
  }) => {
    const { friendId, friendName, accepterId, accepterName } = data

    // Notify the original sender that their request was accepted
    const notification: Notification = {
      id: generateId(),
      type: 'friend_accepted',
      title: 'تم قبول طلب الصداقة',
      content: `${accepterName} قبل طلب صداقتك`,
      data: { friendId: accepterId },
      createdAt: Date.now()
    }

    emitToUser(friendId, 'notification', notification)
    emitToUser(friendId, 'friend-accepted', {
      friendId: accepterId,
      friendName: accepterName
    })

    console.log(`[Friend] ${accepterName} accepted ${friendName}'s request`)
  })

  // ==================== PRIVATE MESSAGES ====================

  // Send private message
  socket.on('send-message', (data: {
    messageId: string
    senderId: string
    senderName: string
    receiverId: string
    content: string
  }) => {
    const { messageId, senderId, senderName, receiverId, content } = data

    const message: Message = {
      id: messageId,
      senderId,
      senderName,
      receiverId,
      content,
      createdAt: Date.now()
    }

    // Emit to receiver
    emitToUser(receiverId, 'message', message)
    
    // Also emit confirmation back to sender (for real-time sync)
    emitToUser(senderId, 'message-sent', message)

    console.log(`[Message] ${senderName} -> ${receiverId}: ${content.substring(0, 30)}...`)
  })

  // Typing indicator
  socket.on('typing', (data: { receiverId: string; isTyping: boolean }) => {
    const userId = socketUsers.get(socket.id)
    if (!userId) return

    emitToUser(data.receiverId, 'typing', {
      userId,
      isTyping: data.isTyping
    })
  })

  // ==================== ROOM MESSAGES ====================

  // Join a room chat
  socket.on('join-room-chat', (data: { roomCode: string; userId: string; userName: string; userTitle?: TitleInfo }) => {
    const { roomCode, userId, userName, userTitle } = data
    
    // Store user title on socket for later use
    ;(socket as any).userTitle = userTitle
    socket.join(`room:${roomCode}`)

    // Notify others in the room
    socket.to(`room:${roomCode}`).emit('user-joined-room-chat', {
      userId,
      userName,
      roomCode
    })

    console.log(`[Room Chat] ${userName} joined room ${roomCode}`)
  })

  // Leave room chat
  socket.on('leave-room-chat', (data: { roomCode: string; userId: string; userName: string }) => {
    const { roomCode, userId, userName } = data
    socket.leave(`room:${roomCode}`)

    socket.to(`room:${roomCode}`).emit('user-left-room-chat', {
      userId,
      userName,
      roomCode
    })

    console.log(`[Room Chat] ${userName} left room ${roomCode}`)
  })

  // Send room message
  socket.on('send-room-message', (data: {
    messageId: string
    roomCode: string
    playerId: string
    playerName: string
    playerTitle?: TitleInfo | null
    content: string
    gameType: string
  }) => {
    const { messageId, roomCode, playerId, playerName, playerTitle, content, gameType } = data

    const message: RoomMessage = {
      id: messageId,
      roomCode,
      playerId,
      playerName,
      playerTitle: playerTitle || (socket as any).userTitle || null,
      content,
      gameType,
      createdAt: Date.now()
    }

    // Emit to everyone in the room
    io.to(`room:${roomCode}`).emit('room-message', message)

    console.log(`[Room Message] ${playerName} in ${roomCode}: ${content.substring(0, 30)}...`)
  })

  // ==================== ROOM INVITES ====================

  // Send room invite notification
  socket.on('room-invite-sent', (data: {
    inviteId: string
    senderId: string
    senderName: string
    receiverId: string
    roomCode: string
    gameType: string
  }) => {
    const { inviteId, senderId, senderName, receiverId, roomCode, gameType } = data

    const notification: Notification = {
      id: generateId(),
      type: 'room_invite',
      title: 'دعوة للانضمام لغرفة',
      content: `${senderName} يدعوك للانضمام للغرفة ${roomCode}`,
      data: { inviteId, senderId, roomCode, gameType },
      createdAt: Date.now()
    }

    emitToUser(receiverId, 'notification', notification)
    emitToUser(receiverId, 'room-invite', {
      id: inviteId,
      senderId,
      senderName,
      roomCode,
      gameType
    })

    console.log(`[Room Invite] ${senderName} -> ${receiverId}: ${roomCode}`)
  })

  // ==================== DISCONNECT ====================

  socket.on('disconnect', (reason) => {
    const userId = socketUsers.get(socket.id)
    console.log(`❌ Client disconnected: ${socket.id}, reason: ${reason}`)

    if (userId) {
      const user = onlineUsers.get(userId)
      onlineUsers.delete(userId)
      userSockets.delete(userId)
      socketUsers.delete(socket.id)

      // Notify others that user is offline
      socket.broadcast.emit('user-offline', { userId })
      broadcastOnlineUsers()

      console.log(`❌ User disconnected: ${user?.name || userId}`)
    }
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3010
httpServer.listen(PORT, () => {
  console.log(`👥 Social Service running on port ${PORT}`)
  console.log(`📡 WebSocket endpoints ready`)
  console.log(`🔗 HTTP endpoints available:`)
  console.log(`   - POST /notify/friend-request`)
  console.log(`   - POST /notify/friend-accepted`)
  console.log(`   - POST /notify/message`)
  console.log(`   - POST /notify/room-message`)
  console.log(`   - POST /notify/room-invite`)
  console.log(`   - GET /online-users`)
  console.log(`   - GET /health`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('Social Service closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('Social Service closed')
    process.exit(0)
  })
})
