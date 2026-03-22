import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { notifyFriendAccepted } from '@/lib/social-notifications';

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

// POST - Accept or reject friend request
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json({ error: 'معرف الطلب والإجراء مطلوبان' }, { status: 400 });
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
    }

    // Find the friend request
    const friendRequest = await db.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: { id: true, name: true } },
      },
    });

    if (!friendRequest) {
      return NextResponse.json({ error: 'طلب الصداقة غير موجود' }, { status: 404 });
    }

    // Only the receiver can accept/reject
    if (friendRequest.receiverId !== user.id) {
      return NextResponse.json({ error: 'غير مصرح لك بهذا الإجراء' }, { status: 403 });
    }

    if (friendRequest.status !== 'pending') {
      return NextResponse.json({ error: 'تم التعامل مع هذا الطلب بالفعل' }, { status: 400 });
    }

    if (action === 'accept') {
      // Update request status
      await db.friendRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' },
      });

      // Create friendship (both directions) - create individually to handle duplicates
      try {
        await db.friendship.create({
          data: { userId: friendRequest.senderId, friendId: user.id },
        });
      } catch {
        // Ignore duplicate error
      }
      try {
        await db.friendship.create({
          data: { userId: user.id, friendId: friendRequest.senderId },
        });
      } catch {
        // Ignore duplicate error
      }

      // Create notification for sender
      await db.notification.create({
        data: {
          userId: friendRequest.senderId,
          type: 'friend_accepted',
          title: 'تم قبول طلب الصداقة',
          content: `${user.name} قبل طلب صداقتك`,
          data: JSON.stringify({ friendId: user.id }),
        },
      });

      // Send real-time notification via WebSocket service
      notifyFriendAccepted({
        friendId: friendRequest.senderId,
        friendName: friendRequest.sender.name,
        accepterId: user.id,
        accepterName: user.name,
      }).catch(err => console.error('Failed to send real-time notification:', err));

      return NextResponse.json({
        success: true,
        message: 'تم قبول طلب الصداقة',
        friend: {
          id: friendRequest.sender.id,
          name: friendRequest.sender.name,
        },
      });
    } else {
      // Reject the request
      await db.friendRequest.update({
        where: { id: requestId },
        data: { status: 'rejected' },
      });

      return NextResponse.json({
        success: true,
        message: 'تم رفض طلب الصداقة',
      });
    }
  } catch (error) {
    console.error('Handle friend request error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
