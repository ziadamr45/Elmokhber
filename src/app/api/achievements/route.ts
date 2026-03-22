import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Title definitions based on total experience
export const TITLES = [
  { minXP: 0, maxXP: 99, title: 'مبتدئ', level: 1, color: '#9CA3AF' },      // Gray
  { minXP: 100, maxXP: 299, title: 'لاعب عادي', level: 2, color: '#22C55E' }, // Green
  { minXP: 300, maxXP: 699, title: 'محترف', level: 3, color: '#3B82F6' },    // Blue
  { minXP: 700, maxXP: 1499, title: 'خبير', level: 4, color: '#A855F7' },    // Purple
  { minXP: 1500, maxXP: Infinity, title: 'أسطورة', level: 5, color: '#F59E0B' }, // Gold
];

// Get title and level from total XP
export function getTitleFromXP(totalXP: number): { title: string; level: number; color: string; nextTitle: string | null; xpToNext: number } {
  const titleInfo = TITLES.find(t => totalXP >= t.minXP && totalXP <= t.maxXP) || TITLES[0];
  const nextTitleInfo = TITLES.find(t => t.level === titleInfo.level + 1);
  
  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    nextTitle: nextTitleInfo?.title || null,
    xpToNext: nextTitleInfo ? nextTitleInfo.minXP - totalXP : 0,
  };
}

// Default achievements to seed
const DEFAULT_ACHIEVEMENTS = [
  // General achievements
  { key: 'first_win', name: 'أول فوز', description: 'افوز لأول مرة', icon: '🏆', xpReward: 20, condition: JSON.stringify({ type: 'wins', value: 1 }), category: 'general' },
  { key: 'wins_10', name: 'بطل', description: 'افوز 10 مرات', icon: '🥇', xpReward: 50, condition: JSON.stringify({ type: 'wins', value: 10 }), category: 'general' },
  { key: 'wins_50', name: 'بطل متميز', description: 'افوز 50 مرة', icon: '👑', xpReward: 100, condition: JSON.stringify({ type: 'wins', value: 50 }), category: 'general' },
  { key: 'games_20', name: 'لاعب نشيط', description: 'العب 20 مباراة', icon: '🎮', xpReward: 30, condition: JSON.stringify({ type: 'games', value: 20 }), category: 'general' },
  { key: 'games_100', name: 'لاعب مخضرم', description: 'العب 100 مباراة', icon: '🎯', xpReward: 80, condition: JSON.stringify({ type: 'games', value: 100 }), category: 'general' },
  
  // Spy achievements
  { key: 'spy_win', name: 'مخبر ماكر', description: 'افوز كمخبر', icon: '🕵️', xpReward: 40, condition: JSON.stringify({ type: 'spy_wins', value: 1 }), category: 'spy' },
  { key: 'spy_wins_5', name: 'مخبر محترف', description: 'افوز 5 مرات كمخبر', icon: '🎭', xpReward: 60, condition: JSON.stringify({ type: 'spy_wins', value: 5 }), category: 'spy' },
  { key: 'spy_wins_20', name: 'سيد المخبرين', description: 'افوز 20 مرة كمخبر', icon: '🦹', xpReward: 120, condition: JSON.stringify({ type: 'spy_wins', value: 20 }), category: 'spy' },
  { key: 'word_guess_5', name: 'حزر ماكر', description: 'احزر الكلمة 5 مرات', icon: '💡', xpReward: 50, condition: JSON.stringify({ type: 'words_guessed', value: 5 }), category: 'spy' },
  
  // Citizen achievements
  { key: 'catch_spy', name: 'مكتشف المخبرين', description: 'اكتشف مخبر 5 مرات', icon: '🔍', xpReward: 30, condition: JSON.stringify({ type: 'spies_caught', value: 5 }), category: 'citizen' },
  { key: 'catch_spy_20', name: 'شرلوك هولمز', description: 'اكتشف مخبر 20 مرة', icon: '🔎', xpReward: 80, condition: JSON.stringify({ type: 'spies_caught', value: 20 }), category: 'citizen' },
  { key: 'citizen_wins_10', name: 'مواطن صالح', description: 'افوز 10 مرات كمواطن', icon: '🛡️', xpReward: 50, condition: JSON.stringify({ type: 'citizen_wins', value: 10 }), category: 'citizen' },
  
  // Streak achievements
  { key: 'streak_3', name: 'سلسلة الفوز', description: 'افوز 3 مرات متتالية', icon: '🔥', xpReward: 20, condition: JSON.stringify({ type: 'win_streak', value: 3 }), category: 'streak' },
  { key: 'streak_5', name: 'لا لا يُقهر', description: 'افوز 5 مرات متتالية', icon: '⚡', xpReward: 40, condition: JSON.stringify({ type: 'win_streak', value: 5 }), category: 'streak' },
  { key: 'streak_10', name: 'أسطورة الفوز', description: 'افوز 10 مرات متتالية', icon: '💫', xpReward: 100, condition: JSON.stringify({ type: 'win_streak', value: 10 }), category: 'streak' },
  { key: 'daily_streak_7', name: 'مثابر', description: 'حافظ على سلسلة 7 أيام', icon: '📅', xpReward: 50, condition: JSON.stringify({ type: 'daily_streak', value: 7 }), category: 'streak' },
];

// Seed achievements if not exist
async function seedAchievements() {
  const existing = await db.achievement.count();
  if (existing === 0) {
    await db.achievement.createMany({
      data: DEFAULT_ACHIEVEMENTS,
    });
    console.log('Seeded achievements');
  }
}

// GET: Get all achievements and user's unlocked ones
export async function GET(request: NextRequest) {
  try {
    await seedAchievements();
    
    const sessionToken = request.cookies.get('session_token')?.value;
    
    // Get all achievements
    const allAchievements = await db.achievement.findMany({
      orderBy: [{ category: 'asc' }, { xpReward: 'asc' }],
    });
    
    // Get user's unlocked achievements if logged in
    let unlockedIds: string[] = [];
    let userStats = null;
    
    if (sessionToken) {
      const user = await db.user.findUnique({
        where: { sessionToken },
        select: {
          id: true,
          gold: true,
          gamesPlayed: true,
          gamesWon: true,
          spyWins: true,
          citizenWins: true,
          totalSpyGames: true,
          totalCitizenGames: true,
          spiesCaught: true,
          wordsGuessed: true,
          currentStreak: true,
          longestStreak: true,
          title: true,
        },
      });
      
      if (user) {
        const unlocked = await db.userAchievement.findMany({
          where: { userId: user.id },
          select: { achievementId: true },
        });
        unlockedIds = unlocked.map(a => a.achievementId);
        
        const titleInfo = getTitleFromXP(user.gold);
        userStats = {
          ...user,
          titleInfo,
        };
      }
    }
    
    // Mark unlocked achievements
    const achievements = allAchievements.map(a => ({
      id: a.id,
      key: a.key,
      name: a.name,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      category: a.category,
      condition: JSON.parse(a.condition),
      unlocked: unlockedIds.includes(a.id),
    }));
    
    return NextResponse.json({ success: true, achievements, userStats });
  } catch (error) {
    console.error('Get achievements error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}
