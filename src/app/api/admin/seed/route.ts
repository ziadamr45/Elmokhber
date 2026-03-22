import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// Simple password hashing
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'elmokhber_salt').digest('hex');
}

// POST - Seed default admin
export async function POST(request: NextRequest) {
  try {
    // Check if any admin exists
    const existingAdmin = await db.admin.findFirst();
    
    if (existingAdmin) {
      return NextResponse.json({ 
        success: false, 
        message: 'يوجد مدير بالفعل' 
      }, { status: 400 });
    }

    // Create default super admin
    const defaultPassword = 'admin123'; // Change this in production!
    const hashedPassword = hashPassword(defaultPassword);

    const admin = await db.admin.create({
      data: {
        email: 'admin@elmokhber.com',
        name: 'المدير الرئيسي',
        password: hashedPassword,
        role: 'super_admin',
        permissions: JSON.stringify([
          'manage_users',
          'manage_rooms',
          'manage_games',
          'view_logs',
          'manage_admins'
        ]),
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء المدير الافتراضي',
      credentials: {
        email: 'admin@elmokhber.com',
        password: defaultPassword
      }
    });
  } catch (error) {
    console.error('Seed admin error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'حدث خطأ في إنشاء المدير' 
    }, { status: 500 });
  }
}
