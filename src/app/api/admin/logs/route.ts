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

// GET - List audit logs
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skip = (page - 1) * limit;
    const action = searchParams.get('action') || 'all';
    const targetType = searchParams.get('targetType') || 'all';

    // Build where clause
    const where: any = {};
    if (action !== 'all') where.action = action;
    if (targetType !== 'all') where.targetType = targetType;

    const logs = await db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: { name: true, email: true }
        }
      }
    });

    const total = await db.auditLog.count({ where });

    return NextResponse.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        adminName: log.admin?.name || 'غير معروف',
        adminId: log.adminId,
        targetType: log.targetType,
        targetId: log.targetId,
        oldData: log.oldData ? JSON.parse(log.oldData) : null,
        newData: log.newData ? JSON.parse(log.newData) : null,
        description: log.description,
        ipAddress: log.ipAddress,
        timestamp: log.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
  }
}
