import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to get authenticated user from session token
async function getAuthenticatedUser(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;
  if (!sessionToken) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { sessionToken },
    select: {
      id: true,
      name: true,
      sessionExpiry: true,
    },
  });

  if (!user) {
    return null;
  }

  // Check if session is expired
  if (user.sessionExpiry && new Date() > user.sessionExpiry) {
    return null;
  }

  return user;
}

// GET - Search users by name
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 1) {
      return NextResponse.json({ users: [] });
    }

    const searchQuery = query.trim();

    // Search users by name OR by ID
    const users = await db.user.findMany({
      where: {
        AND: [
          // Exclude current user
          { id: { not: user.id } },
          // Search by name OR by ID
          {
            OR: [
              { name: { contains: searchQuery } },
              { id: { equals: searchQuery } }, // Exact ID match
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        level: true,
        title: true,
        gold: true,
      },
      take: 20, // Limit results
    });

    // Calculate title info for each user
    const usersWithTitles = users.map((u) => {
      // Get title based on XP (gold)
      const titleInfo = getTitleFromXP(u.gold || 0);
      return {
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        level: u.level || titleInfo.level,
        title: u.title || titleInfo.title,
      };
    });

    return NextResponse.json({ users: usersWithTitles });
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// Title system constants - synced with frontend
const PLAYER_TITLES = [
  { minXP: 0, maxXP: 99, title: 'مبتدئ', level: 1, color: '#9CA3AF', icon: '🌱' },
  { minXP: 100, maxXP: 299, title: 'لاعب عادي', level: 2, color: '#22C55E', icon: '🎮' },
  { minXP: 300, maxXP: 699, title: 'محترف', level: 3, color: '#3B82F6', icon: '⭐' },
  { minXP: 700, maxXP: 1499, title: 'خبير', level: 4, color: '#A855F7', icon: '👑' },
  { minXP: 1500, maxXP: Infinity, title: 'أسطورة', level: 5, color: '#F59E0B', icon: '🔥' },
];

function getTitleFromXP(totalXP: number) {
  const titleInfo = PLAYER_TITLES.find(t => totalXP >= t.minXP && totalXP <= t.maxXP) || PLAYER_TITLES[0];
  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    icon: titleInfo.icon,
  };
}
