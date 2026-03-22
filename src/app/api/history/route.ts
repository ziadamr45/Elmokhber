import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Fetch game history
export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // For online games, get user's history from database
    const onlineHistory: unknown[] = [];
    if (sessionToken) {
      const user = await db.user.findUnique({
        where: { sessionToken },
        select: { id: true },
      });

      if (user) {
        const history = await db.gameHistory.findMany({
          where: { userId: user.id },
          orderBy: { playedAt: 'desc' },
          take: limit,
        });

        onlineHistory.push(...history.map((h) => ({
          id: h.id,
          gameType: h.gameType,
          playMode: h.playMode,
          gameMode: h.gameMode,
          categoryName: h.categoryName,
          playerCount: h.playerCount,
          playedAt: h.playedAt.toISOString(),
          winner: h.winner,
          winnerName: h.winnerName,
          reason: h.reason,
          xpEarned: h.xpEarned,
          // Spy specific
          spyCount: h.spyCount,
          secretWord: h.secretWord,
          spyNames: h.spyNames ? JSON.parse(h.spyNames) : [],
          spyDiscovered: h.spyDiscovered,
          wordGuessed: h.wordGuessed,
          guessedBy: h.guessedBy,
          // Quiz specific
          quizRounds: h.quizRounds,
          correctAnswers: h.correctAnswers,
          // Player data
          playerRankings: h.playerRankings ? JSON.parse(h.playerRankings) : [],
          guessHistory: h.guessHistory ? JSON.parse(h.guessHistory) : [],
        })));
      }
    }

    return NextResponse.json({ success: true, history: onlineHistory });
  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}

// POST - Save game history
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;
    const body = await request.json();

    const {
      gameType,
      playMode,
      gameMode,
      categoryName,
      playerCount,
      winner,
      winnerName,
      reason,
      xpEarned,
      // Spy specific
      spyCount,
      secretWord,
      spyNames,
      spyDiscovered,
      wordGuessed,
      guessedBy,
      // Quiz specific
      quizRounds,
      correctAnswers,
      // Player data
      playerRankings,
      guessHistory,
    } = body;

    // For online games, save to database if user is logged in
    if (playMode === 'online' && sessionToken) {
      const user = await db.user.findUnique({
        where: { sessionToken },
        select: { id: true },
      });

      if (user) {
        const historyEntry = await db.gameHistory.create({
          data: {
            userId: user.id,
            gameType,
            playMode,
            gameMode,
            categoryName,
            playerCount,
            winner,
            winnerName,
            reason,
            xpEarned: xpEarned || 0,
            spyCount: spyCount || 1,
            secretWord,
            spyNames: spyNames ? JSON.stringify(spyNames) : null,
            spyDiscovered: spyDiscovered || false,
            wordGuessed: wordGuessed || false,
            guessedBy,
            quizRounds: quizRounds || 0,
            correctAnswers: correctAnswers || 0,
            playerRankings: playerRankings ? JSON.stringify(playerRankings) : null,
            guessHistory: guessHistory ? JSON.stringify(guessHistory) : null,
          },
        });

        return NextResponse.json({ success: true, id: historyEntry.id });
      }
    }

    // For offline games or unauthenticated users, return the data for local storage
    return NextResponse.json({
      success: true,
      offlineEntry: {
        id: Math.random().toString(36).slice(2, 10),
        gameType,
        playMode,
        gameMode,
        categoryName,
        playerCount,
        playedAt: new Date().toISOString(),
        winner,
        winnerName,
        reason,
        xpEarned: xpEarned || 0,
        spyCount: spyCount || 1,
        secretWord,
        spyNames: spyNames || [],
        spyDiscovered: spyDiscovered || false,
        wordGuessed: wordGuessed || false,
        guessedBy,
        quizRounds: quizRounds || 0,
        correctAnswers: correctAnswers || 0,
        playerRankings: playerRankings || [],
        guessHistory: guessHistory || [],
      },
    });
  } catch (error) {
    console.error('History save error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}

// DELETE - Clear history
export async function DELETE(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session_token')?.value;

    if (sessionToken) {
      const user = await db.user.findUnique({
        where: { sessionToken },
        select: { id: true },
      });

      if (user) {
        await db.gameHistory.deleteMany({
          where: { userId: user.id },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('History clear error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}
