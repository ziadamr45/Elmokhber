'use client';
import { ReactNode, useEffect, useState, useCallback, useRef } from 'react';
import { RoomVoiceChat } from '@/components/room';
import { InGameVoiceChat } from '@/components/room/InGameVoiceChat';
import { RoomCodeDisplay } from '@/components/RoomShareButton';

// Quiz History Entry type
interface QuizHistoryEntry {
  id: string;
  playedAt: string;
  gameType: 'quiz';
  playMode: 'online' | 'offline';
  gameMode: 'relaxed' | 'speed';
  categoryName: string;
  playerCount: number;
  winner: string;
  winnerName?: string;
  reason: string;
  xpEarned: number;
  quizRounds: number;
  correctAnswers: number;
  playerRankings: Array<{ name: string; score: number; xp: number }>;
}

// Quiz Types
interface QuizQuestion {
  question: string;
  answer: string;
  options?: string[];
  type: 'direct' | 'fill-blank' | 'multiple-choice';
  difficulty?: 'easy' | 'medium' | 'hard';
}

interface Player {
  id: string;
  name: string;
  score: number;
  matchScore: number;
  isHost: boolean;
  isReady: boolean;
  hasAnswered: boolean;
  joinedAt: number;
  teamId?: 'A' | 'B';
}

interface Team {
  id: 'A' | 'B';
  name: string;
  color: string;
}

interface QuizRoom {
  code: string;
  isPublic: boolean;
  hostId: string;
  categoryId: string;
  mode: 'relaxed' | 'speed';
  difficulty: 'easy' | 'medium' | 'hard';
  roundsTotal: number;
  timePerRound: number;
  status: 'lobby' | 'running' | 'ended';
  currentRound: number;
  players: Player[];
  currentQuestion: QuizQuestion | null;
  teams: Team[];
  createdAt: number;
  updatedAt: number;
  settings: {
    categoryId: string;
    mode: 'relaxed' | 'speed';
    roundsTotal: number;
    timePerRound: number;
    playType: 'solo' | 'teams';
  };
}

interface PublicRoom {
  code: string;
  hostName: string;
  playerCount: number;
  categoryId: string;
  mode: string;
  difficulty: string;
  playType: 'solo' | 'teams';
  teamCount?: { teamA: number; teamB: number };
  createdAt: number;
}

interface Friend {
  id: string;
  name: string;
  avatar?: string | null;
  level?: number;
  online?: boolean;
}

// Categories - Egyptian and Arab focused
const quizCategories = [
  { id: 'history', name: 'التاريخ', icon: '📜', description: 'تاريخ مصر والعالم العربي' },
  { id: 'geography', name: 'الجغرافيا', icon: '🌍', description: 'جغرافيا البلاد العربية' },
  { id: 'science', name: 'العلوم', icon: '🔬', description: 'معلومات علمية متنوعة' },
  { id: 'technology', name: 'التكنولوجيا', icon: '💻', description: 'أجهزة وتطبيقات' },
  { id: 'sports', name: 'الرياضة', icon: '⚽', description: 'كرة القدم والرياضات العربية' },
  { id: 'movies', name: 'الأفلام', icon: '🎬', description: 'أفلام ومسلسلات عربية' },
  { id: 'music', name: 'الموسيقى', icon: '🎵', description: 'أغاني ومطربين عرب' },
  { id: 'general', name: 'الثقافة العامة', icon: '📚', description: 'معلومات متنوعة' },
  { id: 'arabic', name: 'الثقافة العربية', icon: '🏛️', description: 'تراث وعادات عربية' },
  { id: 'islamic', name: 'الثقافة الإسلامية', icon: '🕌', description: 'معارف إسلامية' },
  { id: 'egypt', name: 'مصر', icon: '🇪🇬', description: 'معلومات عن مصر' },
  { id: 'food', name: 'الأكلات', icon: '🍽️', description: 'أكلات مصرية وعربية' },
  { id: 'celebrities', name: 'المشاهير', icon: '⭐', description: 'فنانين ورياضيين عرب' },
  { id: 'proverbs', name: 'الأمثال', icon: '💬', description: 'أمثال مصرية وعربية' },
];

// Difficulty levels
const difficultyLevels = [
  { id: 'easy' as const, name: 'سهل', icon: '🌱', description: 'أسئلة بسيطة ومعلومات شائعة', color: '#22C55E' },
  { id: 'medium' as const, name: 'متوسط', icon: '⚡', description: 'أسئلة تحتاج تفكير بسيط', color: '#F59E0B' },
  { id: 'hard' as const, name: 'صعب', icon: '🔥', description: 'أسئلة أصعب ومعلومات أقل شهرة', color: '#EF4444' },
];

// Game modes
const quizModes = [
  { id: 'relaxed' as const, name: 'سيبنا براحتنا', description: 'السرعة مش مهمة', icon: '🐢' },
  { id: 'speed' as const, name: 'مين الأسرع', description: 'السرعة مهمة', icon: '⚡' },
];

// Play types
const playTypes = [
  { id: 'solo' as const, name: 'فردي', description: 'كل لاعب لنفسه', icon: '👤' },
  { id: 'teams' as const, name: 'فرق', description: 'تنافس بين فريقين', icon: '👥' },
];

// UI Components
function Shell({ children }: { children: ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-black text-white select-none">
      <div className="mx-auto min-h-screen w-full max-w-md px-5 py-6">{children}</div>
    </div>
  );
}

// Quiz Help Modal
function QuizHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c120f] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎮</span>
            <h3 className="text-xl font-extrabold">شرح اللعبة</h3>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-sm hover:bg-white/20 transition">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm leading-relaxed">
          <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-center">
            <div className="text-3xl mb-2">🎮</div>
            <div className="text-lg font-black">أهلاً بيك في لعبة المسابقة!</div>
            <p className="text-white/70 mt-2">لو بتحب التحدي والمعلومات، اللعبة دي معمولة ليك 👊</p>
          </div>
          
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h4 className="font-bold text-cyan-400 flex items-center gap-2 mb-2"><span>🧠</span> فكرة اللعبة</h4>
            <p className="text-white/80">في كل جولة هيظهر سؤال لكل اللاعبين في نفس وقت.</p>
            <p className="text-white/80 mt-1">المطلوب منك تجاوب صح علشان تكسب <span className="text-yellow-400 font-bold">"خبرة"</span>.</p>
            <p className="text-white/60 text-xs mt-2">الأسئلة بتتولد بالذكاء الاصطناعي ومرتبطة بالثقافة المصرية والعربية 🇪🇬</p>
          </div>
          
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
            <h4 className="font-bold text-green-400 flex items-center gap-2 mb-2"><span>👥</span> لعب فردي أو فرق</h4>
            <p className="text-white/80 text-xs">فردي: كل لاعب ينافس لنفسه</p>
            <p className="text-white/80 text-xs mt-1">فرق: فريقين يتنافسوا ضد بعض والنقاط بتتجمع</p>
          </div>
        </div>
        
        <div className="p-4 border-t border-white/10 shrink-0">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-[#050907]">فهمت! 🎮</button>
        </div>
      </div>
    </div>
  );
}

function QuizLogo({ size = 150 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <span style={{ fontSize: size * 0.8 }}>❓</span>
    </div>
  );
}

function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <button type="button" onClick={onBack} className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl text-white transition hover:bg-white/10">→</button>
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <div className="w-12" />
    </div>
  );
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-5">
      <div className="rounded-full bg-white px-5 py-3 text-sm font-bold text-purple-900 shadow-lg">{message}</div>
    </div>
  );
}

