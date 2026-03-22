import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_DURATION_HOURS = 24 * 7;
const DAILY_REWARD_GOLD = 25;

// Title definitions based on total experience
const TITLES = [
  { minXP: 0, maxXP: 99, title: 'مبتدئ', level: 1, color: '#9CA3AF' },
  { minXP: 100, maxXP: 299, title: 'لاعب عادي', level: 2, color: '#22C55E' },
  { minXP: 300, maxXP: 699, title: 'محترف', level: 3, color: '#3B82F6' },
  { minXP: 700, maxXP: 1499, title: 'خبير', level: 4, color: '#A855F7' },
  { minXP: 1500, maxXP: Infinity, title: 'أسطورة', level: 5, color: '#F59E0B' },
];

function getTitleFromXP(totalXP: number) {
  const titleInfo = TITLES.find(t => totalXP >= t.minXP && totalXP <= t.maxXP) || TITLES[0];
  // Find next title only if it's different from current (not at max level)
  const nextTitleInfo = TITLES.find(t => t.level === titleInfo.level + 1);
  // Don't show next title if already at max level (level 5)
  const hasNextLevel = titleInfo.level < 5;
  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    nextTitle: hasNextLevel && nextTitleInfo ? nextTitleInfo.title : null,
    xpToNext: hasNextLevel && nextTitleInfo ? nextTitleInfo.minXP - totalXP : 0,
  };
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + SESSION_DURATION_HOURS);
  return expiry;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

