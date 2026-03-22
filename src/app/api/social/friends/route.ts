import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { notifyFriendRequest, notifyFriendAccepted } from '@/lib/social-notifications';

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

// GET - List friends and pending requests
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Update user's last seen
    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {}); // Ignore errors

    // Get all friendships (both as user and as friend)
    const [friendsAsUser, friendsAsFriend] = await Promise.all([
      db.friendship.findMany({
        where: { userId: user.id },
        include: {
          friend: {
            select: { id: true, name: true, avatar: true, level: true, title: true, lastSeenAt: true },
          },
        },
      }),
      db.friendship.findMany({
        where: { friendId: user.id },
        include: {
          user: {
            select: { id: true, name: true, avatar: true, level: true, title: true, lastSeenAt: true },
          },
        },
      }),
    ]);

    // Helper to check if user is online (last seen within 30 seconds)
    const isOnline = (lastSeenAt: Date | null): boolean => {
      if (!lastSeenAt) return false;
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      return new Date(lastSeenAt) > thirtySecondsAgo;
    };

    // Combine friends from both relations and add online status
    const friends = [
      ...friendsAsUser.map((f) => ({ 
        ...f.friend, 
        friendshipId: f.id,
        isOnline: isOnline(f.friend.lastSeenAt),
        lastSeenAt: f.friend.lastSeenAt,
      })),
      ...friendsAsFriend.map((f) => ({ 
        ...f.user, 
        friendshipId: f.id,
        isOnline: isOnline(f.user.lastSeenAt),
        lastSeenAt: f.user.lastSeenAt,
      })),
    ];

    // Get pending friend requests (received)
    const pendingRequests = await db.friendRequest.findMany({
      where: {
        receiverId: user.id,
        status: 'pending',
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true, level: true, title: true, lastSeenAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get sent requests that are still pending
    const sentRequests = await db.friendRequest.findMany({
      where: {
        senderId: user.id,
        status: 'pending',
      },
      include: {
        receiver: {
          select: { id: true, name: true, avatar: true, level: true, title: true, lastSeenAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      friends,
      pendingRequests: pendingRequests.map((r) => ({
        id: r.id,
        user: {
          ...r.sender,
          isOnline: isOnline(r.sender.lastSeenAt),
        },
        createdAt: r.createdAt,
      })),
      sentRequests: sentRequests.map((r) => ({
        id: r.id,
        user: {
          ...r.receiver,
          isOnline: isOnline(r.receiver.lastSeenAt),
        },
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get friends error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST - Send friend request
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { friendId } = body;

    if (!friendId) {
      return NextResponse.json({ error: 'معرف الصديق مطلوب' }, { status: 400 });
    }

    if (friendId === user.id) {
      return NextResponse.json({ error: 'لا يمكنك إضافة نفسك كصديق' }, { status: 400 });
    }

    // Check if friend exists
    const friend = await db.user.findUnique({
      where: { id: friendId },
      select: { id: true, name: true },
    });

    if (!friend) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Check if already friends
    const existingFriendship = await db.friendship.findFirst({
      where: {
        OR: [
          { userId: user.id, friendId },
          { userId: friendId, friendId: user.id },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json({ error: 'أنتما أصدقاء بالفعل' }, { status: 400 });
    }

    // Check for existing request
    const existingRequest = await db.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: user.id, receiverId: friendId },
          { senderId: friendId, receiverId: user.id },
        ],
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return NextResponse.json({ error: 'طلب الصداقة موجود بالفعل' }, { status: 400 });
      }
      // If rejected, delete old request and create new one
      await db.friendRequest.delete({ where: { id: existingRequest.id } });
    }

    // Create friend request
    const friendRequest = await db.friendRequest.create({
      data: {
        senderId: user.id,
        receiverId: friendId,
        status: 'pending',
      },
    });

    // Create notification for receiver
    await db.notification.create({
      data: {
        userId: friendId,
        type: 'friend_request',
        title: 'طلب صداقة جديد',
        content: `${user.name} أرسل لك طلب صداقة`,
        data: JSON.stringify({ requestId: friendRequest.id, senderId: user.id }),
      },
    });

    // Send real-time notification via WebSocket service
    notifyFriendRequest({
      requestId: friendRequest.id,
      senderId: user.id,
      senderName: user.name,
      receiverId: friendId,
    }).catch(err => console.error('Failed to send real-time notification:', err));

    return NextResponse.json({
      success: true,
      message: 'تم إرسال طلب الصداقة',
      request: {
        id: friendRequest.id,
        receiverId: friendId,
        receiverName: friend.name,
        createdAt: friendRequest.createdAt,
      },
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// DELETE - Remove friend
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendId = searchParams.get('friendId');

    if (!friendId) {
      return NextResponse.json({ error: 'معرف الصديق مطلوب' }, { status: 400 });
    }

    // Delete both friendship directions
    await db.friendship.deleteMany({
      where: {
        OR: [
          { userId: user.id, friendId },
          { userId: friendId, friendId: user.id },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف الصداقة',
    });
  } catch (error) {
    console.error('Delete friend error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