// Confirm Modal Component
function ConfirmModal({ open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0c120f] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-center text-2xl font-extrabold">{title}</h3>
        <p className="mb-5 text-center text-sm text-white/70">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onConfirm} className="rounded-full bg-red-500 px-4 py-3 text-sm font-extrabold text-white">{confirmLabel}</button>
          <button type="button" onClick={onCancel} className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm font-extrabold text-white">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Friend Invite Modal
function FriendInviteModal({ open, onClose, friends, onInvite, roomCode, teamId }: {
  open: boolean;
  onClose: () => void;
  friends: Friend[];
  onInvite: (friendId: string, teamId?: 'A' | 'B') => void;
  roomCode: string;
  teamId?: 'A' | 'B';
}) {
  const [search, setSearch] = useState('');
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const filteredFriends = friends.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvite = (friendId: string) => {
    onInvite(friendId, teamId);
    setInvited(prev => new Set([...prev, friendId]));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0c120f] shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✉️</span>
            <h3 className="text-xl font-extrabold">دعوة أصدقاء</h3>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-sm hover:bg-white/20 transition">✕</button>
        </div>
        
        <div className="p-4 border-b border-white/10">
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <div className="text-sm text-white/60">كود الغرفة</div>
            <div className="text-2xl font-black tracking-wider">{roomCode}</div>
          </div>
        </div>
        
        <div className="p-4">
          <input
            type="text"
            placeholder="ابحث عن صديق..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 outline-none focus:border-white"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {filteredFriends.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              <div className="text-4xl mb-2">👥</div>
              <p>لا يوجد أصدقاء</p>
            </div>
          ) : (
            filteredFriends.map((friend) => (
              <div key={friend.id} className="rounded-xl bg-white/5 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
                    {friend.avatar ? '😊' : '👤'}
                  </div>
                  <div>
                    <div className="font-bold">{friend.name}</div>
                    {friend.online && <div className="text-xs text-green-400">متصل</div>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleInvite(friend.id)}
                  disabled={invited.has(friend.id)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                    invited.has(friend.id)
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {invited.has(friend.id) ? 'تمت الدعوة ✓' : 'دعوة'}
                </button>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-white/10 shrink-0">
          <button type="button" onClick={onClose} className="w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-[#050907]">تم</button>
        </div>
      </div>
    </div>
  );
}

// Play Type Selection Screen
function PlayTypeScreen({ onBack, onSelect }: {
  onBack: () => void;
  onSelect: (playType: 'solo' | 'teams') => void;
}) {
  return (
    <Shell>
      <ScreenHeader title="نوع اللعب" onBack={onBack} />
      <div className="space-y-4">
        {playTypes.map((pt) => (
          <button
            key={pt.id}
            type="button"
            onClick={() => onSelect(pt.id)}
            className="w-full rounded-2xl bg-white/10 border border-white/20 p-6 text-center transition hover:bg-white/20 hover:border-white/40"
          >
            <div className="text-5xl mb-3">{pt.icon}</div>
            <div className="text-2xl font-bold">{pt.name}</div>
            <div className="text-white/60 mt-1">{pt.description}</div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// Quiz Home Screen
function QuizHomeScreen({ onBack, onCreateRoom, onJoinRoom }: {
  onBack: () => void;
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      <Shell>
        <div className="mb-4 flex items-center gap-2">
          <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xl transition hover:bg-white/10">→</button>
          <div className="flex-1" />
          <button type="button" onClick={() => setShowHelp(true)} className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 transition hover:bg-purple-500/20">
            <span className="text-lg">❓</span>
            <span className="font-bold text-purple-300">شرح اللعبة</span>
          </button>
        </div>
        <div className="flex min-h-[calc(100vh-8rem)] flex-col justify-center gap-8">
          <div className="space-y-5 text-center">
            <h1 className="text-5xl font-black tracking-tight text-white">يلا تحدي!</h1>
            <div className="flex justify-center"><QuizLogo size={150} /></div>
            <p className="text-lg text-white/70">اختبر معلوماتك وتنافس مع أصدقائك</p>
            <p className="text-sm text-white/50">🇪🇬 أسئلة بالثقافة المصرية والعربية</p>
          </div>
          <div className="space-y-4">
            <button type="button" onClick={onCreateRoom} className="flex w-full items-center gap-3 rounded-full bg-white px-2 py-4 text-right text-purple-900 shadow-lg transition hover:scale-[1.01] active:scale-[0.99]">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-3xl text-white">➕</span>
              <span className="flex-1 text-center text-2xl font-bold">إنشاء غرفة</span>
            </button>
            <button type="button" onClick={onJoinRoom} className="flex w-full items-center gap-3 rounded-full bg-white/10 border border-white/20 px-2 py-4 text-right text-white shadow-lg transition hover:scale-[1.01] active:scale-[0.99]">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-500/50 text-3xl text-white">🔑</span>
              <span className="flex-1 text-center text-2xl font-bold">الانضمام بكود</span>
            </button>
          </div>
        </div>
      </Shell>
      <QuizHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}

// Create Room Screen
function CreateRoomScreen({ onBack, onCreate, playerName }: {
  onBack: () => void;
  onCreate: (settings: { isPublic: boolean; categoryId: string; mode: 'relaxed' | 'speed'; difficulty: 'easy' | 'medium' | 'hard'; roundsTotal: number; timePerRound: number; playType: 'solo' | 'teams' }) => void;
  playerName: string;
}) {
  const [isPublic, setIsPublic] = useState(true);
  const [categoryId, setCategoryId] = useState('general');
  const [mode, setMode] = useState<'relaxed' | 'speed'>('relaxed');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [roundsTotal, setRoundsTotal] = useState(10);
  const [timePerRound, setTimePerRound] = useState(30);
  const [playType, setPlayType] = useState<'solo' | 'teams'>('solo');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    console.log('[QuizGame] handleCreate called with settings:', { isPublic, categoryId, mode, difficulty, roundsTotal, timePerRound, playType });
    setLoading(true);
    try {
      await onCreate({ isPublic, categoryId, mode, difficulty, roundsTotal, timePerRound, playType });
      console.log('[QuizGame] onCreate completed successfully');
    } catch (error) {
      console.error('[QuizGame] onCreate error:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = quizCategories.find(c => c.id === categoryId);
  const selectedDifficulty = difficultyLevels.find(d => d.id === difficulty);

  return (
    <Shell>
      <ScreenHeader title="إنشاء غرفة" onBack={onBack} />
      <div className="space-y-6">
        {/* Play Type Selection */}
        <div className="space-y-2">
          <label className="text-lg font-bold">نوع اللعب</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setPlayType('solo')} className={`rounded-xl p-4 text-center transition ${playType === 'solo' ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
              <span className="text-3xl">👤</span>
              <div className="font-bold mt-1">فردي</div>
              <div className="text-xs opacity-70">كل لاعب لنفسه</div>
            </button>
            <button type="button" onClick={() => setPlayType('teams')} className={`rounded-xl p-4 text-center transition ${playType === 'teams' ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
              <span className="text-3xl">👥</span>
              <div className="font-bold mt-1">فرق</div>
              <div className="text-xs opacity-70">تنافس بين فريقين</div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">نوع الغرفة</label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setIsPublic(true)} className={`rounded-xl py-3 text-center transition ${isPublic ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
              <span className="text-2xl">🌐</span>
              <div className="font-bold">عامة</div>
            </button>
            <button type="button" onClick={() => setIsPublic(false)} className={`rounded-xl py-3 text-center transition ${!isPublic ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
              <span className="text-2xl">🔒</span>
              <div className="font-bold">خاصة</div>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">مستوى الصعوبة</label>
          <div className="grid grid-cols-3 gap-2">
            {difficultyLevels.map((d) => (
              <button key={d.id} type="button" onClick={() => setDifficulty(d.id)} className={`rounded-xl p-3 text-center transition ${difficulty === d.id ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
                <div className="text-2xl">{d.icon}</div>
                <div className="text-sm font-bold">{d.name}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-white/50 text-center">{selectedDifficulty?.description}</p>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">اختر التصنيف</label>
          <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {quizCategories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => setCategoryId(cat.id)} className={`rounded-xl p-3 text-center transition ${categoryId === cat.id ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
                <div className="text-xl">{cat.icon}</div>
                <div className="text-xs font-bold">{cat.name}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-white/50 text-center">{selectedCategory?.description}</p>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">وضع اللعب</label>
          <div className="grid grid-cols-2 gap-3">
            {quizModes.map((m) => (
              <button key={m.id} type="button" onClick={() => setMode(m.id)} className={`rounded-xl p-4 text-center transition ${mode === m.id ? 'bg-white text-purple-900' : 'bg-white/10 text-white'}`}>
                <div className="text-3xl mb-2">{m.icon}</div>
                <div className="font-bold">{m.name}</div>
                <div className="text-xs opacity-70">{m.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">عدد الجولات: {roundsTotal}</label>
          <input type="range" min="5" max="20" value={roundsTotal} onChange={(e) => setRoundsTotal(Number(e.target.value))} className="w-full accent-green-500" />
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">وقت كل جولة: {timePerRound} ثانية</label>
          <input type="range" min="15" max="60" step="5" value={timePerRound} onChange={(e) => setTimePerRound(Number(e.target.value))} className="w-full accent-green-500" />
        </div>

        <button type="button" onClick={handleCreate} disabled={loading} className="w-full rounded-full bg-white py-4 text-xl font-bold text-purple-900 shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">
          {loading ? '...جاري الإنشاء' : 'إنشاء الغرفة'}
        </button>
      </div>
    </Shell>
  );
}

// Join Room Screen
function JoinRoomScreen({ onBack, onJoin, publicRooms, loading }: {
  onBack: () => void; 
  onJoin: (roomCode: string, teamId?: 'A' | 'B') => void; 
  publicRooms: PublicRoom[]; 
  loading: boolean;
}) {
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (roomCode.length === 6) {
      setJoining(true);
      await onJoin(roomCode);
      setJoining(false);
    }
  };

  return (
    <Shell>
      <ScreenHeader title="الانضمام بكود" onBack={onBack} />
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-lg font-bold">أدخل كود الغرفة</label>
          <div className="flex gap-2">
            <input type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="مثال: ABC123" className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-lg text-white placeholder:text-white/40 outline-none focus:border-white" maxLength={6} />
            <button type="button" onClick={handleJoin} disabled={roomCode.length !== 6 || joining} className="rounded-xl bg-white px-6 py-3 font-bold text-purple-900 disabled:opacity-50">{joining ? '...' : 'انضم'}</button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-lg font-bold">الغرف العامة المتاحة</label>
          {loading ? (
            <div className="rounded-xl bg-white/10 p-6 text-center text-white/60">جاري التحميل...</div>
          ) : publicRooms.length === 0 ? (
            <div className="rounded-xl bg-white/10 p-6 text-center text-white/60">لا توجد غرف متاحة حالياً</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {publicRooms.map((room) => {
                const category = quizCategories.find(c => c.id === room.categoryId);
                const modeInfo = quizModes.find(m => m.id === room.mode);
                const difficultyInfo = difficultyLevels.find(d => d.id === room.difficulty);
                return (
                  <button key={room.code} type="button" onClick={() => onJoin(room.code)} className="w-full rounded-xl bg-white/10 p-4 text-right transition hover:bg-white/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold">{room.code}</div>
                        <div className="text-sm text-white/60">{category?.icon} {category?.name} • {modeInfo?.icon} {modeInfo?.name}</div>
                        <div className="text-xs text-white/40 mt-1">الصعوبة: {difficultyInfo?.icon} {difficultyInfo?.name}</div>
                        {room.teamCount && (
                          <div className="text-xs text-white/50 mt-1">
                            🟢 {room.teamCount.teamA} vs 🟡 {room.teamCount.teamB}
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="font-bold">{room.playerCount}/8</div>
                        <div className="text-sm text-white/60">{room.hostName}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

// Team Card Component
function TeamCard({ team, players, isHost, onSwitchTeam, currentTeamId, onEditName }: {
  team: Team;
  players: Player[];
  isHost: boolean;
  onSwitchTeam?: () => void;
  currentTeamId?: 'A' | 'B';
  onEditName?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);
  
  const isCurrentTeam = currentTeamId === team.id;

  const handleSaveName = () => {
    if (editName.trim() && onEditName) {
      onEditName(editName.trim());
    }
    setEditing(false);
  };

  return (
    <div 
      className={`rounded-2xl p-4 transition ${
        isCurrentTeam 
          ? team.id === 'A' 
            ? 'bg-green-500/20 border-2 border-green-500/50' 
            : 'bg-yellow-500/20 border-2 border-yellow-500/50'
          : 'bg-white/5 border border-white/10'
      }`}
      style={{ borderColor: isCurrentTeam ? team.color : undefined }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div 
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: team.color }}
          />
          {editing ? (
            <div className="flex gap-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-lg bg-white/10 px-2 py-1 text-sm w-24 outline-none"
                maxLength={20}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="text-xs bg-white/20 px-2 rounded-lg"
              >
                ✓
              </button>
            </div>
          ) : (
            <span className="font-bold">{team.name}</span>
          )}
          {isHost && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-white/50 hover:text-white"
            >
              ✏️
            </button>
          )}
        </div>
        <span className="text-sm text-white/60">{players.length} لاعب</span>
      </div>
      
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {players.length === 0 ? (
          <div className="text-center text-white/40 py-3 text-sm">لا يوجد لاعبين</div>
        ) : (
          players.map((player) => (
            <div key={player.id} className="flex items-center gap-2 text-sm">
              <span>{player.isHost ? '👑' : '👤'}</span>
              <span className={player.teamId === currentTeamId ? 'font-bold' : ''}>{player.name}</span>
            </div>
          ))
        )}
      </div>
      
      {onSwitchTeam && !isCurrentTeam && (
        <button
          type="button"
          onClick={onSwitchTeam}
          className="w-full mt-3 rounded-xl bg-white/10 py-2 text-sm font-bold hover:bg-white/20 transition"
        >
          انضم للفريق
        </button>
      )}
    </div>
  );
}

// Quiz Lobby Screen
function QuizLobbyScreen({ room, playerId, onLeave, onStart, isHost, onSwitchTeam, onUpdateTeamName, onInviteFriend, friends }: {
  room: QuizRoom; 
  playerId: string; 
  onLeave: () => void; 
  onStart: () => void; 
  isHost: boolean;
  onSwitchTeam: (teamId: 'A' | 'B') => void;
  onUpdateTeamName: (teamId: 'A' | 'B', name: string) => void;
  onInviteFriend: (friendId: string, teamId?: 'A' | 'B') => void;
  friends: Friend[];
}) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const category = quizCategories.find(c => c.id === room.categoryId);
  const modeInfo = quizModes.find(m => m.id === room.mode);
  const difficultyInfo = difficultyLevels.find(d => d.id === room.difficulty);
  const currentPlayer = room.players.find(p => p.id === playerId);

  const teamA = room.teams?.find(t => t.id === 'A');
  const teamB = room.teams?.find(t => t.id === 'B');
  const teamAPlayers = room.players.filter(p => p.teamId === 'A');
  const teamBPlayers = room.players.filter(p => p.teamId === 'B');

  const canStart = () => {
    if (room?.settings?.playType === 'teams') {
      return teamAPlayers.length >= 1 && teamBPlayers.length >= 1;
    }
    return room.players.length >= 2;
  };

  const getStartMessage = () => {
    if (room?.settings?.playType === 'teams') {
      if (teamAPlayers.length < 1) return 'الفريق أ فارغ';
      if (teamBPlayers.length < 1) return 'الفريق ب فارغ';
      return 'بدء اللعب';
    }
    return room.players.length < 2 ? 'بانتظار لاعبين (2 على الأقل)' : 'بدء اللعب';
  };

  return (
    <Shell>
      <ScreenHeader title={`غرفة ${room.code}`} onBack={onLeave} />
      <div className="space-y-6">
        {/* Play Type Badge */}
        <div className="rounded-xl bg-white/10 p-3 flex items-center justify-center gap-2">
          <span className="text-2xl">{room?.settings?.playType === 'teams' ? '👥' : '👤'}</span>
          <span className="font-bold">{room?.settings?.playType === 'teams' ? 'لعب فرق' : 'لعب فردي'}</span>
        </div>

        {/* Settings Summary */}
        <div className="rounded-xl bg-white/10 p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl">{category?.icon}</div>
              <div className="text-sm font-bold">{category?.name}</div>
            </div>
            <div>
              <div className="text-2xl">{modeInfo?.icon}</div>
              <div className="text-sm font-bold">{modeInfo?.name}</div>
            </div>
            <div>
              <div className="text-2xl" style={{ color: difficultyInfo?.color }}>{difficultyInfo?.icon}</div>
              <div className="text-sm font-bold">{difficultyInfo?.name}</div>
            </div>
          </div>
          <div className="mt-3 text-center text-white/60">{room.roundsTotal} جولات • {room.timePerRound} ثانية/جولة</div>
        </div>

        {/* Teams or Players */}
        {room?.settings?.playType === 'teams' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-lg font-bold">الفريقان</label>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
              >
                <span>✉️</span>
                <span>دعوة أصدقاء</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <TeamCard
                team={teamA}
                players={teamAPlayers}
                isHost={isHost}
                currentTeamId={currentPlayer?.teamId}
                onSwitchTeam={() => onSwitchTeam('A')}
                onEditName={(name) => onUpdateTeamName('A', name)}
              />
              <TeamCard
                team={teamB}
                players={teamBPlayers}
                isHost={isHost}
                currentTeamId={currentPlayer?.teamId}
                onSwitchTeam={() => onSwitchTeam('B')}
                onEditName={(name) => onUpdateTeamName('B', name)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-lg font-bold">اللاعبين ({room.players.length}/8)</label>
              <button
                type="button"
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
              >
                <span>✉️</span>
                <span>دعوة أصدقاء</span>
              </button>
            </div>
            <div className="space-y-2">
              {room.players.map((player) => (
                <div key={player.id} className={`rounded-xl p-3 flex items-center justify-between ${player.id === playerId ? 'bg-white/20 border border-white/30' : 'bg-white/10'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{player.isHost ? '👑' : '👤'}</span>
                    <span className="font-bold">{player.name}</span>
                    {player.id === playerId && <span className="text-xs text-white/60">(أنت)</span>}
                  </div>
                  <div className="text-white/60">{player.isHost ? 'المضيف' : 'جاهز'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Room Code Share */}
        <RoomCodeDisplay
          gameType="quiz"
          roomCode={room.code}
          playerName={currentPlayer?.name}
          mode={room.mode}
          difficulty={room.difficulty}
          playType={room.settings?.playType === 'teams' ? 'teams' : 'solo'}
        />

        {/* Voice & Chat - Works in all rooms */}
        <RoomVoiceChat
          roomCode={room.code}
          playerId={playerId}
          playerName={currentPlayer?.name || 'لاعب'}
          gameType="quiz"
        />

        {/* Start Button */}
        {isHost ? (
          <button type="button" onClick={onStart} disabled={!canStart()} className="w-full rounded-full bg-white py-4 text-xl font-bold text-purple-900 shadow-lg disabled:opacity-50">
            {getStartMessage()}
          </button>
        ) : (
          <div className="rounded-xl bg-white/10 p-4 text-center">
            <div className="text-white/60">بانتظار المضيف لبدء اللعبة...</div>
          </div>
        )}
      </div>
      
      <FriendInviteModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        friends={friends}
        onInvite={onInviteFriend}
        roomCode={room.code}
        teamId={currentPlayer?.teamId}
      />
    </Shell>
  );
}

// Team Scores Display Component
function TeamScoresDisplay({ room, teamScores }: { room: QuizRoom; teamScores: { teamA: number; teamB: number } }) {
  const teamA = room.teams?.find(t => t.id === 'A');
  const teamB = room.teams?.find(t => t.id === 'B');
  const teamAPlayers = room.players.filter(p => p.teamId === 'A');
  const teamBPlayers = room.players.filter(p => p.teamId === 'B');

  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Team A */}
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: teamA.color + '20' }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: teamA.color }} />
            <span className="text-sm font-bold">{teamA.name}</span>
          </div>
          <div className="text-2xl font-black">{teamScores.teamA}</div>
          <div className="text-xs text-white/50">{teamAPlayers.length} لاعب</div>
        </div>
        
        {/* Team B */}
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: teamB.color + '20' }}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: teamB.color }} />
            <span className="text-sm font-bold">{teamB.name}</span>
          </div>
          <div className="text-2xl font-black">{teamScores.teamB}</div>
          <div className="text-xs text-white/50">{teamBPlayers.length} لاعب</div>
        </div>
      </div>
    </div>
  );
}

// Enhanced Timer component with progress bar
function QuizTimer({ timePerRound, isActive, onTimeUp, currentRound }: {
  timePerRound: number; isActive: boolean; onTimeUp: () => void; currentRound: number;
}) {
  const [timeLeft, setTimeLeft] = useState(timePerRound);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Reset timer when round changes using a ref to track changes
  const prevRoundRef = useRef(currentRound);
  useEffect(() => {
    if (prevRoundRef.current !== currentRound) {
      prevRoundRef.current = currentRound;
      // Intentional state reset for new round - timer must reset
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(timePerRound);
    }
  }, [currentRound, timePerRound]);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeUpRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, timeLeft]);

  const progress = (timeLeft / timePerRound) * 100;
  const isLowTime = timeLeft <= 10;
  const isCriticalTime = timeLeft <= 5;
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const displayTime = minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}`;

  return (
    <div className="w-full">
      <div className={`text-center mb-2 ${isCriticalTime ? 'animate-pulse' : ''}`}>
        <div className={`text-4xl font-black ${isCriticalTime ? 'text-red-500' : isLowTime ? 'text-orange-400' : 'text-white'}`}>
          ⏱️ {displayTime}
        </div>
      </div>
      
      <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            isCriticalTime ? 'bg-red-500' : isLowTime ? 'bg-orange-500' : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-white/50 mt-1">
        <span>0</span>
        <span>{timePerRound}ث</span>
      </div>
    </div>
  );
}

// Quiz Game Screen
function QuizGameScreen({ room, playerId, onAnswer, onNextRound, answerResult, earnedXP, onLeave, onSwitchTeam }: {
  room: QuizRoom;
  playerId: string;
  onAnswer: (answer: string) => void;
  onNextRound: () => void;
  answerResult: { isCorrect: boolean; points: number; correctAnswer: string; confidence?: number; teamScores?: { teamA: number; teamB: number } } | null;
  earnedXP: number | null;
  onLeave: () => void;
  onSwitchTeam: (teamId: 'A' | 'B') => void;
}) {
  const [answer, setAnswer] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const player = room.players.find(p => p.id === playerId);
  const difficultyInfo = difficultyLevels.find(d => d.id === room.difficulty);
  const hasAutoSubmittedRef = useRef(false);

  // Debug: Log player status
  useEffect(() => {
    console.log('[QuizGameScreen] Room state:', {
      playerId,
      playersCount: room.players.length,
      playerIds: room.players.map(p => p.id),
      foundPlayer: !!player,
      playerHasAnswered: player?.hasAnswered,
      currentQuestion: room.currentQuestion?.question?.substring(0, 30)
    });
  }, [room, playerId, player]);

  const allAnswered = room.players.every(p => p.hasAnswered);

  // Calculate team scores
  const teamScores = room?.settings?.playType === 'teams' ? {
    teamA: room.players.filter(p => p.teamId === 'A').reduce((sum, p) => sum + p.matchScore, 0),
    teamB: room.players.filter(p => p.teamId === 'B').reduce((sum, p) => sum + p.matchScore, 0),
  } : null;

  const handleTimeUp = useCallback(() => {
    if (!player?.hasAnswered && !hasSubmitted && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      onAnswer('');
      setHasSubmitted(true);
    }
  }, [player?.hasAnswered, hasSubmitted, onAnswer]);

  // Reset state when question changes using ref to track changes
  const prevQuestionRef = useRef(room.currentQuestion?.question);
  useEffect(() => {
    if (prevQuestionRef.current !== room.currentQuestion?.question) {
      prevQuestionRef.current = room.currentQuestion?.question;
      // Intentional state reset for new question
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswer('');
       
      setHasSubmitted(false);
      hasAutoSubmittedRef.current = false;
    }
  }, [room.currentRound, room.currentQuestion?.question]);

  const handleSubmit = () => {
    console.log('[QuizGameScreen] handleSubmit called', { 
      answer: answer.trim(), 
      hasSubmitted, 
      hasAnswered: player?.hasAnswered,
      playerExists: !!player,
      allAnswered
    });
    
    if (!answer.trim()) {
      console.log('[QuizGameScreen] No answer to submit');
      return;
    }
    if (hasSubmitted) {
      console.log('[QuizGameScreen] Already submitted locally');
      return;
    }
    if (player?.hasAnswered) {
      console.log('[QuizGameScreen] Player already answered (server)');
      return;
    }
    
    console.log('[QuizGameScreen] Calling onAnswer with:', answer.trim());
    setHasSubmitted(true); // Set this BEFORE calling onAnswer to prevent double-submit
    onAnswer(answer.trim());
  };

  if (room.status === 'ended') {
    return (
      <TeamGameSummary
        room={room}
        playerId={playerId}
        earnedXP={earnedXP}
        onLeave={onLeave}
      />
    );
  }

  if (!room.currentQuestion) {
    return (
      <Shell>
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
          <div className="text-2xl font-bold">جاري تحضير السؤال...</div>
          <div className="text-white/60">🤖 الذكاء الاصطناعي بيحضر سؤال جديد</div>
        </div>
      </Shell>
    );
  }

  const isTimerActive = room.status === 'running' && !player?.hasAnswered && !allAnswered;

  return (
    <Shell>
      <div className="space-y-4">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={onLeave} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">→</button>
          <div className="flex-1" />
          <div className="w-10" />
        </div>
        
        {/* Timer */}
        <div className="rounded-xl bg-white/5 p-4">
          <QuizTimer
            timePerRound={room.timePerRound}
            isActive={isTimerActive}
            onTimeUp={handleTimeUp}
            currentRound={room.currentRound}
          />
        </div>
        
        {/* Round and Difficulty info */}
        <div className="flex items-center justify-center gap-2">
          <div className="rounded-full bg-white/10 px-4 py-2">
            <span className="font-bold">الجولة {room.currentRound}/{room.roundsTotal}</span>
          </div>
          <div className="rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: (difficultyInfo?.color || '#fff') + '30', color: difficultyInfo?.color }}>
            {difficultyInfo?.icon} {difficultyInfo?.name}
          </div>
        </div>

        {/* Team Scores or Player Scores */}
        {room?.settings?.playType === 'teams' && teamScores ? (
          <TeamScoresDisplay room={room} teamScores={teamScores} />
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {room.players.map((p) => (
              <div key={p.id} className={`flex-shrink-0 rounded-xl px-3 py-2 text-center ${p.hasAnswered ? 'bg-green-500/30' : 'bg-white/10'} ${p.id === playerId ? 'border border-white/50' : ''}`}>
                <div className="text-sm font-bold">{p.name}</div>
                <div className="font-bold">{p.matchScore}</div>
              </div>
            ))}
          </div>
        )}

        {/* Question */}
        <div className="rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/30 p-6 text-center">
          <div className="text-sm text-purple-300 mb-2">❓ السؤال</div>
          {room.currentQuestion.type === 'fill-blank' ? (
            <div className="text-2xl font-bold">{room.currentQuestion.question.replace('______', '_____')}</div>
          ) : (
            <div className="text-2xl font-bold">{room.currentQuestion.question}</div>
          )}
        </div>

        {/* Answer Options for Multiple Choice */}
        {room.currentQuestion.type === 'multiple-choice' && room.currentQuestion.options && (
          <div className="grid grid-cols-2 gap-3">
            {room.currentQuestion.options.map((option, i) => (
              <button key={i} type="button" onClick={() => !hasSubmitted && !player?.hasAnswered && setAnswer(option)} disabled={hasSubmitted || player?.hasAnswered || allAnswered}
                className={`rounded-xl p-4 text-lg font-bold transition ${answer === option ? 'bg-white text-purple-900' : 'bg-white/10 hover:bg-white/20'} ${hasSubmitted || player?.hasAnswered || allAnswered ? 'opacity-50' : ''}`}>
                {option}
              </button>
            ))}
          </div>
        )}

        {/* Text Input for Direct/Fill-blank */}
        {room.currentQuestion.type !== 'multiple-choice' && (
          <div className="space-y-2">
            <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="اكتب إجابتك..."
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-4 text-lg text-white placeholder:text-white/40 outline-none focus:border-white"
              disabled={hasSubmitted || player?.hasAnswered || allAnswered}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button 
              type="button" 
              onClick={() => {
                console.log('BUTTON CLICKED!');
                handleSubmit();
              }} 
              disabled={!answer.trim() || hasSubmitted || player?.hasAnswered || allAnswered}
              className="w-full rounded-full bg-white py-4 text-xl font-bold text-purple-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasSubmitted || player?.hasAnswered ? 'تم الإرسال ✓' : 'إرسال الإجابة'}
            </button>
            {/* Debug info */}
            <div className="text-xs text-white/40 text-center space-y-1">
              <div>playerId: {playerId?.substring(0, 8)}... | found: {player ? 'yes' : 'NO!'}</div>
              <div>hasSubmitted: {hasSubmitted.toString()} | hasAnswered: {player?.hasAnswered?.toString()}</div>
            </div>
          </div>
        )}

        {/* Answer Result */}
        {answerResult && (
          <div className={`rounded-xl p-4 text-center ${answerResult.isCorrect ? 'bg-green-500/30 border border-green-500/50' : 'bg-red-500/30 border border-red-500/50'}`}>
            <div className="text-xl font-bold">{answerResult.isCorrect ? '✅ إجابة صحيحة!' : '❌ إجابة خاطئة'}</div>
            {!answerResult.isCorrect && <div className="text-white/80 mt-2">الإجابة الصحيحة: <span className="font-bold text-green-400">{answerResult.correctAnswer}</span></div>}
            <div className="text-white/60 mt-1">+{answerResult.points} نقطة</div>
            {room?.settings?.playType === 'teams' && answerResult.teamScores && (
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="text-xs text-white/50">نتيجة الفريقين</div>
                <div className="flex justify-center gap-4 text-sm font-bold">
                  <span className="text-green-400">{room?.teams?.[0].name}: {answerResult.teamScores.teamA}</span>
                  <span className="text-white/30">|</span>
                  <span className="text-yellow-400">{room?.teams?.[1].name}: {answerResult.teamScores.teamB}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Waiting for others */}
        {player?.hasAnswered && !allAnswered && (
          <div className="rounded-xl bg-white/10 p-4 text-center">
            <div className="text-white/60">⏳ بانتظار باقي اللاعبين...</div>
            <div className="flex justify-center gap-1 mt-2">
              {room.players.map(p => (
                <span key={p.id} className={`w-3 h-3 rounded-full ${p.hasAnswered ? 'bg-green-500' : 'bg-white/30'}`} />
              ))}
            </div>
          </div>
        )}

        {/* All answered - waiting for host */}
        {allAnswered && room.hostId !== playerId && (
          <div className="rounded-xl bg-green-500/20 border border-green-500/30 p-4 text-center">
            <div className="text-green-400">✅ جميع اللاعبين أجابوا!</div>
            <div className="text-white/60 text-sm mt-1">بانتظار صاحب الغرفة للجولة التالية...</div>
          </div>
        )}

        {/* Next round button for host */}
        {allAnswered && room.hostId === playerId && (
          <button type="button" onClick={onNextRound} className="w-full rounded-full bg-white py-4 text-xl font-bold text-purple-900">
            {room.currentRound >= room.roundsTotal ? '📊 إنهاء اللعبة' : '➡️ الجولة التالية'}
          </button>
        )}
      </div>

      {/* In-Game Voice & Chat */}
      <InGameVoiceChat
        roomCode={room.code}
        playerId={playerId}
        playerName={player?.name || 'لاعب'}
        gameType="quiz"
      />
    </Shell>
  );
}

// Team Game Summary Component
function TeamGameSummary({ room, playerId, earnedXP, onLeave }: {
  room: QuizRoom;
  playerId: string;
  earnedXP: number | null;
  onLeave: () => void;
}) {
  const sortedPlayers = [...room.players].sort((a, b) => b.matchScore - a.matchScore);
  const me = room.players.find(p => p.id === playerId);

  // Calculate team scores
  const teamScores = {
    teamA: room.players.filter(p => p.teamId === 'A').reduce((sum, p) => sum + p.matchScore, 0),
    teamB: room.players.filter(p => p.teamId === 'B').reduce((sum, p) => sum + p.matchScore, 0),
  };

  const winningTeamId = teamScores.teamA >= teamScores.teamB ? 'A' : 'B';
  const winningTeam = room.teams?.find(t => t.id === winningTeamId);

  // Get best player per team
  const teamAPlayers = room.players.filter(p => p.teamId === 'A');
  const teamBPlayers = room.players.filter(p => p.teamId === 'B');
  const teamABest = teamAPlayers.length > 0 
    ? teamAPlayers.reduce((best, p) => p.matchScore > best.matchScore ? p : best, teamAPlayers[0])
    : null;
  const teamBBest = teamBPlayers.length > 0
    ? teamBPlayers.reduce((best, p) => p.matchScore > best.matchScore ? p : best, teamBPlayers[0])
    : null;

  const didMyTeamWin = me?.teamId === winningTeamId;

  return (
    <Shell>
      <div className="flex min-h-[calc(100vh-4rem)] flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl font-black">انتهت اللعبة!</div>
          {earnedXP !== null && (
            <div className="rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 p-4 mt-4 text-center">
              <div className="text-sm text-white/60">خبرة مكتسبة</div>
              <div className="text-3xl font-black text-yellow-300">+{earnedXP} ⭐</div>
              {didMyTeamWin && <div className="text-sm text-green-400 mt-1">🎉 فوز فريقك!</div>}
            </div>
          )}
        </div>

        {/* Team Results */}
        <div className="space-y-4">
          <div className="text-xl font-bold text-center">نتيجة الفريقين</div>
          
          <div className="grid grid-cols-2 gap-3">
            {/* Team A */}
            <div className={`rounded-2xl p-4 ${winningTeamId === 'A' ? 'bg-green-500/20 border-2 border-green-500/50' : 'bg-white/5 border border-white/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="font-bold">{room?.teams?.[0].name}</span>
                </div>
                {winningTeamId === 'A' && <span className="text-lg">🏆</span>}
              </div>
              <div className="text-3xl font-black text-center">{teamScores.teamA}</div>
              <div className="text-xs text-white/50 text-center mt-1">نقطة</div>
              
              {teamABest && (
                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="text-xs text-white/50">أفضل لاعب</div>
                  <div className="font-bold text-sm">{teamABest.name}</div>
                  <div className="text-xs text-white/60">{teamABest.matchScore} نقطة</div>
                </div>
              )}
            </div>

            {/* Team B */}
            <div className={`rounded-2xl p-4 ${winningTeamId === 'B' ? 'bg-yellow-500/20 border-2 border-yellow-500/50' : 'bg-white/5 border border-white/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <span className="font-bold">{room?.teams?.[1].name}</span>
                </div>
                {winningTeamId === 'B' && <span className="text-lg">🏆</span>}
              </div>
              <div className="text-3xl font-black text-center">{teamScores.teamB}</div>
              <div className="text-xs text-white/50 text-center mt-1">نقطة</div>
              
              {teamBBest && (
                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="text-xs text-white/50">أفضل لاعب</div>
                  <div className="font-bold text-sm">{teamBBest.name}</div>
                  <div className="text-xs text-white/60">{teamBBest.matchScore} نقطة</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* All Players Ranking */}
        <div className="space-y-2">
          <div className="font-bold">ترتيب اللاعبين</div>
          {sortedPlayers.map((p, i) => (
            <div key={p.id} className={`rounded-xl p-3 flex items-center justify-between ${p.id === playerId ? 'bg-white/20 border border-white/30' : 'bg-white/10'}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{p.name}</span>
                    {p.teamId && (
                      <span 
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ 
                          backgroundColor: p.teamId === 'A' ? '#22C55E30' : '#F59E0B30',
                          color: p.teamId === 'A' ? '#22C55E' : '#F59E0B'
                        }}
                      >
                        {p.teamId === 'A' ? room?.teams?.[0].name : room?.teams?.[1].name}
                      </span>
                    )}
                  </div>
                  {p.id === playerId && <span className="text-xs text-white/60">(أنت)</span>}
                </div>
              </div>
              <span className="font-bold">{p.matchScore} نقطة</span>
            </div>
          ))}
        </div>

        <button type="button" onClick={onLeave} className="w-full rounded-full bg-white py-4 text-xl font-bold text-purple-900">العودة للرئيسية</button>
      </div>
    </Shell>
  );
}

