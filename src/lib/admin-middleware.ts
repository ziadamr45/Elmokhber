/**
 * Admin Middleware
 * التحقق من صلاحيات المديرين
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  permissions: string[];
}

/**
 * التحقق من جلسة المدير
 */
export async function verifyAdminSession(request: NextRequest): Promise<AdminSession | null> {
  try {
    const sessionToken = request.headers.get('x-admin-session');
    
    if (!sessionToken) {
      return null;
    }

    const admin = await db.admin.findFirst({
      where: {
        sessionToken,
        sessionExpiry: { gte: new Date() },
        isActive: true,
      },
    });

    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role as 'admin' | 'super_admin',
      permissions: JSON.parse(admin.permissions || '[]'),
    };
  } catch (error) {
    console.error('Verify admin session error:', error);
    return null;
  }
}

/**
 * التحقق من إذن معين
 */
export function hasPermission(admin: AdminSession, permission: string): boolean {
  if (admin.role === 'super_admin') return true;
  return admin.permissions.includes(permission) || admin.permissions.includes('all');
}

/**
 * إضافة سجل تدقيق
 */
export async function createAuditLog(data: {
  adminId: string;
  action: string;
  targetType: string;
  targetId?: string;
  oldData?: any;
  newData?: any;
  description: string;
  request: NextRequest;
}) {
  try {
    await db.auditLog.create({
      data: {
        adminId: data.adminId,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId,
        oldData: data.oldData ? JSON.stringify(data.oldData) : null,
        newData: data.newData ? JSON.stringify(data.newData) : null,
        description: data.description,
        ipAddress: data.request.headers.get('x-forwarded-for') || 
                   data.request.headers.get('x-real-ip') || 'unknown',
        userAgent: data.request.headers.get('user-agent') || 'unknown',
      },
    });
  } catch (error) {
    console.error('Create audit log error:', error);
  }
}

/**
 * الصلاحيات المتاحة
 */
export const PERMISSIONS = {
  // المستخدمين
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  BAN_USERS: 'ban_users',
  
  // الغرف
  VIEW_ROOMS: 'view_rooms',
  MANAGE_ROOMS: 'manage_rooms',
  DELETE_ROOMS: 'delete_rooms',
  
  // الألعاب
  VIEW_GAMES: 'view_games',
  MANAGE_GAMES: 'manage_games',
  END_GAMES: 'end_games',
  
  // الإدارة
  VIEW_LOGS: 'view_logs',
  MANAGE_ADMINS: 'manage_admins',
  
  // النظام
  VIEW_STATS: 'view_stats',
  SYSTEM_CONFIG: 'system_config',
} as const;

/**
 * الصلاحيات الافتراضية للمدير العادي
 */
export const DEFAULT_ADMIN_PERMISSIONS = [
  PERMISSIONS.VIEW_USERS,
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.VIEW_ROOMS,
  PERMISSIONS.MANAGE_ROOMS,
  PERMISSIONS.VIEW_GAMES,
  PERMISSIONS.VIEW_LOGS,
  PERMISSIONS.VIEW_STATS,
];

/**
 * صلاحيات السوبر أدمن (كل الصلاحيات)
 */
export const SUPER_ADMIN_PERMISSIONS = ['all'];
