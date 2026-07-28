import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyAdminSession } from '@/lib/admin-middleware';

// Allow longer execution time for Vercel serverless functions
export const maxDuration = 60;

// POST - Reset admin password (requires authenticated admin session + current password)
export async function POST(request: NextRequest) {
  try {
    // Verify the requesting admin is authenticated
    const admin = await verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ 
        success: false, 
        message: 'غير مصرح - يجب تسجيل الدخول أولاً' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { email, currentPassword, newPassword } = body;

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json({ 
        success: false, 
        message: 'البريد الإلكتروني وكلمة المرور الحالية والجديدة مطلوبة' 
      }, { status: 400 });
    }

    // Only super_admin can reset other admins' passwords
    // Regular admins can only reset their own password
    const targetAdmin = await db.admin.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!targetAdmin) {
      return NextResponse.json({ 
        success: false, 
        message: 'المدير غير موجود' 
      }, { status: 404 });
    }

    // If resetting own password, verify current password
    if (admin.id === targetAdmin.id) {
      // Verify current password using bcrypt
      const isValid = await bcrypt.compare(currentPassword, targetAdmin.password);
      if (!isValid) {
        return NextResponse.json({ 
          success: false, 
          message: 'كلمة المرور الحالية غير صحيحة' 
        }, { status: 400 });
      }
    } else {
      // Only super_admin can reset other admins' passwords
      if (admin.role !== 'super_admin') {
        return NextResponse.json({ 
          success: false, 
          message: 'غير مصرح - فقط super_admin يمكنه إعادة تعيين كلمات مرور أخرى' 
        }, { status: 403 });
      }
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json({ 
        success: false, 
        message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' 
      }, { status: 400 });
    }

    // Hash new password with bcrypt (cost 12)
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await db.admin.update({
      where: { id: targetAdmin.id },
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
        targetId: targetAdmin.id,
        description: `تم إعادة تعيين كلمة المرور للمدير ${targetAdmin.name}`,
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
