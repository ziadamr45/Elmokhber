import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

// No Prisma - use HTTP calls to main API instead

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
})

// Types
interface AdminConnection {
  adminId: string
  adminName: string
  socketId: string
  role: string
  connectedAt: number
}

// Storage
const adminConnections = new Map<string, AdminConnection>()
const socketAdmins = new Map<string, string>()

// Helper: Emit to all admins
function emitToAllAdmins(event: string, data: any) {
  io.emit(event, data)
  console.log(`[Admin] Broadcast ${event} to ${adminConnections.size} admins`)
}

// Helper: Get live stats via HTTP
async function getLiveStats() {
  try {
    const response = await fetch('http://localhost:3000/api/admin/stats')
    const data = await response.json()
    return data.stats || {}
  } catch {
    return { timestamp: Date.now() }
  }
}

// HTTP endpoint for internal notifications
httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url?.startsWith('/socket.io/')) return

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = req.url?.split('?')[0]

  // Notify user banned
  if (url === '/notify/user-banned' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        emitToAllAdmins('user-banned', data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(500).end('Error')
      }
    })
    return
  }

  // Notify room created
  if (url === '/notify/room-created' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        emitToAllAdmins('room-created', data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(500).end('Error')
      }
    })
    return
  }

  // Notify room ended
  if (url === '/notify/room-ended' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        emitToAllAdmins('room-ended', data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(500).end('Error')
      }
    })
    return
  }

  // Notify game started
  if (url === '/notify/game-started' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        emitToAllAdmins('game-started', data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(500).end('Error')
      }
    })
    return
  }

  // Notify game ended
  if (url === '/notify/game-ended' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => body += chunk.toString())
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        emitToAllAdmins('game-ended', data)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(500).end('Error')
      }
    })
    return
  }

  // Get stats
  if (url === '/stats' && req.method === 'GET') {
    const stats = await getLiveStats()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(stats))
    return
  }

  // Health check
  if (url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', admins: adminConnections.size }))
    return
  }

  res.writeHead(404).end('Not found')
})

// Socket events
io.on('connection', (socket: Socket) => {
  console.log(`[Admin] Client connected: ${socket.id}`)

  socket.on('authenticate', async (data: { adminId: string; adminName: string; role: string }) => {
    const { adminId, adminName, role } = data

    // Remove existing connection
    const existing = adminConnections.get(adminId)
    if (existing) {
      const oldSocket = io.sockets.sockets.get(existing.socketId)
      if (oldSocket) oldSocket.disconnect(true)
    }

    // Register admin
    adminConnections.set(adminId, {
      adminId,
      adminName,
      socketId: socket.id,
      role,
      connectedAt: Date.now()
    })
    socketAdmins.set(socket.id, adminId)

    // Send initial stats
    const stats = await getLiveStats()
    socket.emit('authenticated', { success: true, stats })

    console.log(`[Admin] ${adminName} (${role}) authenticated`)
  })

  socket.on('request-stats', async () => {
    const stats = await getLiveStats()
    socket.emit('stats-update', stats)
  })

  socket.on('disconnect', () => {
    const adminId = socketAdmins.get(socket.id)
    if (adminId) {
      adminConnections.delete(adminId)
      socketAdmins.delete(socket.id)
      console.log(`[Admin] Disconnected: ${adminId}`)
    }
  })
})

const PORT = 3020
httpServer.listen(PORT, () => {
  console.log(`🔧 Admin Service running on port ${PORT}`)
  console.log(`📡 WebSocket ready for admin connections`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down admin service...')
  httpServer.close(() => {
    process.exit(0)
  })
})
