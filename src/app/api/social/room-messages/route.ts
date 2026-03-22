import { db } from '@/lib/db';
import { publishToRoom, ABLY_EVENTS } from '@/lib/ably';
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

// GET - Get room messages
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomCode = searchParams.get('roomCode');
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // Message ID for pagination

    if (!roomCode) {
      return NextResponse.json({ error: 'كود الغرفة مطلوب' }, { status: 400 });
    }

    // Build query
    const whereClause: any = { roomCode };
    if (before) {
      const beforeMessage = await db.roomMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        whereClause.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    // Get messages
    const messages = await db.roomMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        createdAt: true,
        playerId: true,
        playerName: true,
        gameType: true,
      },
    });

    // Reverse to show oldest first
    const sortedMessages = messages.reverse();

    return NextResponse.json({
      messages: sortedMessages,
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Get room messages error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST - Send a room message
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { roomCode, content, gameType = 'spy' } = body;

    if (!roomCode || !content) {
      return NextResponse.json({ error: 'كود الغرفة والمحتوى مطلوبان' }, { status: 400 });
    }

    // Validate content
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json({ error: 'محتوى الرسالة فارغ' }, { status: 400 });
    }

    if (trimmedContent.length > 1000) {
      return NextResponse.json({ error: 'الرسالة طويلة جداً' }, { status: 400 });
    }

    // Create message
    const message = await db.roomMessage.create({
      data: {
        roomCode,
        playerId: user.id,
        playerName: user.name,
        content: trimmedContent,
        gameType,
      },
    });

    // Prepare message for Ably
    const messageData = {
      id: message.id,
      roomCode,
      playerId: message.playerId,
      playerName: message.playerName,
      content: message.content,
      gameType: message.gameType,
      createdAt: message.createdAt.toISOString(),
    };

    // Publish to Ably for real-time delivery
    try {
      await publishToRoom(roomCode, ABLY_EVENTS.ROOM_MESSAGE, messageData);
    } catch (ablyError) {
      console.error('[Ably] Failed to send message:', ablyError);
      // Message is still saved to DB, so we don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: messageData,
    });
  } catch (error) {
    console.error('Send room message error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
