'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// Types
export interface User {
  id: string
  name: string
  avatar?: string | null
  level?: number
  title?: string | null
}

export interface Friend {
  id: string
  name: string
  avatar?: string | null
  level?: number
  title?: string | null
  friendshipId: string
}

export interface FriendRequest {
  id: string
  user: User
  createdAt: string
}

export interface Message {
  id: string
  senderId: string
  senderName?: string
  receiverId: string
  content: string
  createdAt: string | number
  isRead?: boolean
  isMine?: boolean
}

export interface Conversation {
  user: User
  lastMessage: Message
  unreadCount: number
}

export interface Notification {
  id: string
  type: 'friend_request' | 'friend_accepted' | 'new_message' | 'room_invite'
  title: string
  content: string
  data?: unknown
  isRead?: boolean
  createdAt: string | number
}

export interface RoomMessage {
  id: string
  roomCode: string
  playerId: string
  playerName: string
  content: string
  gameType: string
  createdAt: string | number
}

export interface OnlineUser {
  id: string
  name: string
  socketId: string
  connectedAt: number
  status: 'online' | 'away' | 'busy'
}

export interface RoomInvite {
  id: string
  senderId: string
  senderName: string
  roomCode: string
  gameType: string
}

interface UseSocialOptions {
  userId?: string
  userName?: string
  socialServiceUrl?: string
  autoConnect?: boolean
}

interface UseSocialReturn {
  // Connection state
  isConnected: boolean
  onlineUsers: OnlineUser[]
  
  // Friends
  friends: Friend[]
  pendingRequests: FriendRequest[]
  sentRequests: FriendRequest[]
  sendFriendRequest: (friendId: string) => Promise<{ success: boolean; error?: string }>
  acceptFriendRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>
  rejectFriendRequest: (requestId: string) => Promise<{ success: boolean; error?: string }>
  removeFriend: (friendId: string) => Promise<{ success: boolean; error?: string }>
  refreshFriends: () => Promise<void>
  
  // Messages
  conversations: Conversation[]
  currentConversation: { messages: Message[]; otherUser: User } | null
  sendMessage: (receiverId: string, content: string) => Promise<{ success: boolean; error?: string }>
  getConversation: (userId: string) => Promise<void>
  refreshConversations: () => Promise<void>
  typingUsers: Map<string, boolean>
  sendTypingIndicator: (receiverId: string, isTyping: boolean) => void
  
  // Notifications
  notifications: Notification[]
  unreadNotificationCount: number
  markNotificationsRead: (notificationIds?: string[]) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  refreshNotifications: () => Promise<void>
  
  // Room Messages
  roomMessages: Map<string, RoomMessage[]>
  joinRoomChat: (roomCode: string) => void
  leaveRoomChat: (roomCode: string) => void
  sendRoomMessage: (roomCode: string, content: string, gameType: string) => Promise<{ success: boolean; error?: string }>
  
  // Room Invites
  sendRoomInvite: (receiverId: string, roomCode: string, gameType: string) => void
  
  // Status
  setStatus: (status: 'online' | 'away' | 'busy') => void
}

const SOCIAL_SERVICE_URL = process.env.NEXT_PUBLIC_SOCIAL_SERVICE_URL || '/?XTransformPort=3010'

