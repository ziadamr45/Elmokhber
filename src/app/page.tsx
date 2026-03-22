'use client';
import { ReactNode, useEffect, useMemo, useState, useCallback, useRef, useId } from 'react';
import { categories, gameModes, questionSuggestions, tips, silentModeTips } from '@/data/categories';
import type { GameModeType } from '@/types';
// VoiceRoom removed - using RoomVoiceChat instead
import { SocialPanel, SocialView, NotificationBell, RoomChat, InviteFriendsModal } from '@/components/social';
import { useSocial } from '@/hooks/useSocial';
import { RoomVoiceChat } from '@/components/room';
import { RoomCodeDisplay } from '@/components/RoomShareButton';
import Onboarding, { hasCompletedOnboarding } from '@/components/Onboarding';
import PrayerReminder from '@/components/PrayerReminder';
import CoinIcon from '@/components/CoinIcon';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import { OfflineIndicator, useOffline } from '@/hooks/useOffline';
import type { Notification as SocialNotification } from '@/hooks/useSocial';
import { useGameSocket, type Room as SocketRoom, type Player as SocketPlayer, type GameSettings as SocketGameSettings } from '@/hooks/useGameSocket';
import { usePrayerReminder } from '@/hooks/usePrayerReminder';
type Screen =
| 'home'
| 'setup'
| 'reveal'
| 'play'
| 'result'
| 'online'
| 'room'
| 'history'
| 'settings'
| 'about'
| 'modes'
| 'auth'
| 'login'
| 'register'
| 'help'
| 'social';
type Winner = 'spies' | 'citizens' | null;
type CategoryItem = (typeof categories)[number];

// Title system constants - synced with backend
const PLAYER_TITLES = [
  { minXP: 0, maxXP: 99, title: 'مبتدئ', level: 1, color: '#9CA3AF', icon: '🌱' },
  { minXP: 100, maxXP: 299, title: 'لاعب عادي', level: 2, color: '#22C55E', icon: '🎮' },
  { minXP: 300, maxXP: 699, title: 'محترف', level: 3, color: '#3B82F6', icon: '⭐' },
  { minXP: 700, maxXP: 1499, title: 'خبير', level: 4, color: '#A855F7', icon: '👑' },
  { minXP: 1500, maxXP: Infinity, title: 'أسطورة', level: 5, color: '#F59E0B', icon: '🔥' },
];

interface TitleInfo {
  title: string;
  level: number;
  color: string;
  icon: string;
  nextTitle: string | null;
  xpToNext: number;
  progress: number; // 0-100 percentage to next level
}

function getTitleFromXP(totalXP: number): TitleInfo {
  const titleInfo = PLAYER_TITLES.find(t => totalXP >= t.minXP && totalXP <= t.maxXP) || PLAYER_TITLES[0];
  // Find next title only if it's different from current (not at max level)
  const nextTitleInfo = PLAYER_TITLES.find(t => t.level === titleInfo.level + 1);
  // Don't show next title if already at max level (level 5)
  const hasNextLevel = titleInfo.level < 5;
  
  // Calculate progress percentage
  const xpInLevel = totalXP - titleInfo.minXP;
  const xpNeededForLevel = hasNextLevel && nextTitleInfo ? nextTitleInfo.minXP - titleInfo.minXP : 0;
  const progress = xpNeededForLevel > 0 ? Math.min(100, (xpInLevel / xpNeededForLevel) * 100) : 100;
  
  return {
    title: titleInfo.title,
    level: titleInfo.level,
    color: titleInfo.color,
    icon: titleInfo.icon,
    nextTitle: hasNextLevel && nextTitleInfo ? nextTitleInfo.title : null,
    xpToNext: hasNextLevel && nextTitleInfo ? nextTitleInfo.minXP - totalXP : 0,
    progress,
  };
}

interface AuthUser {
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
titleInfo?: TitleInfo;
// Detailed stats
spyWins?: number;
citizenWins?: number;
totalSpyGames?: number;
totalCitizenGames?: number;
spiesCaught?: number;
wordsGuessed?: number;
}
interface Profile {
name: string;
language: 'ar';

gold: number;
gamesPlayed: number;
gamesWon: number;
}
interface HistoryEntry {
  id: string;
  playedAt: string;
  // Game identification
  gameType: 'spy' | 'quiz';
  playMode: 'offline' | 'online';
  gameMode: GameModeType | 'relaxed' | 'speed';
  categoryName: string;
  // Basic info
  playerCount: number;
  // Result
  winner: string; // 'spies' | 'citizens' for spy, player name for quiz
  winnerName?: string;
  reason: string;
  // XP earned
  xpEarned: number;
  // Spy specific
  spyCount?: number;
  secretWord?: string;
  spyNames?: string[];
  spyDiscovered?: boolean;
  wordGuessed?: boolean;
  guessedBy?: string;
  guessHistory?: Array<{ playerName: string; guess: string; success: boolean }>;
  // Quiz specific
  quizRounds?: number;
  correctAnswers?: number;
  // Player rankings
  playerRankings?: Array<{ name: string; score: number; xp: number; titleInfo?: TitleInfo }>;
}
interface GameSetup {
playerCount: number;
spyCount: number;
gameTime: number;
categoryId: string;
gameMode: GameModeType;
playerNames: string[];
}
interface OfflineMatch {
id: string;
categoryId: string;
secretWord: string;
playerNames: string[];
spyIndices: number[];
gameMode: GameModeType;
partnerSpyIndex?: number | null;
knowerIndex?: number | null;
gameTime: number;
createdAt: number;
}
interface ResultState {
winner: Winner;
reason: string;
}

// Game Summary types
interface GameSummaryData {
gameType: 'spy' | 'quiz';
playMode: 'online' | 'offline';
gameMode: GameModeType | 'relaxed' | 'speed';
categoryName: string;
categoryIcon: string;
playerCount: number;
playerNames: string[];
winner: Winner | string; // 'spies' | 'citizens' for spy, player name for quiz
winnerName?: string;
reason: string;
xpEarned: number;
// Spy game specific
secretWord?: string;
spyNames?: string[];
spyDiscovered?: boolean;
wordGuessed?: boolean;
guessedBy?: string;
guessHistory?: Array<{
playerName: string;
guess: string;
success: boolean;
}>;
// Quiz game specific
quizRounds?: number;
correctAnswers?: Record<string, number>;
playersWithXP?: Array<{
name: string;
xp: number;
titleInfo?: TitleInfo;
}>;
// For replay functionality
gameSetup?: GameSetup;
categoryId?: string;
}

// Online types (from server)
interface Player {
id: string;
name: string;
isHost: boolean;
isReady: boolean;
joinedAt: number;
viewedRole: boolean;
voteFor: string | null;
gold: number;
titleInfo?: TitleInfo;
}
interface GameSettings {
spyCount: number;
gameTime: number;
categoryId: string;
gameMode: GameModeType;
}
interface Game {
id: string;
categoryId: string;
secretWord: string;
spyIds: string[];
gameMode: GameModeType;
partnerSpyId?: string | null;
knowerId?: string | null;
startedAt: number;
endsAt: number;
voteOpen: boolean;
winner: Winner;
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
interface Room {
  code: string;
  name: string | null;
  isPublic: boolean;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  status: 'lobby' | 'running' | 'ended';
  settings: GameSettings;
  players: Player[];
  game: Game | null;
}
interface PublicRoom {
  code: string;
  name: string | null;
  hostName: string;
  playerCount: number;
  settings: GameSettings;
  createdAt: number;
}
const STORAGE = {
profile: 'spy_game_profile_v3',
history: 'spy_game_history_v3',
};
function safeParse<T>(value: string | null, fallback: T): T {
if (!value) return fallback;
try {
return JSON.parse(value) as T;

} catch {
return fallback;
}
}
function uid() {
return Math.random().toString(36).slice(2, 10);
}
function clamp(value: number, min: number, max: number) {
return Math.min(max, Math.max(min, value));
}
function shuffleArray<T>(items: T[]) {
const copy = [...items];
for (let i = copy.length - 1; i > 0; i -= 1) {
const j = Math.floor(Math.random() * (i + 1));
[copy[i], copy[j]] = [copy[j], copy[i]];
}
return copy;
}
function formatTime(totalSeconds: number) {
const minutes = Math.floor(totalSeconds / 60)
.toString()
.padStart(2, '0');
const seconds = Math.max(0, totalSeconds % 60)
.toString()
.padStart(2, '0');
return `${minutes}:${seconds}`;
}
function formatDate(timestamp: number) {
return new Intl.DateTimeFormat('ar-EG', {
dateStyle: 'medium',
timeStyle: 'short',
}).format(timestamp);
}
function normalizeArabic(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[آإأ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '');
}
function isCorrectGuess(guess: string, answer: string) {
  return normalizeArabic(guess) === normalizeArabic(answer);
}

// Smart answer check using AI - returns a promise
async function smartCheckAnswer(guess: string, answer: string): Promise<{ isCorrect: boolean; method: string }> {
  try {
    const response = await fetch('/api/check-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess, answer }),
    });
    
    const data = await response.json();
    if (data.success) {
      return { isCorrect: data.isCorrect, method: data.method };
    }
  } catch (error) {
    console.error('Smart check error:', error);
  }
  
  // Fallback to simple comparison
  return { isCorrect: isCorrectGuess(guess, answer), method: 'fallback' };
}
function findCategory(categoryId: string): CategoryItem {
return categories.find((item) => item.id === categoryId) ?? categories[0];
}
function getSecretWord(categoryId: string) {
if (categoryId === 'random') {
const words = categories
.filter((item) => item.id !== 'random')
.flatMap((item) => item.words);
return words[Math.floor(Math.random() * words.length)];
}
const category = findCategory(categoryId);
return category.words[Math.floor(Math.random() * category.words.length)];
}
function assignSpyIndices(playerCount: number, spyCount: number) {
return shuffleArray(Array.from({ length: playerCount }, (_, index) => index))
.slice(0, spyCount)
.sort((first, second) => first - second);
}

// Role assignment based on game mode
interface RoleAssignment {
  spyIndices: number[];
  knowerIndex: number | null;
  partnerSpyIndex: number | null;
}

function assignRolesByMode(playerCount: number, gameMode: GameModeType): RoleAssignment {
  const shuffled = shuffleArray(Array.from({ length: playerCount }, (_, index) => index));
  
  switch (gameMode) {
    case 'classic':
    case 'silent': {
      // One spy
      const spyIndex = shuffled[0];
      return { spyIndices: [spyIndex], knowerIndex: null, partnerSpyIndex: null };
    }
    case 'double-spies': {
      // Exactly 2 spies who know each other
      const spy1 = shuffled[0];
      const spy2 = shuffled[1];
      return { 
        spyIndices: [spy1, spy2].sort((a, b) => a - b), 
        knowerIndex: null, 
        partnerSpyIndex: spy2 
      };
    }
    case 'reversed': {
      // All spies except one who knows the word
      const knowerIndex = shuffled[0];
      const spyIndices = Array.from({ length: playerCount }, (_, i) => i)
        .filter(i => i !== knowerIndex);
      return { spyIndices, knowerIndex, partnerSpyIndex: null };
    }
    default:
      return { spyIndices: [shuffled[0]], knowerIndex: null, partnerSpyIndex: null };
  }
}

// Get partner spy name for double-spies mode
function getPartnerSpyName(myIndex: number, match: OfflineMatch): string | null {
  if (match.gameMode !== 'double-spies') return null;
  const otherSpyIndex = match.spyIndices.find(i => i !== myIndex);
  return otherSpyIndex !== undefined ? match.playerNames[otherSpyIndex] : null;
}

// Check if player is the knower in reversed mode
function isKnower(playerIndex: number, match: OfflineMatch): boolean {
  return match.gameMode === 'reversed' && match.knowerIndex === playerIndex;
}

function createDefaultSetup(defaultName = ''): GameSetup {
return {
playerCount: 4,
spyCount: 1,
gameTime: 5,
categoryId: 'places',
gameMode: 'classic',
playerNames: [defaultName, '', '', ''],
};
}
function readProfile(): Profile {
if (typeof window === 'undefined') {
return { name: 'زيزو', language: 'ar', gold: 0, gamesPlayed: 0, gamesWon: 0 };
}
const current = safeParse<Profile | null>(localStorage.getItem(STORAGE.profile), null);
return {
name: current?.name || 'زيزو',
language: 'ar',
gold: current?.gold ?? 0,
gamesPlayed: current?.gamesPlayed ?? 0,
gamesWon: current?.gamesWon ?? 0,
};
}
function writeProfile(profile: Profile) {
if (typeof window === 'undefined') return;
localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
}
function readHistory(): HistoryEntry[] {
if (typeof window === 'undefined') return [];
const current = safeParse<HistoryEntry[] | null>(localStorage.getItem(STORAGE.history), null);
return current || [];
}

function writeHistory(history: HistoryEntry[]) {
if (typeof window === 'undefined') return;
localStorage.setItem(STORAGE.history, JSON.stringify(history.slice(0, 60)));
}
function getRelevantQuestions(categoryId: string) {
return (
questionSuggestions.find((item) => item.category === categoryId)?.questions ??
questionSuggestions.find((item) => item.category === 'general')?.questions ??
[]
);
}
function getWinnerLabel(winner: Winner) {
  if (!winner) return 'غير محدد';
  // 'spies' = المخبر كسب، 'citizens' = المواطنين كسبوا
  return winner === 'spies' ? 'المخبر كسب!' : 'المواطنين كسبوا';
}
// SVG Components - Detective Logo with slow blinking eyes
function MaskLogo({ size = 150 }: { size?: number }) {
  const id = useId();
  const glowId = `glow-${id}`;
  const gradientId = `grad-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 200 250" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="30" y1="10" x2="170" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6CF6FF" />
          <stop offset="0.5" stopColor="#2FD6FF" />
          <stop offset="1" stopColor="#3D7CFF" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient particles */}
      <g opacity="0.5">
        <circle cx="20" cy="30" r="1.5" fill="#66F6FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="180" cy="25" r="2" fill="#66F6FF">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="15" cy="200" r="1.5" fill="#66F6FF">
          <animate attributeName="opacity" values="0.35;0.9;0.35" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="185" cy="195" r="2" fill="#66F6FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Detective Coat/Shoulders - bottom layer */}
      <g filter={`url(#${glowId})`}>
        <path
          d="M30 195 Q50 240 100 250 Q150 240 170 195 L165 220 Q140 250 100 250 Q60 250 35 220 Z"
          fill={`url(#${gradientId})`}
          opacity="0.75"
        />
        {/* Coat collar V-shape */}
        <path
          d="M70 195 L100 215 L130 195"
          stroke="#0A1628"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </g>

      {/* Face/Head - oval shape */}
      <g filter={`url(#${glowId})`}>
        <ellipse cx="100" cy="135" rx="50" ry="58" fill="#0A1628" stroke={`url(#${gradientId})`} strokeWidth="3">
          <animate attributeName="stroke-opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Fedora Hat - Complete and proper */}
      <g filter={`url(#${glowId})`}>
        {/* Hat brim - full ellipse */}
        <ellipse cx="100" cy="85" rx="68" ry="14" fill={`url(#${gradientId})`} />

        {/* Hat top - complete rounded shape */}
        <ellipse cx="100" cy="55" rx="52" ry="35" fill={`url(#${gradientId})`} />

        {/* Hat pinched center top */}
        <ellipse cx="100" cy="28" rx="20" ry="8" fill={`url(#${gradientId})`} />

        {/* Hat band */}
        <rect x="48" y="68" width="104" height="12" rx="2" fill="#0A1628" opacity="0.85" />
      </g>

      {/* Eyes - Slow blinking: close → wait 5s → open → close → open */}
      <g filter={`url(#${glowId})`}>
        {/* Left Eye */}
        <g>
          <ellipse cx="75" cy="130" rx="12" ry="8" fill="#050A15" stroke="#6CF6FF" strokeWidth="1.5">
            {/* Slow blink cycle: open (0-4s) → close (4-5s) → open (5-9s) → close (9-10s) */}
            <animate 
              attributeName="ry" 
              values="8;8;1;1;8;8;8;1;1;8" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
          <ellipse cx="75" cy="130" rx="6" ry="5" fill="#C6FFFF">
            <animate 
              attributeName="ry" 
              values="5;5;0;0;5;5;5;0;0;5" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
          <circle cx="75" cy="130" r="3" fill="#0A1628">
            <animate 
              attributeName="r" 
              values="3;3;0;0;3;3;3;0;0;3" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </circle>
          <ellipse cx="77" cy="128" rx="2" ry="1.5" fill="#FFFFFF" opacity="0.9">
            <animate 
              attributeName="opacity" 
              values="0.9;0.9;0;0;0.9;0.9;0.9;0;0;0.9" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
        </g>

        {/* Right Eye */}
        <g>
          <ellipse cx="125" cy="130" rx="12" ry="8" fill="#050A15" stroke="#6CF6FF" strokeWidth="1.5">
            <animate 
              attributeName="ry" 
              values="8;8;1;1;8;8;8;1;1;8" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
          <ellipse cx="125" cy="130" rx="6" ry="5" fill="#C6FFFF">
            <animate 
              attributeName="ry" 
              values="5;5;0;0;5;5;5;0;0;5" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
          <circle cx="125" cy="130" r="3" fill="#0A1628">
            <animate 
              attributeName="r" 
              values="3;3;0;0;3;3;3;0;0;3" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </circle>
          <ellipse cx="127" cy="128" rx="2" ry="1.5" fill="#FFFFFF" opacity="0.9">
            <animate 
              attributeName="opacity" 
              values="0.9;0.9;0;0;0.9;0.9;0.9;0;0;0.9" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
        </g>
      </g>

      {/* Eyebrows - serious detective look */}
      <g stroke={`url(#${gradientId})`} strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M62 115 Q75 110 88 117" />
        <path d="M112 117 Q125 110 138 115" />
      </g>

      {/* Nose */}
      <path d="M100 140 L97 155 L103 155 Z" fill="#1A3A5A" opacity="0.5" />

      {/* Mouth - serious expression */}
      <path d="M88 168 Q100 172 112 168" stroke="#6CF6FF" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />

      {/* Magnifying glass icon hint */}
      <g opacity="0.3" transform="translate(145, 150)">
        <circle cx="0" cy="0" r="12" stroke="#6CF6FF" strokeWidth="2" fill="none" />
        <line x1="8" y1="8" x2="18" y2="18" stroke="#6CF6FF" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}
function FingerprintLogo({ size = 170 }: { size?: number }) {
  return <MaskLogo size={size} />;
}

// Title Badge Component - Shows player title with level
function TitleBadge({ 
  titleInfo, 
  size = 'normal',
  showProgress = false 
}: { 
  titleInfo: TitleInfo; 
  size?: 'small' | 'normal' | 'large';
  showProgress?: boolean;
}) {
  const sizeClasses = {
    small: 'px-2 py-0.5 text-xs',
    normal: 'px-3 py-1 text-sm',
    large: 'px-4 py-1.5 text-base',
  };
  
  return (
    <div className="inline-flex items-center gap-1.5">
      <span 
        className={`inline-flex items-center gap-1 rounded-full font-bold ${sizeClasses[size]}`}
        style={{ backgroundColor: titleInfo.color + '25', color: titleInfo.color }}
      >
        <span>{titleInfo.icon}</span>
        <span>{titleInfo.title}</span>
      </span>
      {showProgress && titleInfo.nextTitle && (
        <span className="text-xs text-white/50">
          ({titleInfo.xpToNext} للمستوى التالي)
        </span>
      )}
    </div>
  );
}

// Player Name with Title - Used in rooms, games, results
function PlayerNameWithTitle({ 
  name, 
  titleInfo,
  isYou = false,
  size = 'normal' 
}: { 
  name: string; 
  titleInfo?: TitleInfo;
  isYou?: boolean;
  size?: 'small' | 'normal';
}) {
  const nameSize = size === 'small' ? 'text-sm' : 'text-base';
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`font-bold ${nameSize} ${isYou ? 'text-cyan-400' : ''}`}>
        {name}
        {isYou && <span className="text-xs text-white/50 mr-1">(أنت)</span>}
      </span>
      {titleInfo && (
        <TitleBadge titleInfo={titleInfo} size="small" />
      )}
    </div>
  );
}

