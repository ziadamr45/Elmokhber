import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

// Simple password hashing
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'elmokhber_salt').digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان' 
      }, { status: 400 });
    }

    // Find admin by email
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!admin) {
      return NextResponse.json({ 
        success: false, 
        message: 'بيانات الدخول غير صحيحة' 
      }, { status: 401 });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return NextResponse.json({ 
        success: false, 
        message: 'تم تعطيل حسابك' 
      }, { status: 403 });
    }

    // Verify password
    const hashedPassword = hashPassword(password);
    if (admin.password !== hashedPassword) {
      return NextResponse.json({ 
        success: false, 
        message: 'بيانات الدخول غير صحيحة' 
      }, { status: 401 });
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');
    const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update admin session
    await db.admin.update({
      where: { id: admin.id },
      data: {
        sessionToken,
        sessionExpiry,
        lastLoginAt: new Date()
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'login',
        targetType: 'admin',
        targetId: admin.id,
        description: `${admin.name} قام بتسجيل الدخول`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: JSON.parse(admin.permissions)
      }
    });

    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: sessionExpiry,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    }, { status: 500 });
  }
}

// Verify admin session
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('admin_session')?.value;

    if (!sessionToken) {
      return NextResponse.json({ 
        success: false, 
        message: 'غير مصرح' 
      }, { status: 401 });
    }

    const admin = await db.admin.findUnique({
      where: { sessionToken }
    });

    if (!admin || !admin.sessionExpiry || admin.sessionExpiry < new Date()) {
      return NextResponse.json({ 
        success: false, 
        message: 'الجلسة منتهية' 
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: JSON.parse(admin.permissions)
      }
    });
  } catch (error) {
    console.error('Verify session error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'حدث خطأ' 
    }, { status: 500 });
  }
}

// Logout
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('admin_session')?.value;

    if (sessionToken) {
      await db.admin.updateMany({
        where: { sessionToken },
        data: {
          sessionToken: null,
          sessionExpiry: null
        }
      });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete('admin_session');
    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}
