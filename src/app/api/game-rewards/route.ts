import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// XP rewards configuration
const SPY_GAME_XP = {
  classic: {
    spyWin: 15,      // Spy wins
    citizenWin: 10,  // Citizens win
    participation: 5, // Just playing
  },
  'double-spies': {
    spyWin: 10,
    citizenWin: 10,
    participation: 5,
  },
  reversed: {
    spyWin: 10,
    citizenWin: 20,  // The lone knower gets more
    participation: 5,
  },
  silent: {
    spyWin: 15,
    citizenWin: 12,
    participation: 5,
  },
};

const QUIZ_GAME_XP = {
  relaxed: {
    perCorrectAnswer: 3,
    winBonus: 10,
    participation: 5,
  },
  speed: {
    perCorrectAnswer: 5,
    winBonus: 15,
    participation: 5,
  },
};

// Title system for calculating title info
const TITLES = [
  { minXP: 0, maxXP: 99, title: 'مبتدئ', level: 1, color: '#9CA3AF', icon: '🌱' },
  { minXP: 100, maxXP: 299, title: 'لاعب عادي', level: 2, color: '#22C55E', icon: '🎮' },
  { minXP: 300, maxXP: 699, title: 'محترف', level: 3, color: '#3B82F6', icon: '⭐' },
  { minXP: 700, maxXP: 1499, title: 'خبير', level: 4, color: '#A855F7', icon: '👑' },
  { minXP: 1500, maxXP: Infinity, title: 'أسطورة', level: 5, color: '#F59E0B', icon: '🔥' },
];

function getTitleFromXP(totalXP: number) {
  const titleInfo = TITLES.find(t => totalXP >= t.minXP && totalXP <= t.maxXP) || TITLES[0];
  const nextTitleInfo = TITLES.find(t => t.level === titleInfo.level + 1);
  const hasNextLevel = titleInfo.level < 5;

  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    icon: titleInfo.icon,
    nextTitle: hasNextLevel && nextTitleInfo ? nextTitleInfo.title : null,
    xpToNext: hasNextLevel && nextTitleInfo ? nextTitleInfo.minXP - totalXP : 0,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookies
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: 'غير مسجل الدخول' }, { status: 401 });
    }

    // Find user by session
    const user = await db.user.findUnique({
      where: { sessionToken },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'المستخدم غير موجود' }, { status: 404 });
    }

    const body = await request.json();
    const { gameType, gameMode, outcome, playerRole, stats } = body;

    let xpToAdd = 0;
    let reason = '';
    let description = '';

    if (gameType === 'spy') {
      const modeXP = SPY_GAME_XP[gameMode as keyof typeof SPY_GAME_XP] || SPY_GAME_XP.classic;

      if (outcome === 'win') {
        if (playerRole === 'spy') {
          xpToAdd = modeXP.spyWin;
          reason = 'spy_win';
          description = `فوز كمخبر - وضع ${gameMode}`;
        } else {
          xpToAdd = modeXP.citizenWin;
          reason = 'citizen_win';
          description = `فوز كمواطن - وضع ${gameMode}`;
        }
      } else {
        xpToAdd = modeXP.participation;
        reason = 'game_loss';
        description = `مشاركة في لعبة مخبر - وضع ${gameMode}`;
      }
    } else if (gameType === 'quiz') {
      const modeXP = QUIZ_GAME_XP[gameMode as keyof typeof QUIZ_GAME_XP] || QUIZ_GAME_XP.relaxed;
      const correctAnswers = stats?.correctAnswers || 0;

      xpToAdd = correctAnswers * modeXP.perCorrectAnswer + modeXP.participation;

      if (outcome === 'win') {
        xpToAdd += modeXP.winBonus;
        reason = 'quiz_win';
        description = `فوز في المسابقة - ${correctAnswers} إجابة صحيحة`;
      } else {
        reason = 'quiz_participation';
        description = `مشاركة في المسابقة - ${correctAnswers} إجابة صحيحة`;
      }
    } else {
      // Generic game participation
      xpToAdd = 5;
      reason = 'game_participation';
      description = 'مشاركة في لعبة';
    }

    // Update user's gold (XP) and stats
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        gold: { increment: xpToAdd },
        gamesPlayed: { increment: 1 },
        gamesWon: outcome === 'win' ? { increment: 1 } : undefined,
        // Update spy/citizen specific stats
        ...(gameType === 'spy' && playerRole === 'spy' ? {
          totalSpyGames: { increment: 1 },
          spyWins: outcome === 'win' ? { increment: 1 } : undefined,
        } : {}),
        ...(gameType === 'spy' && playerRole === 'citizen' ? {
          totalCitizenGames: { increment: 1 },
          citizenWins: outcome === 'win' ? { increment: 1 } : undefined,
        } : {}),
        ...(gameType === 'spy' && outcome === 'win' && playerRole === 'citizen' ? {
          spiesCaught: { increment: 1 },
        } : {}),
        ...(gameType === 'spy' && outcome === 'win' && playerRole === 'spy' ? {
          wordsGuessed: { increment: 1 },
        } : {}),
      },
    });

    // Create experience transaction record
    await db.experienceTransaction.create({
      data: {
        userId: user.id,
        amount: xpToAdd,
        reason,
        description,
      },
    });

    const titleInfo = getTitleFromXP(updatedUser.gold);

    return NextResponse.json({
      success: true,
      xpEarned: xpToAdd,
      totalXP: updatedUser.gold,
      titleInfo,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        gold: updatedUser.gold,
        gamesPlayed: updatedUser.gamesPlayed,
        gamesWon: updatedUser.gamesWon,
      },
    });
  } catch (error) {
    console.error('Game rewards API error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}