// UI Components
function Shell({ children }: { children: ReactNode }) {
return (
<div dir="rtl" className="min-h-screen bg-[#050907] text-white select-none">
<div className="mx-auto min-h-screen w-full max-w-md px-5 py-6">{children}</div>
</div>
);
}
function IconCircle({ icon, accent = 'text-cyan-400' }: { icon: ReactNode; accent?: string }) {
return (
<span className={`flex h-11 w-11 items-center justify-center rounded-full bg-black/80 text-2xl ${accent}`}>
{icon}
</span>
);
}
function HomeActionButton({
icon,
title,
accent,
onClick,
}: {
icon: ReactNode;
title: string;
accent?: string;
onClick: () => void;
}) {
return (
<button
type="button"
onClick={onClick}
className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-white to-gray-100 px-3 py-3 text-right text-[#050907] shadow-lg transition-all hov
er:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
>
<IconCircle icon={icon} accent={accent} />
<span className="flex-1 text-center text-2xl font-black tracking-wide">{title}</span>
</button>
);
}
function SmallPillButton({
label,
onClick,
}: {
label: string;
onClick: () => void;
}) {
return (
<button
type="button"
onClick={onClick}
className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/12 active:scale-95"
>
{label}
</button>
);
}
function ScreenHeader({
title,
onBack,
showHomeIcon = true,
}: {
title: string;
onBack: () => void;
showHomeIcon?: boolean;
}) {
return (
<div className="mb-8 flex items-center justify-between">
<button
type="button"
onClick={onBack}
className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl text-white transition hover:bg-white/10"
>
{showHomeIcon ? '⌂' : '→'}
</button>
<h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
<div className="w-12" />
</div>
);
}

function ConfirmModal({
open,
title,
message,
confirmLabel,
cancelLabel,
onConfirm,
onCancel,
}: {
open: boolean;
title: string;
message: string;
confirmLabel: string;
cancelLabel: string;
onConfirm: () => void;
onCancel: () => void;
}) {
if (!open) return null;
return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
<div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0c120f] p-5 shadow-2xl">
<h3 className="mb-2 text-center text-2xl font-extrabold">{title}</h3>
<p className="mb-5 text-center text-sm text-white/70">{message}</p>
<div className="grid grid-cols-2 gap-3">
<button
type="button"
onClick={onConfirm}
className="rounded-full bg-white px-4 py-3 text-sm font-extrabold text-[#050907]"
>
{confirmLabel}
</button>
<button
type="button"
onClick={onCancel}
className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-extrabold text-white"
>
{cancelLabel}
</button>
</div>
</div>
</div>
);
}

// Game Summary Modal - Shows after every game
function GameSummaryModal({
open,
summary,
onClose,
onReplay,
}: {
open: boolean;
summary: GameSummaryData | null;
onClose: () => void;
onReplay: () => void;
}) {
if (!open || !summary) return null;

const getGameTypeName = () => {
return summary.gameType === 'spy' ? 'لعبة المخبر' : 'لعبة المسابقة';
};

const getPlayModeName = () => {
return summary.playMode === 'online' ? 'أونلاين' : 'أوفلاين';
};

const getGameModeName = () => {
if (summary.gameType === 'quiz') {
  // Quiz game modes
  const quizModes: Record<string, { name: string; icon: string }> = {
    'relaxed': { name: 'سيبنا براحتنا', icon: '😌' },
    'speed': { name: 'مين الأسرع', icon: '⚡' },
  };
  const mode = quizModes[summary.gameMode as string];
  return mode ? `${mode.icon} ${mode.name}` : 'سيبنا براحتنا';
} else {
  // Spy game modes
  const mode = gameModes.find(m => m.id === summary.gameMode);
  return mode ? `${mode.icon} ${mode.name}` : 'كلاسيكي';
}
};

const getWinnerDisplay = () => {
if (summary.gameType === 'quiz') {
  // For quiz, show the winner's name
  return { 
    text: summary.winnerName ? `🏆 ${summary.winnerName}` : 'انتهت اللعبة!', 
    icon: '🎉', 
    color: 'text-yellow-400' 
  };
}
// For spy game
if (summary.winner === 'spies') {
return { text: 'المخبر كسب!', icon: '🕵️', color: 'text-red-400' };
}
return { text: 'المواطنين كسبوا!', icon: '👥', color: 'text-green-400' };
};

const winnerInfo = getWinnerDisplay();

return (
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
<div
className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c120f] shadow-2xl"
onClick={(e) => e.stopPropagation()}
>
{/* Header with close button */}
<div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0c120f] px-5 py-4">
<h2 className="text-xl font-black">📊 ملخص الجيم</h2>
<button
type="button"
onClick={onClose}
className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg hover:bg-white/20 transition"
>
✕
</button>
</div>

<div className="p-5 space-y-5">
{/* Game Type & Mode */}
<div className="grid grid-cols-2 gap-3">
<div className="rounded-xl bg-white/5 p-3 text-center">
<div className="text-xs text-white/50 mb-1">اللعبة</div>
<div className="font-bold">{getGameTypeName()}</div>
</div>
<div className="rounded-xl bg-white/5 p-3 text-center">
<div className="text-xs text-white/50 mb-1">النوع</div>
<div className="font-bold">{getPlayModeName()}</div>
</div>
</div>

{/* Game Mode */}
<div className="rounded-xl bg-white/5 p-3 text-center">
<div className="text-xs text-white/50 mb-1">الوضع</div>
<div className="font-bold text-lg">{getGameModeName()}</div>
</div>

{/* Category & Players */}
<div className="grid grid-cols-2 gap-3">
<div className="rounded-xl bg-white/5 p-3 text-center">
<div className="text-xs text-white/50 mb-1">التصنيف</div>
<div className="font-bold">{summary.categoryIcon} {summary.categoryName}</div>
</div>
<div className="rounded-xl bg-white/5 p-3 text-center">
<div className="text-xs text-white/50 mb-1">اللاعبين</div>
<div className="font-bold">{summary.playerCount}</div>
</div>
</div>

{/* Winner Section */}
<div className="rounded-[1.5rem] bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 p-5 text-center">
<div className="text-4xl mb-2">{winnerInfo.icon}</div>
<div className={`text-2xl font-black ${winnerInfo.color}`}>{winnerInfo.text}</div>
<p className="text-sm text-white/70 mt-1">{summary.reason}</p>
</div>

{/* XP Earned */}
<div className="rounded-xl bg-yellow-400/20 border border-yellow-400/30 p-4 flex items-center justify-between">
<div className="flex items-center gap-3">
<CoinIcon size={32} />
<span className="font-bold">الخبرة المكتسبة</span>
</div>
<span className="text-2xl font-black text-yellow-300">+{summary.xpEarned}</span>
</div>

{/* Quiz Game Specific Details */}
{summary.gameType === 'quiz' && (
<div className="space-y-3">
{/* Quiz Stats */}
<div className="grid grid-cols-2 gap-3">
  <div className="rounded-xl bg-white/5 p-4 text-center">
    <div className="text-xs text-white/50 mb-1">عدد الجولات</div>
    <div className="text-2xl font-black">{summary.quizRounds || 0}</div>
  </div>
  <div className="rounded-xl bg-white/5 p-4 text-center">
    <div className="text-xs text-white/50 mb-1">اللاعبين</div>
    <div className="text-2xl font-black">{summary.playerCount}</div>
  </div>
</div>

{/* Player Rankings for Quiz */}
{summary.playersWithXP && summary.playersWithXP.length > 0 && (
<div className="rounded-xl bg-white/5 p-4">
  <div className="text-sm text-white/50 mb-3">ترتيب اللاعبين</div>
  <div className="space-y-2">
  {summary.playersWithXP.map((player, i) => (
    <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-white/50">{i + 1}</span>
        <span className="font-bold">{player.name}</span>
        {player.titleInfo && (
        <span 
          className="text-xs px-2 py-0.5 rounded-full font-bold"
          style={{ backgroundColor: player.titleInfo.color + '25', color: player.titleInfo.color }}
        >
          {player.titleInfo.icon}
        </span>
        )}
      </div>
      <span className="font-bold text-yellow-300">+{player.xp}</span>
    </div>
  ))}
  </div>
</div>
)}
</div>
)}

{/* Spy Game Specific Details */}
{summary.gameType === 'spy' && summary.secretWord && (
<div className="space-y-3">
{/* Secret Word */}
<div className="rounded-xl bg-white px-4 py-3 text-[#050907]">
<div className="text-xs text-black/50 mb-1">الكلمة السرية</div>
<div className="text-xl font-black">{summary.secretWord}</div>
</div>

{/* Spies */}
{summary.spyNames && summary.spyNames.length > 0 && (
<div className="rounded-xl bg-white/5 p-4">
<div className="text-sm text-white/50 mb-2">المخبرين</div>
<div className="flex flex-wrap gap-2">
{summary.spyNames.map((name, i) => (
<span key={i} className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 font-bold text-sm">
🕵️ {name}
</span>
))}
</div>
</div>
)}

{/* Discovery Status */}
{summary.spyDiscovered !== undefined && (
<div className="rounded-xl bg-white/5 p-4 flex items-center justify-between">
<span className="text-white/70">تم اكتشاف المخبر؟</span>
<span className={`font-bold ${summary.spyDiscovered ? 'text-green-400' : 'text-red-400'}`}>
{summary.spyDiscovered ? '✅ نعم' : '❌ لا'}
</span>
</div>
)}

{/* Word Guess */}
{summary.wordGuessed !== undefined && (
<div className="rounded-xl bg-white/5 p-4 flex items-center justify-between">
<span className="text-white/70">تم تخمين الكلمة؟</span>
<span className={`font-bold ${summary.wordGuessed ? 'text-green-400' : 'text-red-400'}`}>
{summary.wordGuessed ? `✅ نعم (${summary.guessedBy})` : '❌ لا'}
</span>
</div>
)}

{/* Guess History */}
{summary.guessHistory && summary.guessHistory.length > 0 && (
<div className="rounded-xl bg-white/5 p-4">
<div className="text-sm text-white/50 mb-2">محاولات التخمين</div>
<div className="space-y-2">
{summary.guessHistory.map((guess, i) => (
<div key={i} className="flex items-center justify-between text-sm">
<span className="text-white/70">{guess.playerName}</span>
<span className={guess.success ? 'text-green-400' : 'text-red-400'}>
{guess.guess} {guess.success ? '✓' : '✗'}
</span>
</div>
))}
</div>
</div>
)}
</div>
)}

{/* Action Buttons */}
<div className={`grid gap-3 pt-2 ${summary.gameSetup ? 'grid-cols-2' : 'grid-cols-1'}`}>
{summary.gameSetup && (
<button
type="button"
onClick={onReplay}
className="rounded-full bg-white px-4 py-4 text-lg font-black text-[#050907]"
>
🔄 إعادة اللعب
</button>
)}
<button
type="button"
onClick={onClose}
className="rounded-full border border-white/10 bg-white/5 px-4 py-4 text-lg font-black text-white"
>
🏠 الرئيسية
</button>
</div>
</div>
</div>
</div>
);
}

interface ExperienceTransaction {
  id: string;
  amount: number;
  reason: string;
  description: string | null;
  createdAt: string;
}

function ExperienceHistoryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [transactions, setTransactions] = useState<ExperienceTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  // Fetch transactions when modal opens
  useEffect(() => {
    if (!open) {
      // Reset when modal closes
      hasFetchedRef.current = false;
      return;
    }
    
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    // Use setTimeout to defer setState outside of effect
    const timeoutId = setTimeout(() => {
      setLoading(true);
      fetch('/api/experience')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTransactions(data.transactions || []);
          }
        })
        .catch(() => {
          // Handle error silently
        })
        .finally(() => setLoading(false));
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [open]);

  if (!open) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `اليوم ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isYesterday) {
      return `أمس ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'new_account':
        return '🎉';
      case 'daily_reward':
      case 'daily_reward_bonus':
        return '📅';
      case 'game_win':
        return '🏆';
      case 'game_loss':
        return '💔';
      case 'spy_win':
        return '🕵️';
      default:
        return '⭐';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0c120f] shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CoinIcon size={32} />
            <h3 className="text-xl font-extrabold">سجل الخبره</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-sm hover:bg-white/20 transition"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-white/60">جاري التحميل...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-white/60">لا يوجد سجل بعد</div>
          ) : (
            transactions.map((t) => (
              <div
                key={t.id}
                className="rounded-xl bg-white/5 p-3 flex items-center gap-3"
              >
                <div className="text-2xl">{getReasonIcon(t.reason)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">
                    {t.description || t.reason}
                  </div>
                  <div className="text-xs text-white/50">{formatDate(t.createdAt)}</div>
                </div>
                <div className={`font-bold ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-[#050907]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
if (!message) return null;
return (
<div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-5">
<div className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#050907] shadow-lg animate-bounce">
{message}
</div>
</div>
);
}

// Toast Notification Component - للإشعارات الفورية
function ToastContainer({ toasts, removeToast }: { toasts: Array<{ id: string; type: string; title: string; message: string; icon?: string; duration?: number }>; removeToast: (id: string) => void }) {
return (
<div className="fixed top-4 left-4 right-4 z-[100] pointer-events-none">
<div className="flex flex-col gap-2 items-end max-w-sm ml-auto">
{toasts.map((toast) => (
<div 
key={toast.id} 
className="pointer-events-auto w-full flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-lg shadow-black/20 bg-[#0c120f] border-white/10 animate-slide-in"
>
<div className="flex-shrink-0 text-2xl">{toast.icon || '🔔'}</div>
<div className="flex-1 min-w-0">
<p className="font-bold text-white text-sm">{toast.title}</p>
<p className="text-white/70 text-xs mt-0.5">{toast.message}</p>
</div>
<button
onClick={() => removeToast(toast.id)}
className="flex-shrink-0 text-white/40 hover:text-white/70 transition text-lg"
>
×
</button>
</div>
))}
</div>
</div>
);
}
function CounterBlock({
label,
icon,
value,
onDecrease,
onIncrease,
}: {
label: string;
icon: ReactNode;
value: number;
onDecrease: () => void;
onIncrease: () => void;
}) {
return (
<div className="space-y-3">
<div className="flex items-center gap-3">
<span className="w-9 text-center text-2xl text-white/80">{icon}</span>
<div className="flex-1 rounded-full bg-white px-6 py-3 text-center text-2xl font-bold text-[#050907]">
{label}
</div>
</div>
<div className="flex items-center justify-center gap-10">
<button
type="button"
onClick={onDecrease}
className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white text-4xl leading-none text-white"
>
−
</button>
<div className="min-w-12 text-center text-5xl font-extrabold">{value}</div>
<button
type="button"
onClick={onIncrease}
className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white text-4xl leading-none text-white"
>
+
</button>
</div>
</div>
);
}
// Auth Views - Completely Different Design
function AuthScreen({
onLoginClick,
onRegisterClick,
}: {
onLoginClick: () => void;
onRegisterClick: () => void;
}) {
return (
<div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 select-none">
<div className="w-full max-w-sm space-y-8">
<div className="text-center space-y-4">

<div className="flex justify-center"><MaskLogo size={100} /></div>
<h1 className="text-4xl font-black text-white">المخبر</h1>
<p className="text-white/80 text-lg">اكشف المخبر بينكم</p>
</div>
<div className="space-y-4 pt-4">
<button
type="button"
onClick={onLoginClick}
className="w-full rounded-2xl bg-white px-6 py-4 text-xl font-bold text-black shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
>
تسجيل الدخول
</button>
<button
type="button"
onClick={onRegisterClick}
className="w-full rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white px-6 py-4 text-xl font-bold text-white hover:bg-white/30 transition-all hover
:scale-[1.02] active:scale-[0.98]"
>
إنشاء حساب جديد
</button>
</div>
</div>
</div>
);
}
function LoginView({
onBack,
onLogin,
notify,
}: {
onBack: () => void;
onLogin: (email: string, password: string) => Promise<boolean>;
notify: (message: string) => void;
}) {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const handleLogin = async () => {
if (!email.trim()) {
notify('اكتب البريد الإلكتروني');
return;
}
if (!password) {
notify('اكتب كلمة المرور');
return;
}
setLoading(true);
const success = await onLogin(email.trim(), password);
setLoading(false);
if (!success) {
setPassword('');
}
};
return (
<div className="min-h-screen bg-black flex flex-col p-6 select-none">
<button
type="button"
onClick={onBack}
className="self-start mb-8 text-white/80 text-lg flex items-center gap-2"
>
← رجوع
</button>
<div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-8">
<div className="text-center space-y-2">
<h1 className="text-3xl font-black text-white">تسجيل الدخول</h1>
<p className="text-white/70">سجل دخولك عشان تلعب</p>
</div>
<div className="space-y-4">
<input
type="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
placeholder="البريد الإلكتروني"
className="w-full rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none focus:border-white focus:bg-white/30 transition-all"
/>
<input
type="password"
value={password}
onChange={(e) => setPassword(e.target.value)}
placeholder="كلمة المرور"
className="w-full rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none focus:border-white focus:bg-white/30 transition-all"
/>
</div>
<button
type="button"
onClick={handleLogin}
disabled={loading}
className="w-full rounded-2xl bg-white px-6 py-4 text-xl font-bold text-purple-600 shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.9
8] disabled:opacity-50"
>
{loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
</button>
</div>
</div>
);
}
function RegisterView({
onBack,
onRegister,

notify,
}: {
onBack: () => void;
onRegister: (name: string, email: string, password: string, gender: 'male' | 'female') => Promise<boolean>;
notify: (message: string) => void;
}) {
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [gender, setGender] = useState<'male' | 'female' | null>(null);
const [loading, setLoading] = useState(false);
const handleRegister = async () => {
if (!name.trim()) {
  notify('اكتب اسمك');
  return;
}
if (!email.trim()) {
  notify('اكتب البريد الإلكتروني');
  return;
}
if (password.length < 6) {
  notify('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  return;
}
if (!gender) {
  notify('اختر الجنس');
  return;
}
setLoading(true);
await onRegister(name.trim(), email.trim(), password, gender);
setLoading(false);
};
return (
<div className="min-h-screen bg-black flex flex-col p-6 select-none">
<button
type="button"
onClick={onBack}
className="self-start mb-6 text-white/80 text-lg flex items-center gap-2"
>
← رجوع
</button>
<div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-6">
<div className="text-center space-y-2">
<h1 className="text-3xl font-black text-white">إنشاء حساب جديد</h1>
<p className="flex items-center justify-center gap-1 text-white/70">انضم للعبة واكسب <CoinIcon size={16} /></p>
</div>
<div className="space-y-4">
<input
type="text"
value={name}
onChange={(e) => setName(e.target.value)}
placeholder="اسمك"
className="w-full rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none focus:border-white focus:bg-white/30 transition-all"
/>
<input
type="email"
value={email}
onChange={(e) => setEmail(e.target.value)}
placeholder="البريد الإلكتروني"
className="w-full rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none focus:border-white focus:bg-white/30 transition-all"
/>
<input
type="password"
value={password}
onChange={(e) => setPassword(e.target.value)}
placeholder="كلمة المرور (على الأقل 6 أحرف)"
className="w-full rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 px-5 py-4 text-lg text-white placeholder:text-white/50 outline-none focus:
border-white focus:bg-white/30 transition-all"
/>
</div>
<div className="space-y-3">
<div className="text-center text-white/80 font-bold">اختر الجنس</div>
<div className="grid grid-cols-2 gap-4">
<button
type="button"
onClick={() => setGender('male')}
className={`rounded-2xl py-4 text-center transition-all ${
gender === 'male'
? 'bg-white text-black scale-[1.02]'
: 'bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/30'
}`}
>
<div className="text-3xl mb-1"> </div>
<div className="font-bold">ذكر</div>
</button>
<button
type="button"
onClick={() => setGender('female')}
className={`rounded-2xl py-4 text-center transition-all ${
gender === 'female'
? 'bg-white text-black scale-[1.02]'
: 'bg-white/20 backdrop-blur-sm border-2 border-white/30 text-white hover:bg-white/30'
}`}
>
<div className="text-3xl mb-1"> </div>
<div className="font-bold">أنثى</div>
</button>
</div>
</div>
<button
type="button"

onClick={handleRegister}
disabled={loading}
className="w-full rounded-2xl bg-white px-6 py-4 text-xl font-bold text-black shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] di
sabled:opacity-50"
>
{loading ? 'جاري التحميل...' : 'إنشاء الحساب'}
</button>
</div>
</div>
);
}
// Views
function HomeView({
authUser,
onStartOffline,
onStartOnline,
onHistory,
onSettings,
onAbout,
onHelp,
onExperienceClick,
onOpenSocial,
socialNotifications,
pendingFriendRequests,
onMarkNotificationsRead,
onJoinRoom,
}: {
authUser: AuthUser;
onStartOffline: () => void;
onStartOnline: () => void;
onHistory: () => void;
onSettings: () => void;
onAbout: () => void;
onHelp: () => void;
onExperienceClick: () => void;
onOpenSocial: () => void;
socialNotifications: SocialNotification[];
pendingFriendRequests: number;
onMarkNotificationsRead: (ids?: string[]) => void;
onJoinRoom?: (roomCode: string, gameType: string) => void;
}) {
const unreadNotifications = socialNotifications.filter(n => !n.isRead).length;
const totalUnread = unreadNotifications + pendingFriendRequests;

// Hidden admin access - click logo 20 times
const [logoClickCount, setLogoClickCount] = useState(0);
const [lastLogoClick, setLastLogoClick] = useState(0);

const handleLogoClick = () => {
  const now = Date.now();
  // Reset count if more than 3 seconds between clicks
  if (now - lastLogoClick > 3000) {
    setLogoClickCount(1);
  } else {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);
    if (newCount >= 20) {
      setLogoClickCount(0);
      // Redirect to admin login page
      window.location.href = '/admin-login';
    }
  }
  setLastLogoClick(now);
};

return (
<Shell>
{/* Top Bar - All in one row */}
<div className="flex items-center gap-2 mb-4 pt-2">
<button
type="button"
onClick={onHistory}
className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 transition hover:bg-cyan-500/20 hover:scale-105"
title="السجل"
>
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="10"/>
<polyline points="12,6 12,12 16,14"/>
</svg>
</button>
<button
type="button"
onClick={onSettings}
className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/80 transition hover:bg-white/10 hover:scale-105"
title="الإعدادات"
>
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="3"/>
<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>
</button>
<button
type="button"
onClick={onAbout}
className="flex h-9 w-9 items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 transition hover:bg-purple-500/20 hover:scale-105"
title="عنا"
>
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
<circle cx="12" cy="12" r="10"/>
<path d="M12 16v-4"/>
<path d="M12 8h.01"/>
</svg>
</button>
{/* Notification Bell */}
<NotificationBell
  notifications={socialNotifications}
  unreadCount={totalUnread}
  onMarkAllRead={() => onMarkNotificationsRead()}
  onJoinRoom={onJoinRoom}
  className="h-9 w-9"
/>
<div className="flex-1" />
<button
type="button"
onClick={onExperienceClick}
className="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 px-4 py-2 transition hover:from-yellow-500/30 hover:to-orange-500/30 cursor-pointer"
title="سجل الخبره"
>
<CoinIcon size={20} />
<span className="font-bold text-yellow-400">{authUser.gold}</span>
</button>
</div>
<div className="flex min-h-[calc(100vh-8rem)] flex-col justify-center gap-8">
<div className="space-y-5 text-center">
<h1 className="text-6xl font-black tracking-tight text-white sm:text-7xl">المخبر</h1>
<div className="flex justify-center relative" onClick={handleLogoClick}>
<MaskLogo size={170} />
</div>
</div>
<div className="space-y-4">
<HomeActionButton icon="❓" title="ايه الكلام؟" onClick={onHelp} />
<HomeActionButton icon="▶" accent="text-cyan-400" title="يلا اوفلاين؟" onClick={onStartOffline} />
<HomeActionButton icon="◎" title="يلا اونلاين؟" onClick={onStartOnline} />
<HomeActionButton icon="👥" accent="text-green-400" title="تواصل مع أصحابك!" onClick={onOpenSocial} />
</div>
</div>
</Shell>
);
}
// Help View - How to Play
function HelpView({
  onBack,
  onStartOffline,
  onStartOnline,
}: {
  onBack: () => void;
  onStartOffline: () => void;
  onStartOnline: () => void;
}) {
  return (
    <Shell>
      <ScreenHeader title="ايه الكلام؟" onBack={onBack} />
      
      <div className="space-y-4 pb-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center"><MaskLogo size={80} /></div>
          <h2 className="text-2xl font-black">🕵️ المخبر</h2>
          <p className="text-white/70 text-sm">لعبة تجمع بين الذكاء والضحك والتفكير 🔥</p>
        </div>

        {/* Game Idea */}
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <h3 className="text-lg font-black text-cyan-400 mb-2">📱 فكرة اللعبة</h3>
          <p className="text-white/70 text-sm leading-relaxed">
            المخبر هي لعبة جماعية بتتلعب مع أصحابك.
          </p>
          <p className="text-white text-sm font-bold mt-2">
            فيه لاعبين عارفين الكلمة السرية… وفيه مخبر (أو أكتر) مش عارفها!
          </p>
          <p className="text-cyan-400 text-sm font-bold mt-2">
            الهدف؟ اكتشف مين المخبر… والمخبر يحاول يعرف الكلمة من غير ما يتكشف!
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <h3 className="text-base font-black text-center">📝 خطوات اللعب</h3>

          {/* Step 1 */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">📱</span>
              <span className="font-bold text-cyan-400 text-sm">الخطوة 1: تجهيز اللعبة</span>
            </div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-5">
              <li>• اختار عدد اللاعبين (من 3 لـ 15)</li>
              <li>• اختار عدد المخبرين</li>
              <li>• اختار التصنيف (أماكن – أكل – مهن...)</li>
              <li>• حدد وقت الجولة</li>
              <li>• اختار المود (طريقة اللعب)</li>
            </ul>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">👀</span>
              <span className="font-bold text-cyan-400 text-sm">الخطوة 2: شوف دورك</span>
            </div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-5">
              <li>• كل لاعب يشوف الشاشة لوحده</li>
              <li>• اللاعب العادي يشوف الكلمة السرية</li>
              <li>• المخبر مش بيشوف الكلمة</li>
            </ul>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">💬</span>
              <span className="font-bold text-cyan-400 text-sm">الخطوة 3: اتكلم واسأل</span>
            </div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-5">
              <li>• كل لاعب يسأل التاني أسئلة عن الكلمة</li>
              <li>• المخبر يحاول يفهم الكلمة من الكلام</li>
              <li>• باقي اللاعبين يحاولوا يلاحظوا مين مش فاهم</li>
            </ul>
          </div>

          {/* Step 4 */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🗳️</span>
              <span className="font-bold text-cyan-400 text-sm">الخطوة 4: التصويت</span>
            </div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-5">
              <li>• كل لاعب يختار مين المخبر</li>
              <li>• لو تم اكتشاف المخبر → الفريق يكسب</li>
              <li>• لو لأ → المخبر يكسب</li>
            </ul>
          </div>

          {/* Step 5 */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🎯</span>
              <span className="font-bold text-cyan-400 text-sm">الخطوة 5: تخمين المخبر</span>
            </div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-5">
              <li>• المخبر يقدر يخمن الكلمة في أي وقت</li>
              <li>• لو خمّن صح → يكسب فورًا</li>
            </ul>
          </div>
        </div>

        {/* Game Modes */}
        <div className="space-y-2">
          <h3 className="text-base font-black text-center">⚡ أوضاع اللعب (المودات)</h3>

          {/* Classic */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3">
            <div className="font-bold text-purple-400 text-sm mb-1">🎯 الوضع الكلاسيكي</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• مخبر واحد</li>
              <li>• نظام متوازن في اللعب والجوائز</li>
            </ul>
          </div>

          {/* Double Spies */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
            <div className="font-bold text-orange-400 text-sm mb-1">👥 وضع المخبرين (أونلاين فقط)</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• فيه أكتر من مخبر</li>
              <li>• المخبرين بيعرفوا بعض</li>
              <li>• المكافأة أقل شوية لأن فرصتهم أسهل</li>
            </ul>
          </div>

          {/* Reversed */}
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <div className="font-bold text-red-400 text-sm mb-1">🔄 الوضع المعكوس</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• كل اللاعبين مخبرين</li>
              <li>• لاعب واحد بس هو اللي عارف الكلمة</li>
              <li>• مكافأته أعلى لأنه في موقف أصعب</li>
            </ul>
          </div>

          {/* Silent */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
            <div className="font-bold text-blue-400 text-sm mb-1">🤫 الوضع الصامت</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• ممنوع الكلام خالص</li>
              <li>• اللعب كله بالإشارات</li>
              <li>• مكافأة أعلى شوية لصعوبة اللعب</li>
            </ul>
          </div>
        </div>

        {/* Tips */}
        <div className="space-y-2">
          <h3 className="text-base font-black text-center">💡 نصايح مهمة</h3>

          {/* Spy Tips */}
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3">
            <div className="font-bold text-orange-400 text-sm mb-1">للمخبر:</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• اسأل أسئلة عامة مش واضحة</li>
              <li>• خليك طبيعي وماتتوترش</li>
              <li>• حاول تفهم من كلامهم بسرعة</li>
            </ul>
          </div>

          {/* Team Tips */}
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
            <div className="font-bold text-green-400 text-sm mb-1">للفريق:</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• ماتقولش حاجة تكشف الكلمة</li>
              <li>• ركز في اللي بيتهرب أو كلامه غريب</li>
              <li>• خلي أسئلتك ذكية</li>
            </ul>
          </div>
        </div>

        {/* Questions Examples */}
        <div className="space-y-2">
          <h3 className="text-base font-black text-center">❓ أمثلة على الأسئلة</h3>

          {/* Allowed */}
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
            <div className="font-bold text-green-400 text-sm mb-1">✅ أسئلة كويسة:</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• هل ده موجود في البيت؟</li>
              <li>• هل بنستخدمه كتير؟</li>
              <li>• هل ده مكان؟</li>
            </ul>
          </div>

          {/* Not Allowed */}
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <div className="font-bold text-red-400 text-sm mb-1">❌ أسئلة غلط:</div>
            <ul className="text-xs text-white/70 space-y-0.5 pr-4">
              <li>• الكلمة حرفها الأول إيه؟</li>
              <li>• هل الكلمة هي "..."؟</li>
            </ul>
          </div>
        </div>

        {/* Rewards */}
        <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <h3 className="text-base font-black text-yellow-400 text-center mb-2">🏆 نظام الخبرة</h3>
          <p className="text-xs text-white/70 text-center mb-3">
            كل مود ليه نظام خبرة مختلف حسب صعوبته
          </p>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/80">🎯 كلاسيكي - الفوز:</span>
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                <CoinIcon size={16} />
                10 | المخبر: 15
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">👥 مخبرين - الفوز:</span>
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                <CoinIcon size={16} />
                10 للكل
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">🔄 معكوس - العارف يكسب:</span>
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                <CoinIcon size={16} />
                20 🔥
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/80">🤫 صامت - الفوز:</span>
              <span className="flex items-center gap-1 font-bold text-yellow-400">
                <CoinIcon size={16} />
                12 | المخبر: 15
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-1.5 mt-1.5">
              <span className="text-white/60">الخسارة (أي مود):</span>
              <span className="flex items-center gap-1 font-bold text-yellow-400/70">
                <CoinIcon size={16} />
                5
              </span>
            </div>
          </div>
        </div>

        {/* Ready to Play */}
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-center">
          <h3 className="text-lg font-black text-cyan-400">🔥 جاهز تلعب؟</h3>
          <p className="text-sm text-white/70 mt-1">
            ورّي أصحابك إنك أذكى واحد فيهم…
          </p>
          <p className="text-sm text-cyan-400 font-bold">
            ولا هتتفضح وتطلع أنت المخبر؟ 😏
          </p>
        </div>

        {/* Play Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={onStartOffline}
            className="w-full rounded-[1.5rem] bg-white px-5 py-3.5 text-lg font-black text-[#050907] shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            يلا أوفلاين؟ ▶
          </button>
          <button
            type="button"
            onClick={onStartOnline}
            className="w-full rounded-[1.5rem] border border-cyan-400/30 bg-cyan-400/10 px-5 py-3.5 text-lg font-black text-cyan-100 hover:bg-cyan-400/20 transition-all"
          >
            يلا أونلاين؟ ◎
          </button>
        </div>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-3 text-lg font-black text-white hover:bg-white/10 transition"
        >
          ← رجوع
        </button>
      </div>
    </Shell>
  );
}
function SetupView({
initial,
onBack,
onStart,
}: {
initial: GameSetup;
onBack: () => void;
onStart: (setup: GameSetup) => void;
}) {
const [playerCount, setPlayerCount] = useState(initial.playerCount);
const [spyCount, setSpyCount] = useState(initial.spyCount);
const [gameTime, setGameTime] = useState(initial.gameTime);
const [categoryId, setCategoryId] = useState(initial.categoryId);
const [gameMode, setGameMode] = useState<GameModeType>(initial.gameMode || 'classic');
const [playerNames, setPlayerNames] = useState<string[]>(() => {
const names = [...initial.playerNames];
while (names.length < initial.playerCount) names.push('');
return names.slice(0, initial.playerCount);
});
// Get min players for selected mode
const selectedMode = gameModes.find(m => m.id === gameMode);
const minPlayers = selectedMode?.minPlayers || 3;
// Handle playerCount changes via callbacks instead of effect
const handlePlayerCountChange = useCallback((newCount: number) => {
setPlayerCount(newCount);
setPlayerNames((current) => {
const next = [...current];
while (next.length < newCount) next.push('');
return next.slice(0, newCount);
});
setSpyCount((current) => clamp(current, 1, Math.max(1, newCount - 1)));
}, []);
return (
<Shell>
<ScreenHeader title="يلا نجهرها" onBack={onBack} />
<div className="space-y-8 pb-8">
<div className="flex justify-center">
<MaskLogo size={120} />
</div>

{/* Game Mode Selection */}
<div className="space-y-3">
<h2 className="text-center text-xl font-extrabold">اختر الوضع</h2>
<div className="grid grid-cols-2 gap-3">
{gameModes.filter(m => !m.isOnlineOnly).map((mode) => (
<button
  key={mode.id}
  type="button"
  onClick={() => setGameMode(mode.id)}
  className={`rounded-[1.6rem] border px-4 py-4 text-center transition ${
    gameMode === mode.id
      ? 'border-purple-400 bg-purple-400 text-[#050907]'
      : 'border-white/10 bg-white/5 text-white'
  }`}
>
  <div className="mb-1 text-2xl">{mode.icon}</div>
  <div className="font-bold text-sm">{mode.name}</div>
  <div className="text-xs opacity-70 mt-1">{mode.minPlayers}+ لاعبين</div>
</button>
))}
</div>
{gameMode === 'silent' && (
  <div className="rounded-[1.5rem] border border-yellow-500/30 bg-yellow-500/10 p-4 text-center">
    <div className="text-2xl mb-2">🤫</div>
    <div className="font-bold text-yellow-300">وضع صامت</div>
    <p className="text-sm text-white/70 mt-1">ممنوع الكلام! بالإشارات والحركات بس</p>
  </div>
)}
</div>

<CounterBlock
label="إحنا كام"
icon="👥"
value={playerCount}
onDecrease={() => handlePlayerCountChange(clamp(playerCount - 1, minPlayers, 12))}
onIncrease={() => handlePlayerCountChange(clamp(playerCount + 1, minPlayers, 12))}
/>
{gameMode !== 'double-spies' && gameMode !== 'reversed' && (
<CounterBlock
label="كام مخبر"
icon="🔍"
value={spyCount}
onDecrease={() => setSpyCount((value) => clamp(value - 1, 1, Math.max(1, playerCount - 1)))}
onIncrease={() => setSpyCount((value) => clamp(value + 1, 1, Math.max(1, playerCount - 1)))}
/>
)}
<CounterBlock
label="كام دقيقة"
icon="⏱"
value={gameTime}
onDecrease={() => setGameTime((value) => clamp(value - 1, 1, 15))}
onIncrease={() => setGameTime((value) => clamp(value + 1, 1, 15))}
/>
<div className="space-y-3">
<h2 className="text-center text-xl font-extrabold">اختر الفئة</h2>
<div className="grid grid-cols-2 gap-3">
{categories.map((category) => (
<button
key={category.id}
type="button"
onClick={() => setCategoryId(category.id)}
className={`rounded-[1.6rem] border px-4 py-4 text-center transition ${
categoryId === category.id
? 'border-cyan-400 bg-cyan-400 text-[#050907]'
: 'border-white/10 bg-white/5 text-white'
}`}
>
<div className="mb-1 text-2xl">{category.icon}</div>
<div className="font-bold">{category.name}</div>
</button>
))}
</div>
</div>
<div className="space-y-3">
<h2 className="text-center text-xl font-extrabold">أضف اللاعبين</h2>
<div className="space-y-3">
{Array.from({ length: playerCount }, (_, index) => (
<input
key={`player-${index + 1}`}
value={playerNames[index] ?? ''}
onChange={(event) => {
const next = [...playerNames];
next[index] = event.target.value;
setPlayerNames(next);
}}
placeholder={`اسم اللاعب ${index + 1}`}
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-base font-bold text-white outline-none placeholder:text-white/35 focus:bord
er-cyan-400"
/>
))}
</div>
</div>
<button
type="button"
onClick={() =>
onStart({
playerCount,
spyCount,
gameTime,
categoryId,
gameMode,
playerNames: Array.from({ length: playerCount }, (_, index) => {
const name = playerNames[index]?.trim();
return name || `لاعب ${index + 1}`;
}),
})
}
className="flex w-full items-center gap-3 rounded-full bg-white px-2 py-2 text-[#050907] shadow-lg"
>
<IconCircle icon="▶" accent="text-cyan-400" />
<span className="flex-1 text-center text-3xl font-black">يلا نلعب</span>
</button>
</div>
</Shell>
);
}
function RevealView({
match,
onExit,
onComplete,
}: {
match: OfflineMatch;
onExit: () => void;
onComplete: () => void;
}) {
const [currentIndex, setCurrentIndex] = useState(0);
const [revealed, setRevealed] = useState(false);
const [confirmExit, setConfirmExit] = useState(false);
// Reset state when match.id changes - this is a valid pattern for syncing state with props
useEffect(() => {
/* eslint-disable react-hooks/set-state-in-effect */
setCurrentIndex(0);
setRevealed(false);
/* eslint-enable react-hooks/set-state-in-effect */
}, [match.id]);
const isSpy = match.spyIndices.includes(currentIndex);
const isLast = currentIndex === match.playerNames.length - 1;
// For different game modes
const playerIsKnower = isKnower(currentIndex, match);
const partnerName = getPartnerSpyName(currentIndex, match);
// Determine role display based on game mode
const getRoleDisplay = () => {
  if (match.gameMode === 'reversed') {
    // In reversed mode: the knower knows the word, others are spies
    if (playerIsKnower) {
      return (
        <div className="space-y-5">
          <div className="text-4xl font-black leading-tight">أنت الوحيد اللي عارف!</div>
          <div className="text-xl text-white/70">الكلمة:</div>
          <div className="mx-auto max-w-full rounded-[2rem] bg-white px-6 py-5 text-3xl font-black text-[#050907] shadow-lg">
            {match.secretWord}
          </div>
          <div className="rounded-xl bg-orange-500/20 border border-orange-400/30 p-4 text-center">
            <p className="text-lg text-orange-300">⚠️ كل الباقي مخبرين</p>
            <p className="text-sm text-white/60 mt-1">اخبي إنك عارف!</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-5">
          <div className="text-5xl font-black leading-tight">أنت المخبر</div>
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <p className="text-xl text-white/80">في شخص واحد بس عارف الكلمة</p>
            <p className="text-lg text-cyan-300 mt-2">اكتشفه!</p>
          </div>
        </div>
      );
    }
  }
  if (match.gameMode === 'double-spies' && isSpy) {
    return (
      <div className="space-y-5">
        <div className="text-5xl font-black leading-tight">أنت المخبر</div>
        <div className="rounded-[1.5rem] bg-cyan-500/20 border border-cyan-400/30 px-6 py-5 text-center">
          <p className="text-xl text-cyan-300 font-bold">شريكك: {partnerName}</p>
          <p className="text-sm text-white/60 mt-2">انتوا المخبرين الاتنين!</p>
        </div>
        <p className="text-xl text-white/80 text-center">اعملوا إنكم فاهمين..</p>
      </div>
    );
  }
  // Classic and Silent modes
  if (isSpy) {
    return (
      <div className="space-y-5">
        <div className="text-5xl font-black leading-tight">أنت المخبر</div>
        <div className="rounded-xl bg-white/5 p-4 text-center">
          <p className="text-xl text-white/80">اعمل إنك فاهم</p>
          <p className="text-lg text-cyan-300 mt-1">وحاول تلمس الكلمة..</p>
        </div>
        {match.gameMode === 'silent' && (
          <div className="rounded-xl bg-yellow-500/20 border border-yellow-400/30 p-4 text-center">
            <p className="text-lg text-yellow-300">🤫 مفيش كلام!</p>
            <p className="text-sm text-white/60 mt-1">بالإشارات بس</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="text-4xl font-black leading-tight">أنت مش المخبر</div>
      <div className="text-xl text-white/70">الكلمة:</div>
      <div className="mx-auto max-w-full rounded-[2rem] bg-white px-6 py-5 text-3xl font-black text-[#050907] shadow-lg">
        {match.secretWord}
      </div>
      {match.gameMode === 'silent' && (
        <div className="rounded-xl bg-yellow-500/20 border border-yellow-400/30 p-4 text-center">
          <p className="text-lg text-yellow-300">🤫 مفيش كلام!</p>
          <p className="text-sm text-white/60 mt-1">بالإشارات بس</p>
        </div>
      )}
    </div>
  );
};
return (
<Shell>
<ScreenHeader title={`اللاعب: ${currentIndex + 1}`} onBack={() => setConfirmExit(true)} />
<div className="flex min-h-[75vh] flex-col items-center py-4">
{/* Player Name Section */}
<div className="w-full text-center mb-6">
<div className="text-3xl font-black text-cyan-400">{match.playerNames[currentIndex]}</div>
<p className="text-lg text-white/60 mt-2">{revealed ? 'بلاش أي حد يشوف الشاشة!' : 'اضبط بصمتك وشوف دورك لوحدك'}</p>
</div>

{/* Main Content Area */}
<div className="flex-1 flex items-center justify-center w-full">
{!revealed ? (
<button
type="button"
onClick={() => setRevealed(true)}
className="flex flex-col items-center justify-center gap-5 rounded-[2rem] border border-white/10 bg-white/[0.03] px-10 py-12 transition hover:bg-white/[0.06] active:scale-[0.98]"
>
<div className="text-4xl font-black text-white/80">اضبط بصمتك</div>
<FingerprintLogo size={160} />
</button>
) : (
<div className="w-full space-y-5 text-center px-2">
<div className="flex justify-center mb-4">
<MaskLogo size={150} />
</div>
{getRoleDisplay()}
</div>
)}
</div>

{/* Action Button */}
<div className="w-full mt-6">
<button
type="button"
onClick={() => {
if (!revealed) return;
if (isLast) {
onComplete();
return;
}
setRevealed(false);
setCurrentIndex((value) => value + 1);
}}
className={`w-full rounded-full px-6 py-4 text-2xl font-black transition ${
revealed ? 'bg-white text-[#050907]' : 'bg-white/10 text-white/40'
}`}
>
{isLast ? 'ابدأ اللعب' : 'اللي بعده'}
</button>
</div>
</div>
<ConfirmModal
open={confirmExit}
title="تهرب من الجولة؟"
message="لو تخرج دلوقتي هترجع للرئيسية والجولة هتقفل."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onExit}
onCancel={() => setConfirmExit(false)}
/>
</Shell>
);
}
function PlayView({
match,
onExit,
onFinish,
notify,
}: {
match: OfflineMatch;
onExit: () => void;
onFinish: (winner: Winner, reason: string) => void;
notify: (message: string) => void;
}) {
const [timeLeft, setTimeLeft] = useState(match.gameTime * 60);
const [paused, setPaused] = useState(false);
const [tipIndex, setTipIndex] = useState(0);
const [showQuestions, setShowQuestions] = useState(false);
const [showGuess, setShowGuess] = useState(false);
const [showVote, setShowVote] = useState(false);
const [guessText, setGuessText] = useState('');
const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
const [confirmExit, setConfirmExit] = useState(false);
const [checkingGuess, setCheckingGuess] = useState(false);
const category = findCategory(match.categoryId);
const questions = useMemo(() => getRelevantQuestions(match.categoryId), [match.categoryId]);
// For double-spies mode: track selected players for voting
const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
// Reset state when match changes - valid pattern for syncing state with props
useEffect(() => {
 
setTimeLeft(match.gameTime * 60);
setPaused(false);
setGuessText('');
setSelectedPlayer(null);
setSelectedPlayers([]);
setShowGuess(false);
setShowVote(false);
setTipIndex(0);
 
}, [match.id, match.gameTime]);
// Timer effect
useEffect(() => {
if (paused) return undefined;
if (timeLeft <= 0) {
// Defer state update to avoid synchronous setState in effect
const timeout = setTimeout(() => setShowVote(true), 0);
return () => clearTimeout(timeout);
}
const timer = window.setInterval(() => {
setTimeLeft((value) => (value > 0 ? value - 1 : 0));
}, 1000);
return () => window.clearInterval(timer);
}, [paused, timeLeft]);
useEffect(() => {
const rotate = window.setInterval(() => {
setTipIndex((value) => (value + 1) % tips.length);
}, 4500);
return () => window.clearInterval(rotate);
}, []);

// Toggle player selection for double-spies mode
const togglePlayerSelection = (index: number) => {
  setSelectedPlayers(prev => 
    prev.includes(index) 
      ? prev.filter(i => i !== index)
      : prev.length < 2 ? [...prev, index] : prev
  );
};

// Get voting title based on game mode
const getVotingTitle = () => {
  if (match.gameMode === 'reversed') {
    return 'مين اللي عارف الكلمة؟';
  }
  if (match.gameMode === 'double-spies') {
    return 'اختار المخبرين (2)';
  }
  return 'مين المخبر؟';
};

// Calculate voting result
const calculateVoteResult = () => {
  if (match.gameMode === 'double-spies') {
    if (selectedPlayers.length !== 2) {
      notify('اختار مخبرين بالظبط!');
      return;
    }
    const foundSpies = selectedPlayers.every(i => match.spyIndices.includes(i));
    if (foundSpies) {
      onFinish('citizens', 'الناس كشفوا المخبرين الاتنين!');
    } else {
      onFinish('spies', 'الناس اختاروا غلط!');
    }
  } else if (match.gameMode === 'reversed') {
    if (selectedPlayer === null) {
      notify('اختر لاعب الأول');
      return;
    }
    const foundKnower = selectedPlayer === match.knowerIndex;
    if (foundKnower) {
      onFinish('citizens', 'الناس كشفوا اللي عارف الكلمة!');
    } else {
      onFinish('spies', 'الناس اختاروا الشخص الغلط!');
    }
  } else {
    if (selectedPlayer === null) {
      notify('اختر لاعب الأول');
      return;
    }
    const votedSpy = match.spyIndices.includes(selectedPlayer);
    onFinish(votedSpy ? 'citizens' : 'spies', votedSpy ? 'الناس كشفت المخبر!' : 'الناس اختارت الشخص الغلط!');
  }
};

// Get guess button text based on game mode
const getGuessButtonText = () => {
  if (match.gameMode === 'reversed') {
    return 'أنا عارف الكلمة وعايز أخمن مين المخبرين';
  }
  return 'أنا المخبر وعايز أخمن';
};

return (
<Shell>
<div className="space-y-5 pb-6">
<div className="flex items-center justify-between">
<button
type="button"
onClick={() => setConfirmExit(true)}
className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl"
>
⌂

</button>
<div className="text-center">
<div className="text-sm text-white/55">الفئة</div>
<div className="text-xl font-black">
{category.icon} {category.name}
</div>
</div>
<button
type="button"
onClick={() => setPaused((value) => !value)}
className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl"
>
{paused ? '▶' : '❚❚'}
</button>
</div>

{/* Silent mode warning */}
{match.gameMode === 'silent' && (
  <div className="rounded-[1.5rem] border border-yellow-500/30 bg-yellow-500/10 p-4 text-center animate-pulse">
    <div className="text-2xl mb-1">🤫</div>
    <div className="font-bold text-yellow-300">وضع صامت - ممنوع الكلام!</div>
    <p className="text-sm text-white/70 mt-1">استخدموا الإشارات والحركات بس</p>
  </div>
)}

<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-8 text-center">
<div className="text-sm text-white/55">{paused ? 'الوقت متوقف' : 'الوقت الباقي'}</div>
<div className="mt-3 text-6xl font-black tracking-wider">{formatTime(timeLeft)}</div>
</div>
<div className="rounded-[1.8rem] border border-cyan-400/20 bg-cyan-400/10 p-4">
<div className="mb-1 text-sm font-black text-cyan-300">نصيحة سريعة</div>
<div className="leading-7 text-white/90">{match.gameMode === 'silent' ? silentModeTips[tipIndex % silentModeTips.length] : tips[tipIndex]}</div>
</div>

{/* Hide questions button in silent mode */}
{match.gameMode !== 'silent' && (
<div className="grid grid-cols-2 gap-3">
<button
type="button"
onClick={() => setShowQuestions((value) => !value)}
className="rounded-[1.5rem] bg-white px-4 py-4 text-lg font-black text-[#050907]"
>
اقترح أسئلة
</button>
<button
type="button"
onClick={() => setShowVote(true)}
className="rounded-[1.5rem] border border-white/15 bg-white/5 px-4 py-4 text-lg font-black text-white"
>
صوتوا
</button>
</div>
)}

{match.gameMode === 'silent' && (
  <button
    type="button"
    onClick={() => setShowVote(true)}
    className="w-full rounded-[1.5rem] border border-white/15 bg-white/5 px-4 py-4 text-lg font-black text-white"
  >
    صوتوا
  </button>
)}

{match.gameMode !== 'reversed' && (
<button
type="button"
onClick={() => setShowGuess(true)}
className="w-full rounded-[1.6rem] bg-red-500 px-5 py-4 text-xl font-black text-white"
>
{getGuessButtonText()}
</button>
)}

{match.gameMode !== 'silent' && showQuestions && (
<div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
{questions.map((question) => (
<div key={question} className="rounded-[1.2rem] bg-white px-4 py-3 text-[#050907]">
{question}
</div>
))}
</div>
)}
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="mb-3 text-lg font-black">اللاعبين</div>
<div className="grid grid-cols-2 gap-3">
{match.playerNames.map((name, index) => (
<div key={`${name}-${index + 1}`} className="rounded-[1.3rem] border border-white/8 bg-white/5 px-3 py-3 text-center font-bold">
{name}
</div>
))}
</div>
</div>
{showGuess && (
<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-5">
<div className="w-full max-w-md rounded-[2rem] bg-[#0c120f] p-5">
<div className="mb-4 text-center text-2xl font-black">خمن الكلمة</div>
<input
value={guessText}
onChange={(event) => setGuessText(event.target.value)}
placeholder={match.categoryId === 'random' ? 'اكتب التخمين بتاعك' : 'اكتب أو اختار من تحت'}
className="mb-4 w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-white outline-none placeholder:text-white/35 focus:border-cyan-400"
/>
{match.categoryId !== 'random' && (
<div className="mb-4 max-h-52 space-y-2 overflow-auto">
{category.words.map((word) => (
<button
key={word}
type="button"
onClick={() => setGuessText(word)}
className={`w-full rounded-xl px-4 py-3 text-right font-bold ${
guessText === word ? 'bg-cyan-400 text-[#050907]' : 'bg-white text-[#050907]'
}`}
>
{word}
</button>
))}
</div>
)}
<div className="grid grid-cols-2 gap-3">
<button
type="button"
disabled={checkingGuess}
onClick={async () => {
if (!guessText.trim()) {
notify('اكتب التخمين الأول');
return;
}
setCheckingGuess(true);
try {
const result = await smartCheckAnswer(guessText, match.secretWord);
if (result.isCorrect) {
onFinish('spies', 'المخبر خمن الكلمة صح!');
} else {
// When spy guesses wrong, game ends - citizens win!
onFinish('citizens', 'المخبر خمن كلمة غلط وخسر!');
}
} finally {
setCheckingGuess(false);
}
}}
className="rounded-full bg-white px-4 py-3 font-black text-[#050907] disabled:opacity-50"
>
{checkingGuess ? '...جاري التحقق' : 'تأكيد'}
</button>
<button
type="button"
onClick={() => setShowGuess(false)}
className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-black text-white"
>
رجوع
</button>
</div>
</div>
</div>
)}
{showVote && (
<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-5">
<div className="w-full max-w-md rounded-[2rem] bg-[#0c120f] p-5">
<div className="mb-4 text-center text-2xl font-black">{getVotingTitle()}</div>
{match.gameMode === 'double-spies' && (
  <div className="mb-3 text-center text-sm text-white/60">
    تم اختيار: {selectedPlayers.length}/2
  </div>
)}
<div className="mb-4 max-h-72 space-y-2 overflow-auto">
{match.playerNames.map((name, index) => {
  const isSelected = match.gameMode === 'double-spies' 
    ? selectedPlayers.includes(index)
    : selectedPlayer === index;
  return (
<button
key={`${name}-vote-${index + 1}`}
type="button"
onClick={() => {
  if (match.gameMode === 'double-spies') {
    togglePlayerSelection(index);
  } else {
    setSelectedPlayer(index);
  }
}}
className={`w-full rounded-xl px-4 py-3 text-right font-bold transition ${
isSelected ? 'bg-red-500 text-white' : 'bg-white text-[#050907]'
}`}
>
{name}
{match.gameMode === 'double-spies' && selectedPlayers.includes(index) && (
  <span className="ml-2 text-xs">✓</span>
)}
</button>
  );
})}
</div>
<div className="grid grid-cols-2 gap-3">
<button
type="button"
onClick={calculateVoteResult}
className="rounded-full bg-white px-4 py-3 font-black text-[#050907]"
>
احسب النتيجة
</button>
<button
type="button"
onClick={() => {
  setShowVote(false);
  setSelectedPlayers([]);
  setSelectedPlayer(null);
}}
className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-black text-white"
>
رجوع
</button>
</div>
</div>
</div>
)}
</div>
<ConfirmModal
open={confirmExit}
title="تهرب من الجولة؟"
message="لو تخرج دلوقتي هتقفل الجولة وترجع للرئيسية."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onExit}
onCancel={() => setConfirmExit(false)}
/>
</Shell>
);
}
function ResultView({
match,
result,
onHome,
onPlayAgain,
}: {
match: OfflineMatch;
result: ResultState;
onHome: () => void;
onPlayAgain: () => void;
}) {
const spyNames = match.spyIndices.map((index) => match.playerNames[index]);
return (
<Shell>
<div className="flex min-h-[calc(100vh-3rem)] flex-col justify-center gap-6">
<div className="flex justify-center">
<MaskLogo size={140} />
</div>
<div className="space-y-3 text-center">
<div className="text-sm text-white/60">خلصت الجولة</div>
<h1 className="text-5xl font-black">{getWinnerLabel(result.winner)}</h1>
<p className="text-lg text-white/70">{result.reason}</p>
</div>
<div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
<div className="text-lg font-black">ملخص الجولة</div>
<div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 text-[#050907]">
<span className="font-bold">الكلمة</span>
<span className="font-black">{match.secretWord}</span>
</div>
<div className="flex items-center justify-between rounded-xl bg-white/8 px-4 py-3">
<span className="font-bold text-white/65">المخبرين</span>
<span className="font-black">{spyNames.join(' - ')}</span>
</div>
<div className="flex items-center justify-between rounded-xl bg-white/8 px-4 py-3">
<span className="font-bold text-white/65">عدد اللاعبين</span>
<span className="font-black">{match.playerNames.length}</span>
</div>

</div>
<div className="grid grid-cols-2 gap-3">
<button type="button" onClick={onPlayAgain} className="rounded-full bg-white px-4 py-4 text-xl font-black text-[#050907]">
جولة جديدة
</button>
<button
type="button"
onClick={onHome}
className="rounded-full border border-white/10 bg-white/5 px-4 py-4 text-xl font-black text-white"
>
الرئيسية
</button>
</div>
</div>
</Shell>
);
}
function HistoryView({
  history,
  onBack,
  onClear,
  onViewSummary,
}: {
  history: HistoryEntry[];
  onBack: () => void;
  onClear: () => void;
  onViewSummary: (entry: HistoryEntry) => void;
}) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `اليوم ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (isYesterday) {
      return `أمس ${date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getGameTypeLabel = (gameType: string) => {
    return gameType === 'spy' ? '🕵️ المخبر' : '❓ المسابقة';
  };

  const getPlayModeLabel = (playMode: string) => {
    return playMode === 'online' ? '🌐 أونلاين' : '📱 أوفلاين';
  };

  const getGameModeLabel = (gameMode: string) => {
    const modes: Record<string, string> = {
      'classic': 'كلاسيكي',
      'double-spies': 'مخبرين اثنين',
      'reversed': 'المقلوب',
      'silent': 'الصامت',
      'relaxed': 'سيبنا براحتنا',
      'speed': 'مين الأسرع',
    };
    return modes[gameMode] || gameMode;
  };

  const getWinnerLabel = (winner: string, gameType: string) => {
    if (gameType === 'spy') {
      return winner === 'spies' ? 'المخبر كسب!' : 'المواطنين كسبوا';
    }
    return winner; // For quiz, winner is the player name
  };

  return (
    <Shell>
      <ScreenHeader title="سجل اللعب" onBack={onBack} />
      <div className="space-y-4 pb-8">
        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-full border border-red-400/30 bg-red-500/10 px-4 py-3 font-black text-red-200"
        >
          امسح السجل
        </button>

        {!history.length && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center text-white/60">
            ماعندكش جولات محفوظة.
          </div>
        )}

        {history.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onViewSummary(entry)}
            className="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 text-right transition hover:bg-white/[0.08]"
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xl font-black">{getGameTypeLabel(entry.gameType)}</div>
                <div className="text-xs text-white/50">{formatDate(entry.playedAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs">
                  {getPlayModeLabel(entry.playMode)}
                </span>
              </div>
            </div>

            {/* Winner Banner */}
            <div className={`mb-3 rounded-xl p-3 text-center ${
              entry.gameType === 'spy' 
                ? entry.winner === 'spies' 
                  ? 'bg-red-500/20 text-red-300' 
                  : 'bg-green-500/20 text-green-300'
                : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              <div className="text-lg font-black">{getWinnerLabel(entry.winner, entry.gameType)}</div>
              {entry.winnerName && entry.gameType === 'quiz' && (
                <div className="text-sm">🏆 {entry.winnerName}</div>
              )}
            </div>

            {/* Game Info Grid */}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-white/5 p-2 text-center">
                <div className="text-xs text-white/45">المود</div>
                <div className="font-bold text-xs">{getGameModeLabel(entry.gameMode as string)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-2 text-center">
                <div className="text-xs text-white/45">اللاعبين</div>
                <div className="font-black">{entry.playerCount}</div>
              </div>
              {entry.gameType === 'spy' && (
                <div className="rounded-xl bg-white/5 p-2 text-center">
                  <div className="text-xs text-white/45">المخبرين</div>
                  <div className="font-black">{entry.spyCount}</div>
                </div>
              )}
              {entry.gameType === 'quiz' && (
                <div className="rounded-xl bg-white/5 p-2 text-center">
                  <div className="text-xs text-white/45">الجولات</div>
                  <div className="font-black">{entry.quizRounds}</div>
                </div>
              )}
            </div>

            {/* XP Earned */}
            {entry.xpEarned > 0 && (
              <div className="mt-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30 p-2 flex items-center justify-between">
                <span className="text-sm text-white/70">الخبرة المكتسبة</span>
                <span className="font-black text-yellow-300">+{entry.xpEarned} ⭐</span>
              </div>
            )}

            {/* Category */}
            <div className="mt-3 text-xs text-white/50">
              الفئة: {entry.categoryName}
            </div>

            {/* Click hint */}
            <div className="mt-2 text-center text-xs text-white/30">
              اضغط لعرض التفاصيل ←
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}
function SettingsView({
  profile,
  authUser,
  onBack,
  onLogout,
  onClaimReward,
  notify,
}: {
  profile: Profile;
  authUser: AuthUser | null;
  onBack: () => void;
  onLogout: () => Promise<void>;
  onClaimReward: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [claiming, setClaiming] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [achievements, setAchievements] = useState<any[]>([]);
  
  const handleClaimReward = async () => {
    setClaiming(true);
    try {
      await onClaimReward();
    } catch {
      notify('حدث خطأ');
    }
    setClaiming(false);
  };
  
  // Get title info
  const titleInfo = authUser?.titleInfo || getTitleFromXP(authUser?.gold || 0);
  
  // Profile View
  if (showProfile && authUser) {
    return (
      <Shell>
        <ScreenHeader title="الملف الشخصي" onBack={() => setShowProfile(false)} showHomeIcon={false} />
        <div className="space-y-4 pb-8">
          {/* Profile Card with Title */}
          <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-5 space-y-4">
            {/* User Info with Title Badge */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="text-5xl">{authUser.gender === 'male' ? '👨' : '👩'}</div>
                {/* Level badge */}
                <div 
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black border-2 border-[#050907]"
                  style={{ backgroundColor: titleInfo.color }}
                >
                  {titleInfo.level}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black">{authUser.name}</span>
                  <span className="text-lg">{titleInfo.icon}</span>
                </div>
                {/* Title Badge */}
                <div 
                  className="inline-block px-3 py-0.5 rounded-full text-sm font-bold mt-1"
                  style={{ backgroundColor: titleInfo.color + '30', color: titleInfo.color }}
                >
                  {titleInfo.title}
                </div>
                <div className="text-sm text-white/60 mt-1">{authUser.email}</div>
              </div>
            </div>
            
            {/* XP Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">الخبرة</span>
                {titleInfo.nextTitle && (
                  <span className="text-white/50">
                    {titleInfo.xpToNext} خبرة للـ {titleInfo.nextTitle}
                  </span>
                )}
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${titleInfo.progress}%`,
                    backgroundColor: titleInfo.color 
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/50">
                <span>{authUser.gold} خبرة</span>
                {titleInfo.nextTitle && <span>المستوى التالي: {titleInfo.nextTitle}</span>}
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[1.5rem] bg-yellow-400/20 px-4 py-3 text-center">
                <CoinIcon size={32} />
                <div className="text-xl font-black text-yellow-300">{authUser.gold}</div>
                <div className="text-xs text-white/60">خبرة</div>
              </div>
              <div className="rounded-[1.5rem] bg-orange-400/20 px-4 py-3 text-center">
                <div className="text-2xl">🔥</div>
                <div className="text-xl font-black text-orange-300">{authUser.currentStreak}</div>
                <div className="text-xs text-white/60">يوم</div>
              </div>
              <div className="rounded-[1.5rem] bg-cyan-400/20 px-4 py-3 text-center">
                <div className="text-2xl">🏆</div>
                <div className="text-xl font-black text-cyan-300">{authUser.gamesWon || 0}</div>
                <div className="text-xs text-white/60">فوز</div>
              </div>
            </div>
            
            {/* Detailed Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                <div className="text-lg">🎮</div>
                <div className="text-lg font-bold">{authUser.gamesPlayed || 0}</div>
                <div className="text-xs text-white/60">لعبة</div>
              </div>
              <div className="rounded-xl bg-white/5 px-4 py-3 text-center">
                <div className="text-lg">⭐</div>
                <div className="text-lg font-bold">{authUser.longestStreak || 0}</div>
                <div className="text-xs text-white/60">أطول سلسلة</div>
              </div>
            </div>
            
            {/* Win Rate */}
            {authUser.gamesPlayed > 0 && (
              <div className="rounded-xl bg-white/5 px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/70">نسبة الفوز</span>
                  <span className="text-lg font-bold text-green-400">
                    {Math.round((authUser.gamesWon / authUser.gamesPlayed) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                    style={{ width: `${(authUser.gamesWon / authUser.gamesPlayed) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {authUser.canClaimReward && (
              <button
                type="button"
                onClick={handleClaimReward}
                disabled={claiming}
                className="w-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 px-4 py-4 text-xl font-black text-[#050907] disabled:opacity-50"
              >
                {claiming ? 'جاري الاستلام...' : <span className="flex items-center justify-center gap-2">استلم مكافأتك اليومية <CoinIcon size={20} />25+</span>}
              </button>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="w-full rounded-full border border-red-400/30 bg-red-500/10 px-4 py-3 font-bold text-red-300"
            >
              تسجيل الخروج
            </button>
          </div>
          
          {/* Achievements Section */}
          <button
            type="button"
            onClick={() => setShowAchievements(!showAchievements)}
            className="w-full rounded-[2rem] border border-purple-500/30 bg-purple-500/10 p-4 text-right transition-all hover:bg-purple-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏅</span>
                <span className="text-xl font-black text-purple-400">الإنجازات</span>
              </div>
              <span className="text-white/50">{showAchievements ? '▲' : '▼'}</span>
            </div>
          </button>
          
          {showAchievements && (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 space-y-3">
              <div className="text-center text-white/50 text-sm py-4">
                جاري تحميل الإنجازات...
              </div>
            </div>
          )}
        </div>
      </Shell>
    );
  }
  
  // Settings Menu
  return (
    <Shell>
      <ScreenHeader title="الإعدادات" onBack={onBack} />
      <div className="space-y-4 pb-8">
        {/* Profile Option */}
        {authUser && (
          <button
            type="button"
            onClick={() => setShowProfile(true)}
            className="w-full rounded-[2rem] border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 p-5 text-right transition-all hover:bg-cyan-500/20"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="text-4xl">{authUser.gender === 'male' ? '👨' : '👩'}</div>
                  <div 
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 border-[#050907]"
                    style={{ backgroundColor: titleInfo.color }}
                  >
                    {titleInfo.level}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black">{authUser.name}</span>
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: titleInfo.color + '30', color: titleInfo.color }}
                    >
                      {titleInfo.icon} {titleInfo.title}
                    </span>
                  </div>
                  <div className="text-sm text-white/60 mt-1">{authUser.email}</div>
                </div>
              </div>
              <span className="text-2xl text-white/50">←</span>
            </div>
          </button>
        )}
        
        {!authUser && (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <div className="text-lg font-black mb-2">مش مسجل الدخول</div>
            <p className="text-sm text-white/60">سجل دخولك عشان تشوف إحصائياتك وتستلم مكافآتك اليومية</p>
          </div>
        )}
        
        {/* Language Option */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🌐</span>
              <span className="text-xl font-black">اللغة</span>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-bold">العربية (مصري)</div>
          </div>
        </div>
        
        {/* Notifications */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <span className="text-xl font-black">الإشعارات</span>
            </div>
            <div className="rounded-2xl bg-green-500/20 px-4 py-2 text-sm font-bold text-green-400">مفعلة</div>
          </div>
        </div>
        
        {/* Sound */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔊</span>
              <span className="text-xl font-black">الصوت</span>
            </div>
            <div className="rounded-2xl bg-green-500/20 px-4 py-2 text-sm font-bold text-green-400">مفعل</div>
          </div>
        </div>
        
        {/* About App */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ℹ️</span>
              <span className="text-xl font-black">عن التطبيق</span>
            </div>
            <div className="text-sm text-white/50">الإصدار 1.0.0</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
function AboutView({ onBack }: { onBack: () => void }) {
  return (
    <Shell>
      <ScreenHeader title="عنا ℹ️" onBack={onBack} />
      <div className="space-y-5 pb-8">
        {/* About Developer - FIRST */}
        <div className="rounded-[2rem] border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">👨‍💻</span>
            <span className="text-xl font-black text-cyan-400">عن المطور</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-3xl font-black text-white shadow-lg">
              ز
            </div>
            <div>
              <div className="text-2xl font-black">زياد عمرو</div>
              <div className="text-sm text-white/60">مطور تطبيقات ومواقع ويب</div>
            </div>
          </div>
          <div className="space-y-3 text-white/70 leading-relaxed">
            <p>
              زياد عمرو هو مطور شاب شغوف بعالم التكنولوجيا وتطوير التطبيقات، بدأ رحلته في عالم البرمجة منذ سنوات وله عدة مشاريع ناجحة.
            </p>
            <p>
              بيسعى دايمًا لتقديم تطبيقات بسيطة وممتعة تخدم المستخدم العربي، والمخبر واحدة من أحلامه اللي حققها عشان يوصل لكم تجربة مميزة.
            </p>
            <p className="border-r-4 border-cyan-400 pr-4 italic text-white/80">
              &quot;زياد بيؤمن إن التكنولوجيا لازم تكون سهلة ومتاحة للكل، وده اللي بيحاول يطبقه في كل مشروع بيشتغل عليه.&quot;
            </p>
          </div>
        </div>

        {/* About App - SECOND */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📱</span>
            <span className="text-xl font-black">نبذة عن التطبيق</span>
          </div>
          <div className="space-y-3 text-white/70 leading-relaxed">
            <p>
              المخبر هي لعبة اجتماعية ترفيهية للهواتف الذكية، حيث يتنافس الأصدقاء في جو من الحماس والذكاء لكشف المخبر المخفي وسط المجموعة قبل فوات الأوان.
            </p>
            <p>
              اللعبة بتعتمد على الذكاء الاجتماعي والملاحظة، حيث لازم الأصدقاء يكتشفوا مين فيهم المخبر اللي مش عارف الكلمة السرية قبل ما الوقت يخلص!
            </p>
          </div>
        </div>

        {/* App Goal - THIRD */}
        <div className="rounded-[2rem] border border-yellow-500/30 bg-yellow-500/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🎯</span>
            <span className="text-xl font-black text-yellow-400">هدف التطبيق</span>
          </div>
          <p className="text-lg font-bold text-white mb-3">هدفنا نبسط الناس! 🎉</p>
          <p className="text-white/70 mb-3">المخبر مصممة عشان:</p>
          <div className="space-y-2 text-white/70">
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>تجمع الأصدقاء والجمعات على حاجة ممتعة</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>تخلق جو من الحماس والضحك</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>تنمي الذكاء الاجتماعي والملاحظة</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              <span>تكون سهلة وبسيطة للكل</span>
            </div>
          </div>
          <p className="mt-4 text-white/80 leading-relaxed">
            نسعى إننا نكون اللعبة الأولى في الجمعات واللي بتخلّي كل واحد فينا يضحك ويستمتع! 🎉
          </p>
        </div>

        {/* Contact Links - FOURTH */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📧</span>
            <span className="text-xl font-black">تواصل معنا</span>
          </div>
          <div className="space-y-3">
            <a
              href="https://www.facebook.com/ziad7mr"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                📘
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg">فيسبوك</div>
                <div className="text-sm text-white/80">@ziad7mr</div>
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-blue-600">
                تابعنا
              </div>
            </a>
            <a
              href="https://t.me/ziadamr"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 p-4 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            >
              <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                📱
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg">تيليجرام</div>
                <div className="text-sm text-white/80">@ziadamr</div>
              </div>
              <div className="rounded-full bg-white px-4 py-2 text-sm font-bold text-sky-600">
                راسلنا
              </div>
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white/40 text-sm">
          <div>2026 © المخبر</div>
          <div>الإصدار 1.0.0</div>
        </div>
      </div>
    </Shell>
  );
}
function ModesView({ onBack }: { onBack: () => void }) {
return (
<Shell>
<ScreenHeader title="أوضاع تانية" onBack={onBack} />
<div className="space-y-4 pb-8">
{gameModes.map((mode) => (
<div key={mode.id} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
<div className="mb-2 flex items-center gap-3">
<div className="text-3xl">{mode.icon}</div>
<div className="text-2xl font-black">{mode.name}</div>
</div>
<div className="leading-7 text-white/70">{mode.description}</div>
</div>
))}
</div>
</Shell>
);
}
// Online Views with HTTP API
function OnlineGatewayView({
onBack,
defaultName,
playerGold,
gameApi,
onRoomCreated,
onRoomJoined,
notify,
isConnected,
}: {
onBack: () => void;
defaultName: string;
playerGold: number;
gameApi: (action: string, data?: Record<string, unknown>) => Promise<{ success: boolean; room?: Room; error?: string; playerId?: string }>;
onRoomCreated: (room: Room, playerId: string) => void;
onRoomJoined: (room: Room, playerId: string) => void;
notify: (message: string) => void;
isConnected: boolean;
}) {
const [mode, setMode] = useState<'select' | 'create' | 'join' | 'public'>('select');
const [name, setName] = useState(defaultName);
const [code, setCode] = useState('');
const [roomName, setRoomName] = useState('');
const [isPublic, setIsPublic] = useState(true);
const [settings, setSettings] = useState<GameSettings>({
spyCount: 1,
gameTime: 5,
categoryId: 'places',
gameMode: 'classic',
});
const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
const [loading, setLoading] = useState(false);
useEffect(() => {
setName(defaultName);
}, [defaultName]);
// Fetch public rooms
useEffect(() => {
const fetchPublicRooms = async () => {
try {
const response = await fetch('/api/game?action=public-rooms');
const data = await response.json();
if (data.success && data.rooms) {
setPublicRooms(data.rooms);
}
} catch (error) {
console.error('Failed to fetch public rooms:', error);
}
};
fetchPublicRooms();
const interval = setInterval(fetchPublicRooms, 5000);
return () => clearInterval(interval);
}, []);
const handleCreateRoom = async () => {
setLoading(true);
const playerName = name.trim() || defaultName || 'لاعب';
const result = await gameApi('create-room', { playerName, isPublic, settings, playerGold, roomName: roomName.trim() || undefined });
setLoading(false);
if (result.success && result.room && result.playerId) {
onRoomCreated(result.room, result.playerId);
} else {
notify(result.error || 'حدث خطأ');
}
};
const handleJoinRoom = async () => {
const roomCode = code.trim().toUpperCase();
if (roomCode.length !== 6) {
notify('كود الغرفة لازم يكون 6 حروف');
}
setLoading(true);
const playerName = name.trim() || defaultName || 'لاعب';
const result = await gameApi('join-room', { roomCode, playerName, playerGold });
setLoading(false);
if (result.success && result.room && result.playerId) {
onRoomJoined(result.room, result.playerId);

} else {
notify(result.error || 'حدث خطأ');
}
};
const handleJoinPublicRoom = async (roomCode: string) => {
setLoading(true);
const playerName = name.trim() || defaultName || 'لاعب';
const result = await gameApi('join-room', { roomCode, playerName, playerGold });
setLoading(false);
if (result.success && result.room && result.playerId) {
onRoomJoined(result.room, result.playerId);
} else {
notify(result.error || 'حدث خطأ');
}
};
if (mode === 'select') {
return (
<Shell>
<ScreenHeader title="يلا اونلاين؟" onBack={onBack} />
<div className="space-y-5">
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 text-center">
<div className="mb-2 text-5xl">🎮</div>
<div className="text-2xl font-black">العبوا اونلاين</div>
<p className="mt-3 leading-7 text-white/65">
 اعمل غرفة وابعته لصحابك، خد الكود، أو انضم لغرفة عامة.
</p>
<div className="mt-3 text-sm text-white/50">
جاهز للعب
</div>
</div>
<button
type="button"
onClick={() => setMode('create')}
className="w-full rounded-[1.8rem] bg-white px-5 py-5 text-2xl font-black text-[#050907]"
>
اعمل غرفة جديدة
</button>
<button
type="button"
onClick={() => setMode('join')}
className="w-full rounded-[1.8rem] border border-white/10 bg-white/5 px-5 py-5 text-2xl font-black text-white"
>
انضم بكود
</button>
<button
type="button"
onClick={() => setMode('public')}
className="w-full rounded-[1.8rem] border border-cyan-400/30 bg-cyan-400/10 px-5 py-5 text-2xl font-black text-cyan-100"
>
غرف عامة ({publicRooms.length})
</button>
</div>
</Shell>
);
}
if (mode === 'public') {
return (
<Shell>
 <ScreenHeader title="غرف عامة" onBack={() => setMode('select')} showHomeIcon={false} />
<div className="space-y-4 pb-8">
<input
value={name}
onChange={(event) => setName(event.target.value)}
placeholder="اسمك"
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-white outline-none placeholder:text-white/35 focus:border-cyan-400"
/>
{!publicRooms.length && (
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 text-center text-white/60">
مفيش غرف عامة دلوقتي. اعمل واحدة جديدة!
</div>
)}
{publicRooms.map((room) => (
<div key={room.code} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="mb-3 flex items-center justify-between">
<div>
{room.name ? (
<>
<div className="text-2xl font-black text-cyan-400">{room.name}</div>
<div className="text-xs text-white/50 mt-1">كود: {room.code}</div>
</>
) : (
<div className="text-2xl font-black tracking-wider">{room.code}</div>
)}
</div>
<div className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#050907]">
{room.playerCount}/12
</div>
</div>
<div className="mb-3 text-sm text-white/60">
صاحب الغرفة: {room.hostName}
</div>
<div className="mb-3 flex gap-2 text-xs">
<span className="rounded-full bg-white/10 px-2 py-1">{room.settings.spyCount} </span>
<span className="rounded-full bg-white/10 px-2 py-1">{room.settings.gameTime} </span>
</div>
<button
type="button"
onClick={() => handleJoinPublicRoom(room.code)}
className="w-full rounded-full bg-white px-4 py-3 font-black text-[#050907]"
>
انضم
</button>
</div>
))}
</div>
</Shell>
);
}
if (mode === 'create') {
return (
<Shell>
<ScreenHeader title="اعمل غرفة" onBack={() => setMode('select')} showHomeIcon={false} />
<div className="space-y-5 pb-8">

<input
value={name}
onChange={(event) => setName(event.target.value)}
placeholder="اسمك"
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-white outline-none placeholder:text-white/35 focus:border-cyan-400"
/>
<input
value={roomName}
onChange={(event) => setRoomName(event.target.value)}
placeholder="اسم الغرفة (اختياري)"
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-white outline-none placeholder:text-white/35 focus:border-cyan-400"
/>
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="mb-3 text-xl font-black">نوع</div>
<div className="grid grid-cols-2 gap-3">
<button
type="button"
onClick={() => setIsPublic(true)}
className={`rounded-xl py-3 font-black ${isPublic ? 'bg-white text-[#050907]' : 'bg-white/5 text-white'}`}
>
عامة
</button>
<button
type="button"
onClick={() => setIsPublic(false)}
className={`rounded-xl py-3 font-black ${!isPublic ? 'bg-white text-[#050907]' : 'bg-white/5 text-white'}`}
>
خاصة
</button>
</div>
</div>
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="mb-3 text-xl font-black">إعدادات اللعبة</div>
<div className="space-y-4">
<div className="flex items-center justify-between">
<span className="text-white/80">عدد المخبرين</span>
<div className="flex gap-3">
<button
type="button"
onClick={() => setSettings(s => ({ ...s, spyCount: Math.max(1, s.spyCount - 1) }))}
className="h-10 w-10 rounded-full border border-white/20 text-xl hover:bg-white/10 transition"
>
−
</button>
<span className="w-8 text-center text-xl font-black">{settings.spyCount}</span>
<button
type="button"
onClick={() => setSettings(s => ({ ...s, spyCount: Math.min(3, s.spyCount + 1) }))}
className="h-10 w-10 rounded-full border border-white/20 text-xl hover:bg-white/10 transition"
>
+
</button>
</div>
</div>
<div className="flex items-center justify-between">
<span className="text-white/80">وقت اللعب (دقايق)</span>
<div className="flex gap-3">
<button
type="button"
onClick={() => setSettings(s => ({ ...s, gameTime: Math.max(3, s.gameTime - 1) }))}
className="h-10 w-10 rounded-full border border-white/20 text-xl hover:bg-white/10 transition"
>
−
</button>
<span className="w-8 text-center text-xl font-black">{settings.gameTime}</span>
<button
type="button"
onClick={() => setSettings(s => ({ ...s, gameTime: Math.min(15, s.gameTime + 1) }))}
className="h-10 w-10 rounded-full border border-white/20 text-xl hover:bg-white/10 transition"
>
+
</button>
</div>
</div>
</div>
</div>
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="mb-3 text-xl font-black">اختر التصنيف</div>
<div className="grid grid-cols-2 gap-2">
{categories.map((cat) => (
<button
key={cat.id}
type="button"
onClick={() => setSettings(s => ({ ...s, categoryId: cat.id }))}
className={`rounded-xl py-3 text-sm font-bold transition ${
settings.categoryId === cat.id ? 'bg-white text-[#050907]' : 'bg-white/5 text-white hover:bg-white/10'
}`}
>
{cat.icon} {cat.name}
</button>
))}
</div>
</div>
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="mb-3 text-xl font-black">اختر الوضع</div>
<div className="grid grid-cols-2 gap-2">
{gameModes.map((gameModeItem) => (
<button
key={gameModeItem.id}
type="button"
onClick={() => setSettings(s => ({ ...s, gameMode: gameModeItem.id }))}
className={`rounded-xl py-3 text-sm font-bold transition ${
settings.gameMode === gameModeItem.id ? 'bg-purple-400 text-[#050907]' : 'bg-white/5 text-white hover:bg-white/10'
}`}
>
<div className="text-lg">{gameModeItem.icon}</div>
<div>{gameModeItem.name}</div>
</button>
))}
</div>
</div>
<button
type="button"
onClick={handleCreateRoom}
disabled={!isConnected}
className="w-full rounded-full bg-white px-4 py-4 text-xl font-black text-[#050907] disabled:opacity-50"
>
أنشئ الغرفة
</button>
</div>
</Shell>
);
}
return (
<Shell>
<ScreenHeader title="انضم لغرفة" onBack={() => setMode('select')} showHomeIcon={false} />
<div className="space-y-4">
<input
value={name}
onChange={(event) => setName(event.target.value)}
placeholder="اسمك"
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-white outline-none placeholder:text-white/35 focus:border-cyan-400"

/>
<input
value={code}
onChange={(event) => setCode(event.target.value.toUpperCase())}
placeholder="كود الغرفة"
maxLength={6}
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-center text-xl font-black tracking-[0.4em] text-white outline-none placeholder:te
xt-white/35 focus:border-cyan-400"
/>
<button
type="button"
onClick={handleJoinRoom}
disabled={!isConnected || code.length !== 6}
className="w-full rounded-full bg-white px-4 py-4 text-xl font-black text-[#050907] disabled:opacity-50"
>
ادخل الغرفة
</button>
</div>
</Shell>
);
}
function OnlineRoomView({
room,
gameApi,
playerId,
onLeave,
notify,
onSaveHistory,
authUserId,
authUserName,
onlineUsers,
friends,
sendRoomInvite,
socialConnected,
}: {
room: Room;
gameApi: (action: string, data?: Record<string, unknown>) => Promise<{ success: boolean; room?: Room; error?: string; isSpy?: boolean; secretWord?: string | null }>;
playerId: string;
onLeave: () => void;
notify: (message: string) => void;
onSaveHistory: (entry: HistoryEntry) => void;
authUserId?: string;
authUserName?: string;
onlineUsers?: { id: string; name: string }[];
friends?: { id: string; name: string }[];
sendRoomInvite?: (receiverId: string, roomCode: string, gameType: string) => void;
socialConnected?: boolean;
}) {
const [confirmExit, setConfirmExit] = useState(false);
const [revealed, setRevealed] = useState(false);
const [confirmedRole, setConfirmedRole] = useState(false); // New: player confirmed they saw their role
const [myRole, setMyRole] = useState<{ isSpy: boolean; secretWord: string | null; partnerSpyName?: string | null } | null>(null);
const [guessText, setGuessText] = useState('');
const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
const [timeLeft, setTimeLeft] = useState<number>(0); // New: separate time state
const [xpClaimed, setXpClaimed] = useState(false);
const [earnedXP, setEarnedXP] = useState<number | null>(null);
const [historySaved, setHistorySaved] = useState(false);
const [showQuestions, setShowQuestions] = useState(false);
const [showInviteModal, setShowInviteModal] = useState(false);
const previousStatusRef = useRef<string | null>(null);
const questionsRef = useRef<string[]>([]); // Store questions to prevent re-generation
const roleFetchedRef = useRef(false); // Prevent multiple role fetches
const timerRef = useRef<NodeJS.Timeout | null>(null); // Timer ref
const me = room.players.find((player) => player.id === playerId) ?? null;
const category = findCategory(room.game?.categoryId ?? room.settings.categoryId);

// Handle inviting a friend to the room
const handleInviteFriend = useCallback(async (friendId: string) => {
  if (!socialConnected) {
    notify('غير متصل بخدمة الأصدقاء');
    return false;
  }
  
  sendRoomInvite?.(friendId, room.code, 'spy');
  notify('تم إرسال الدعوة!');
  return true;
}, [socialConnected, sendRoomInvite, room.code, notify]);

// Initialize questions ONCE when game starts
useEffect(() => {
  if (room.status === 'running' && room.game && questionsRef.current.length === 0) {
    const categoryId = room.game.categoryId || room.settings.categoryId;
    const categoryQuestions = questionSuggestions.find(q => q.category === categoryId);
    const generalQuestions = questionSuggestions.find(q => q.category === 'general');
    
    let allQuestions: string[] = [];
    if (categoryQuestions) {
      allQuestions = [...categoryQuestions.questions, ...generalQuestions?.questions.slice(0, 3) || []];
    } else {
      allQuestions = generalQuestions?.questions || [];
    }
    
    // Shuffle and store ONCE
    questionsRef.current = allQuestions.sort(() => Math.random() - 0.5).slice(0, 5);
  }
  
  // Reset when game ends
  if (room.status === 'ended') {
    questionsRef.current = [];
    roleFetchedRef.current = false;
    setRevealed(false);
    setConfirmedRole(false);
    setMyRole(null);
  }
}, [room.status, room.game]);

// Timer effect - separate from render
useEffect(() => {
  if (room.status !== 'running' || !room.game) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return;
  }

  // Handle endsAt - could be Date object, string, or number
  let endsAtValue: number;
  const endsAt = room.game.endsAt;
  
  if (typeof endsAt === 'number') {
    endsAtValue = endsAt;
  } else if (endsAt instanceof Date) {
    endsAtValue = endsAt.getTime();
  } else if (typeof endsAt === 'string') {
    endsAtValue = new Date(endsAt).getTime();
  } else {
    // Fallback: use gameTime from settings
    const startedAt = room.game.startedAt;
    let startedAtValue: number;
    if (typeof startedAt === 'number') {
      startedAtValue = startedAt;
    } else if (startedAt instanceof Date) {
      startedAtValue = startedAt.getTime();
    } else if (typeof startedAt === 'string') {
      startedAtValue = new Date(startedAt).getTime();
    } else {
      startedAtValue = Date.now();
    }
    endsAtValue = startedAtValue + (room.settings.gameTime * 60 * 1000);
  }
  
  // Calculate initial time
  const calculateTimeLeft = () => {
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endsAtValue - now) / 1000));
    return remaining;
  };
  
  setTimeLeft(calculateTimeLeft());
  
  // Start timer
  timerRef.current = setInterval(() => {
    const remaining = calculateTimeLeft();
    setTimeLeft(remaining);
    
    if (remaining <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, 1000);
  
  return () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}, [room.status, room.game?.endsAt, room.game?.startedAt, room.settings?.gameTime]);

// Fetch role ONCE when revealed
const handleRevealRole = useCallback(async () => {
  if (roleFetchedRef.current) return;
  roleFetchedRef.current = true;
  
  const result = await gameApi('get-role');
  if (result.success) {
    setMyRole({
      isSpy: result.isSpy || false,
      secretWord: result.secretWord || null,
      partnerSpyName: result.partnerSpyName || null,
    });
  }
}, [gameApi]);

// Reset XP state when transitioning away from 'ended' (new game starting)
useEffect(() => {
  // Check if we're transitioning from 'ended' to something else
  if (previousStatusRef.current === 'ended' && room.status !== 'ended') {
    // Use setTimeout to defer setState outside of render phase
    const timer = setTimeout(() => {
      setXpClaimed(false);
      setEarnedXP(null);
      setHistorySaved(false);
    }, 0);
    return () => clearTimeout(timer);
  }
  // Update ref for next comparison
  previousStatusRef.current = room.status;
}, [room.status]);

// Combined: Claim XP and Save history when game ends
useEffect(() => {
  if (room.status !== 'ended' || historySaved || !room.game) return;

  const claimXPAndSaveHistory = async () => {
    const iAmSpy = room.game!.spyIds.includes(playerId);
    const spyWon = room.game!.winner === 'spies';
    const didWin = (iAmSpy && spyWon) || (!iAmSpy && !spyWon);
    const spyNames = room.game!.spyIds.map(spyId => {
      const spyPlayer = room.players.find(p => p.id === spyId);
      return spyPlayer?.name || 'غير معروف';
    });

    // Claim XP first
    let xpEarned = 0;
    try {
      const response = await fetch('/api/game-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: 'spy',
          gameMode: room.settings.gameMode,
          outcome: didWin ? 'win' : 'loss',
          playerRole: iAmSpy ? 'spy' : 'citizen',
        }),
      });

      const data = await response.json();
      if (data.success) {
        xpEarned = data.xpEarned || 0;
        setEarnedXP(xpEarned);
      }
    } catch (error) {
      console.error('Failed to claim XP:', error);
    }
    setXpClaimed(true);

    // Now save history with actual XP earned
    const entry: HistoryEntry = {
      id: uid(),
      playedAt: new Date().toISOString(),
      gameType: 'spy',
      playMode: 'online',
      gameMode: room.settings.gameMode,
      categoryName: category?.name || 'غير معروف',
      playerCount: room.players.length,
      winner: room.game!.winner || 'citizens',
      reason: room.game!.finishedReason || '',
      xpEarned: xpEarned, // Use actual XP earned
      spyCount: room.game!.spyIds.length,
      secretWord: room.game!.secretWord,
      spyNames,
      spyDiscovered: room.game!.winner === 'citizens',
      wordGuessed: room.game!.winner === 'spies' && room.game!.guessHistory?.some(g => g.success),
      guessedBy: room.game!.guessHistory?.find(g => g.success)?.playerName,
      guessHistory: room.game!.guessHistory?.map(g => ({
        playerName: g.playerName,
        guess: g.guess,
        success: g.success,
      })),
      playerRankings: room.players.map(p => ({
        name: p.name,
        score: 0,
        xp: p.id === playerId ? xpEarned : 0, // Set player's XP
        titleInfo: p.titleInfo,
      })),
    };

    onSaveHistory(entry);
    setHistorySaved(true);
  };

  claimXPAndSaveHistory();
}, [room.status, historySaved, room.game, playerId, room.settings.gameMode, category, onSaveHistory]);

// Voice chat state (LiveKit)
// Voice state removed - using RoomVoiceChat instead

const handleGuess = async () => {
if (!guessText.trim()) {
notify('اكتب التخمين الأول');
return;
}
const result = await gameApi('guess-word', { guess: guessText });
if (result.success) {
if (room.game?.secretWord.toLowerCase() === guessText.toLowerCase()) {
notify('تخمين صحيح!');
} else {
notify('تخمين غلط!');
}
setGuessText('');
} else {
notify(result.error || 'حدث خطأ');
}
};
const handleVote = async (targetId: string) => {
setSelectedVoteId(targetId);
await gameApi('vote', { targetId });
};
const handleCalculateVotes = async () => {
const result = await gameApi('calculate-votes');
if (!result.success) {
notify(result.error || 'حدث خطأ');
}
};
if (!me) {
return (
<Shell>
<div className="flex min-h-[80vh] items-center justify-center text-center text-white/60">
مش موجود في الغرفة دلوقتي.
</div>
</Shell>
);
}
const activeGame = room.game;
const allViewed = room.players.every((player) => player.viewedRole);
const iAmSpy = activeGame ? activeGame.spyIds.includes(playerId) : false;
const myVote = room.players.find((player) => player.id === playerId)?.voteFor ?? null;
// Lobby view
if (room.status === 'lobby') {

return (
<Shell>
<ScreenHeader title="الغرفة" onBack={() => setConfirmExit(true)} />
<div className="space-y-5 pb-8">
{/* Room Code Display with Share Button */}
<RoomCodeDisplay
  gameType="spy"
  roomCode={room.code}
  roomName={room.name}
  playerName={me?.name}
  mode={room.settings.gameMode}
/>

{/* Invite Friends Button */}
<button
  type="button"
  onClick={() => setShowInviteModal(true)}
  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 px-4 py-3 text-cyan-400 font-bold transition hover:from-cyan-500/30 hover:to-blue-500/30"
>
  <span className="text-xl">👥</span>
  <span>دعوة أصدقاء</span>
  {onlineUsers.length > 0 && (
    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
      {onlineUsers.length} متصل
    </span>
  )}
</button>

<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="text-xl font-black">اللاعبين ({room.players.length}/12)</div>
</div>
<div className="space-y-2">
{room.players.map((player) => (
<div key={player.id} className="flex items-center justify-between rounded-[1.2rem] bg-white/6 px-4 py-3">
<div className="flex items-center gap-3">
<div>
<div className="flex items-center gap-2">
<span className="font-black">{player.name}</span>
{player.titleInfo && (
<span 
className="text-xs px-2 py-0.5 rounded-full font-bold"
style={{ backgroundColor: player.titleInfo.color + '25', color: player.titleInfo.color }}
>
{player.titleInfo.icon} {player.titleInfo.title}
</span>
)}
</div>
<div className="text-xs text-white/45">
{player.isHost ? 'صاحب الغرفة' : 'لاعب'}

</div>
</div>
</div>
<div className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
{player.isReady ? 'جاهز' : 'منتظر'}
</div>
</div>
))}

</div>

{/* Voice & Chat - Same style as Quiz Game */}
<RoomVoiceChat
  roomCode={room.code}
  playerId={playerId}
  playerName={me?.name || 'لاعب'}
  playerTitle={me?.titleInfo}
  gameType="spy"
/>

{me.isHost && (
<>
{/* Settings Summary */}
<div className="rounded-[2rem] border border-cyan-500/30 bg-cyan-500/10 p-4">
<div className="text-lg font-black text-cyan-400 text-center mb-3">إعدادات اللعبة</div>
<div className="grid grid-cols-2 gap-3 text-center">
<div className="rounded-xl bg-white/10 p-3">
<div className="text-xs text-white/60 mb-1">الوضع</div>
<div className="text-lg font-bold">{gameModes.find(m => m.id === room.settings.gameMode)?.icon || '🎭'} {gameModes.find(m => m.id === room.settings.gameMode)?.name || 'كلاسيكي'}</div>
</div>
<div className="rounded-xl bg-white/10 p-3">
<div className="text-xs text-white/60 mb-1">التصنيف</div>
<div className="text-lg font-bold">{category.icon} {category.name}</div>
</div>
<div className="rounded-xl bg-white/10 p-3">
<div className="text-xs text-white/60 mb-1">المخبرين</div>
<div className="text-lg font-bold">{room.settings.spyCount}</div>
</div>
<div className="rounded-xl bg-white/10 p-3">
<div className="text-xs text-white/60 mb-1">الوقت</div>
<div className="text-lg font-bold">{room.settings.gameTime} د</div>
</div>
</div>
</div>

{room.players.length < (room.settings.gameMode === 'double-spies' ? 4 : 3) && (
  <div className="rounded-xl bg-yellow-500/20 border border-yellow-500/30 p-3 text-center text-yellow-300 text-sm">
    ⚠️ {room.settings.gameMode === 'double-spies' 
      ? 'وضع المخبرين المزدوجين يتطلب 4 لاعبين على الأقل'
      : 'اللعبة تتطلب 3 لاعبين على الأقل'}
  </div>
)}
<button
type="button"
onClick={async () => {
  const result = await gameApi('start-game');
  if (!result.success) {
    notify(result.error || 'حدث خطأ أثناء بدء اللعبة');
  }
}}
disabled={room.players.length < (room.settings.gameMode === 'double-spies' ? 4 : 3)}
className="w-full rounded-full bg-white px-4 py-4 text-2xl font-black text-[#050907] disabled:opacity-50 disabled:cursor-not-allowed"
>
ابدأ اللعب ({room.players.length}/{room.settings.gameMode === 'double-spies' ? 4 : 3} لاعبين)
</button>
</>
)}
{!me.isHost && (
<div className="rounded-[2rem] border border-cyan-500/30 bg-cyan-500/10 p-4">
<div className="text-center text-white/70 leading-7">
مستني صاحب الغرفة يبدأ الجولة.
</div>
</div>
)}
</div>
<ConfirmModal
open={confirmExit}
title="تهرب من الغرفة؟"
message="لو تخرج، اسمك هيتشال من الغرفة الحالية."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onLeave}
onCancel={() => setConfirmExit(false)}
/>

{/* Invite Friends Modal */}
<InviteFriendsModal
  open={showInviteModal}
  onOpenChange={setShowInviteModal}
  friends={friends}
  onlineUsers={onlineUsers}
  onInvite={handleInviteFriend}
  roomCode={room.code}
  gameMode={room.settings.gameMode}
/>
</Shell>
);
}
// Ended game view
if (room.status === 'ended' && room.game) {
const iAmSpy = room.game.spyIds.includes(playerId);
const spyWon = room.game.winner === 'spies';
const didWin = (iAmSpy && spyWon) || (!iAmSpy && !spyWon);

return (
<Shell>
<ScreenHeader title="النتيجة" onBack={() => setConfirmExit(true)} />
<div className="space-y-5">
<div className="text-center">
<div className="text-5xl font-black">{getWinnerLabel(room.game.winner)}</div>
<p className="mt-3 text-lg text-white/70">{room.game.finishedReason}</p>
</div>

{/* XP Earned Display */}
{earnedXP !== null && (
<div className="rounded-[2rem] bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 px-5 py-4 text-center">
<div className="text-sm text-white/60">خبرة مكتسبة</div>
<div className="text-3xl font-black text-yellow-300">+{earnedXP} ⭐</div>
{didWin && <div className="text-sm text-green-400 mt-1">🎉 فوز!</div>}
</div>
)}

<div className="rounded-[2rem] bg-white px-5 py-5 text-[#050907]">
<div className="text-sm font-bold">الكلمة السرية</div>
<div className="mt-2 text-4xl font-black">{room.game.secretWord}</div>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="rounded-[1.6rem] bg-white/8 p-4 text-center">
<div className="text-xs text-white/55">دورك</div>
<div className="text-2xl font-black">{iAmSpy ? '🕵️ مخبر' : '👤 مواطن'}</div>
</div>
<div className="rounded-[1.6rem] bg-white/8 p-4 text-center">
<div className="text-xs text-white/55">المخبرين</div>
<div className="text-2xl font-black">{room.game.spyIds.length}</div>
</div>
</div>
{me.isHost && (
<button
type="button"
onClick={() => gameApi('play-again')}
className="w-full rounded-full bg-white px-4 py-4 text-xl font-black text-[#050907]"
>
جولة جديدة
</button>
)}
</div>
<ConfirmModal
open={confirmExit}
title="تهرب من الغرفة؟"
message="لو تخرج دلوقتي هترجع للرئيسية."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onLeave}
onCancel={() => setConfirmExit(false)}
/>
</Shell>
);
}
// Reveal role view - Show role until player confirms
if (room.status === 'running' && room.game && !confirmedRole) {
return (
<Shell>
<ScreenHeader title={me.name} onBack={() => setConfirmExit(true)} />
<div className="flex min-h-[74vh] flex-col items-center justify-between py-4 gap-6">
<div className="space-y-3 text-center">
<div className="text-3xl font-black">🎭 دورك في اللعبة</div>
<div className="text-white/60">الغرفة: {room.name || room.code}</div>
{room.name && <div className="text-xs text-white/40">كود: {room.code}</div>}
</div>

{!revealed ? (
<button
type="button"
onClick={() => {
  setRevealed(true);
  handleRevealRole();
}}
className="flex flex-1 flex-col items-center justify-center gap-5 rounded-[2rem] border border-white/10 bg-white/[0.03] px-8 py-10 active:scale-95 transition-transform my-4"
>
<div className="text-4xl font-black text-center">اضغط هنا عشان تشوف دورك</div>
<FingerprintLogo size={180} />
<div className="text-white/50 text-sm">محدش يشوف الشاشة غيرك!</div>
</button>
) : (
<div className="w-full space-y-5 text-center px-4 flex-1 overflow-y-auto py-2">
<div className="flex justify-center">
<MaskLogo size={150} />
</div>

{myRole ? (
myRole.isSpy ? (
<div className="rounded-[2rem] border-4 border-red-500/50 bg-red-500/20 p-6 space-y-4">
<div className="text-5xl font-black">🕵️ أنت المخبر</div>
<div className="text-xl text-white/90">مش هتعرف الكلمة السرية!</div>
{myRole.partnerSpyName && (
<div className="p-4 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
<p className="text-cyan-300 font-bold text-lg">🤝 شريكك المخبر</p>
<p className="text-white text-2xl font-black mt-1">{myRole.partnerSpyName}</p>
<p className="text-cyan-200/70 text-sm mt-2">انتوا الاتنين مخبرين.. اتعاونوا!</p>
</div>
)}
<div className="text-lg text-white/70">
  {room.settings.gameMode === 'silent' 
    ? 'راقب إشارات الناس وحاول تعرف الكلمة من غير ما تبان.' 
    : 'ركز في كلام الناس وحاول تعرف الكلمة من غير ما تبان.'}
</div>
<div className="p-4 rounded-xl bg-white/10 text-sm text-white/60">
💡 {room.settings.gameMode === 'silent' 
  ? 'نصيحة: راقب الإشارات بعناية وحاول تقلد الحركات.' 
  : 'نصيحة: اسأل أسئلة عامة ومتحاولش تبان إنك مش عارف الكلمة.'}
</div>
</div>
) : (
<div className="rounded-[2rem] border-4 border-green-500/50 bg-green-500/20 p-6 space-y-4">
<div className="text-4xl font-black">👤 أنت مواطن</div>
<div className="text-lg text-white/70">الكلمة السرية هي:</div>
<div className="mx-auto rounded-[2rem] bg-white px-8 py-6 text-4xl font-black text-[#050907] shadow-lg">
{myRole.secretWord}
</div>
<div className="p-4 rounded-xl bg-white/10 text-sm text-white/60">
💡 {room.settings.gameMode === 'silent' 
  ? 'نصيحة: استخدم إشارات واضحة توضح الكلمة للمواطنين.' 
  : 'نصيحة: اسأل أسئلة توضح الكلمة للمواطنين بس مش للمخبر.'}
</div>
</div>
)
) : (
<div className="text-2xl text-white/60 flex items-center justify-center gap-3 py-10">
<div className="animate-spin h-6 w-6 border-2 border-white/30 border-t-white rounded-full"></div>
جاري التحميل...
</div>
)}
</div>
)}

<div className="w-full px-4 pt-2">
<button
type="button"
onClick={() => {
  if (!revealed || !myRole) {
    notify('اضغط الأول عشان تشوف دورك');
    return;
  }
  setConfirmedRole(true);
}}
disabled={!revealed || !myRole}
className="w-full rounded-full bg-white px-4 py-4 text-2xl font-black text-[#050907] disabled:opacity-50 disabled:cursor-not-allowed"
>
{!revealed ? 'اضغط الأول عشان تشوف دورك' : 'تمام، شفت دوري ✓'}
</button>
</div>
</div>
<ConfirmModal
open={confirmExit}
title="تهرب من الجولة؟"
message="لو تخرج، هتسيب الغرفة والجولة مكتمتلة من غيرك."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onLeave}
onCancel={() => setConfirmExit(false)}
/>
</Shell>
);
}
// Waiting for others
if (room.status === 'running' && room.game && !allViewed) {
return (
<Shell>
<ScreenHeader title="مستني الباقي" onBack={() => setConfirmExit(true)} />
<div className="flex min-h-[74vh] flex-col items-center justify-center gap-5 text-center">
<MaskLogo size={150} />
<div className="text-3xl font-black">كل واحد يشوف دوره</div>
<div className="text-white/65">
الجاهزين: {room.players.filter((player) => player.viewedRole).length} / {room.players.length}
</div>
</div>
<ConfirmModal
open={confirmExit}
title="تهرب من الغرفة؟"
message="لو تخرج دلوقتي هترجع للرئيسية."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onLeave}
onCancel={() => setConfirmExit(false)}
/>
</Shell>
);
}
// Main game view
if (!activeGame) {
return (
<Shell>
<div className="flex min-h-[80vh] items-center justify-center text-center text-white/60">
اللعبة مش متاحة حاليا.
</div>
</Shell>
);
}

// Use stored questions from ref (won't change on re-render)
const displayQuestions = questionsRef.current;

return (
<Shell>
<div className="space-y-4 pb-8">
{/* Header */}
<div className="flex items-center justify-between">
<button
type="button"
onClick={() => setConfirmExit(true)}
className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl"
>
⌂
</button>
<div className="text-center">
<div className="text-sm text-white/55">{room.code} • اونلاين</div>
<div className="text-xl font-black">{category.icon} {category.name}</div>
</div>
<div className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#050907]">
{myRole?.isSpy ? '🕵️ مخبر' : '👤 مواطن'}
</div>
</div>

{/* Silent Mode Warning for Online */}
{room.settings.gameMode === 'silent' && (
  <div className="rounded-[1.5rem] border border-yellow-500/30 bg-yellow-500/10 p-4 text-center animate-pulse">
    <div className="text-2xl mb-1">🤫</div>
    <div className="font-bold text-yellow-300">وضع صامت - ممنوع الكلام!</div>
    <p className="text-sm text-white/70 mt-1">استخدموا الإشارات والحركات بس</p>
  </div>
)}

{/* Timer - More prominent */}
<div className={`rounded-[2rem] border px-6 py-6 text-center ${
  timeLeft <= 60 
    ? 'border-red-500/50 bg-red-500/20 animate-pulse' 
    : timeLeft <= 180 
      ? 'border-yellow-500/30 bg-yellow-500/10' 
      : 'border-white/10 bg-white/[0.04]'
}`}>
<div className="text-sm text-white/55">⏰ الوقت الباقي</div>
<div className={`mt-2 text-7xl font-black tracking-wider ${
  timeLeft <= 60 ? 'text-red-400' : timeLeft <= 180 ? 'text-yellow-400' : ''
}`}>
{formatTime(timeLeft)}
</div>
{timeLeft <= 60 && (
  <div className="mt-2 text-sm text-red-300">⚠️ الوقت قارب يخلص!</div>
)}
</div>

{/* My Role Card */}
{myRole && (
<div className={`rounded-[2rem] p-4 text-center ${
  myRole.isSpy 
    ? 'border border-red-500/30 bg-red-500/10' 
    : 'border border-green-500/30 bg-green-500/10'
}`}>
<div className="text-2xl font-black">{myRole.isSpy ? '🕵️ أنت المخبر' : '👤 أنت مواطن'}</div>
{!myRole.isSpy && myRole.secretWord && (
<div className="mt-3 rounded-xl bg-white px-4 py-3 text-2xl font-black text-[#050907]">
{myRole.secretWord}
</div>
)}
{myRole.isSpy && myRole.partnerSpyName && (
<div className="mt-3 p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30">
<p className="text-cyan-300 font-bold">🤝 شريكك المخبر: <span className="text-white">{myRole.partnerSpyName}</span></p>
</div>
)}
{myRole.isSpy && (
<div className="mt-2 text-white/70">ركز في كلام الناس وحاول تعرف الكلمة</div>
)}
</div>
)}

{/* Spy Guess Section */}
{myRole?.isSpy && !activeGame.winner && (
<div className="space-y-3 rounded-[2rem] border border-red-400/20 bg-red-500/10 p-4">
<div className="text-lg font-black text-red-100">🔮 خمن الكلمة السرية</div>
<input
value={guessText}
onChange={(event) => setGuessText(event.target.value)}
placeholder="اكتب تخمينك هنا..."
className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-4 text-white outline-none placeholder:text-white/35 focus:border-red-300"
/>
<button
type="button"
onClick={() => {
if (!guessText.trim()) {
notify('اكتب التخمين الأول');
return;
}
handleGuess();
setGuessText('');
}}
className="w-full rounded-full bg-white px-4 py-4 text-lg font-black text-[#050907]"
>
خمن دلوقتي
</button>
</div>
)}

{/* Suggested Questions - Hidden in Silent Mode */}
{activeGame.gameMode !== 'silent' && (
<div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<button
type="button"
onClick={() => setShowQuestions(!showQuestions)}
className="flex w-full items-center justify-between text-lg font-black"
>
<div className="flex items-center gap-2">
<span>💡</span>
<span>أسئلة مقترحة</span>
</div>
<span className="text-2xl">{showQuestions ? '−' : '+'}</span>
</button>

{showQuestions && (
<div className="mt-4 space-y-2">
{displayQuestions.length > 0 ? (
  displayQuestions.map((question, index) => (
<button
key={index}
type="button"
onClick={() => {
navigator.clipboard?.writeText(question);
notify('تم نسخ السؤال');
}}
className="w-full rounded-xl px-4 py-3 text-right font-medium transition bg-white/5 text-white hover:bg-white/10"
>
<span className="text-white/50 ml-2">{index + 1}.</span>
{question}
</button>
  ))
) : (
  <div className="text-center text-white/40 py-4">جاري تحميل الأسئلة...</div>
)}
<div className="mt-3 text-center text-xs text-white/40">
اضغط على السؤال لنسخه
</div>
</div>
)}
</div>
)}

{/* Voting Section */}
<div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
<div className="flex items-center justify-between">
<div className="text-lg font-black">🗳️ التصويت</div>
<div className={`rounded-full px-3 py-1 text-xs font-bold ${
  activeGame.voteOpen || timeLeft === 0 
    ? 'bg-green-500/20 text-green-400' 
    : 'bg-white/10 text-white/50'
}`}>
{activeGame.voteOpen || timeLeft === 0 ? 'مفتوح' : 'مغلق'}
</div>
</div>

{/* Players to vote for */}
<div className="space-y-2">
{room.players.map((player) => {
const voteCount = room.players.filter((p) => p.voteFor === player.id).length;
const isSelected = selectedVoteId === player.id;
const hasVoted = myVote === player.id;

return (
<button
key={player.id}
type="button"
onClick={() => setSelectedVoteId(player.id)}
className={`flex w-full items-center justify-between rounded-xl px-4 py-3 font-bold transition ${
  isSelected 
    ? 'bg-white text-[#050907] scale-[1.02]' 
    : hasVoted 
      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
      : 'bg-white/6 text-white hover:bg-white/10'
}`}
>
<div className="flex items-center gap-2">
<span>{player.name}</span>
{player.titleInfo && (
<span 
className="text-xs px-2 py-0.5 rounded-full font-bold"
style={{ 
backgroundColor: isSelected ? player.titleInfo.color + '30' : player.titleInfo.color + '25', 
color: player.titleInfo.color 
}}
>
{player.titleInfo.icon}
</span>
)}
{player.id === playerId && (
<span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">أنت</span>
)}
</div>
<div className="flex items-center gap-2">
{voteCount > 0 && (
<span className="text-xs opacity-70 bg-white/10 px-2 py-1 rounded-full">
{voteCount} صوت
</span>
)}
{hasVoted && <span className="text-green-500">✓</span>}
</div>
</button>
);
})}
</div>

{/* Voting Actions */}
<div className="grid grid-cols-2 gap-3 mt-4">
<button
type="button"
onClick={() => {
if (!selectedVoteId) {
notify('اختر شخص تصوت له');
return;
}
handleVote(selectedVoteId);
notify('تم تسجيل صوتك');
}}
disabled={!selectedVoteId}
className="rounded-full bg-white px-4 py-3 font-black text-[#050907] disabled:opacity-50"
>
ثبّت صوتي
</button>
</div>

{/* Open Voting - Only for host */}
{me.isHost && !activeGame.voteOpen && (
<button
type="button"
onClick={() => gameApi('open-voting')}
className="rounded-full border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 font-black text-cyan-100"
>
🔓 افتح التصويت
</button>
)}

{/* Calculate Votes - Only for host or when time is up */}
{(me.isHost || timeLeft === 0) && (
<button
type="button"
onClick={() => handleCalculateVotes()}
className="w-full rounded-full border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 font-black text-cyan-100 mt-2"
>
📊 احسب نتيجة التصويت
</button>
)}
</div>

{/* Voice & Chat */}
<RoomVoiceChat
  roomCode={room.code}
  playerId={playerId}
  playerName={me?.name || 'لاعب'}
  playerTitle={me?.titleInfo}
  gameType="spy"
/>
</div>

<ConfirmModal
open={confirmExit}
title="تهرب من الغرفة؟"
message="لو تخرج دلوقتي هتسيب الجولة وتروح للرئيسية."
confirmLabel="اخرج"
cancelLabel="كمّل"
onConfirm={onLeave}
onCancel={() => setConfirmExit(false)}
/>
</Shell>
);
}
// Main App
export default function App() {
const [screen, setScreen] = useState<Screen>('home');
const [profile, setProfile] = useState<Profile>({ name: 'زيزو', language: 'ar', gold: 0, gamesPlayed: 0, gamesWon: 0 });
const [history, setHistory] = useState<HistoryEntry[]>([]);
const [setupDraft, setSetupDraft] = useState<GameSetup>({ playerCount: 4, spyCount: 1, gameTime: 5, categoryId: 'places', playerNames: ['', '', '', ''] });
const [offlineMatch, setOfflineMatch] = useState<OfflineMatch | null>(null);
const [result, setResult] = useState<ResultState | null>(null);
const [toast, setToast] = useState<string | null>(null);
const [mounted, setMounted] = useState(false);
const [showOnboarding, setShowOnboarding] = useState(false);
// Toast Notifications State - للإشعارات الفورية
const [toastNotifications, setToastNotifications] = useState<Array<{ id: string; type: string; title: string; message: string; icon?: string; duration?: number }>>([]);
const [lastNotificationCheck, setLastNotificationCheck] = useState(0);
// Auth state
const [authUser, setAuthUser] = useState<AuthUser | null>(null);
const [authChecked, setAuthChecked] = useState(false);
const [showExperienceModal, setShowExperienceModal] = useState(false);
const [gameSummary, setGameSummary] = useState<GameSummaryData | null>(null);
// Social notifications state - centralized
const [socialNotifications, setSocialNotifications] = useState<SocialNotification[]>([]);
const [pendingFriendRequests, setPendingFriendRequests] = useState<number>(0);

// Global social hook - keeps user online while app is open
const {
  onlineUsers: globalOnlineUsers,
  friends: globalFriends,
  isConnected: socialConnected,
  sendRoomInvite,
} = useSocial({
  userId: authUser?.id || '',
  userName: authUser?.name || '',
  autoConnect: !!authUser, // Only connect when user is logged in
});

// Prayer reminder hook
const {
  reminderState: prayerReminderState,
  dismissReminder: dismissPrayerReminder,
  showGameStartReminder,
  nextPrayer,
  prayerTimes,
  fetchPrayerTimes,
} = usePrayerReminder();

// Function to fetch all social notifications (from DB + friend requests)
const fetchSocialNotifications = useCallback(async () => {
  if (!authUser) return;
  try {
    // Fetch notifications
    const notifRes = await fetch('/api/social/notifications');
    if (notifRes.ok) {
      const notifData = await notifRes.json();
      setSocialNotifications(notifData.notifications || []);
    }
    // Fetch friend requests count
    const friendsRes = await fetch('/api/social/friends');
    if (friendsRes.ok) {
      const friendsData = await friendsRes.json();
      setPendingFriendRequests(friendsData.pendingRequests?.length || 0);
    }
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
}, [authUser]);

// Poll for notifications every 5 seconds
useEffect(() => {
  if (!authUser) return;
  // Defer first fetch to avoid setState in effect
  const timeoutId = setTimeout(() => {
    fetchSocialNotifications();
  }, 0);
  const interval = setInterval(fetchSocialNotifications, 5000);
  return () => {
    clearTimeout(timeoutId);
    clearInterval(interval);
  };
}, [authUser, fetchSocialNotifications]);

// Online state (HTTP API based)
const [isConnected, setIsConnected] = useState(false);
const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
const [playerId, setPlayerId] = useState<string | null>(null);
const [showRoomClosedModal, setShowRoomClosedModal] = useState(false);
const [roomClosedReason, setRoomClosedReason] = useState('');
const [sessionInvalidReason, setSessionInvalidReason] = useState<string | null>(null);
const notify = useCallback((message: string) => {
setToast(message);
setTimeout(() => setToast(null), 3000);
}, []);

// Toast Notification Functions - للإشعارات الفورية
const addToastNotification = useCallback((toast: { type: string; title: string; message: string; icon?: string; duration?: number }) => {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  setToastNotifications(prev => [...prev, { ...toast, id }]);
  
  // Auto remove after duration
  setTimeout(() => {
    setToastNotifications(prev => prev.filter(t => t.id !== id));
  }, toast.duration || 5000);
}, []);

const removeToastNotification = useCallback((id: string) => {
  setToastNotifications(prev => prev.filter(t => t.id !== id));
}, []);

const showToast = useCallback((type: 'success' | 'info' | 'warning' | 'game', title: string, message: string, icon?: string) => {
  addToastNotification({ type, title, message, icon });
}, [addToastNotification]);

// Helper to get session token from cookies
const getSessionToken = useCallback(() => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/session_token=([^;]+)/);
  return match ? match[1] : null;
}, []);

// Socket.io for real-time room updates
const gameSocket = useGameSocket({
  serverPort: 3003,
  sessionToken: getSessionToken(),
  onConnected: (id) => {
    console.log('[App] Socket connected:', id);
    setIsConnected(true);
  },
  onRoomUpdate: (room) => {
    console.log('[App] Room update received:', room.code);
    setCurrentRoom(room);
  },
  onRoomClosed: (roomCode, reason) => {
    console.log('[App] Room closed:', roomCode, reason);
    setCurrentRoom(null);
    setPlayerId(null);
    setRoomClosedReason(reason);
    setShowRoomClosedModal(true);
  },
  onPlayerLeft: (pId, playerName, room) => {
    console.log('[App] Player left:', playerName);
    setCurrentRoom(room);
    notify(`${playerName} غادر الغرفة`);
  },
  onPlayerJoined: (player, room) => {
    console.log('[App] Player joined:', player.name);
    setCurrentRoom(room);
    notify(`${player.name} انضم للغرفة`);
  },
  onError: (message) => {
    notify(message);
  },
  onAuthError: (reason) => {
    console.log('[App] Socket auth error:', reason);
    setAuthUser(null);
    setSessionInvalidReason(reason);
    setScreen('auth');
  },
});
// Check auth on mount
const checkAuth = useCallback(async () => {
try {
const response = await fetch('/api/auth');
const data = await response.json();
// Check if session was invalidated (logged in from another device)
if (data.sessionInvalid) {
  console.log('[App] Session invalid:', data.sessionInvalidReason);
  setAuthUser(null);
  setSessionInvalidReason(data.sessionInvalidReason || 'تم تسجيل الدخول من جهاز آخر');
  setAuthChecked(true);
  return;
}
if (data.authenticated && data.user) {
const userWithTitle = {
...data.user,
titleInfo: data.user.titleInfo || getTitleFromXP(data.user.gold || 0),
};
setAuthUser(userWithTitle);
} else {
setAuthUser(null);
}
} catch {
setAuthUser(null);
}
setAuthChecked(true);
}, []);
// Login function
const handleLogin = useCallback(async (email: string, password: string): Promise<boolean> => {
try {
const response = await fetch('/api/auth', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'login', data: { email, password } }),
});
const data = await response.json();
if (data.success && data.user) {
// Store session token for socket authentication
if (data.sessionToken) {
localStorage.setItem('session_token', data.sessionToken);
}
const userWithTitle = {
...data.user,
titleInfo: data.user.titleInfo || getTitleFromXP(data.user.gold || 0),
};
setAuthUser(userWithTitle);
setScreen('home');
notify('أهلاً ' + data.user.name + '!');
return true;
} else {
notify(data.error || 'حدث خطأ');
return false;
}
} catch {
notify('حدث خطأ في الاتصال');
return false;
}
}, [notify]);
// Register function
const handleRegister = useCallback(async (name: string, email: string, password: string, gender: 'male' | 'female'): Promise<boolean> => {
try {
const response = await fetch('/api/auth', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'register', data: { name, email, password, gender } }),
});
const data = await response.json();
if (data.success && data.user) {
// Store session token for socket authentication
if (data.sessionToken) {
localStorage.setItem('session_token', data.sessionToken);
}
const userWithTitle = {
...data.user,
titleInfo: data.user.titleInfo || getTitleFromXP(data.user.gold || 0),
};
setAuthUser(userWithTitle);
setScreen('home');
notify('أهلاً ' + data.user.name + '!');
return true;
} else {
notify(data.error || 'حدث خطأ');
return false;
}
} catch {
notify('حدث خطأ في الاتصال');
return false;
}
}, [notify]);
// Logout function
const handleLogout = useCallback(async () => {
try {
await fetch('/api/auth', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'logout' }),
});
// Clear session token from localStorage
localStorage.removeItem('session_token');
setAuthUser(null);
setScreen('auth');
notify('تم تسجيل الخروج');
} catch {
notify('حدث خطأ');
}
}, [notify]);
// Claim reward function
const handleClaimReward = useCallback(async () => {
try {
const response = await fetch('/api/auth', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action: 'claim-reward' }),
});
const data = await response.json();
if (data.success && data.user) {
setAuthUser(data.user);
const bonus = data.reward?.bonus || 0;
if (bonus > 0) {
notify(`مكافأة ${data.reward.gold} خبره! (بونص ${bonus} للسلسلة!)`);
} else {
notify(`مكافأة ${data.reward.gold} خبره!`);
}
} else {
notify(data.error || 'حدث خطأ');
}
} catch {
notify('حدث خطأ');
}
}, [notify]);
// Initialize - lazy state initialization for sync reads
const [initDone, setInitDone] = useState(false);
useEffect(() => {
/* eslint-disable react-hooks/set-state-in-effect */
if (!initDone) {
setProfile(readProfile());
setHistory(readHistory());
setInitDone(true);
}
setMounted(true);
// Check if user needs to see onboarding
if (!hasCompletedOnboarding()) {
setShowOnboarding(true);
}
/* eslint-enable react-hooks/set-state-in-effect */
checkAuth();
}, [checkAuth, initDone]);

// App Notifications System - إشعارات التطبيق التلقائية
useEffect(() => {
  if (!authUser || !mounted) return;
  
  const checkForAppNotifications = () => {
    const now = Date.now();
    // Check every 2 minutes
    if (now - lastNotificationCheck < 120000) return;
    setLastNotificationCheck(now);
    
    // Random chance to show notification
    const random = Math.random();
    
    // Notification: Play now (10% chance)
    if (random < 0.1) {
      const messages = [
        { title: '🎮 خش العب!', message: 'في ناس مستنية تلعب معاك!', icon: '🎮' },
        { title: '🎮 وقت اللعب!', message: 'اعمل غرفة جديدة واستنى أصدقائك!', icon: '🎮' },
        { title: '🎮 في غرف مفتوحة!', message: 'شوف الغرف العامة وانضم!', icon: '🎮' },
      ];
      const msg = messages[Math.floor(Math.random() * messages.length)];
      addToastNotification({ type: 'game', ...msg, duration: 6000 });
      return;
    }
    
    // Notification: Friends online (15% chance if there are online friends)
    if (random < 0.25 && globalFriends.length > 0) {
      const onlineFriendsCount = globalFriends.filter(f => 
        globalOnlineUsers.some(u => u.id === f.id)
      ).length;
      
      if (onlineFriendsCount > 0) {
        addToastNotification({
          type: 'info',
          title: '👥 أصدقائك أونلاين!',
          message: `في ${onlineFriendsCount} من أصدقائك متصلين دلوقتي!`,
          icon: '👥',
          duration: 5000,
        });
        return;
      }
    }
    
    // Notification: Daily reward (if available)
    if (random < 0.35 && authUser.canClaimReward) {
      addToastNotification({
        type: 'success',
        title: '🎁 المكافأة اليومية!',
        message: 'مكافأتك اليومية جاهزة! اخدها من الإعدادات.',
        icon: '🎁',
        duration: 7000,
      });
      return;
    }
  };
  
  // Check on mount and then periodically
  const timeoutId = setTimeout(checkForAppNotifications, 5000); // First check after 5s
  const interval = setInterval(checkForAppNotifications, 60000); // Then every minute
  
  return () => {
    clearTimeout(timeoutId);
    clearInterval(interval);
  };
}, [authUser, mounted, lastNotificationCheck, globalFriends, globalOnlineUsers, addToastNotification]);

// Periodic session verification (every 30 seconds)
useEffect(() => {
  if (!authUser) return;
  
  const verifySession = async () => {
    try {
      const response = await fetch('/api/auth');
      const data = await response.json();
      
      // Check if session was invalidated (logged in from another device)
      if (data.sessionInvalid) {
        console.log('[App] Session invalid during periodic check:', data.sessionInvalidReason);
        setAuthUser(null);
        setSessionInvalidReason(data.sessionInvalidReason || 'تم تسجيل الدخول من جهاز آخر');
        setScreen('auth');
      }
    } catch {
      // Ignore verification errors
    }
  };
  
  const interval = setInterval(verifySession, 30000); // Check every 30 seconds
  return () => clearInterval(interval);
}, [authUser]);

// Check connection for online mode
useEffect(() => {
const checkConnection = async () => {
try {
const response = await fetch('/api/game?action=health');
setIsConnected(response.ok);
} catch {
setIsConnected(false);
}
};
checkConnection();
const interval = setInterval(checkConnection, 30000);
return () => clearInterval(interval);
}, []);
// Poll room state when in a room
useEffect(() => {
if (screen !== 'room' || !playerId) return;
const pollRoom = async () => {
try {
const response = await fetch(`/api/game?action=room-state&playerId=${playerId}`);
const data = await response.json();
if (data.success && data.room) {
setCurrentRoom(data.room);
}
} catch {
// Ignore polling errors
}
};
pollRoom();
const interval = setInterval(pollRoom, 2000);
return () => clearInterval(interval);
}, [screen, playerId]);
// Game API for online mode
const gameApi = useCallback(async (action: string, data?: Record<string, unknown>) => {
try {
const response = await fetch('/api/game', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ action, data: data ? { ...data, playerId } : { playerId } }),
});
return await response.json();
} catch {
return { success: false, error: 'حدث خطأ في الاتصال' };
}
}, [playerId]);
// Game handlers
const handleStartSetup = useCallback(() => {
if (!authUser) {
setScreen('login');
return;
}
setSetupDraft(createDefaultSetup(authUser.name));
setScreen('setup');
}, [authUser]);
const handleStartOnline = useCallback(() => {
if (!authUser) {
setScreen('login');
return;
}
setScreen('online');
}, [authUser]);
const handleStartGame = useCallback((setup: GameSetup) => {
// Assign roles based on game mode
const roles = assignRolesByMode(setup.playerCount, setup.gameMode);
const match: OfflineMatch = {
id: uid(),
categoryId: setup.categoryId,
secretWord: getSecretWord(setup.categoryId),
playerNames: setup.playerNames,
spyIndices: roles.spyIndices,
gameMode: setup.gameMode,
partnerSpyIndex: roles.partnerSpyIndex,
knowerIndex: roles.knowerIndex,
gameTime: setup.gameTime,
createdAt: Date.now(),
};
setSetupDraft(setup);
setOfflineMatch(match);
setScreen('reveal');
}, []);
const handleRevealComplete = useCallback(() => {
setScreen('play');
}, []);
const handleFinishGame = useCallback((winner: Winner, reason: string) => {
  if (!offlineMatch) return;
  setResult({ winner, reason });

  // Offline mode: No XP system - just record history and show result
  const category = findCategory(offlineMatch.categoryId);
  const spyNames = offlineMatch.spyIndices.map(i => offlineMatch.playerNames[i]);

  // Add to history with new format
  const entry: HistoryEntry = {
    id: uid(),
    playedAt: new Date().toISOString(),
    gameType: 'spy',
    playMode: 'offline',
    gameMode: offlineMatch.gameMode,
    categoryName: category.name,
    playerCount: offlineMatch.playerNames.length,
    winner: winner || 'citizens',
    reason,
    xpEarned: 0, // No XP in offline mode
    spyCount: offlineMatch.spyIndices.length,
    secretWord: offlineMatch.secretWord,
    spyNames,
    spyDiscovered: false,
    wordGuessed: false,
  };

  const updatedHistory = [entry, ...history];
  setHistory(updatedHistory);
  writeHistory(updatedHistory);

  // Go to result screen for offline games
  setScreen('result');
}, [offlineMatch, history]);
const handlePlayAgain = useCallback(() => {
if (setupDraft.playerNames[0]) {
handleStartGame(setupDraft);
} else {
setScreen('setup');
}
}, [setupDraft, handleStartGame]);
const handleSaveProfile = useCallback((newProfile: Profile) => {
setProfile(newProfile);
writeProfile(newProfile);
notify('تم الحفظ!');
}, [notify]);
const handleClearHistory = useCallback(() => {
  setHistory([]);
  writeHistory([]);
  notify('تم مسح السجل');
}, []);

// Save history entry - works for both online and offline games
const handleSaveHistoryEntry = useCallback(async (entry: HistoryEntry) => {
  // Save to local state
  const updatedHistory = [entry, ...history];
  setHistory(updatedHistory);
  writeHistory(updatedHistory);

  // For online games, also save to database
  if (entry.playMode === 'online') {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to save history to database:', error);
    }
  }
}, [history, notify]);

// Online room handlers
const handleRoomCreated = useCallback((room: Room, pId: string) => {
setCurrentRoom(room);
setPlayerId(pId);
setScreen('room');
}, []);
const handleRoomJoined = useCallback((room: Room, pId: string) => {
setCurrentRoom(room);
setPlayerId(pId);
setScreen('room');
}, []);
const handleLeaveRoom = useCallback(async () => {
  // Call API to leave the room first
  try {
    await gameApi('leave-room');
  } catch (error) {
    console.error('Failed to leave room:', error);
  }
  // Then clear local state
  setCurrentRoom(null);
  setPlayerId(null);
  setScreen('home');
}, [gameApi]);

// Handle joining a room from notification (friend invite)
const handleJoinRoomFromNotification = useCallback(async (roomCode: string, gameType: string) => {
  if (!authUser) {
    notify('يجب تسجيل الدخول أولاً');
    return;
  }
  
  try {
    const result = await gameApi('join-room', { 
      roomCode, 
      playerName: authUser.name, 
      playerGold: authUser.gold 
    });
    
    if (result.success && result.room && result.playerId) {
      handleRoomJoined(result.room, result.playerId);
      notify('تم الانضمام للغرفة!');
    } else {
      notify(result.error || 'حدث خطأ أثناء الانضمام للغرفة');
    }
  } catch (error) {
    console.error('Error joining room from notification:', error);
    notify('حدث خطأ في الاتصال');
  }
}, [authUser, gameApi, handleRoomJoined, notify]);

// Show loading until auth is checked
if (!mounted || !authChecked) {
return (
<div dir="rtl" className="min-h-screen bg-[#050907] flex flex-col items-center justify-center select-none overflow-hidden">
  {/* Logo */}
  <div className="animate-pulse flex-shrink-0">
    <MaskLogo size={180} />
  </div>
  
  {/* App Name */}
  <h1 className="mt-8 text-5xl font-black tracking-wide bg-gradient-to-l from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent leading-relaxed pb-2">
    المخبر
  </h1>
  
  {/* Subtitle */}
  <p className="mt-2 text-lg text-white/50">اكشف المخبر بينكم</p>
  
  {/* Loading dots */}
  <div className="mt-10 flex items-center gap-1.5">
    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
  </div>
</div>
);
}

// Show onboarding for new users
if (showOnboarding) {
return (
<>
<Onboarding
  onComplete={() => setShowOnboarding(false)}
/>
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}

// Render screens
if (screen === 'auth') {
return (
<>
<AuthScreen
onLoginClick={() => setScreen('login')}
onRegisterClick={() => setScreen('register')}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'login') {
return (
<>
<LoginView
onBack={() => setScreen('auth')}
onLogin={handleLogin}
notify={notify}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'register') {
return (
<>
<RegisterView

onBack={() => setScreen('auth')}
onRegister={handleRegister}
notify={notify}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'setup') {
return (
<>
<SetupView
initial={setupDraft}
onBack={() => setScreen('home')}
onStart={handleStartGame}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'reveal' && offlineMatch) {
return (
<>
<RevealView
match={offlineMatch}
onExit={() => setScreen('home')}
onComplete={handleRevealComplete}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'play' && offlineMatch) {
return (
<>
<PlayView
match={offlineMatch}
onExit={() => setScreen('home')}
onFinish={handleFinishGame}
notify={notify}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'result' && offlineMatch && result) {
return (
<>
<ResultView
match={offlineMatch}
result={result}
onHome={() => setScreen('home')}
onPlayAgain={handlePlayAgain}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'history') {
return (
<>
<HistoryView
history={history}
onBack={() => setScreen('home')}
onClear={handleClearHistory}
onViewSummary={(entry) => {
  // Convert HistoryEntry to GameSummaryData for the modal
  const category = categories.find(c => c.name === entry.categoryName);
  const summary: GameSummaryData = {
    gameType: entry.gameType,
    playMode: entry.playMode,
    gameMode: entry.gameMode, // Can be GameModeType or 'relaxed' | 'speed'
    categoryName: entry.categoryName,
    categoryIcon: category?.icon || (entry.gameType === 'spy' ? '🕵️' : '❓'),
    playerCount: entry.playerCount,
    playerNames: entry.playerRankings?.map(p => p.name) || [],
    winner: entry.winner, // 'spies' | 'citizens' for spy, player name for quiz
    winnerName: entry.winnerName || (entry.gameType === 'quiz' ? entry.winner : undefined),
    reason: entry.reason,
    xpEarned: entry.xpEarned,
    // Spy specific
    secretWord: entry.secretWord,
    spyNames: entry.spyNames,
    spyDiscovered: entry.spyDiscovered,
    wordGuessed: entry.wordGuessed,
    guessedBy: entry.guessedBy,
    guessHistory: entry.guessHistory,
    // Quiz specific
    quizRounds: entry.quizRounds,
    correctAnswers: entry.playerRankings?.reduce((acc, p) => {
      acc[p.name] = p.xp;
      return acc;
    }, {} as Record<string, number>),
    playersWithXP: entry.playerRankings,
    // Add gameSetup for replay functionality
    gameSetup: entry.gameType === 'spy' && entry.spyCount && entry.spyCount > 0 ? {
      playerCount: entry.playerCount,
      spyCount: entry.spyCount,
      gameTime: 5, // Default time
      categoryId: category?.id || 'places',
      gameMode: ['classic', 'double-spies', 'reversed', 'silent'].includes(entry.gameMode as string)
        ? (entry.gameMode as GameModeType)
        : 'classic', // Default to classic if gameMode is invalid
      playerNames: entry.playerRankings?.map(p => p.name) || [],
    } : undefined,
    categoryId: category?.id,
  };
  setGameSummary(summary);
}}
/>
<GameSummaryModal
  open={!!gameSummary}
  summary={gameSummary}
  onClose={() => setGameSummary(null)}
  onReplay={() => {
    if (gameSummary?.gameSetup) {
      handleStartGame(gameSummary.gameSetup);
    }
    setGameSummary(null);
  }}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'settings') {
return (
<>
<SettingsView
profile={profile}
authUser={authUser}
onBack={() => setScreen('home')}
onLogout={handleLogout}
onClaimReward={handleClaimReward}
notify={notify}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'about') {
return (
<>
<AboutView onBack={() => setScreen('home')} />
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'modes') {
return (
<>
<ModesView onBack={() => setScreen('home')} />
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}

if (screen === 'online') {
return (
<>
<OnlineGatewayView
onBack={() => setScreen('home')}
defaultName={authUser?.name || profile.name}
playerGold={authUser?.gold || 0}
gameApi={gameApi}
onRoomCreated={handleRoomCreated}
onRoomJoined={handleRoomJoined}
notify={notify}
isConnected={isConnected}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'room' && currentRoom) {
return (
<>
<OnlineRoomView
room={currentRoom}
gameApi={gameApi}
playerId={playerId!}
onLeave={handleLeaveRoom}
notify={notify}
onSaveHistory={handleSaveHistoryEntry}
authUserId={authUser?.id}
authUserName={authUser?.name}
onlineUsers={globalOnlineUsers}
friends={globalFriends}
sendRoomInvite={sendRoomInvite}
socialConnected={socialConnected}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
if (screen === 'help') {
return (
<HelpView
          onBack={() => setScreen('home')}
          onStartOffline={() => setScreen('setup')}
          onStartOnline={() => setScreen('online')}
        />
);
}
if (screen === 'social') {
return (
<SocialView
onBack={() => setScreen('home')}
userId={authUser?.id || ''}
userName={authUser?.name || ''}
onInviteToRoom={(friendId) => {
console.log('Invite to room:', friendId);
}}
/>
);
}
// Default: If not authenticated, show auth screen first
if (!authUser) {
return (
<>
<AuthScreen
onLoginClick={() => setScreen('login')}
onRegisterClick={() => setScreen('register')}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />
</>
);
}
// Authenticated user: Show Home screen
return (
<>
<HomeView
authUser={authUser!}
onStartOffline={handleStartSetup}
onStartOnline={handleStartOnline}
onHistory={() => setScreen('history')}
onSettings={() => setScreen('settings')}
onAbout={() => setScreen('about')}
onHelp={() => setScreen('help')}
onExperienceClick={() => setShowExperienceModal(true)}
onOpenSocial={() => setScreen('social')}
socialNotifications={socialNotifications}
pendingFriendRequests={pendingFriendRequests}
onJoinRoom={handleJoinRoomFromNotification}
onMarkNotificationsRead={async (ids) => {
  try {
    await fetch('/api/social/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: ids ? 'mark_read' : 'mark_all_read', notificationIds: ids }),
    });
    fetchSocialNotifications();
  } catch (e) {
    console.error('Error marking notifications:', e);
  }
}}
/>
<ExperienceHistoryModal
open={showExperienceModal}
onClose={() => setShowExperienceModal(false)}
/>
<GameSummaryModal
open={!!gameSummary}
summary={gameSummary}
onClose={() => {
setGameSummary(null);
setResult(null);
setOfflineMatch(null);
setScreen('home');
}}
onReplay={() => {
if (gameSummary?.gameSetup) {
handleStartGame(gameSummary.gameSetup);
}
setGameSummary(null);
}}
/>
<Toast message={toast} />
<ToastContainer toasts={toastNotifications} removeToast={removeToastNotification} />

{/* Offline Indicator */}
<OfflineIndicator />

{/* PWA Install Banner */}
<PWAInstallButton variant="banner" />

{/* Session Invalid Modal - shown when user is logged in from another device */}
{sessionInvalidReason && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4">
    <div className="w-full max-w-sm rounded-[2rem] border border-red-500/30 bg-[#0c120f] p-5 shadow-2xl">
      <div className="text-center space-y-4">
        <div className="text-5xl">⚠️</div>
        <h3 className="text-xl font-bold">تم تسجيل الخروج</h3>
        <p className="text-white/70">{sessionInvalidReason}</p>
        <button
          type="button"
          onClick={() => setSessionInvalidReason(null)}
          className="w-full rounded-full bg-white px-6 py-3 text-lg font-bold text-[#050907]"
        >
          حسنًا
        </button>
      </div>
    </div>
  </div>
)}

{/* Prayer Reminder Modal */}
{prayerReminderState.shouldShow && (
  <PrayerReminder
    type={prayerReminderState.type}
    prayerName={prayerReminderState.prayerName}
    prayerTime={prayerReminderState.prayerTime}
    onDismiss={dismissPrayerReminder}
  />
)}
</>);
}
// Build fix Sat Mar 21 13:24:42 UTC 2026
// fix
// Force rebuild Sat Mar 21 14:46:23 UTC 2026
// trigger new build
