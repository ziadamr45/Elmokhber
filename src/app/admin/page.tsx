'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ============================================
// Types & Interfaces
// ============================================

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'moderator';
  status: 'active' | 'banned' | 'suspended';
  createdAt: string;
  lastLogin: string;
  gamesPlayed: number;
  roomsCreated: number;
  gold: number;
  level: number;
  title?: string;
}

interface Room {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  playersCount: number;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  gameType: string;
  createdAt: string;
  isPrivate: boolean;
}

interface Game {
  id: string;
  roomId: string;
  roomName: string;
  players: string[];
  winner: string | null;
  duration: number;
  status: 'ongoing' | 'completed' | 'cancelled';
  startedAt: string;
  endedAt: string | null;
}

interface LogEntry {
  id: string;
  action: string;
  userId: string;
  userName: string;
  targetType: 'user' | 'room' | 'game' | 'system';
  targetId: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalRooms: number;
  activeRooms: number;
  totalGames: number;
  gamesToday: number;
  bannedUsers: number;
  peakConcurrentUsers: number;
}

interface LiveUpdate {
  type: 'user_joined' | 'user_left' | 'room_created' | 'room_ended' | 'game_started' | 'game_ended';
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

interface AuthResponse {
  success: boolean;
  user?: AdminUser;
  token?: string;
  message?: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
}

type ActiveSection = 'dashboard' | 'users' | 'rooms' | 'games' | 'logs';

// ============================================
// Constants
// ============================================

const ARABIC_TEXT = {
  // Login
  loginTitle: '🔐 لوحة تحكم المدير',
  loginSubtitle: 'قم بتسجيل الدخول للوصول إلى لوحة التحكم',
  email: 'البريد الإلكتروني',
  password: 'كلمة المرور',
  loginButton: 'تسجيل الدخول',
  loggingIn: 'جاري تسجيل الدخول...',
  loginError: 'فشل تسجيل الدخول. تحقق من بياناتك.',
  
  // Navigation
  dashboard: 'لوحة التحكم',
  users: 'المستخدمين',
  rooms: 'الغرف',
  games: 'الألعاب',
  logs: 'سجل العمليات',
  liveMonitoring: 'المراقبة المباشرة',
  logout: 'تسجيل الخروج',
  
  // Stats
  totalUsers: 'إجمالي المستخدمين',
  activeUsers: 'المستخدمين النشطين',
  totalRooms: 'إجمالي الغرف',
  activeRooms: 'الغرف النشطة',
  totalGames: 'إجمالي الألعاب',
  gamesToday: 'ألعاب اليوم',
  bannedUsers: 'المستخدمين المحظورين',
  peakUsers: 'ذروة المستخدمين',
  
  // Users
  usersList: 'قائمة المستخدمين',
  searchUsers: 'البحث عن مستخدم...',
  userName: 'الاسم',
  userEmail: 'البريد الإلكتروني',
  userRole: 'الدور',
  userStatus: 'الحالة',
  userJoined: 'تاريخ الانضمام',
  userLastLogin: 'آخر دخول',
  actions: 'الإجراءات',
  edit: 'تعديل',
  ban: 'حظر',
  unban: 'إلغاء الحظر',
  delete: 'حذف',
  suspend: 'تعليق',
  activate: 'تفعيل',
  admin: 'مدير',
  moderator: 'مشرف',
  regularUser: 'مستخدم',
  active: 'نشط',
  banned: 'محظور',
  suspended: 'معلق',
  userGold: 'الذهب',
  userLevel: 'المستوى',
  modifyGold: 'تعديل الذهب',
  addGold: 'إضافة ذهب',
  subtractGold: 'خصم ذهب',
  goldAmount: 'الكمية',
  goldReason: 'السبب',
  currentGold: 'الذهب الحالي',
  goldAdded: 'تمت إضافة الذهب',
  goldSubtracted: 'تم خصم الذهب',
  
  // Rooms
  roomsList: 'قائمة الغرف',
  searchRooms: 'البحث عن غرفة...',
  roomName: 'اسم الغرفة',
  roomHost: 'المضيف',
  roomPlayers: 'اللاعبين',
  roomStatus: 'الحالة',
  roomCreated: 'تاريخ الإنشاء',
  roomType: 'نوع اللعبة',
  viewRoom: 'عرض',
  endRoom: 'إنهاء',
  deleteRoom: 'حذف',
  waiting: 'في الانتظار',
  playing: 'جارية',
  finished: 'منتهية',
  private: 'خاصة',
  public: 'عامة',
  
  // Games
  gamesList: 'قائمة الألعاب',
  searchGames: 'البحث عن لعبة...',
  gameId: 'معرف اللعبة',
  gameRoom: 'الغرفة',
  gamePlayers: 'اللاعبين',
  gameWinner: 'الفائز',
  gameDuration: 'المدة',
  gameStatus: 'الحالة',
  gameStarted: 'بدأت',
  gameEnded: 'انتهت',
  ongoing: 'جارية',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
  noWinner: 'لا يوجد',
  minutes: 'دقيقة',
  
  // Logs
  logsList: 'سجل العمليات',
  searchLogs: 'البحث في السجل...',
  logAction: 'العملية',
  logUser: 'المستخدم',
  logTarget: 'الهدف',
  logDetails: 'التفاصيل',
  logTime: 'الوقت',
  logIP: 'عنوان IP',
  refreshLogs: 'تحديث',
  
  // Live Updates
  liveUpdates: 'التحديثات المباشرة',
  noUpdates: 'لا توجد تحديثات حالياً',
  connected: 'متصل',
  disconnected: 'غير متصل',
  
  // Confirmations
  confirmDelete: 'هل أنت متأكد من الحذف؟',
  confirmBan: 'هل أنت متأكد من حظر هذا المستخدم؟',
  confirmAction: 'تأكيد',
  cancel: 'إلغاء',
  
  // Misc
  loading: 'جاري التحميل...',
  noData: 'لا توجد بيانات',
  error: 'حدث خطأ',
  retry: 'إعادة المحاولة',
  save: 'حفظ',
  close: 'إغلاق',
  filterAll: 'الكل',
  filter: 'تصفية',
  export: 'تصدير',
  welcome: 'مرحباً',
  lastUpdate: 'آخر تحديث',
  justNow: 'الآن',
  minutesAgo: 'منذ دقائق',
  hoursAgo: 'منذ ساعات',
} as const;

// ============================================
// Helper Functions
// ============================================

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} ${ARABIC_TEXT.minutes}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
};

