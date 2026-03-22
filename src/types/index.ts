// Game Mode Types
export type GameModeType = 'classic' | 'double-spies' | 'reversed' | 'silent';

export interface Category {
  id: string;
  name: string;
  icon: string;
  words: string[];
}

export interface QuestionSuggestion {
  category: string;
  questions: string[];
}

export interface GameMode {
  id: GameModeType;
  name: string;
  description: string;
  icon: string;
  isOnlineOnly?: boolean;
  minPlayers?: number;
}

export interface UserProfile {
  name: string;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface GameHistory {
  id: string;
  gameMode: 'offline' | 'online' | 'quiz';
  categoryName: string;
  playerCount: number;
  spyCount: number;
  winner: 'spies' | 'citizens' | null;
  secretWord: string;
  reason: string;
  points: number;
  playedAt: number;
}

export interface QuizQuestion {
  question: string;
  answer: string;
  options?: string[];
  type: 'direct' | 'fill-blank' | 'multiple-choice';
}

export interface QuizPlayer {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  isReady: boolean;
  hasAnswered: boolean;
  joinedAt: number;
}

export interface QuizRoom {
  code: string;
  isPublic: boolean;
  hostId: string;
  categoryId: string;
  mode: 'relaxed' | 'speed';
  roundsTotal: number;
  timePerRound: number;
  status: 'lobby' | 'running' | 'ended';
  currentRound: number;
  players: QuizPlayer[];
  currentQuestion: QuizQuestion | null;
  createdAt: number;
  updatedAt: number;
}

export interface PublicRoom {
  code: string;
  hostName: string;
  playerCount: number;
  categoryId: string;
  mode: string;
  createdAt: number;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  joinedAt: number;
  viewedRole: boolean;
  voteFor: string | null;
  gold: number;
}

export interface GameSettings {
  spyCount: number;
  gameTime: number;
  categoryId: string;
  gameMode: GameModeType;
}

export interface Game {
  id: string;
  categoryId: string;
  secretWord: string;
  spyIds: string[];
  gameMode: GameModeType;
  // For double-spies mode: partner spy ID
  partnerSpyId?: string | null;
  // For reversed mode: the one who knows the word
  knowerId?: string | null;
  startedAt: number;
  endsAt: number;
  voteOpen: boolean;
  winner: 'spies' | 'citizens' | null;
  finishedReason: string | null;
  endedAt: number | null;
  guessHistory: Array<{
    playerId: string;
    playerName: string;
    guess: string;
    success: boolean;
    at: number;
  }>;
}

export interface Room {
  code: string;
  isPublic: boolean;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  status: 'lobby' | 'running' | 'ended';
  settings: GameSettings;
  players: Player[];
  game: Game | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  gender: 'male' | 'female';
  avatar?: string | null;
  gold: number;
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  longestStreak: number;
  canClaimReward: boolean;
}

export interface Profile {
  name: string;
  language: 'ar';
  gold: number;
  gamesPlayed: number;
  gamesWon: number;
}

export interface HistoryEntry {
  id: string;
  date: number;
  mode: 'offline' | 'online';
  categoryName: string;
  playerCount: number;
  spyCount: number;
  players: string[];
  winner: 'spies' | 'citizens' | null;
  secretWord: string;
  reason: string;
  goldEarned: number;
}

export interface GameSetup {
  playerCount: number;
  spyCount: number;
  gameTime: number;
  categoryId: string;
  gameMode: GameModeType;
  playerNames: string[];
}

export interface OfflineMatch {
  id: string;
  categoryId: string;
  secretWord: string;
  playerNames: string[];
  spyIndices: number[];
  gameMode: GameModeType;
  // For double-spies mode: partner spy index
  partnerSpyIndex?: number | null;
  // For reversed mode: the one who knows the word
  knowerIndex?: number | null;
  gameTime: number;
  createdAt: number;
}

export interface ResultState {
  winner: 'spies' | 'citizens' | null;
  reason: string;
}

export type Winner = 'spies' | 'citizens' | null;