function calculateStreakBonus(streak: number): number {
  if (streak % 30 === 0 && streak > 0) return 100;
  if (streak % 7 === 0 && streak > 0) return 50;
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    if (!sessionToken) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Find user by sessionToken to check if session is valid
    const userWithToken = await db.user.findUnique({
      where: { sessionToken },
      select: {
        id: true,
        email: true,
        name: true,
        gender: true,
        avatar: true,
        gold: true,
        gamesPlayed: true,
        gamesWon: true,
        currentStreak: true,
        longestStreak: true,
        lastLoginAt: true,
        lastRewardAt: true,
        sessionExpiry: true,
        sessionToken: true,
        title: true,
        level: true,
        spyWins: true,
        citizenWins: true,
        totalSpyGames: true,
        totalCitizenGames: true,
        spiesCaught: true,
        wordsGuessed: true,
      },
    });

    // If no user found with this sessionToken, it means the session was invalidated
    // (user logged in from another device with a new sessionToken)
    if (!userWithToken) {
      const response = NextResponse.json({ 
        authenticated: false, 
        user: null,
        sessionInvalid: true,
        sessionInvalidReason: 'تم تسجيل الدخول من جهاز آخر'
      });
      response.cookies.delete('session_token');
      return response;
    }

    // Check if session has expired
    if (userWithToken.sessionExpiry && new Date() > userWithToken.sessionExpiry) {
      await db.user.update({
        where: { id: userWithToken.id },
        data: { sessionToken: null, sessionExpiry: null },
      });
      const response = NextResponse.json({ 
        authenticated: false, 
        user: null,
        sessionInvalid: true,
        sessionInvalidReason: 'انتهت صلاحية الجلسة'
      });
      response.cookies.delete('session_token');
      return response;
    }

    const now = new Date();
    const canClaimReward = !userWithToken.lastRewardAt || !isSameDay(userWithToken.lastRewardAt, now);
    const titleInfo = getTitleFromXP(userWithToken.gold);

    // Return user data without sensitive token
    const { sessionToken: _, ...user } = userWithToken;

    return NextResponse.json({
      authenticated: true,
      user: { 
        ...user, 
        canClaimReward,
        titleInfo,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ authenticated: false, user: null }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (action === 'register') {
      const { name, email, password, gender } = data;

      if (!name || !email || !password || !gender) {
        return NextResponse.json({ success: false, error: 'كل البيانات مطلوبة' }, { status: 400 });
      }

      if (password.length < 6) {
        return NextResponse.json({ success: false, error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 });
      }

      if (!['male', 'female'].includes(gender)) {
        return NextResponse.json({ success: false, error: 'الجنس يجب أن يكون ذكر أو أنثى' }, { status: 400 });
      }

      const existingUser = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return NextResponse.json({ success: false, error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const sessionToken = generateSessionToken();
      const sessionExpiry = getSessionExpiry();
      const now = new Date();

      const user = await db.user.create({
        data: {
          name: name.trim(),
          email: email.toLowerCase(),
          password: hashedPassword,
          gender,
          gold: 50,
          currentStreak: 1,
          longestStreak: 1,
          lastLoginAt: now,
          lastRewardAt: now,
          sessionToken,
          sessionExpiry,
        },
      });

      await db.dailyReward.create({
        data: { userId: user.id, goldAmount: 50, streakDay: 1 },
      });

      // Track experience transaction for new account (non-blocking)
      try {
        await db.experienceTransaction.create({
          data: {
            userId: user.id,
            amount: 50,
            reason: 'new_account',
            description: 'مكافأة إنشاء حساب جديد',
          },
        });
      } catch (e) {
        console.error('Failed to create experience transaction:', e);
      }

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          gender: user.gender,
          gold: user.gold,
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          canClaimReward: false,
          titleInfo: getTitleFromXP(user.gold),
        },
        sessionToken, // Include session token for socket authentication
      });

      response.cookies.set('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION_HOURS * 60 * 60,
        path: '/',
        expires: new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000),
      });

      return response;
    }

    if (action === 'login') {
      const { email, password } = data;

      if (!email || !password) {
        return NextResponse.json({ success: false, error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
      }

      const user = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        return NextResponse.json({ success: false, error: 'البريد الإلكتروني غير موجود' }, { status: 400 });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return NextResponse.json({ success: false, error: 'كلمة المرور غير صحيحة' }, { status: 400 });
      }

      const sessionToken = generateSessionToken();
      const sessionExpiry = getSessionExpiry();
      const now = new Date();

      await db.user.update({
        where: { id: user.id },
        data: { sessionToken, sessionExpiry, lastLoginAt: now },
      });

      const canClaimReward = !user.lastRewardAt || !isSameDay(user.lastRewardAt, now);
      const titleInfo = getTitleFromXP(user.gold);

      const response = NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          gender: user.gender,
          avatar: user.avatar,
          gold: user.gold,
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          canClaimReward,
          titleInfo,
        },
        sessionToken, // Include session token for socket authentication
      });

      response.cookies.set('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_DURATION_HOURS * 60 * 60,
        path: '/',
        expires: new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000),
      });

      return response;
    }

    if (action === 'logout') {
      const sessionToken = request.cookies.get('session_token')?.value;

      if (sessionToken) {
        await db.user.updateMany({
          where: { sessionToken },
          data: { sessionToken: null, sessionExpiry: null },
        });
      }

      const response = NextResponse.json({ success: true });
      response.cookies.delete('session_token');
      return response;
    }

    if (action === 'claim-reward') {
      const sessionToken = request.cookies.get('session_token')?.value;

      if (!sessionToken) {
        return NextResponse.json({ success: false, error: 'غير مسجل الدخول' }, { status: 401 });
      }

      const user = await db.user.findUnique({ where: { sessionToken } });

      if (!user) {
        return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
      }

      const now = new Date();

      if (user.lastRewardAt && isSameDay(user.lastRewardAt, now)) {
        return NextResponse.json({ success: false, error: 'تم استلام المكافأة اليوم بالفعل' }, { status: 400 });
      }

      let newStreak = 1;
      if (user.lastRewardAt && isYesterday(user.lastRewardAt)) {
        newStreak = user.currentStreak + 1;
      }

      const streakBonus = calculateStreakBonus(newStreak);
      const totalGold = DAILY_REWARD_GOLD + streakBonus;

      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: {
          gold: { increment: totalGold },
          currentStreak: newStreak,
          longestStreak: Math.max(user.longestStreak, newStreak),
          lastRewardAt: now,
        },
      });

      await db.dailyReward.create({
        data: { userId: user.id, goldAmount: totalGold, streakDay: newStreak },
      });

      // Track experience transaction for daily reward
      await db.experienceTransaction.create({
        data: {
          userId: user.id,
          amount: totalGold,
          reason: streakBonus > 0 ? 'daily_reward_bonus' : 'daily_reward',
          description: streakBonus > 0 ? `مكافأة يومية + بونص السلسلة (${newStreak} يوم)` : `مكافأة يومية (${newStreak} يوم متتالي)`,
        },
      });

      return NextResponse.json({
        success: true,
        reward: { gold: totalGold, streak: newStreak, streakBonus, isMilestone: streakBonus > 0 },
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          gender: updatedUser.gender,
          avatar: updatedUser.avatar,
          gold: updatedUser.gold,
          gamesPlayed: updatedUser.gamesPlayed,
          gamesWon: updatedUser.gamesWon,
          currentStreak: updatedUser.currentStreak,
          longestStreak: updatedUser.longestStreak,
          canClaimReward: false,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