// Main Quiz Game Component
export default function QuizGame({ playerName, onBack, notify, onSaveHistory, friends: propFriends }: {
  playerName: string; 
  onBack: () => void; 
  notify: (message: string) => void; 
  onSaveHistory: (entry: QuizHistoryEntry) => void;
  friends?: Friend[];
}) {
  const [screen, setScreen] = useState<'home' | 'create' | 'join' | 'lobby' | 'game'>('home');
  const [playType, setPlayType] = useState<'solo' | 'teams'>('solo');
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string; confidence?: number; teamScores?: { teamA: number; teamB: number } } | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [earnedXP, setEarnedXP] = useState<number | null>(null);
  const [xpClaimed, setXpClaimed] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [friends] = useState<Friend[]>(propFriends || []);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<string | null>(null);
  // Ref to store XP value immediately for history saving
  const earnedXPRef = useRef<number>(0);

  // Reset XP state when transitioning away from 'ended'
  useEffect(() => {
    if (previousStatusRef.current === 'ended' && room && room.status !== 'ended') {
      const timer = setTimeout(() => {
        setXpClaimed(false);
        setEarnedXP(null);
        earnedXPRef.current = 0;
      }, 0);
      return () => clearTimeout(timer);
    }
    previousStatusRef.current = room?.status || null;
  }, [room?.status]);

  // Claim XP when quiz game ends
  useEffect(() => {
    if (!room || room.status !== 'ended' || xpClaimed || !playerId) return;

    const claimXP = async () => {
      try {
        const me = room.players.find(p => p.id === playerId);
        const sortedPlayers = [...room.players].sort((a, b) => b.matchScore - a.matchScore);
        const winner = sortedPlayers[0];
        const didWin = me?.id === winner?.id;

        // For teams, check if player's team won
        let outcome = didWin ? 'win' : 'loss';
        if (room?.settings?.playType === 'teams' && me?.teamId) {
          const teamScores = {
            teamA: room.players.filter(p => p.teamId === 'A').reduce((sum, p) => sum + p.matchScore, 0),
            teamB: room.players.filter(p => p.teamId === 'B').reduce((sum, p) => sum + p.matchScore, 0),
          };
          const winningTeamId = teamScores.teamA >= teamScores.teamB ? 'A' : 'B';
          outcome = me.teamId === winningTeamId ? 'win' : 'loss';
        }

        const response = await fetch('/api/game-rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameType: 'quiz',
            gameMode: room.mode,
            outcome,
            playerRole: 'player',
            stats: { correctAnswers: Math.floor((me?.matchScore || 0) / 10), difficulty: room.difficulty },
          }),
        });

        const data = await response.json();
        if (data.success) {
          // Store in ref immediately for history saving
          earnedXPRef.current = data.xpEarned;
          setEarnedXP(data.xpEarned);
        }
      } catch (error) {
        console.error('Failed to claim XP:', error);
      }
      setXpClaimed(true);
    };

    claimXP();
  }, [room?.status, xpClaimed, playerId, room?.players, room?.mode, room?.difficulty, room?.settings?.playType]);

  // Save history when quiz game ends
  useEffect(() => {
    if (room?.status !== 'ended' || historySaved || !playerId || !xpClaimed) return;

    const saveHistory = () => {
      const me = room.players.find(p => p.id === playerId);
      const sortedPlayers = [...room.players].sort((a, b) => b.matchScore - a.matchScore);
      const winner = sortedPlayers[0];

      let winnerName = winner?.name || 'غير معروف';
      if (room?.settings?.playType === 'teams' && me?.teamId) {
        const teamScores = {
          teamA: room.players.filter(p => p.teamId === 'A').reduce((sum, p) => sum + p.matchScore, 0),
          teamB: room.players.filter(p => p.teamId === 'B').reduce((sum, p) => sum + p.matchScore, 0),
        };
        const winningTeamId = teamScores.teamA >= teamScores.teamB ? 'A' : 'B';
        const winningTeam = room?.teams?.find(t => t.id === winningTeamId);
        winnerName = winningTeam?.name || winnerName;
      }

      // Use ref value which is set immediately when XP is claimed
      const finalEarnedXP = earnedXPRef.current || earnedXP || 0;

      const entry: QuizHistoryEntry = {
        id: Math.random().toString(36).slice(2, 10),
        playedAt: new Date().toISOString(),
        gameType: 'quiz',
        playMode: 'online',
        gameMode: room.mode,
        categoryName: quizCategories.find(c => c.id === room.categoryId)?.name || 'الثقافة العامة',
        playerCount: room.players.length,
        winner: winnerName,
        winnerName: winner?.name,
        reason: me?.id === winner?.id ? 'فزت في المسابقة!' : `${winner?.name} كسب المسابقة`,
        xpEarned: finalEarnedXP,
        quizRounds: room.roundsTotal,
        correctAnswers: Math.floor((me?.matchScore || 0) / 10),
        playerRankings: sortedPlayers.map(p => ({ name: p.name, score: p.matchScore, xp: p.id === playerId ? finalEarnedXP : 0 })),
      };

      onSaveHistory(entry);
      setHistorySaved(true);
    };

    saveHistory();
  }, [room?.status, historySaved, playerId, room?.players, room?.mode, room?.categoryId, room?.roundsTotal, earnedXP, xpClaimed, onSaveHistory, room?.settings?.playType, room?.teams]);

  // API helper
  const api = useCallback(async (action: string, data?: Record<string, unknown>) => {
    const response = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }),
    });
    return response.json();
  }, []);

  // Fetch public rooms
  const fetchPublicRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const response = await fetch('/api/quiz?action=public-rooms');
      const data = await response.json();
      if (data.success) {
        setPublicRooms(data.rooms);
      }
    } catch (error) {
      console.error('Error fetching public rooms:', error);
    }
    setLoadingRooms(false);
  }, []);

  // Poll room state
  const pollRoomState = useCallback(async () => {
    if (!playerId) return;
    try {
      const response = await fetch(`/api/quiz?action=poll&playerId=${playerId}`);
      const data = await response.json();
      if (data.success && data.inRoom && data.room) {
        // Update hasAnswered for each player based on answeredPlayerIds
        if (data.room.answeredPlayerIds && data.room.players) {
          data.room.players = data.room.players.map((p: Player) => ({
            ...p,
            hasAnswered: data.room.answeredPlayerIds.includes(p.id)
          }));
        }
        // Update matchScore from the database scores
        if (data.room.players) {
          data.room.players = data.room.players.map((p: Player) => ({
            ...p,
            matchScore: p.matchScore || p.score || 0
          }));
        }
        setRoom(data.room);
        if (data.room.status === 'running' && screen !== 'game') {
          setScreen('game');
        } else if (data.room.status === 'ended' && screen !== 'game') {
          setScreen('game');
        }
      } else if (!data.inRoom) {
        setRoom(null);
        setScreen('home');
      }
    } catch (error) {
      console.error('Error polling room state:', error);
    }
  }, [playerId, screen]);

  // Start polling when in lobby or game
  useEffect(() => {
    if (screen === 'lobby' || screen === 'game') {
      pollingRef.current = setInterval(pollRoomState, 1500);
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      };
    }
  }, [screen, pollRoomState]);

  // Fetch public rooms when on join screen
  // Fetch public rooms when on join screen
  useEffect(() => {
    if (screen === 'join') {
      // Intentional side effect for data fetching
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchPublicRooms();
    }
  }, [screen, fetchPublicRooms]);

  // Handle play type selection
  const handleSelectPlayType = useCallback((selectedPlayType: 'solo' | 'teams') => {
    setPlayType(selectedPlayType);
    setScreen('create');
  }, []);

  // Create room
  const handleCreateRoom = useCallback(async (settings: { isPublic: boolean; categoryId: string; mode: 'relaxed' | 'speed'; difficulty: 'easy' | 'medium' | 'hard'; roundsTotal: number; timePerRound: number; playType: 'solo' | 'teams' }) => {
    console.log('[QuizGame] handleCreateRoom called with settings:', settings, 'playerName:', playerName);
    try {
      const data = await api('create-room', {
        playerName,
        isPublic: settings.isPublic,
        categoryId: settings.categoryId,
        mode: settings.mode,
        difficulty: settings.difficulty,
        roundsTotal: settings.roundsTotal,
        timePerRound: settings.timePerRound,
        playType: settings.playType,
      });
      console.log('[QuizGame] API response:', data);
      if (data.success) {
        setRoom(data.room);
        setPlayerId(data.playerId);
        setScreen('lobby');
        notify('تم إنشاء الغرفة بنجاح!');
      } else {
        console.error('[QuizGame] API returned error:', data.error);
        notify(data.error || 'حدث خطأ');
      }
    } catch (error) {
      console.error('[QuizGame] API call error:', error);
      notify('حدث خطأ في الاتصال');
    }
  }, [playerName, api, notify]);

  // Join room
  const handleJoinRoom = useCallback(async (roomCode: string, teamId?: 'A' | 'B') => {
    try {
      const data = await api('join-room', { roomCode, playerName, teamId });
      if (data.success) {
        setRoom(data.room);
        setPlayerId(data.playerId);
        setScreen('lobby');
        notify('تم الانضمام للغرفة!');
      } else {
        notify(data.error || 'حدث خطأ');
      }
    } catch {
      notify('حدث خطأ في الاتصال');
    }
  }, [playerName, api, notify]);

  // Switch team
  const handleSwitchTeam = useCallback(async (teamId: 'A' | 'B') => {
    console.log('[QuizGame] handleSwitchTeam called:', { playerId, teamId });
    if (!playerId) {
      console.error('[QuizGame] No playerId, cannot switch team');
      return;
    }
    try {
      console.log('[QuizGame] Calling switch-team API...');
      const data = await api('switch-team', { playerId, teamId });
      console.log('[QuizGame] switch-team response:', data);
      if (data.success) {
        setRoom(data.room);
        notify(`انضممت للفريق ${teamId === 'A' ? 'أ' : 'ب'}`);
      } else {
        console.error('[QuizGame] switch-team failed:', data.error);
        notify(data.error || 'حدث خطأ');
      }
    } catch (error) {
      console.error('[QuizGame] switch-team error:', error);
      notify('حدث خطأ في تغيير الفريق');
    }
  }, [playerId, api, notify]);

  // Update team name
  const handleUpdateTeamName = useCallback(async (teamId: 'A' | 'B', name: string) => {
    if (!playerId) return;
    try {
      const data = await api('update-team-name', { playerId, teamId, name });
      if (data.success) {
        setRoom(data.room);
      }
    } catch {
      notify('حدث خطأ في تحديث اسم الفريق');
    }
  }, [playerId, api, notify]);

  // Invite friend
  const handleInviteFriend = useCallback((friendId: string, teamId?: 'A' | 'B') => {
    // This would integrate with the social system
    console.log('Inviting friend:', friendId, 'to team:', teamId);
    notify('تم إرسال الدعوة!');
  }, [notify]);

  // Leave room
  const handleLeaveRoom = useCallback(async () => {
    if (playerId) {
      try {
        await api('leave-room', { playerId });
      } catch {
        // Ignore
      }
    }
    setRoom(null);
    setPlayerId(null);
    setShowExitConfirm(false);
    setScreen('home');
    setHistorySaved(false);
    setXpClaimed(false);
    setEarnedXP(null);
  }, [playerId, api]);

  // Request exit
  const requestExit = useCallback(() => {
    if (room?.status === 'ended') {
      handleLeaveRoom();
    } else {
      setShowExitConfirm(true);
    }
  }, [room?.status, handleLeaveRoom]);

  // Start game
  const handleStartGame = useCallback(async () => {
    if (!playerId) return;
    try {
      const data = await api('start-game', { playerId });
      if (data.success) {
        // Initialize players with hasAnswered: false
        if (data.room) {
          data.room.players = data.room.players.map((p: Player) => ({
            ...p,
            hasAnswered: false,
            matchScore: p.matchScore || p.score || 0
          }));
        }
        setRoom(data.room);
        setScreen('game');
      } else {
        notify(data.error || 'حدث خطأ');
      }
    } catch {
      notify('حدث خطأ في الاتصال');
    }
  }, [playerId, api, notify]);

  // Submit answer
  const handleSubmitAnswer = useCallback(async (answer: string) => {
    console.log('[QuizGame] handleSubmitAnswer called', { playerId, answer, roomStatus: room?.status });
    if (!playerId || !room) {
      console.log('[QuizGame] handleSubmitAnswer early return - no playerId or room');
      return;
    }
    try {
      console.log('[QuizGame] Calling API submit-answer');
      const data = await api('submit-answer', {
        playerId,
        answer,
        timeTaken: Date.now()
      });
      console.log('[QuizGame] API response:', data);
      if (data.success) {
        // Immediately update local state to show player has answered
        setRoom(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            players: prev.players.map(p => 
              p.id === playerId 
                ? { ...p, hasAnswered: true, matchScore: (p.matchScore || 0) + data.points }
                : p
            )
          };
        });
        setAnswerResult({
          isCorrect: data.isCorrect,
          points: data.points,
          correctAnswer: data.correctAnswer,
          confidence: data.confidence,
          teamScores: data.teamScores,
        });
        console.log('[QuizGame] Answer result set:', { isCorrect: data.isCorrect, points: data.points });
        setTimeout(() => setAnswerResult(null), 3000);
      } else {
        console.log('[QuizGame] API returned error:', data.error);
        notify(data.error || 'حدث خطأ في إرسال الإجابة');
      }
    } catch (error) {
      console.error('[QuizGame] handleSubmitAnswer error:', error);
      notify('حدث خطأ في الاتصال');
    }
  }, [playerId, room, api, notify]);

  // Next round
  const handleNextRound = useCallback(async () => {
    if (!playerId) return;
    try {
      const data = await api('next-round', { playerId });
      if (data.success) {
        // Reset hasAnswered for all players when moving to next round
        if (data.room) {
          data.room.players = data.room.players.map((p: Player) => ({
            ...p,
            hasAnswered: false
          }));
        }
        setRoom(data.room);
        setAnswerResult(null); // Clear previous answer result
        if (data.gameEnded) {
          notify('انتهت اللعبة!');
        }
      }
    } catch {
      notify('حدث خطأ في الاتصال');
    }
  }, [playerId, api, notify]);

  // Render screens
  if (screen === 'create') {
    return <CreateRoomScreen onBack={() => setScreen('home')} onCreate={handleCreateRoom} playerName={playerName} />;
  }

  if (screen === 'join') {
    return <JoinRoomScreen onBack={() => setScreen('home')} onJoin={handleJoinRoom} publicRooms={publicRooms} loading={loadingRooms} />;
  }

  if (screen === 'lobby' && room) {
    return (
      <>
        <QuizLobbyScreen 
          room={room} 
          playerId={playerId!} 
          onLeave={requestExit} 
          onStart={handleStartGame} 
          isHost={room.hostId === playerId}
          onSwitchTeam={handleSwitchTeam}
          onUpdateTeamName={handleUpdateTeamName}
          onInviteFriend={handleInviteFriend}
          friends={friends}
        />
        <ConfirmModal open={showExitConfirm} title="الخروج من الغرفة؟" message="لو خرجت دلوقتي هتسيب الغرفة ولن تتمكن من الرجوع." confirmLabel="خرج" cancelLabel="كمل" onConfirm={handleLeaveRoom} onCancel={() => setShowExitConfirm(false)} />
      </>
    );
  }

  if (screen === 'game' && room) {
    return (
      <>
        <QuizGameScreen 
          room={room} 
          playerId={playerId!} 
          onAnswer={handleSubmitAnswer} 
          onNextRound={handleNextRound} 
          answerResult={answerResult} 
          earnedXP={earnedXP} 
          onLeave={requestExit}
          onSwitchTeam={handleSwitchTeam}
        />
        <ConfirmModal open={showExitConfirm} title="الخروج من اللعبة؟" message={room.status === 'running' ? "لو خرجت دلوقتي هتسيب اللعبة وخسارتك مضمونة!" : "لو خرجت دلوقتي هتسيب الغرفة."} confirmLabel="خرج" cancelLabel="كمل" onConfirm={handleLeaveRoom} onCancel={() => setShowExitConfirm(false)} />
      </>
    );
  }

  return (
    <>
      <QuizHomeScreen 
        onBack={onBack} 
        onCreateRoom={() => setScreen('create')}
        onJoinRoom={() => setScreen('join')}
      />
      <Toast message={null} />
    </>
  );
}
