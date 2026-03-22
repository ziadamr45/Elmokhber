import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Types
interface TitleInfo {
  title: string;
  level: number;
  color: string;
  icon: string;
}

interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: Date;
  viewedRole: boolean;
  voteFor: string | null;
  gold: number;
  titleInfo?: TitleInfo;
}

interface GameSettings {
  spyCount: number;
  gameTime: number;
  categoryId: string;
  gameMode: 'classic' | 'double-spies' | 'reversed' | 'silent';
}

interface Game {
  id: string;
  categoryId: string;
  secretWord: string;
  spyIds: string[];
  gameMode: 'classic' | 'double-spies' | 'reversed' | 'silent';
  partnerSpyId?: string | null;
  knowerId?: string | null;
  startedAt: Date;
  endsAt: Date;
  voteOpen: boolean;
  winner: 'spies' | 'citizens' | null;
  finishedReason: string | null;
  endedAt: Date | null;
  guessHistory: Array<{
    playerId: string;
    playerName: string;
    guess: string;
    success: boolean;
    at: number;
  }>;
}

interface Room {
  code: string;
  name: string | null;
  isPublic: boolean;
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  status: 'lobby' | 'running' | 'ended';
  settings: GameSettings;
  players: Player[];
  game: Game | null;
}

// Helper functions
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const categories = [
  { id: 'places', name: 'أماكن', icon: '🏢' },
  { id: 'countries', name: 'دول', icon: '🌍' },
  { id: 'jobs', name: 'وظائف', icon: '💼' },
  { id: 'food', name: 'أكل', icon: '🍽️' },
  { id: 'sports', name: 'رياضة', icon: '⚽' },
  { id: 'movies', name: 'أفلام', icon: '🎬' },
  { id: 'random', name: 'مفاجأة', icon: '🎲' },
];

const categoryWords: Record<string, string[]> = {
  places: ['مكتبة', 'سوق', 'مدرسة', 'محطة قطار', 'فندق', 'مطعم', 'جامعة', 'بنك', 'مطار', 'مستشفى'],
  countries: ['عمان', 'البحرين', 'الكويت', 'قطر', 'لبنان', 'الأردن', 'المغرب', 'الإمارات', 'السعودية', 'مصر'],
  jobs: ['صحفي', 'محاسب', 'مبرمج', 'طباخ', 'شرطي', 'طيار', 'معلم', 'محامي', 'مهندس', 'طبيب'],
  food: ['محشي', 'جبنة', 'طعمية', 'فتة', 'مقلوبة', 'ملوخية', 'كباب', 'شاورما', 'فلافل', 'كشري'],
  sports: ['هوكي', 'كرة طائرة', 'جماز', 'ملاكمة', 'كاراتيه', 'جري', 'سباحة', 'تنس', 'كرة السلة', 'كرة القدم'],
  movies: ['خيال علمي', 'إثارة', 'رعب', 'كوميديا', 'قصة حب', 'رحلة', 'النهاية', 'البداية', 'الأمير الصغير', 'تيتانيك'],
  random: [],
};

