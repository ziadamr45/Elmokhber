import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// Simple password hashing
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'elmokhber_salt').digest('hex');
}

// POST - Reset admin password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json({ 
        success: false, 
        message: 'البريد الإلكتروني وكلمة المرور الجديدة مطلوبان' 
      }, { status: 400 });
    }

    // Find admin
    const admin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!admin) {
      return NextResponse.json({ 
        success: false, 
        message: 'المدير غير موجود' 
      }, { status: 404 });
    }

    // Update password
    const hashedPassword = hashPassword(newPassword);
    
    await db.admin.update({
      where: { id: admin.id },
      data: {
        password: hashedPassword,
        sessionToken: null,
        sessionExpiry: null
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        adminId: admin.id,
        action: 'password_reset',
        targetType: 'admin',
        targetId: admin.id,
        description: `تم إعادة تعيين كلمة المرور للمدير ${admin.name}`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'حدث خطأ في إعادة تعيين كلمة المرور' 
    }, { status: 500 });
  }
}
