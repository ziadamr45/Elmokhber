import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to get authenticated user from session token
async function getAuthenticatedUser(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { sessionToken },
    select: {
      id: true,
      name: true,
      avatar: true,
      sessionExpiry: true,
    },
  });

  if (!user) {
    return null;
  }

  // Check if session is expired
  if (user.sessionExpiry && new Date() > user.sessionExpiry) {
    return null;
  }

  return user;
}

// GET - List all conversations
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Get all unique conversations with latest message
    // We'll get messages where user is sender or receiver, then group by the other user

    const sentMessages = await db.privateMessage.findMany({
      where: { senderId: user.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        isRead: true,
        receiverId: true,
        receiver: {
          select: { id: true, name: true, avatar: true, level: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const receivedMessages = await db.privateMessage.findMany({
      where: { receiverId: user.id },
      select: {
        id: true,
        content: true,
        createdAt: true,
        isRead: true,
        senderId: true,
        sender: {
          select: { id: true, name: true, avatar: true, level: true, title: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Create a map to track latest message per conversation
    const conversationsMap = new Map<
      string,
      {
        user: any;
        lastMessage: any;
        unreadCount: number;
        updatedAt: Date;
      }
    >();

    // Process sent messages
    for (const msg of sentMessages) {
      const existing = conversationsMap.get(msg.receiverId);
      if (!existing || msg.createdAt > existing.updatedAt) {
        conversationsMap.set(msg.receiverId, {
          user: msg.receiver,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
            isMine: true,
          },
          unreadCount: existing?.unreadCount || 0,
          updatedAt: msg.createdAt,
        });
      }
    }

    // Process received messages
    for (const msg of receivedMessages) {
      const existing = conversationsMap.get(msg.senderId);
      if (!existing || msg.createdAt > existing.updatedAt) {
        conversationsMap.set(msg.senderId, {
          user: msg.sender,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
            isMine: false,
          },
          unreadCount: (existing?.unreadCount || 0) + (msg.isRead ? 0 : 1),
          updatedAt: msg.createdAt,
        });
      } else if (!msg.isRead) {
        // Increment unread count
        existing.unreadCount += 1;
      }
    }

    // Convert to array and sort by latest message
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map((conv) => ({
        user: conv.user,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount,
      }));

    return NextResponse.json({
      conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