function getSecretWord(categoryId: string): string {
  if (categoryId === 'random') {
    const allWords = Object.values(categoryWords).flat();
    return allWords[Math.floor(Math.random() * allWords.length)];
  }
  const words = categoryWords[categoryId] || categoryWords.places;
  return words[Math.floor(Math.random() * words.length)];
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignSpyIds(playerIds: string[], spyCount: number): string[] {
  return shuffleArray(playerIds).slice(0, spyCount);
}

// Role assignment based on game mode
interface RoleAssignment {
  spyIds: string[];
  knowerId: string | null;
  partnerSpyId: string | null;
}

function assignRolesByMode(playerIds: string[], gameMode: string): RoleAssignment {
  const shuffled = shuffleArray(playerIds);

  switch (gameMode) {
    case 'classic':
    case 'silent': {
      const spyId = shuffled[0];
      return { spyIds: [spyId], knowerId: null, partnerSpyId: null };
    }
    case 'double-spies': {
      const spy1 = shuffled[0];
      const spy2 = shuffled[1];
      return {
        spyIds: [spy1, spy2].sort((a, b) => a.localeCompare(b)),
        knowerId: null,
        partnerSpyId: spy2,
      };
    }
    case 'reversed': {
      const knowerId = shuffled[0];
      const spyIds = playerIds.filter((id) => id !== knowerId);
      return { spyIds, knowerId, partnerSpyId: null };
    }
    default:
      return { spyIds: [shuffled[0]], knowerId: null, partnerSpyId: null };
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

function getTitleFromLevel(level: number) {
  const titleInfo = PLAYER_TITLES.find(t => t.level === level) || PLAYER_TITLES[0];
  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    icon: titleInfo.icon,
  };
}

// Transform database room to API format
function formatRoom(dbRoom: any): Room {
  const players: Player[] = dbRoom.players.map((p: any) => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    isReady: p.isReady,
    joinedAt: p.joinedAt,
    viewedRole: p.viewedRole,
    voteFor: p.voteFor,
    gold: p.gold,
    titleInfo: getTitleFromLevel(p.level || 1),
  }));

  let game: Game | null = null;
  if (dbRoom.game) {
    const g = dbRoom.game;
    game = {
      id: g.id,
      categoryId: g.categoryId,
      secretWord: g.secretWord,
      spyIds: JSON.parse(g.spyIds || '[]'),
      gameMode: g.gameMode,
      partnerSpyId: g.partnerSpyId,
      knowerId: g.knowerId,
      startedAt: g.startedAt,
      endsAt: g.endsAt,
      voteOpen: g.voteOpen,
      winner: g.winner,
      finishedReason: g.finishedReason,
      endedAt: g.endedAt,
      guessHistory: JSON.parse(g.guessHistory || '[]'),
    };
  }

  return {
    code: dbRoom.code,
    name: dbRoom.name || null,
    isPublic: dbRoom.isPublic,
    hostId: dbRoom.hostId,
    createdAt: dbRoom.createdAt,
    updatedAt: dbRoom.updatedAt,
    lastActivityAt: dbRoom.lastActivityAt,
    status: dbRoom.status,
    settings: {
      spyCount: dbRoom.spyCount,
      gameTime: dbRoom.gameTime,
      categoryId: dbRoom.categoryId,
      gameMode: dbRoom.gameMode,
    },
    players,
    game,
  };
}

// Cleanup old rooms
async function cleanupOldRooms() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Delete ended rooms older than 5 minutes
    await db.spyRoom.deleteMany({
      where: {
        status: 'ended',
        updatedAt: { lt: fiveMinutesAgo },
      },
    });

    // Delete lobby rooms with no activity for 2 minutes
    await db.spyRoom.deleteMany({
      where: {
        status: 'lobby',
        lastActivityAt: { lt: twoMinutesAgo },
      },
    });

    // Delete running rooms with no activity for 30 minutes
    await db.spyRoom.deleteMany({
      where: {
        status: 'running',
        lastActivityAt: { lt: thirtyMinutesAgo },
      },
    });
  } catch (error) {
    console.error('[Cleanup] Error:', error);
  }
}

