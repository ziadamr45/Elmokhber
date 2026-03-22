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

// GET - Get conversation with a specific user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // Message ID for pagination

    if (!otherUserId) {
      return NextResponse.json({ error: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    // Check if other user exists
    const otherUser = await db.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, name: true, avatar: true },
    });

    if (!otherUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Build query
    const whereClause: any = {
      OR: [
        { senderId: user.id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: user.id },
      ],
    };

    if (before) {
      const beforeMessage = await db.privateMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        whereClause.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    // Get messages
    const messages = await db.privateMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        isRead: true,
        createdAt: true,
        senderId: true,
        receiverId: true,
      },
    });

    // Mark messages as read (messages sent to current user)
    await db.privateMessage.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    // Reverse to show oldest first
    const sortedMessages = messages.reverse();

    return NextResponse.json({
      messages: sortedMessages,
      otherUser,
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, content } = body;

    if (!receiverId || !content) {
      return NextResponse.json({ error: 'معرف المستلم والمحتوى مطلوبان' }, { status: 400 });
    }

    if (receiverId === user.id) {
      return NextResponse.json({ error: 'لا يمكنك إرسال رسالة لنفسك' }, { status: 400 });
    }

    // Validate content
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json({ error: 'محتوى الرسالة فارغ' }, { status: 400 });
    }

    if (trimmedContent.length > 5000) {
      return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 });
    }

    // Check if receiver exists
    const receiver = await db.user.findUnique({
      where: { id: receiverId },
      select: { id: true, name: true },
    });

    if (!receiver) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Create message
    const message = await db.privateMessage.create({
      data: {
        senderId: user.id,
        receiverId,
        content: trimmedContent,
        isRead: false,
      },
    });

    // Create notification for receiver
    await db.notification.create({
      data: {
        userId: receiverId,
        type: 'new_message',
        title: 'رسالة جديدة',
        content: `${user.name}: ${trimmedContent.substring(0, 50)}${trimmedContent.length > 50 ? '...' : ''}`,
        data: JSON.stringify({ senderId: user.id, messageId: message.id }),
      },
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        senderId: message.senderId,
        receiverId: message.receiverId,
        createdAt: message.createdAt,
        isRead: message.isRead,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
