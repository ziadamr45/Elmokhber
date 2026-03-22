import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';

// Simple password hashing (same as in login route)
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'elmokhber_salt').digest('hex');
}

// Verify admin session (GET)
export async function GET(request: NextRequest) {
  try {
    // Check for token in Authorization header or cookie
    const authHeader = request.headers.get('authorization');
    const tokenFromHeader = authHeader?.replace('Bearer ', '');
    const tokenFromCookie = request.cookies.get('admin_session')?.value;
    const sessionToken = tokenFromHeader || tokenFromCookie;

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

    // Check if admin is active
    if (!admin.isActive) {
      return NextResponse.json({ 
        success: false, 
        message: 'تم تعطيل حسابك' 
      }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: JSON.parse(admin.permissions)
      },
      token: sessionToken
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'حدث خطأ' 
    }, { status: 500 });
  }
}

// Login (POST)
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
    try {
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
    } catch (e) {
      console.error('Failed to create audit log:', e);
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        permissions: JSON.parse(admin.permissions)
      },
      token: sessionToken
    });

    response.cookies.set('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
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

// Logout (DELETE)
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tokenFromHeader = authHeader?.replace('Bearer ', '');
    const tokenFromCookie = request.cookies.get('admin_session')?.value;
    const sessionToken = tokenFromHeader || tokenFromCookie;

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
