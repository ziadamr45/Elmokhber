import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'غير مسجل الدخول' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { sessionToken },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
    }

    // Use Prisma's experienceTransaction delegate
    const transactions = await db.experienceTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      success: true,
      transactions: transactions.map((t) => ({
        id: t.id,
        amount: t.amount,
        reason: t.reason,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Experience history error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
