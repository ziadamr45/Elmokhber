import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Helper to verify admin session
async function verifyAdmin(request: NextRequest) {
  // Check for token in Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.replace('Bearer ', '');
  const tokenFromCookie = request.cookies.get('admin_session')?.value;
  const sessionToken = tokenFromHeader || tokenFromCookie;

  if (!sessionToken) return null;

  const admin = await db.admin.findUnique({
    where: { sessionToken }
  });

  if (!admin || !admin.sessionExpiry || admin.sessionExpiry < new Date()) {
    return null;
  }

  // Check if admin is active
  if (!admin.isActive) return null;

  return admin;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    // Get stats with error handling for each query
    let totalUsers = 0;
    let activeUsers = 0;
    let bannedUsers = 0;
    let totalRooms = 0;
    let activeRooms = 0;
    let totalGames = 0;
    let gamesToday = 0;
    let peakUsers = 0;
    let recentGames: any[] = [];
    let recentUsers: any[] = [];

    try {
      totalUsers = await db.user.count();
    } catch (e) { console.error('Error counting users:', e); }

    try {
      activeUsers = await db.onlineUser.count();
    } catch (e) { console.error('Error counting online users:', e); }

    try {
      bannedUsers = await db.user.count({
        where: { isBanned: true }
      });
    } catch (e) { console.error('Error counting banned users:', e); }

    try {
      const totalSpyRooms = await db.spyRoom.count();
      const totalQuizRooms = await db.quizRoom.count();
      totalRooms = totalSpyRooms + totalQuizRooms;
    } catch (e) { console.error('Error counting rooms:', e); }

    try {
      const activeSpyRooms = await db.spyRoom.count({
        where: { status: { in: ['lobby', 'running'] } }
      });
      const activeQuizRooms = await db.quizRoom.count({
        where: { status: { in: ['lobby', 'running'] } }
      });
      activeRooms = activeSpyRooms + activeQuizRooms;
    } catch (e) { console.error('Error counting active rooms:', e); }

    try {
      totalGames = await db.spyGame.count({
        where: { endedAt: { not: null } }
      });
    } catch (e) { console.error('Error counting games:', e); }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      gamesToday = await db.spyGame.count({
        where: {
          endedAt: { gte: today }
        }
      });
    } catch (e) { console.error('Error counting today games:', e); }

    try {
      peakUsers = await db.onlineUser.count();
    } catch (e) { console.error('Error counting peak users:', e); }

    try {
      recentGames = await db.gameHistory.findMany({
        take: 10,
        orderBy: { playedAt: 'desc' },
        select: {
          id: true,
          gameType: true,
          playMode: true,
          gameMode: true,
          categoryName: true,
          playerCount: true,
          winner: true,
          playedAt: true,
          xpEarned: true
        }
      });
    } catch (e) { console.error('Error fetching recent games:', e); }

    try {
      recentUsers = await db.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          gold: true,
          gamesPlayed: true,
          gamesWon: true,
          isBanned: true,
          createdAt: true,
          lastLoginAt: true
        }
      });
    } catch (e) { console.error('Error fetching recent users:', e); }

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        bannedUsers,
        totalRooms,
        activeRooms,
        totalGames,
        gamesToday,
        peakUsers
      },
      recentGames,
      recentUsers
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'حدث خطأ في الخادم',
      stats: {
        totalUsers: 0,
        activeUsers: 0,
        bannedUsers: 0,
        totalRooms: 0,
        activeRooms: 0,
        totalGames: 0,
        gamesToday: 0,
        peakUsers: 0
      },
      recentGames: [],
      recentUsers: []
    }, { status: 500 });
  }
}
