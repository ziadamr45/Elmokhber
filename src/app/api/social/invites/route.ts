import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch pending room invites for current user
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'غير مسجل الدخول' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { sessionToken },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Get pending invites that haven't expired
    const invites = await db.roomInvite.findMany({
      where: {
        receiverId: user.id,
        status: 'pending',
        expiresAt: { gte: new Date() },
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            title: true,
            level: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      invites: invites.map((invite) => ({
        id: invite.id,
        roomCode: invite.roomCode,
        gameType: invite.gameType,
        status: invite.status,
        expiresAt: invite.expiresAt.toISOString(),
        createdAt: invite.createdAt.toISOString(),
        sender: {
          id: invite.sender.id,
          name: invite.sender.name,
          title: invite.sender.title,
          level: invite.sender.level,
        },
      })),
    });
  } catch (error) {
    console.error('Fetch invites error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST - Send a room invite
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'غير مسجل الدخول' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { sessionToken },
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const body = await request.json();
    const { receiverId, roomCode, gameType, gameMode } = body;

    if (!receiverId || !roomCode || !gameType) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    // Check if users are friends
    const friendship = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId: receiverId },
          { userId: receiverId, friendId: user.id },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json({ success: false, error: 'يجب أن تكون صديق أولاً' }, { status: 403 });
    }

    // Check for existing pending invite
    const existingInvite = await db.roomInvite.findFirst({
      where: {
        senderId: user.id,
        receiverId,
        roomCode,
        status: 'pending',
        expiresAt: { gte: new Date() },
      },
    });

    if (existingInvite) {
      return NextResponse.json({
        success: true,
        invite: {
          id: existingInvite.id,
          roomCode: existingInvite.roomCode,
          gameType: existingInvite.gameType,
          alreadyInvited: true,
        },
      });
    }

    // Create invite with 30 minutes expiry
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const invite = await db.roomInvite.create({
      data: {
        senderId: user.id,
        receiverId,
        roomCode,
        gameType,
        expiresAt,
      },
    });

    // Create notification for receiver
    const gameTypeName = gameType === 'quiz' ? 'المسابقة' : 'المخبر';
    const gameModeText = gameMode ? ` (${gameMode})` : '';

    await db.notification.create({
      data: {
        userId: receiverId,
        type: 'room_invite',
        title: 'دعوة للانضمام لغرفة',
        content: `${user.name} يدعوك للانضمام للغرفة ${roomCode} - ${gameTypeName}${gameModeText}`,
        data: JSON.stringify({
          inviteId: invite.id,
          senderId: user.id,
          senderName: user.name,
          roomCode,
          gameType,
          gameMode,
        }),
      },
    });

    // Notify via social service (real-time)
    try {
      await fetch('http://localhost:3010/notify/room-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteId: invite.id,
          senderId: user.id,
          senderName: user.name,
          receiverId,
          roomCode,
          gameType,
          gameMode,
        }),
      });
    } catch (e) {
      console.log('Real-time notification failed, will show on next poll');
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        roomCode: invite.roomCode,
        gameType: invite.gameType,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Send invite error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}

// PUT - Accept or reject an invite
export async function PUT(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'غير مسجل الدخول' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { sessionToken },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const body = await request.json();
    const { inviteId, action } = body; // action: 'accept' or 'reject'

    if (!inviteId || !action) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    const invite = await db.roomInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.receiverId !== user.id) {
      return NextResponse.json({ success: false, error: 'الدعوة غير موجودة' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'الدعوة تم الرد عليها بالفعل' }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      await db.roomInvite.update({
        where: { id: inviteId },
        data: { status: 'expired' },
      });
      return NextResponse.json({ success: false, error: 'الدعوة منتهية الصلاحية' }, { status: 400 });
    }

    // Update invite status
    const updatedInvite = await db.roomInvite.update({
      where: { id: inviteId },
      data: { status: action === 'accept' ? 'accepted' : 'rejected' },
    });

    return NextResponse.json({
      success: true,
      invite: {
        id: updatedInvite.id,
        roomCode: updatedInvite.roomCode,
        gameType: updatedInvite.gameType,
        status: updatedInvite.status,
      },
    });
  } catch (error) {
    console.error('Update invite error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}