export function useSocial(options: UseSocialOptions): UseSocialReturn {
  const {
    userId,
    userName,
    socialServiceUrl = SOCIAL_SERVICE_URL,
    autoConnect = true
  } = options

  // Socket reference
  const socketRef = useRef<Socket | null>(null)

  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  // Friends state
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])

  // Messages state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<{ messages: Message[]; otherUser: User } | null>(null)
  const [typingUsers, setTypingUsers] = useState<Map<string, boolean>>(new Map())

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)

  // Room messages state
  const [roomMessages, setRoomMessages] = useState<Map<string, RoomMessage[]>>(new Map())

  // Refs for callbacks used in socket handlers
  const refreshFriendsRef = useRef<() => Promise<void>>()
  const refreshConversationsRef = useRef<() => Promise<void>>()

  // ==================== FRIENDS API ====================

  const refreshFriends = useCallback(async () => {
    try {
      const response = await fetch('/api/social/friends')
      if (response.ok) {
        const data = await response.json()
        setFriends(data.friends)
        setPendingRequests(data.pendingRequests)
        setSentRequests(data.sentRequests)
      }
    } catch (error) {
      console.error('[Social] Error refreshing friends:', error)
    }
  }, [])

  // Update ref
  useEffect(() => {
    refreshFriendsRef.current = refreshFriends
  }, [refreshFriends])

  const sendFriendRequest = useCallback(async (friendId: string) => {
    try {
      const response = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId })
      })
      const data = await response.json()
      
      if (data.success) {
        // Notify via WebSocket
        socketRef.current?.emit('friend-request-sent', {
          requestId: data.request.id,
          senderId: userId,
          senderName: userName,
          receiverId: friendId
        })
        
        // Update sent requests
        setSentRequests(prev => [{
          id: data.request.id,
          user: { id: friendId, name: data.request.receiverName },
          createdAt: data.request.createdAt
        }, ...prev])
        
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (error) {
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }
  }, [userId, userName])

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    try {
      const response = await fetch('/api/social/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'accept' })
      })
      const data = await response.json()
      
      if (data.success) {
        // Notify via WebSocket
        socketRef.current?.emit('friend-request-accepted', {
          friendId: data.friend.id,
          friendName: data.friend.name,
          accepterId: userId,
          accepterName: userName
        })
        
        // Remove from pending
        setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        
        // Refresh friends
        refreshFriends()
        
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (error) {
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }
  }, [userId, userName, refreshFriends])

  const rejectFriendRequest = useCallback(async (requestId: string) => {
    try {
      const response = await fetch('/api/social/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'reject' })
      })
      const data = await response.json()
      
      if (data.success) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId))
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (error) {
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }
  }, [])

  const removeFriend = useCallback(async (friendId: string) => {
    try {
      const response = await fetch(`/api/social/friends?friendId=${friendId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setFriends(prev => prev.filter(f => f.id !== friendId))
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (error) {
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }
  }, [])

  // ==================== MESSAGES API ====================

  const refreshConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/social/messages/conversations')
      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations)
      }
    } catch (error) {
      console.error('[Social] Error refreshing conversations:', error)
    }
  }, [])

  // Update ref
  useEffect(() => {
    refreshConversationsRef.current = refreshConversations
  }, [refreshConversations])

  const getConversation = useCallback(async (otherUserId: string) => {
    try {
      const response = await fetch(`/api/social/messages?userId=${otherUserId}`)
      if (response.ok) {
        const data = await response.json()
        setCurrentConversation({
          messages: data.messages,
          otherUser: data.otherUser
        })
      }
    } catch (error) {
      console.error('[Social] Error getting conversation:', error)
    }
  }, [])

  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    try {
      const response = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId, content })
      })
      const data = await response.json()
      
      if (data.success && data.message) {
        // Create the message object
        const newMessage: Message = {
          id: data.message.id,
          senderId: userId || '',
          senderName: userName,
          receiverId,
          content: data.message.content,
          createdAt: data.message.createdAt || Date.now(),
          isMine: true
        }
        
        // Add to current conversation immediately for the sender (optimistic update)
        setCurrentConversation(prev => {
          if (prev && prev.otherUser.id === receiverId) {
            // Check if message already exists
            const exists = prev.messages.some(m => m.id === newMessage.id)
            if (!exists) {
              console.log('[Social] Adding message locally:', newMessage.id)
              return {
                ...prev,
                messages: [...prev.messages, newMessage]
              }
            }
          }
          return prev
        })
        
        // Notify via WebSocket for real-time delivery
        if (socketRef.current?.connected) {
          console.log('[Social] Emitting send-message via socket')
          socketRef.current.emit('send-message', {
            messageId: data.message.id,
            senderId: userId,
            senderName: userName,
            receiverId,
            content: data.message.content
          })
        } else {
          console.warn('[Social] Socket not connected, message will not be delivered in real-time')
        }
        
        // Refresh conversations list to update last message
        refreshConversationsRef.current?.()
        
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (error) {
      console.error('[Social] Error sending message:', error)
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }
  }, [userId, userName])

  const sendTypingIndicator = useCallback((receiverId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { receiverId, isTyping })
  }, [])

  // ==================== NOTIFICATIONS API ====================

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/social/notifications')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
        setUnreadNotificationCount(data.unreadCount)
      }
    } catch (error) {
      console.error('[Social] Error refreshing notifications:', error)
    }
  }, [])

  const markNotificationsRead = useCallback(async (notificationIds?: string[]) => {
    try {
      const response = await fetch('/api/social/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: notificationIds ? 'mark_read' : 'mark_all_read',
          notificationIds 
        })
      })
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadNotificationCount(0)
      }
    } catch (error) {
      console.error('[Social] Error marking notifications read:', error)
    }
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    await markNotificationsRead()
  }, [markNotificationsRead])

  // ==================== ROOM MESSAGES ====================

  const joinRoomChat = useCallback((roomCode: string) => {
    if (socketRef.current && userId && userName) {
      socketRef.current.emit('join-room-chat', { roomCode, userId, userName })
      setRoomMessages(prev => {
        const newMap = new Map(prev)
        if (!newMap.has(roomCode)) {
          newMap.set(roomCode, [])
        }
        return newMap
      })
    }
  }, [userId, userName])

  const leaveRoomChat = useCallback((roomCode: string) => {
    if (socketRef.current && userId && userName) {
      socketRef.current.emit('leave-room-chat', { roomCode, userId, userName })
    }
  }, [userId, userName])

  const sendRoomMessage = useCallback(async (roomCode: string, content: string, gameType: string) => {
    try {
      const response = await fetch('/api/social/room-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, content, gameType })
      })
      const data = await response.json()
      
      if (data.success) {
        // Notify via WebSocket
        socketRef.current?.emit('send-room-message', {
          messageId: data.message.id,
          roomCode,
          playerId: userId,
          playerName: userName,
          content: data.message.content,
          gameType
        })
        
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch (error) {
      return { success: false, error: 'حدث خطأ في الاتصال' }
    }
  }, [userId, userName])

  // ==================== ROOM INVITES ====================

  const sendRoomInvite = useCallback((receiverId: string, roomCode: string, gameType: string) => {
    if (socketRef.current && userId && userName) {
      const inviteId = Math.random().toString(36).slice(2, 10)
      socketRef.current.emit('room-invite-sent', {
        inviteId,
        senderId: userId,
        senderName: userName,
        receiverId,
        roomCode,
        gameType
      })
    }
  }, [userId, userName])

  // ==================== STATUS ====================

  const setStatus = useCallback((status: 'online' | 'away' | 'busy') => {
    socketRef.current?.emit('update-status', { status })
  }, [])

  // ==================== SOCKET CONNECTION ====================

  // Poll for conversation updates when in a chat
  useEffect(() => {
    if (!userId || !currentConversation?.otherUser.id) return
    
    // Poll every 1.5 seconds for real-time feel
    const pollInterval = setInterval(() => {
      getConversation(currentConversation.otherUser.id)
    }, 1500)

    return () => {
      clearInterval(pollInterval)
    }
  }, [userId, currentConversation?.otherUser.id, getConversation])

  // Fetch data on mount and periodically
  useEffect(() => {
    if (!userId) return

    // Initial fetch
    const timeoutId = setTimeout(() => {
      refreshFriends()
      refreshConversations()
      refreshNotifications()
    }, 0)

    // Poll for status updates every 2 seconds for real-time feel
    const pollInterval = setInterval(() => {
      refreshFriends()
      refreshNotifications()
    }, 2000)

    return () => {
      clearTimeout(timeoutId)
      clearInterval(pollInterval)
    }
  }, [userId])

  useEffect(() => {
    if (!autoConnect || !userId || !userName) return

    const socket = io(socialServiceUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[Social] Connected to social service')
      setIsConnected(true)
      socket.emit('authenticate', { userId, userName })
      // Refresh data immediately on connect
      refreshFriends()
      refreshConversations()
      refreshNotifications()
    })

    socket.on('disconnect', () => {
      console.log('[Social] Disconnected from social service')
      setIsConnected(false)
    })

    socket.on('authenticated', (data: { user: OnlineUser; onlineUsers: OnlineUser[] }) => {
      console.log('[Social] Authenticated:', data.user.name)
      setOnlineUsers(data.onlineUsers)
    })

    socket.on('online-users', (data: { users: OnlineUser[] }) => {
      setOnlineUsers(data.users)
    })

    socket.on('user-online', (data: { user: OnlineUser }) => {
      setOnlineUsers(prev => {
        const filtered = prev.filter(u => u.id !== data.user.id)
        return [...filtered, data.user]
      })
    })

    socket.on('user-offline', (data: { userId: string }) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== data.userId))
    })

    socket.on('user-status-changed', (data: { userId: string; status: 'online' | 'away' | 'busy' }) => {
      setOnlineUsers(prev => prev.map(u => 
        u.id === data.userId ? { ...u, status: data.status } : u
      ))
    })

    // ==================== FRIEND REQUESTS ====================

    socket.on('friend-request', (data: FriendRequest) => {
      setPendingRequests(prev => [data, ...prev])
    })

    socket.on('friend-accepted', (data: { friendId: string; friendName: string }) => {
      // Remove from sent requests
      setSentRequests(prev => prev.filter(r => r.user.id !== data.friendId))
      // Refresh friends list using ref
      refreshFriendsRef.current?.()
    })

    // ==================== MESSAGES ====================

    socket.on('message', (data: Message) => {
      console.log('[Social] Received message from:', data.senderId, 'content:', data.content?.substring(0, 30))
      // Update current conversation if viewing
      setCurrentConversation(prev => {
        if (prev?.otherUser.id === data.senderId) {
          // Check if message already exists
          const exists = prev.messages.some(m => m.id === data.id)
          if (!exists) {
            console.log('[Social] Adding received message to conversation')
            return {
              ...prev,
              messages: [...prev.messages, data]
            }
          }
        }
        return prev
      })
      
      // Update conversations list using ref
      refreshConversationsRef.current?.()
    })

    socket.on('message-sent', (data: Message) => {
      // Update current conversation if viewing (only if message not already added locally)
      setCurrentConversation(prev => {
        if (prev?.otherUser.id === data.receiverId) {
          // Check if message already exists (optimistic update)
          const exists = prev.messages.some(m => m.id === data.id)
          if (!exists) {
            return {
              ...prev,
              messages: [...prev.messages, data]
            }
          }
        }
        return prev
      })
    })

    socket.on('typing', (data: { userId: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const newMap = new Map(prev)
        newMap.set(data.userId, data.isTyping)
        return newMap
      })
    })

    // ==================== NOTIFICATIONS ====================

    socket.on('notification', (data: Notification) => {
      setNotifications(prev => [data, ...prev])
      if (!data.isRead) {
        setUnreadNotificationCount(prev => prev + 1)
      }
    })

    // ==================== ROOM MESSAGES ====================

    socket.on('room-message', (data: RoomMessage) => {
      setRoomMessages(prev => {
        const newMap = new Map(prev)
        const messages = newMap.get(data.roomCode) || []
        newMap.set(data.roomCode, [...messages, data])
        return newMap
      })
    })

    socket.on('user-joined-room-chat', (data: { userId: string; userName: string; roomCode: string }) => {
      console.log(`[Social] ${data.userName} joined room chat ${data.roomCode}`)
    })

    socket.on('user-left-room-chat', (data: { userId: string; userName: string; roomCode: string }) => {
      console.log(`[Social] ${data.userName} left room chat ${data.roomCode}`)
    })

    // ==================== ROOM INVITES ====================

    socket.on('room-invite', (data: RoomInvite) => {
      console.log(`[Social] Room invite from ${data.senderName}: ${data.roomCode}`)
    })

    return () => {
      socket.disconnect()
    }
  }, [userId, userName, socialServiceUrl, autoConnect])

  return {
    // Connection state
    isConnected,
    onlineUsers,
    
    // Friends
    friends,
    pendingRequests,
    sentRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refreshFriends,
    
    // Messages
    conversations,
    currentConversation,
    sendMessage,
    getConversation,
    refreshConversations,
    typingUsers,
    sendTypingIndicator,
    
    // Notifications
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    markAllNotificationsRead,
    refreshNotifications,
    
    // Room Messages
    roomMessages,
    joinRoomChat,
    leaveRoomChat,
    sendRoomMessage,
    
    // Room Invites
    sendRoomInvite,
    
    // Status
    setStatus
  }
}
