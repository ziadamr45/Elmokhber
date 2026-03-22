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

// GET - List notifications
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const before = searchParams.get('before'); // Notification ID for pagination
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // Build query
    const whereClause: any = { userId: user.id };
    if (unreadOnly) {
      whereClause.isRead = false;
    }
    if (before) {
      const beforeNotification = await db.notification.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeNotification) {
        whereClause.createdAt = { lt: beforeNotification.createdAt };
      }
    }

    // Get notifications
    const notifications = await db.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get unread count
    const unreadCount = await db.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        data: n.data ? JSON.parse(n.data) : null,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      unreadCount,
      hasMore: notifications.length === limit,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// POST - Mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { action, notificationIds } = body;

    if (action === 'mark_all_read') {
      // Mark all notifications as read
      await db.notification.updateMany({
        where: {
          userId: user.id,
          isRead: false,
        },
        data: { isRead: true },
      });

      return NextResponse.json({
        success: true,
        message: 'تم تحديد كل الإشعارات كمقروءة',
      });
    }

    if (action === 'mark_read' && notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await db.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: user.id,
        },
        data: { isRead: true },
      });

      return NextResponse.json({
        success: true,
        message: 'تم تحديد الإشعارات كمقروءة',
      });
    }

    if (action === 'delete' && notificationIds && Array.isArray(notificationIds)) {
      // Delete specific notifications
      await db.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          userId: user.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'تم حذف الإشعارات',
      });
    }

    if (action === 'clear_all') {
      // Delete all notifications
      await db.notification.deleteMany({
        where: { userId: user.id },
      });

      return NextResponse.json({
        success: true,
        message: 'تم حذف كل الإشعارات',
      });
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
