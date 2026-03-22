import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin(request: NextRequest) {
  // Check for token in Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const tokenFromHeader = authHeader?.replace('Bearer ', '');
  const tokenFromCookie = request.cookies.get('admin_session')?.value;
  const sessionToken = tokenFromHeader || tokenFromCookie;

  if (!sessionToken) return null;

  const admin = await db.admin.findUnique({ where: { sessionToken } });
  if (!admin || !admin.sessionExpiry || admin.sessionExpiry < new Date()) return null;

  // Check if admin is active
  if (!admin.isActive) return null;

  return admin;
}

// GET - List rooms
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';

    // Get spy rooms
    const spyWhere: any = {};
    if (status !== 'all') spyWhere.status = status;

    const spyRooms = await db.spyRoom.findMany({
      where: spyWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        players: true,
        game: true
      }
    });

    // Get quiz rooms
    const quizRooms = await db.quizRoom.findMany({
      where: spyWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        players: true
      }
    });

    // Format rooms
    const rooms = [
      ...spyRooms.map(r => ({
        id: r.id,
        code: r.code,
        name: `غرفة ${r.code}`,
        hostId: r.hostId,
        hostName: r.players.find(p => p.isHost)?.name || 'غير معروف',
        playersCount: r.players.length,
        maxPlayers: 12,
        status: r.status === 'lobby' ? 'waiting' : r.status === 'running' ? 'playing' : 'finished',
        gameType: 'spy',
        gameMode: r.gameMode,
        categoryId: r.categoryId,
        isPrivate: !r.isPublic,
        createdAt: r.createdAt.toISOString(),
        startedAt: r.startedAt?.toISOString(),
        endedAt: r.endedAt?.toISOString()
      })),
      ...quizRooms.map(r => ({
        id: r.id,
        code: r.code,
        name: `غرفة ${r.code}`,
        hostId: r.hostId,
        hostName: r.players.find(p => p.isHost)?.name || 'غير معروف',
        playersCount: r.players.length,
        maxPlayers: 12,
        status: r.status === 'lobby' ? 'waiting' : r.status === 'running' ? 'playing' : 'finished',
        gameType: 'quiz',
        gameMode: r.mode,
        categoryId: r.categoryId,
        isPrivate: !r.isPublic,
        createdAt: r.createdAt.toISOString(),
        startedAt: r.startedAt?.toISOString(),
        endedAt: r.endedAt?.toISOString()
      }))
    ];

    // Sort by createdAt desc
    rooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
  }
}

// POST - Room actions
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, action, gameType } = body;

    if (!roomId || !action || !gameType) {
      return NextResponse.json({ success: false, message: 'بيانات ناقصة' }, { status: 400 });
    }

    let logDescription = '';

    if (gameType === 'spy') {
      const room = await db.spyRoom.findUnique({ where: { id: roomId }, include: { players: true } });
      if (!room) {
        return NextResponse.json({ success: false, message: 'الغرفة غير موجودة' }, { status: 404 });
      }

      switch (action) {
        case 'end':
          await db.spyRoom.update({
            where: { id: roomId },
            data: { status: 'ended', endedAt: new Date() }
          });
          if (room.game) {
            await db.spyGame.update({
              where: { roomId },
              data: { endedAt: new Date(), winner: 'citizens', finishedReason: 'أُنهيت بواسطة المشرف' }
            });
          }
          logDescription = `تم إنهاء الغرفة ${room.code}`;
          break;

        case 'delete':
          await db.spyRoom.delete({ where: { id: roomId } });
          logDescription = `تم حذف الغرفة ${room.code}`;
          break;

        default:
          return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 });
      }
    } else if (gameType === 'quiz') {
      const room = await db.quizRoom.findUnique({ where: { id: roomId }, include: { players: true } });
      if (!room) {
        return NextResponse.json({ success: false, message: 'الغرفة غير موجودة' }, { status: 404 });
      }

      switch (action) {
        case 'end':
          await db.quizRoom.update({
            where: { id: roomId },
            data: { status: 'ended', endedAt: new Date() }
          });
          logDescription = `تم إنهاء الغرفة ${room.code}`;
          break;

        case 'delete':
          await db.quizRoom.delete({ where: { id: roomId } });
          logDescription = `تم حذف الغرفة ${room.code}`;
          break;

        default:
          return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 });
      }
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: `room_${action}`,
        targetType: 'room',
        targetId: roomId,
        description: logDescription,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({ success: true, message: logDescription });
  } catch (error) {
    console.error('Room action error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
  }
}