const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return ARABIC_TEXT.justNow;
  if (diffMins < 60) return `${diffMins} ${ARABIC_TEXT.minutesAgo}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} ${ARABIC_TEXT.hoursAgo}`;
  return formatDate(dateString);
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
    case 'waiting':
    case 'ongoing':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'banned':
    case 'cancelled':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'suspended':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'playing':
    case 'completed':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'finished':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const getRoleColor = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'moderator':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'user':
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

// ============================================
// Loading Spinner Component
// ============================================

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; text?: string }> = ({ 
  size = 'md', 
  text 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div 
        className={`${sizeClasses[size]} border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin`}
      />
      {text && <p className="text-slate-400 text-sm">{text}</p>}
    </div>
  );
};

// ============================================
// Login Component
// ============================================

const LoginPage: React.FC<{
  onLogin: (email: string, password: string) => Promise<void>;
  error: string;
  loading: boolean;
}> = ({ onLogin, error, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (!email.trim() || !password.trim()) {
      setLocalError('يرجى ملء جميع الحقول');
      return;
    }
    
    try {
      await onLogin(email, password);
    } catch {
      setLocalError(ARABIC_TEXT.loginError);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md relative backdrop-blur-xl bg-slate-900/80 border-slate-700/50 shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/25">
            <span className="text-4xl">🔐</span>
          </div>
          <CardTitle className="text-2xl font-bold text-white mb-1">
            {ARABIC_TEXT.loginTitle}
          </CardTitle>
          <p className="text-slate-400 text-sm">
            {ARABIC_TEXT.loginSubtitle}
          </p>
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">
                {ARABIC_TEXT.email}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20 h-12 text-right"
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 block">
                {ARABIC_TEXT.password}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20 h-12 text-right"
                disabled={loading}
              />
            </div>
            
            {(error || localError) && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error || localError}</span>
              </div>
            )}
            
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white font-medium shadow-lg shadow-cyan-500/25 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  <span>{ARABIC_TEXT.loggingIn}</span>
                </div>
              ) : (
                <span>{ARABIC_TEXT.loginButton}</span>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// Stats Card Component
// ============================================

const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: string;
  trend?: { value: number; up: boolean };
  color: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose';
}> = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
    rose: 'from-rose-500/20 to-rose-600/5 border-rose-500/20 text-rose-400',
  };

  const iconBgClasses = {
    cyan: 'bg-cyan-500/20',
    emerald: 'bg-emerald-500/20',
    amber: 'bg-amber-500/20',
    purple: 'bg-purple-500/20',
    rose: 'bg-rose-500/20',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm hover:scale-[1.02] transition-transform duration-300`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-slate-400 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold text-white">{(value ?? 0).toLocaleString('ar-SA')}</p>
            {trend && (
              <p className={`text-xs flex items-center gap-1 ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
                <span>{trend.up ? '↑' : '↓'}</span>
                <span>{Math.abs(trend.value)}% هذا الأسبوع</span>
              </p>
            )}
          </div>
          <div className={`w-14 h-14 rounded-xl ${iconBgClasses[color]} flex items-center justify-center text-2xl`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// Sidebar Component
// ============================================

const Sidebar: React.FC<{
  activeSection: ActiveSection;
  setActiveSection: (section: ActiveSection) => void;
}> = ({ activeSection, setActiveSection }) => {
  const navItems: { id: ActiveSection; label: string; icon: string }[] = [
    { id: 'dashboard', label: ARABIC_TEXT.dashboard, icon: '📊' },
    { id: 'users', label: ARABIC_TEXT.users, icon: '👥' },
    { id: 'rooms', label: ARABIC_TEXT.rooms, icon: '🏠' },
    { id: 'games', label: ARABIC_TEXT.games, icon: '🎮' },
    { id: 'logs', label: ARABIC_TEXT.logs, icon: '📋' },
  ];

  return (
    <aside className="w-64 bg-slate-900/80 backdrop-blur-xl border-l border-slate-700/50 flex flex-col">
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <span className="text-xl">⚙️</span>
          </div>
          <div>
            <h1 className="font-bold text-white">لوحة الإدارة</h1>
            <p className="text-xs text-slate-400">نظام التحكم</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-right ${
              activeSection === item.id
                ? 'bg-gradient-to-r from-cyan-500/20 to-transparent text-cyan-400 border-r-2 border-cyan-500'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      
      <div className="p-4 border-t border-slate-700/50">
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-xs text-slate-400">نصيحة</p>
              <p className="text-xs text-cyan-400">يمكنك استخدام البحث للعثور السريع</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ============================================
// Users Section Component
// ============================================

const UsersSection: React.FC<{
  users: User[];
  loading: boolean;
  onUpdateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onResetPassword: (userId: string, newPassword: string) => Promise<void>;
  onModifyGold: (userId: string, amount: number, reason: string) => Promise<void>;
  onRefresh: () => void;
}> = ({ users, loading, onUpdateUser, onDeleteUser, onResetPassword, onModifyGold, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState<string | null>(null);
  const [showGoldDialog, setShowGoldDialog] = useState<User | null>(null);
  const [goldAmount, setGoldAmount] = useState('');
  const [goldReason, setGoldReason] = useState('');
  const [goldAction, setGoldAction] = useState<'add' | 'subtract'>('add');

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = async (action: string, userId: string, data?: Partial<User>) => {
    setActionLoading(userId);
    try {
      switch (action) {
        case 'ban':
          await onUpdateUser(userId, { status: 'banned' });
          break;
        case 'unban':
          await onUpdateUser(userId, { status: 'active' });
          break;
        case 'suspend':
          await onUpdateUser(userId, { status: 'suspended' });
          break;
        case 'activate':
          await onUpdateUser(userId, { status: 'active' });
          break;
        case 'delete':
          await onDeleteUser(userId);
          setShowConfirmDelete(null);
          break;
        case 'update':
          if (data) await onUpdateUser(userId, data);
          break;
        case 'resetPassword':
          if (newPassword && newPassword.length >= 6) {
            await onResetPassword(userId, newPassword);
            setNewPassword('');
            setShowPasswordDialog(null);
          }
          break;
        case 'modifyGold':
          const amount = parseInt(goldAmount);
          if (!isNaN(amount) && amount > 0 && goldReason.trim()) {
            const finalAmount = goldAction === 'subtract' ? -amount : amount;
            await onModifyGold(userId, finalAmount, goldReason);
            setGoldAmount('');
            setGoldReason('');
            setShowGoldDialog(null);
          }
          break;
      }
      onRefresh();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
      setSelectedUser(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>👥</span>
          {ARABIC_TEXT.usersList}
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={ARABIC_TEXT.searchUsers}
              className="w-64 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">{ARABIC_TEXT.filterAll}</option>
            <option value="active">{ARABIC_TEXT.active}</option>
            <option value="banned">{ARABIC_TEXT.banned}</option>
            <option value="suspended">{ARABIC_TEXT.suspended}</option>
          </select>
          
          <Button
            onClick={onRefresh}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            🔄
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner text={ARABIC_TEXT.loading} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p>{ARABIC_TEXT.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.userName}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.userEmail}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.userGold}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.userStatus}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.userJoined}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8 border-2 border-slate-700">
                            <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-teal-600 text-white text-sm">
                              {user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-white font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">{user.email}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 text-lg">🪙</span>
                          <span className="text-amber-400 font-bold">{(user.gold ?? 0).toLocaleString('ar-SA')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={`${getStatusColor(user.status)} border`}>
                          {user.status === 'active' ? ARABIC_TEXT.active : user.status === 'banned' ? ARABIC_TEXT.banned : ARABIC_TEXT.suspended}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedUser(user)}
                            className="text-slate-400 hover:text-white hover:bg-slate-800"
                            title="تعديل"
                          >
                            ✏️
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowPasswordDialog(user.id)}
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            title="تغيير كلمة المرور"
                          >
                            🔑
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowGoldDialog(user)}
                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                            title="تعديل الذهب"
                          >
                            🪙
                          </Button>
                          {user.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction('ban', user.id)}
                              disabled={actionLoading === user.id}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              title="حظر"
                            >
                              🚫
                            </Button>
                          )}
                          {user.status === 'banned' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAction('unban', user.id)}
                              disabled={actionLoading === user.id}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              title="إلغاء الحظر"
                            >
                              ✓
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowConfirmDelete(user.id)}
                            disabled={actionLoading === user.id}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="حذف"
                          >
                            🗑️
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span>🔑</span>
                تغيير كلمة المرور
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">كلمة المرور الجديدة</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور جديدة (6 أحرف على الأقل)"
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleAction('resetPassword', showPasswordDialog)}
                  disabled={actionLoading === showPasswordDialog || newPassword.length < 6}
                  className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600"
                >
                  تغيير كلمة المرور
                </Button>
                <Button
                  onClick={() => { setShowPasswordDialog(null); setNewPassword(''); }}
                  variant="outline"
                  className="flex-1 border-slate-700"
                >
                  {ARABIC_TEXT.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <span className="text-5xl mb-4 block">⚠️</span>
                <h3 className="text-xl font-bold text-white mb-2">{ARABIC_TEXT.confirmDelete}</h3>
                <p className="text-slate-400">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAction('delete', showConfirmDelete)}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  {ARABIC_TEXT.confirmAction}
                </Button>
                <Button
                  onClick={() => setShowConfirmDelete(null)}
                  variant="outline"
                  className="flex-1 border-slate-700"
                >
                  {ARABIC_TEXT.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gold Modification Dialog */}
      {showGoldDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span>🪙</span>
                {ARABIC_TEXT.modifyGold}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <span className="text-slate-400">{ARABIC_TEXT.currentGold}</span>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-lg">🪙</span>
                  <span className="text-amber-400 font-bold text-xl">{(showGoldDialog.gold ?? 0).toLocaleString('ar-SA')}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={() => setGoldAction('add')}
                  className={`flex-1 ${goldAction === 'add' ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  ➕ {ARABIC_TEXT.addGold}
                </Button>
                <Button
                  onClick={() => setGoldAction('subtract')}
                  className={`flex-1 ${goldAction === 'subtract' ? 'bg-red-500' : 'bg-slate-700'}`}
                >
                  ➖ {ARABIC_TEXT.subtractGold}
                </Button>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">{ARABIC_TEXT.goldAmount}</label>
                <Input
                  type="number"
                  value={goldAmount}
                  onChange={(e) => setGoldAmount(e.target.value)}
                  placeholder="أدخل الكمية"
                  className="bg-slate-800/50 border-slate-700 text-white"
                  min="1"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-slate-400">{ARABIC_TEXT.goldReason}</label>
                <Input
                  value={goldReason}
                  onChange={(e) => setGoldReason(e.target.value)}
                  placeholder="أدخل سبب التعديل"
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleAction('modifyGold', showGoldDialog.id)}
                  disabled={actionLoading === showGoldDialog.id || !goldAmount || parseInt(goldAmount) <= 0 || !goldReason.trim()}
                  className={`flex-1 ${goldAction === 'add' ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}
                >
                  {goldAction === 'add' ? ARABIC_TEXT.addGold : ARABIC_TEXT.subtractGold}
                </Button>
                <Button
                  onClick={() => { setShowGoldDialog(null); setGoldAmount(''); setGoldReason(''); }}
                  variant="outline"
                  className="flex-1 border-slate-700"
                >
                  {ARABIC_TEXT.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Dialog */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span>✏️</span>
                {ARABIC_TEXT.edit}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">{ARABIC_TEXT.userName}</label>
                <Input
                  value={selectedUser.name}
                  onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-400">{ARABIC_TEXT.userRole}</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value as User['role'] })}
                  className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2"
                >
                  <option value="user">{ARABIC_TEXT.regularUser}</option>
                  <option value="moderator">{ARABIC_TEXT.moderator}</option>
                  <option value="admin">{ARABIC_TEXT.admin}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleAction('update', selectedUser.id, selectedUser)}
                  disabled={actionLoading === selectedUser.id}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-teal-600"
                >
                  {ARABIC_TEXT.save}
                </Button>
                <Button
                  onClick={() => setSelectedUser(null)}
                  variant="outline"
                  className="flex-1 border-slate-700"
                >
                  {ARABIC_TEXT.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================
// Rooms Section Component
// ============================================

const RoomsSection: React.FC<{
  rooms: Room[];
  loading: boolean;
  onRoomAction: (roomId: string, action: string) => Promise<void>;
  onDeleteRoom: (roomId: string) => Promise<void>;
  onRefresh: () => void;
}> = ({ rooms, loading, onRoomAction, onDeleteRoom, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.hostName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAction = async (action: string, roomId: string) => {
    setActionLoading(roomId);
    try {
      if (action === 'delete') {
        await onDeleteRoom(roomId);
        setShowConfirmDelete(null);
      } else {
        await onRoomAction(roomId, action);
      }
      onRefresh();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🏠</span>
          {ARABIC_TEXT.roomsList}
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={ARABIC_TEXT.searchRooms}
              className="w-64 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">{ARABIC_TEXT.filterAll}</option>
            <option value="waiting">{ARABIC_TEXT.waiting}</option>
            <option value="playing">{ARABIC_TEXT.playing}</option>
            <option value="finished">{ARABIC_TEXT.finished}</option>
          </select>
          
          <Button
            onClick={onRefresh}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            🔄
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner text={ARABIC_TEXT.loading} />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p>{ARABIC_TEXT.noData}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredRooms.map((room) => (
                <Card key={room.id} className="bg-slate-800/50 border-slate-700/50 hover:border-cyan-500/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{room.isPrivate ? '🔒' : '🌐'}</span>
                        <h3 className="font-bold text-white">{room.name}</h3>
                      </div>
                      <Badge className={`${getStatusColor(room.status)} border text-xs`}>
                        {room.status === 'waiting' ? ARABIC_TEXT.waiting : room.status === 'playing' ? ARABIC_TEXT.playing : ARABIC_TEXT.finished}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm text-slate-400 mb-4">
                      <div className="flex items-center justify-between">
                        <span>👤 {ARABIC_TEXT.roomHost}</span>
                        <span className="text-white">{room.hostName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>👥 {ARABIC_TEXT.roomPlayers}</span>
                        <span className="text-cyan-400">{room.playersCount}/{room.maxPlayers}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>🎮 {ARABIC_TEXT.roomType}</span>
                        <span className="text-white">{room.gameType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>📅 {ARABIC_TEXT.roomCreated}</span>
                        <span className="text-white">{getRelativeTime(room.createdAt)}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-3 border-t border-slate-700/50">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        👁️ {ARABIC_TEXT.viewRoom}
                      </Button>
                      {room.status === 'playing' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction('end', room.id)}
                          disabled={actionLoading === room.id}
                          className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                        >
                          ⏹️ {ARABIC_TEXT.endRoom}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowConfirmDelete(room.id)}
                        disabled={actionLoading === room.id}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        🗑️
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-slate-900 border-slate-700">
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <span className="text-5xl mb-4 block">⚠️</span>
                <h3 className="text-xl font-bold text-white mb-2">{ARABIC_TEXT.confirmDelete}</h3>
                <p className="text-slate-400">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleAction('delete', showConfirmDelete)}
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  {ARABIC_TEXT.confirmAction}
                </Button>
                <Button
                  onClick={() => setShowConfirmDelete(null)}
                  variant="outline"
                  className="flex-1 border-slate-700"
                >
                  {ARABIC_TEXT.cancel}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================
// Games Section Component
// ============================================

const GamesSection: React.FC<{
  games: Game[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ games, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredGames = games.filter((game) => {
    const matchesSearch = game.roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      game.players.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || game.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🎮</span>
          {ARABIC_TEXT.gamesList}
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={ARABIC_TEXT.searchGames}
              className="w-64 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">{ARABIC_TEXT.filterAll}</option>
            <option value="ongoing">{ARABIC_TEXT.ongoing}</option>
            <option value="completed">{ARABIC_TEXT.completed}</option>
            <option value="cancelled">{ARABIC_TEXT.cancelled}</option>
          </select>
          
          <Button
            onClick={onRefresh}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            🔄
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner text={ARABIC_TEXT.loading} />
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p>{ARABIC_TEXT.noData}</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gameId}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gameRoom}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gamePlayers}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gameWinner}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gameDuration}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gameStatus}</th>
                    <th className="text-right px-6 py-4 text-sm font-medium text-slate-300">{ARABIC_TEXT.gameStarted}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.map((game) => (
                    <tr key={game.id} className="border-b border-slate-700/30 hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-cyan-400">#{game.id.slice(-6)}</td>
                      <td className="px-6 py-4 text-white">{game.roomName}</td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2 space-x-reverse">
                          {game.players.slice(0, 3).map((player, i) => (
                            <Avatar key={i} className="w-6 h-6 border-2 border-slate-900">
                              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-teal-600 text-white text-xs">
                                {player.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {game.players.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-slate-700 border-2 border-slate-900 flex items-center justify-center text-xs text-slate-400">
                              +{game.players.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {game.winner ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            🏆 {game.winner}
                          </span>
                        ) : (
                          <span className="text-slate-500">{ARABIC_TEXT.noWinner}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{formatDuration(game.duration)}</td>
                      <td className="px-6 py-4">
                        <Badge className={`${getStatusColor(game.status)} border`}>
                          {game.status === 'ongoing' ? ARABIC_TEXT.ongoing : game.status === 'completed' ? ARABIC_TEXT.completed : ARABIC_TEXT.cancelled}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{getRelativeTime(game.startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// Logs Section Component
// ============================================

const LogsSection: React.FC<{
  logs: LogEntry[];
  loading: boolean;
  onRefresh: () => void;
}> = ({ logs, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || log.targetType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getLogIcon = (type: string): string => {
    switch (type) {
      case 'user': return '👤';
      case 'room': return '🏠';
      case 'game': return '🎮';
      case 'system': return '⚙️';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>📋</span>
          {ARABIC_TEXT.logsList}
        </h2>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={ARABIC_TEXT.searchLogs}
              className="w-64 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-800/50 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">{ARABIC_TEXT.filterAll}</option>
            <option value="user">{ARABIC_TEXT.users}</option>
            <option value="room">{ARABIC_TEXT.rooms}</option>
            <option value="game">{ARABIC_TEXT.games}</option>
            <option value="system">النظام</option>
          </select>
          
          <Button
            onClick={onRefresh}
            className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700"
          >
            🔄 {ARABIC_TEXT.refreshLogs}
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LoadingSpinner text={ARABIC_TEXT.loading} />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p>{ARABIC_TEXT.noData}</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
              <div className="divide-y divide-slate-700/30">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg flex-shrink-0">
                        {getLogIcon(log.targetType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-white">{log.userName}</span>
                          <Badge className={`${getRoleColor('user')} border text-xs`}>
                            {log.action}
                          </Badge>
                        </div>
                        <p className="text-slate-400 text-sm mb-2">{log.details}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <span>🎯</span>
                            {log.targetType === 'user' ? ARABIC_TEXT.users : log.targetType === 'room' ? ARABIC_TEXT.rooms : log.targetType === 'game' ? ARABIC_TEXT.games : 'النظام'}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>📍</span>
                            {log.ipAddress}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>🕐</span>
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================
// Live Updates Component
// ============================================

const LiveUpdates: React.FC<{
  updates: LiveUpdate[];
  connected: boolean;
}> = ({ updates, connected }) => {
  const getUpdateIcon = (type: string): string => {
    switch (type) {
      case 'user_joined': return '👋';
      case 'user_left': return '🚪';
      case 'room_created': return '🏠';
      case 'room_ended': return '🏁';
      case 'game_started': return '🎮';
      case 'game_ended': return '🏆';
      default: return '📡';
    }
  };

  const getUpdateColor = (type: string): string => {
    switch (type) {
      case 'user_joined':
      case 'room_created':
      case 'game_started':
        return 'border-emerald-500/30 bg-emerald-500/5';
      case 'user_left':
      case 'room_ended':
        return 'border-amber-500/30 bg-amber-500/5';
      case 'game_ended':
        return 'border-cyan-500/30 bg-cyan-500/5';
      default:
        return 'border-slate-500/30 bg-slate-500/5';
    }
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <span>📡</span>
            {ARABIC_TEXT.liveUpdates}
          </CardTitle>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            connected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            {connected ? ARABIC_TEXT.connected : ARABIC_TEXT.disconnected}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {updates.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <span className="text-2xl block mb-2">📭</span>
              <p className="text-sm">{ARABIC_TEXT.noUpdates}</p>
            </div>
          ) : (
            updates.slice(0, 20).map((update, index) => (
              <div
                key={`${update.timestamp}-${index}`}
                className={`p-3 rounded-lg border ${getUpdateColor(update.type)} text-sm`}
              >
                <div className="flex items-center gap-2">
                  <span>{getUpdateIcon(update.type)}</span>
                  <span className="text-white">{update.message}</span>
                </div>
                <span className="text-xs text-slate-500 block mt-1">
                  {getRelativeTime(update.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// Dashboard Overview Component
// ============================================

const DashboardOverview: React.FC<{
  stats: Stats;
  liveUpdates: LiveUpdate[];
  connected: boolean;
}> = ({ stats, liveUpdates, connected }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>📊</span>
          {ARABIC_TEXT.dashboard}
        </h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={ARABIC_TEXT.totalUsers}
          value={stats.totalUsers}
          icon="👥"
          color="cyan"
          trend={{ value: 12, up: true }}
        />
        <StatsCard
          title={ARABIC_TEXT.activeRooms}
          value={stats.activeRooms}
          icon="🏠"
          color="emerald"
          trend={{ value: 5, up: true }}
        />
        <StatsCard
          title={ARABIC_TEXT.gamesToday}
          value={stats.gamesToday}
          icon="🎮"
          color="purple"
          trend={{ value: 8, up: true }}
        />
        <StatsCard
          title={ARABIC_TEXT.bannedUsers}
          value={stats.bannedUsers}
          icon="🚫"
          color="rose"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title={ARABIC_TEXT.activeUsers}
          value={stats.activeUsers}
          icon="🟢"
          color="emerald"
        />
        <StatsCard
          title={ARABIC_TEXT.totalRooms}
          value={stats.totalRooms}
          icon="🏢"
          color="cyan"
        />
        <StatsCard
          title={ARABIC_TEXT.totalGames}
          value={stats.totalGames}
          icon="🕹️"
          color="purple"
        />
        <StatsCard
          title={ARABIC_TEXT.peakUsers}
          value={stats.peakConcurrentUsers}
          icon="📈"
          color="amber"
        />
      </div>

      {/* Live Updates */}
      <LiveUpdates updates={liveUpdates} connected={connected} />
    </div>
  );
};

// ============================================
// Main Admin Panel Component
// ============================================

export default function AdminPanel() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  
  // UI State
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data State
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalRooms: 0,
    activeRooms: 0,
    totalGames: 0,
    gamesToday: 0,
    bannedUsers: 0,
    peakConcurrentUsers: 0,
  });
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  
  // Loading States
  const [statsLoading, setStatsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Socket State
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // ============================================
  // API Functions
  // ============================================

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('adminToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (response.status === 401) {
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
      setAdminUser(null);
      throw new Error('Unauthorized');
    }
    
    return response;
  }, []);

  const verifySession = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/admin/auth');
      const data: AuthResponse = await response.json();
      
      if (data.success && data.user) {
        setAdminUser(data.user);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('adminToken');
        setIsAuthenticated(false);
        setAdminUser(null);
      }
    } catch {
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
      setAdminUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, [fetchWithAuth]);

  const login = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError('');
    
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data: AuthResponse = await response.json();
      
      if (data.success && data.token && data.user) {
        localStorage.setItem('adminToken', data.token);
        setAdminUser(data.user);
        setIsAuthenticated(true);
        setAuthError('');
      } else {
        setAuthError(data.message || ARABIC_TEXT.loginError);
      }
    } catch {
      setAuthError(ARABIC_TEXT.loginError);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchWithAuth('/api/admin/auth', { method: 'DELETE' });
    } finally {
      localStorage.removeItem('adminToken');
      setIsAuthenticated(false);
      setAdminUser(null);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    }
  }, [fetchWithAuth]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetchWithAuth('/api/admin/stats');
      const data = await response.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const response = await fetchWithAuth('/api/admin/users');
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const response = await fetchWithAuth('/api/admin/rooms');
      const data = await response.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setRoomsLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchGames = useCallback(async () => {
    setGamesLoading(true);
    try {
      const response = await fetchWithAuth('/api/admin/games');
      const data = await response.json();
      if (data.games) {
        setGames(data.games);
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setGamesLoading(false);
    }
  }, [fetchWithAuth]);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const response = await fetchWithAuth('/api/admin/logs');
      const data = await response.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }, [fetchWithAuth]);

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    const response = await fetchWithAuth('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({ userId, updates }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to update user');
    }
  }, [fetchWithAuth]);

  const deleteUser = useCallback(async (userId: string) => {
    const response = await fetchWithAuth('/api/admin/users', {
      method: 'DELETE',
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete user');
    }
  }, [fetchWithAuth]);

  const resetUserPassword = useCallback(async (userId: string, newPassword: string) => {
    const response = await fetchWithAuth('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({ userId, action: 'resetPassword', data: { newPassword } }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to reset password');
    }
    return data;
  }, [fetchWithAuth]);

  const modifyUserGold = useCallback(async (userId: string, amount: number, reason: string) => {
    const response = await fetchWithAuth('/api/admin/users', {
      method: 'PUT',
      body: JSON.stringify({ userId, action: 'modifyGold', data: { amount, reason } }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to modify gold');
    }
    return data;
  }, [fetchWithAuth]);

  const roomAction = useCallback(async (roomId: string, action: string) => {
    const response = await fetchWithAuth('/api/admin/rooms', {
      method: 'PUT',
      body: JSON.stringify({ roomId, action }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to perform action');
    }
  }, [fetchWithAuth]);

  const deleteRoom = useCallback(async (roomId: string) => {
    const response = await fetchWithAuth('/api/admin/rooms', {
      method: 'DELETE',
      body: JSON.stringify({ roomId }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete room');
    }
  }, [fetchWithAuth]);

  // ============================================
  // Effects
  // ============================================

  // Verify session on mount
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Initialize socket connection when authenticated
  useEffect(() => {
    if (isAuthenticated && adminUser) {
      const socket = io('/', {
        transports: ['websocket', 'polling'],
        query: { XTransformPort: '3020' },
      });

      socket.on('connect', () => {
        setSocketConnected(true);
        console.log('Socket connected to admin service');
        // Authenticate with admin info
        socket.emit('authenticate', {
          adminId: adminUser.id,
          adminName: adminUser.name,
          role: adminUser.role
        });
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
        console.log('Socket disconnected from admin service');
      });

      socket.on('authenticated', (data: { success: boolean; stats?: Stats }) => {
        console.log('Admin authenticated:', data.success);
        if (data.stats) {
          setStats(data.stats);
        }
      });

      socket.on('stats-update', (newStats: Partial<Stats>) => {
        setStats((prev) => ({ ...prev, ...newStats }));
      });

      // Live update events from admin service
      socket.on('user-banned', (data: LiveUpdate) => {
        setLiveUpdates((prev) => [data, ...prev].slice(0, 50));
      });

      socket.on('room-created', (data: LiveUpdate) => {
        setLiveUpdates((prev) => [data, ...prev].slice(0, 50));
      });

      socket.on('room-ended', (data: LiveUpdate) => {
        setLiveUpdates((prev) => [data, ...prev].slice(0, 50));
      });

      socket.on('game-started', (data: LiveUpdate) => {
        setLiveUpdates((prev) => [data, ...prev].slice(0, 50));
      });

      socket.on('game-ended', (data: LiveUpdate) => {
        setLiveUpdates((prev) => [data, ...prev].slice(0, 50));
      });

      // Request stats every 30 seconds
      const statsInterval = setInterval(() => {
        socket.emit('request-stats');
      }, 30000);

      socketRef.current = socket;

      return () => {
        clearInterval(statsInterval);
        socket.disconnect();
      };
    }
  }, [isAuthenticated, adminUser]);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchUsers();
      fetchRooms();
      fetchGames();
      fetchLogs();
    }
  }, [isAuthenticated, fetchStats, fetchUsers, fetchRooms, fetchGames, fetchLogs]);

  // Fetch section-specific data when section changes
  useEffect(() => {
    if (isAuthenticated) {
      switch (activeSection) {
        case 'users':
          if (users.length === 0) fetchUsers();
          break;
        case 'rooms':
          if (rooms.length === 0) fetchRooms();
          break;
        case 'games':
          if (games.length === 0) fetchGames();
          break;
        case 'logs':
          if (logs.length === 0) fetchLogs();
          break;
      }
    }
  }, [activeSection, isAuthenticated, users.length, rooms.length, games.length, logs.length, fetchUsers, fetchRooms, fetchGames, fetchLogs]);

  // ============================================
  // Render
  // ============================================

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center" dir="rtl">
        <LoadingSpinner size="lg" text={ARABIC_TEXT.loading} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        error={authError}
        loading={authLoading}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" dir="rtl">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        {sidebarOpen && (
          <Sidebar
            activeSection={activeSection}
            setActiveSection={setActiveSection}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6 sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {sidebarOpen ? '◀' : '▶'}
              </Button>
              <div className="h-6 w-px bg-slate-700" />
              <h1 className="text-lg font-semibold text-white">
                {activeSection === 'dashboard' && ARABIC_TEXT.dashboard}
                {activeSection === 'users' && ARABIC_TEXT.users}
                {activeSection === 'rooms' && ARABIC_TEXT.rooms}
                {activeSection === 'games' && ARABIC_TEXT.games}
                {activeSection === 'logs' && ARABIC_TEXT.logs}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                socketConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {socketConnected ? ARABIC_TEXT.connected : ARABIC_TEXT.disconnected}
              </div>

              {/* Admin Info */}
              {adminUser && (
                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">{adminUser.name}</p>
                    <p className="text-xs text-slate-400">{adminUser.email}</p>
                  </div>
                  <Avatar className="w-10 h-10 border-2 border-cyan-500/30">
                    <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
                      {adminUser.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              {/* Logout Button */}
              <Button
                onClick={logout}
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
              >
                🚪 {ARABIC_TEXT.logout}
              </Button>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 p-6 overflow-auto">
            {activeSection === 'dashboard' && (
              <DashboardOverview
                stats={stats}
                liveUpdates={liveUpdates}
                connected={socketConnected}
              />
            )}

            {activeSection === 'users' && (
              <UsersSection
                users={users}
                loading={usersLoading}
                onUpdateUser={updateUser}
                onDeleteUser={deleteUser}
                onResetPassword={resetUserPassword}
                onModifyGold={modifyUserGold}
                onRefresh={fetchUsers}
              />
            )}

            {activeSection === 'rooms' && (
              <RoomsSection
                rooms={rooms}
                loading={roomsLoading}
                onRoomAction={roomAction}
                onDeleteRoom={deleteRoom}
                onRefresh={fetchRooms}
              />
            )}

            {activeSection === 'games' && (
              <GamesSection
                games={games}
                loading={gamesLoading}
                onRefresh={fetchGames}
              />
            )}

            {activeSection === 'logs' && (
              <LogsSection
                logs={logs}
                loading={logsLoading}
                onRefresh={fetchLogs}
              />
            )}
          </main>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
    </div>
  );
}