// Run cleanup occasionally
if (Math.random() < 0.1) {
  cleanupOldRooms().catch(console.error);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const playerId = searchParams.get('playerId');
  const roomCode = searchParams.get('roomCode');

  try {
    switch (action) {
      case 'health':
        return NextResponse.json({ success: true, status: 'ok' });

      case 'public-rooms': {
        const rooms = await db.spyRoom.findMany({
          where: {
            isPublic: true,
            status: 'lobby',
          },
          include: { players: true },
          orderBy: { createdAt: 'desc' },
        });

        const publicRooms = rooms.map((r) => ({
          code: r.code,
          name: r.name || null,
          hostName: r.players.find((p) => p.id === r.hostId)?.name || 'غير معروف',
          playerCount: r.players.length,
          settings: {
            spyCount: r.spyCount,
            gameTime: r.gameTime,
            categoryId: r.categoryId,
            gameMode: r.gameMode,
          },
          createdAt: r.createdAt.getTime(),
        }));

        return NextResponse.json({ success: true, rooms: publicRooms });
      }

      case 'get-room': {
        if (!roomCode) {
          return NextResponse.json({ success: false, error: 'كود الغرفة مطلوب' }, { status: 400 });
        }

        const room = await db.spyRoom.findUnique({
          where: { code: roomCode.toUpperCase() },
          include: { players: true, game: true },
        });

        if (!room) {
          return NextResponse.json({ success: false, error: 'الغرفة مش موجودة' }, { status: 404 });
        }

        return NextResponse.json({ success: true, room: formatRoom(room) });
      }

      case 'poll':
      case 'room-state': {
        if (!playerId) {
          return NextResponse.json({ success: false, error: 'معرف اللاعب مطلوب' }, { status: 400 });
        }

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: {
            room: {
              include: { players: true, game: true },
            },
          },
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, inRoom: false });
        }

        // Update activity
        await db.spyRoom.update({
          where: { id: player.room.id },
          data: { lastActivityAt: new Date() },
        });

        return NextResponse.json({ success: true, inRoom: true, room: formatRoom(player.room) });
      }

      default:
        return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
    }
  } catch (error) {
    console.error('Game API error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'create-room': {
        const { playerName, isPublic, settings, playerGold, playerId: existingPlayerId, roomName } = data;

        // Check if player is already in a room
        if (existingPlayerId) {
          const existingPlayer = await db.spyPlayer.findUnique({
            where: { id: existingPlayerId },
            include: { room: true },
          });

          if (existingPlayer?.room && existingPlayer.room.status !== 'ended') {
            // Remove player from old room
            await db.spyPlayer.delete({ where: { id: existingPlayerId } });

            // Delete room if empty
            const remainingPlayers = await db.spyPlayer.count({
              where: { roomId: existingPlayer.room.id },
            });

            if (remainingPlayers === 0) {
              await db.spyRoom.delete({ where: { id: existingPlayer.room.id } });
            }
          }
        }

        const code = generateRoomCode();
        const playerId = existingPlayerId || generateId();
        const now = new Date();

        const room = await db.spyRoom.create({
          data: {
            code,
            name: roomName || null,
            isPublic,
            hostId: playerId,
            spyCount: settings?.spyCount || 1,
            gameTime: settings?.gameTime || 5,
            categoryId: settings?.categoryId || 'places',
            gameMode: settings?.gameMode || 'classic',
            status: 'lobby',
            lastActivityAt: now,
            players: {
              create: {
                id: playerId,
                name: playerName,
                isHost: true,
                isReady: true,
                viewedRole: false,
                gold: playerGold || 0,
              },
            },
          },
          include: { players: true, game: true },
        });

        console.log(`[Game] Room ${code} created by ${playerName}`);

        return NextResponse.json({ success: true, room: formatRoom(room), playerId });
      }

      case 'join-room': {
        const { roomCode, playerName, playerGold } = data;
        const code = roomCode.toUpperCase();

        const room = await db.spyRoom.findUnique({
          where: { code },
          include: { players: true },
        });

        if (!room) {
          return NextResponse.json({ success: false, error: 'الغرفة مش موجودة' }, { status: 404 });
        }

        if (room.status !== 'lobby') {
          return NextResponse.json({ success: false, error: 'اللعبة بدأت بالفعل' }, { status: 400 });
        }

        if (room.players.length >= 12) {
          return NextResponse.json({ success: false, error: 'الغرفة ممتلئة' }, { status: 400 });
        }

        const playerId = generateId();

        await db.spyPlayer.create({
          data: {
            id: playerId,
            roomId: room.id,
            name: playerName,
            isHost: false,
            isReady: true,
            viewedRole: false,
            gold: playerGold || 0,
          },
        });

        const updatedRoom = await db.spyRoom.update({
          where: { id: room.id },
          data: { lastActivityAt: new Date() },
          include: { players: true, game: true },
        });

        console.log(`[Game] ${playerName} joined room ${code}`);

        return NextResponse.json({ success: true, room: formatRoom(updatedRoom), playerId });
      }

      case 'leave-room': {
        const { playerId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { players: true } } },
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: true });
        }

        const room = player.room;
        const wasHost = room.hostId === playerId;

        // Delete player
        await db.spyPlayer.delete({ where: { id: playerId } });

        // Check remaining players
        const remainingPlayers = await db.spyPlayer.findMany({
          where: { roomId: room.id },
        });

        // If no players left, delete room
        if (remainingPlayers.length === 0) {
          await db.spyRoom.delete({ where: { id: room.id } });
          console.log(`[Leave] Room ${room.code} deleted (empty)`);
          return NextResponse.json({ success: true, roomDeleted: true });
        }

        // If host left during running game, close room
        if (wasHost && room.status === 'running') {
          await db.spyRoom.update({
            where: { id: room.id },
            data: { status: 'ended', endedAt: new Date() },
          });
          console.log(`[Leave] Room ${room.code} closed (host left during game)`);
          return NextResponse.json({
            success: true,
            roomDeleted: true,
            reason: 'صاحب الغرفة غادر أثناء اللعب',
          });
        }

        // Transfer host
        if (wasHost) {
          const newHost = remainingPlayers[0];
          await db.spyPlayer.update({
            where: { id: newHost.id },
            data: { isHost: true },
          });
          await db.spyRoom.update({
            where: { id: room.id },
            data: { hostId: newHost.id, lastActivityAt: new Date() },
          });
          console.log(`[Leave] Host transferred to ${newHost.name} in room ${room.code}`);
        }

        const updatedRoom = await db.spyRoom.findUnique({
          where: { id: room.id },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, room: updatedRoom ? formatRoom(updatedRoom) : null });
      }

      case 'update-settings': {
        const { playerId, settings } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: { room: true },
        });

        if (!player || !player.room || player.room.hostId !== playerId) {
          return NextResponse.json({ success: false, error: 'مش صاحب الغرفة' }, { status: 403 });
        }

        const updatedRoom = await db.spyRoom.update({
          where: { id: player.room.id },
          data: {
            ...settings,
            lastActivityAt: new Date(),
          },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, room: formatRoom(updatedRoom) });
      }

      case 'start-game': {
        const { playerId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { players: true } } },
        });

        if (!player || !player.room || player.room.hostId !== playerId) {
          return NextResponse.json({ success: false, error: 'مش صاحب الغرفة' }, { status: 403 });
        }

        const room = player.room;
        const minPlayers = room.gameMode === 'double-spies' ? 4 : 3;

        if (room.players.length < minPlayers) {
          return NextResponse.json(
            { success: false, error: `لازم لا يقل عن ${minPlayers} لاعبين على الأقل` },
            { status: 400 }
          );
        }

        // Assign roles
        const playerIds = room.players.map((p) => p.id);
        const roles = assignRolesByMode(playerIds, room.gameMode);
        const secretWord = getSecretWord(room.categoryId);
        const now = new Date();
        const endsAt = new Date(now.getTime() + room.gameTime * 60 * 1000);

        // Create game
        await db.spyGame.create({
          data: {
            roomId: room.id,
            categoryId: room.categoryId,
            secretWord,
            spyIds: JSON.stringify(roles.spyIds),
            gameMode: room.gameMode,
            partnerSpyId: roles.partnerSpyId,
            knowerId: roles.knowerId,
            endsAt,
          },
        });

        // Update room status
        const updatedRoom = await db.spyRoom.update({
          where: { id: room.id },
          data: {
            status: 'running',
            startedAt: now,
            lastActivityAt: now,
          },
          include: { players: true, game: true },
        });

        // Reset player states
        await db.spyPlayer.updateMany({
          where: { roomId: room.id },
          data: { viewedRole: false, voteFor: null },
        });

        console.log(`[Game] Started in room ${room.code}, mode: ${room.gameMode}`);

        return NextResponse.json({ success: true, room: formatRoom(updatedRoom) });
      }

      case 'get-role': {
        const { playerId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: {
            room: {
              include: { players: true, game: true },
            },
          },
        });

        if (!player || !player.room || !player.room.game) {
          return NextResponse.json({ success: false, error: 'مفيش لعبة' }, { status: 400 });
        }

        const game = player.room.game;
        const spyIds = JSON.parse(game.spyIds || '[]');
        const isSpy = spyIds.includes(playerId);
        const isKnower = game.knowerId === playerId;

        // Mark as viewed
        await db.spyPlayer.update({
          where: { id: playerId },
          data: { viewedRole: true },
        });

        // For double-spies mode, include partner info
        let partnerSpyName: string | null = null;
        if (game.gameMode === 'double-spies' && isSpy) {
          const partnerId = spyIds.find((id: string) => id !== playerId);
          if (partnerId) {
            const partner = player.room.players.find((p) => p.id === partnerId);
            partnerSpyName = partner?.name || null;
          }
        }

        const playerIsKnower = game.gameMode === 'reversed' && isKnower;

        return NextResponse.json({
          success: true,
          isSpy: isSpy && !playerIsKnower,
          isKnower: playerIsKnower,
          secretWord: isSpy && !playerIsKnower ? null : game.secretWord,
          partnerSpyName,
          gameMode: game.gameMode,
          category: categories.find((c) => c.id === game.categoryId),
        });
      }

      case 'guess-word': {
        const { playerId, guess } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: {
            room: {
              include: { players: true, game: true },
            },
          },
        });

        if (!player || !player.room || !player.room.game) {
          return NextResponse.json({ success: false, error: 'مفيش لعبة' }, { status: 400 });
        }

        const game = player.room.game;
        const spyIds = JSON.parse(game.spyIds || '[]');

        if (!spyIds.includes(playerId)) {
          return NextResponse.json({ success: false, error: 'أنت مش المخبر!' }, { status: 403 });
        }

        if (game.winner) {
          return NextResponse.json({ success: false, error: 'اللعبة انتهت بالفعل' }, { status: 400 });
        }

        const correct = guess.toLowerCase().trim() === game.secretWord.toLowerCase().trim();

        const guessHistory = JSON.parse(game.guessHistory || '[]');
        guessHistory.push({
          playerId,
          playerName: player.name,
          guess,
          success: correct,
          at: Date.now(),
        });

        if (correct) {
          await db.spyGame.update({
            where: { id: game.id },
            data: {
              winner: 'spies',
              finishedReason: `${player.name} خمن الكلمة صح!`,
              endedAt: new Date(),
              guessHistory: JSON.stringify(guessHistory),
            },
          });

          await db.spyRoom.update({
            where: { id: player.room.id },
            data: { status: 'ended', endedAt: new Date() },
          });
        } else {
          await db.spyGame.update({
            where: { id: game.id },
            data: { guessHistory: JSON.stringify(guessHistory) },
          });
        }

        const updatedRoom = await db.spyRoom.findUnique({
          where: { id: player.room.id },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, correct, room: updatedRoom ? formatRoom(updatedRoom) : null });
      }

      case 'vote': {
        const { playerId, targetId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: { room: true },
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, error: 'مش في غرفة' }, { status: 400 });
        }

        await db.spyPlayer.update({
          where: { id: playerId },
          data: { voteFor: targetId },
        });

        await db.spyRoom.update({
          where: { id: player.room.id },
          data: { lastActivityAt: new Date() },
        });

        const updatedRoom = await db.spyRoom.findUnique({
          where: { id: player.room.id },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, room: updatedRoom ? formatRoom(updatedRoom) : null });
      }

      case 'open-voting': {
        const { playerId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { game: true } } },
        });

        if (!player || !player.room || !player.room.game) {
          return NextResponse.json({ success: false, error: 'مفيش لعبة' }, { status: 400 });
        }

        await db.spyGame.update({
          where: { id: player.room.game.id },
          data: { voteOpen: true },
        });

        const updatedRoom = await db.spyRoom.findUnique({
          where: { id: player.room.id },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, room: updatedRoom ? formatRoom(updatedRoom) : null });
      }

      case 'calculate-votes': {
        const { playerId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: {
            room: {
              include: { players: true, game: true },
            },
          },
        });

        if (!player || !player.room || !player.room.game) {
          return NextResponse.json({ success: false, error: 'مفيش لعبة' }, { status: 400 });
        }

        const game = player.room.game;
        const players = player.room.players;
        const spyIds = JSON.parse(game.spyIds || '[]');

        if (game.winner) {
          return NextResponse.json({ success: false, error: 'اللعبة انتهت بالفعل' }, { status: 400 });
        }

        // Count votes
        const votes = new Map<string, number>();
        for (const p of players) {
          if (p.voteFor) {
            votes.set(p.voteFor, (votes.get(p.voteFor) || 0) + 1);
          }
        }

        let maxVotes = 0;
        let mostVotedId: string | null = null;
        let tie = false;

        for (const [pId, count] of votes) {
          if (count > maxVotes) {
            maxVotes = count;
            mostVotedId = pId;
            tie = false;
          } else if (count === maxVotes) {
            tie = true;
          }
        }

        let winner: string;
        let finishedReason: string;

        if (tie || !mostVotedId) {
          winner = 'spies';
          finishedReason = 'التصويت تعادل! - المخبر كسب';
        } else {
          const isSpy = spyIds.includes(mostVotedId);
          const votedPlayer = players.find((p) => p.id === mostVotedId);

          if (isSpy) {
            winner = 'citizens';
            finishedReason = `الناس كشفت المخبر: ${votedPlayer?.name}!`;
          } else {
            winner = 'spies';
            finishedReason = `الناس اتهمت البريء: ${votedPlayer?.name}!`;
          }
        }

        await db.spyGame.update({
          where: { id: game.id },
          data: {
            winner,
            finishedReason,
            endedAt: new Date(),
          },
        });

        await db.spyRoom.update({
          where: { id: player.room.id },
          data: { status: 'ended', endedAt: new Date() },
        });

        console.log(`[Game] Ended in room ${player.room.code}, winner: ${winner}`);

        const updatedRoom = await db.spyRoom.findUnique({
          where: { id: player.room.id },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, room: updatedRoom ? formatRoom(updatedRoom) : null });
      }

      case 'play-again': {
        const { playerId } = data;

        const player = await db.spyPlayer.findUnique({
          where: { id: playerId },
          include: { room: true },
        });

        if (!player || !player.room || player.room.hostId !== playerId) {
          return NextResponse.json({ success: false, error: 'مش صاحب الغرفة' }, { status: 403 });
        }

        // Delete existing game
        if (player.room.game) {
          await db.spyGame.delete({ where: { roomId: player.room.id } });
        }

        // Reset room
        await db.spyRoom.update({
          where: { id: player.room.id },
          data: {
            status: 'lobby',
            lastActivityAt: new Date(),
          },
        });

        // Reset players
        await db.spyPlayer.updateMany({
          where: { roomId: player.room.id },
          data: { viewedRole: false, voteFor: null, isReady: true },
        });

        const updatedRoom = await db.spyRoom.findUnique({
          where: { id: player.room.id },
          include: { players: true, game: true },
        });

        return NextResponse.json({ success: true, room: updatedRoom ? formatRoom(updatedRoom) : null });
      }

      default:
        return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
    }
  } catch (error) {
    console.error('Game API error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}
