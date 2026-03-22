import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

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

// GET - List users
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status === 'active') {
      where.isBanned = false;
    } else if (status === 'banned') {
      where.isBanned = true;
    }

    const users = await db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        gold: true,
        gamesPlayed: true,
        gamesWon: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        title: true,
        level: true,
        currentStreak: true,
        longestStreak: true,
        createdAt: true,
        lastLoginAt: true,
        sessionExpiry: true
      }
    });

    const total = await db.user.count({ where });

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        ...u,
        role: 'user',
        status: u.isBanned ? 'banned' : 'active',
        lastLogin: u.lastLoginAt?.toISOString() || u.createdAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, action, data } = body;

    if (!userId || !action) {
      return NextResponse.json({ success: false, message: 'بيانات ناقصة' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 });
    }

    let updateData: any = {};
    let logDescription = '';

    switch (action) {
      case 'ban':
        updateData = {
          isBanned: true,
          bannedAt: new Date(),
          bannedReason: data?.reason || 'محظور بواسطة المشرف',
          bannedBy: admin.id
        };
        logDescription = `تم حظر المستخدم ${user.name}`;
        break;

      case 'unban':
        updateData = {
          isBanned: false,
          bannedAt: null,
          bannedReason: null,
          bannedBy: null
        };
        logDescription = `تم إلغاء حظر المستخدم ${user.name}`;
        break;

      case 'edit':
        if (data?.name) updateData.name = data.name;
        if (data?.gold !== undefined) updateData.gold = data.gold;
        if (data?.title) updateData.title = data.title;
        if (data?.level !== undefined) updateData.level = data.level;
        logDescription = `تم تعديل بيانات المستخدم ${user.name}`;
        break;

      case 'modifyGold':
        const goldAmount = data?.amount;
        const goldReason = data?.reason || 'تعديل بواسطة المشرف';
        
        if (typeof goldAmount !== 'number' || goldAmount === 0) {
          return NextResponse.json({ 
            success: false, 
            message: 'كمية الذهب غير صحيحة' 
          }, { status: 400 });
        }
        
        const newGoldAmount = Math.max(0, user.gold + goldAmount);
        updateData.gold = newGoldAmount;
        
        // Create experience transaction record
        await db.experienceTransaction.create({
          data: {
            userId: userId,
            amount: goldAmount,
            reason: goldReason,
            description: `تعديل بواسطة المشرف: ${goldReason}`,
          }
        });
        
        logDescription = `تم ${goldAmount > 0 ? 'إضافة' : 'خصم'} ${Math.abs(goldAmount)} ذهب ${goldAmount > 0 ? 'إلى' : 'من'} المستخدم ${user.name}. السبب: ${goldReason}`;
        break;

      case 'resetPassword':
        // Use provided password or generate random one
        const newPassword = data?.newPassword || Math.random().toString(36).slice(-8);
        
        if (newPassword.length < 6) {
          return NextResponse.json({ 
            success: false, 
            message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' 
          }, { status: 400 });
        }
        
        // Use bcrypt to hash password (same as auth route)
        updateData.password = await bcrypt.hash(newPassword, 12);
        logDescription = `تم تغيير كلمة مرور المستخدم ${user.name}`;
        break;

      default:
        return NextResponse.json({ success: false, message: 'إجراء غير معروف' }, { status: 400 });
    }

    await db.user.update({
      where: { id: userId },
      data: updateData
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action,
        targetType: 'user',
        targetId: userId,
        oldData: JSON.stringify({ name: user.name, email: user.email, isBanned: user.isBanned }),
        newData: JSON.stringify(updateData),
        description: logDescription,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({ success: true, message: logDescription });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return NextResponse.json({ success: false, message: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, message: 'معرف المستخدم مطلوب' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Delete user
    await db.user.delete({ where: { id: userId } });

    // Create audit log
    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'delete_user',
        targetType: 'user',
        targetId: userId,
        oldData: JSON.stringify({ name: user.name, email: user.email }),
        description: `تم حذف المستخدم ${user.name}`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({ success: true, message: 'تم حذف المستخدم' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ success: false, message: 'حدث خطأ' }, { status: 500 });
  }
}
