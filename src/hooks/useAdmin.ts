'use client';

import { useState, useCallback, useEffect } from 'react';

// Types
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  permissions: string[];
}

interface UserStats {
  total: number;
  online: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
  byDay: Array<{ date: Date; count: number }>;
}

interface GameStats {
  total: number;
  today: number;
  thisWeek: number;
  spyGames: number;
  quizGames: number;
  winRate: number;
  byDay: Array<{ date: Date; count: number }>;
}

interface RoomStats {
  total: number;
  active: number;
}

interface AdminStats {
  users: UserStats;
  games: GameStats;
  rooms: RoomStats;
  topPlayers: Array<{
    id: string;
    name: string;
    gold: number;
    gamesWon: number;
    gamesPlayed: number;
    level: number;
    title: string | null;
  }>;
}

interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  gender: string;
  gold: number;
  level: number;
  title: string | null;
  gamesPlayed: number;
  gamesWon: number;
  isBanned: boolean;
  bannedAt: Date | null;
  bannedReason: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  spyWins: number;
  citizenWins: number;
  currentStreak: number;
  longestStreak: number;
  _count: {
    friends: number;
    gameHistory: number;
  };
}

interface LiveRoom {
  id: string;
  code: string;
  gameType: string;
  hostId: string;
  hostName: string;
  isPublic: boolean;
  status: 'lobby' | 'running' | 'ended';
  playerCount: number;
  maxPlayers: number;
  players: Array<{ id: string; name: string }>;
  gameMode: string | null;
  categoryId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

interface AuditLogItem {
  id: string;
  adminId: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  action: string;
  targetType: string;
  targetId: string | null;
  oldData: any;
  newData: any;
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface UseAdminReturn {
  // Auth state
  admin: AdminUser | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  
  // Stats
  stats: AdminStats | null;
  statsLoading: boolean;
  statsError: string | null;
  
  // Users
  users: AdminUserListItem[];
  usersPagination: { page: number; limit: number; total: number; totalPages: number };
  usersLoading: boolean;
  usersError: string | null;
  
  // Rooms
  rooms: LiveRoom[];
  roomsStats: { total: number; totalPlayers: number; byStatus: Record<string, number> };
  roomsLoading: boolean;
  roomsError: string | null;
  
  // Logs
  logs: AuditLogItem[];
  logsPagination: { page: number; limit: number; total: number; totalPages: number };
  logsFilters: { actions: string[]; targetTypes: string[] };
  logsLoading: boolean;
  logsError: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  verifySession: () => Promise<boolean>;
  fetchStats: () => Promise<void>;
  fetchUsers: (page?: number, search?: string, status?: string) => Promise<void>;
  updateUser: (userId: string, action: string, data?: any) => Promise<boolean>;
  fetchRooms: (gameType?: string, status?: string) => Promise<void>;
  roomAction: (roomId: string, action: string) => Promise<boolean>;
  deleteRoom: (roomId: string) => Promise<boolean>;
  fetchLogs: (filters?: { page?: number; action?: string; targetType?: string; startDate?: string; endDate?: string }) => Promise<void>;
  clearErrors: () => void;
}

// Session storage keys
const SESSION_TOKEN_KEY = 'admin_session_token';
const ADMIN_DATA_KEY = 'admin_data';

export function useAdmin(): UseAdminReturn {
  // Auth state
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Stats state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  
  // Users state
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  
  // Rooms state
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [roomsStats, setRoomsStats] = useState({ total: 0, totalPlayers: 0, byStatus: {} as Record<string, number> });
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  
  // Logs state
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [logsFilters, setLogsFilters] = useState({ actions: [] as string[], targetTypes: [] as string[] });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  
  // Load session from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const storedAdmin = localStorage.getItem(ADMIN_DATA_KEY);
    
    if (storedToken && storedAdmin) {
      try {
        const adminData = JSON.parse(storedAdmin);
        setSessionToken(storedToken);
        setAdmin(adminData);
      } catch {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(ADMIN_DATA_KEY);
      }
    }
  }, []);
  
  // API helper with auth header
  const apiCall = useCallback(async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (sessionToken) {
      headers['x-admin-session'] = sessionToken;
    }
    
    const response = await fetch(`/api/admin${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    return response.json();
  }, [sessionToken]);
  
  // Login
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    
    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAdmin(data.admin);
        setSessionToken(data.sessionToken);
        localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
        localStorage.setItem(ADMIN_DATA_KEY, JSON.stringify(data.admin));
        return true;
      } else {
        setAuthError(data.error || 'فشل تسجيل الدخول');
        return false;
      }
    } catch (error) {
      setAuthError('حدث خطأ في الاتصال');
      return false;
    } finally {
      setAuthLoading(false);
    }
  }, []);
  
  // Logout
  const logout = useCallback(async () => {
    try {
      await apiCall('/auth', 'DELETE');
    } catch {
      // Ignore logout errors
    }
    
    setAdmin(null);
    setSessionToken(null);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(ADMIN_DATA_KEY);
  }, [apiCall]);
  
  // Verify session
  const verifySession = useCallback(async (): Promise<boolean> => {
    if (!sessionToken) return false;
    
    try {
      const data = await apiCall('/auth', 'GET');
      
      if (data.success) {
        setAdmin(data.admin);
        return true;
      } else {
        logout();
        return false;
      }
    } catch {
      logout();
      return false;
    }
  }, [sessionToken, apiCall, logout]);
  
  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    
    try {
      const data = await apiCall('/stats', 'GET');
      
      if (data.success) {
        setStats(data.stats);
      } else {
        setStatsError(data.error || 'فشل تحميل الإحصائيات');
      }
    } catch {
      setStatsError('حدث خطأ في الاتصال');
    } finally {
      setStatsLoading(false);
    }
  }, [apiCall]);
  
  // Fetch users
  const fetchUsers = useCallback(async (page = 1, search = '', status = 'all') => {
    setUsersLoading(true);
    setUsersError(null);
    
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      if (search) params.set('search', search);
      if (status !== 'all') params.set('status', status);
      
      const data = await apiCall(`/users?${params.toString()}`, 'GET');
      
      if (data.success) {
        setUsers(data.users);
        setUsersPagination(data.pagination);
      } else {
        setUsersError(data.error || 'فشل تحميل المستخدمين');
      }
    } catch {
      setUsersError('حدث خطأ في الاتصال');
    } finally {
      setUsersLoading(false);
    }
  }, [apiCall]);
  
  // Update user
  const updateUser = useCallback(async (userId: string, action: string, data?: any): Promise<boolean> => {
    setUsersLoading(true);
    setUsersError(null);
    
    try {
      const response = await apiCall('/users', 'PUT', { userId, action, data });
      
      if (response.success) {
        return true;
      } else {
        setUsersError(response.error || 'فشل تحديث المستخدم');
        return false;
      }
    } catch {
      setUsersError('حدث خطأ في الاتصال');
      return false;
    } finally {
      setUsersLoading(false);
    }
  }, [apiCall]);
  
  // Fetch rooms
  const fetchRooms = useCallback(async (gameType?: string, status?: string) => {
    setRoomsLoading(true);
    setRoomsError(null);
    
    try {
      const params = new URLSearchParams();
      if (gameType) params.set('gameType', gameType);
      if (status) params.set('status', status);
      
      const data = await apiCall(`/rooms?${params.toString()}`, 'GET');
      
      if (data.success) {
        setRooms(data.rooms);
        setRoomsStats(data.stats);
      } else {
        setRoomsError(data.error || 'فشل تحميل الغرف');
      }
    } catch {
      setRoomsError('حدث خطأ في الاتصال');
    } finally {
      setRoomsLoading(false);
    }
  }, [apiCall]);
  
  // Room action
  const roomAction = useCallback(async (roomId: string, action: string): Promise<boolean> => {
    setRoomsLoading(true);
    setRoomsError(null);
    
    try {
      const response = await apiCall('/rooms', 'PUT', { roomId, action });
      
      if (response.success) {
        return true;
      } else {
        setRoomsError(response.error || 'فشل تنفيذ الإجراء');
        return false;
      }
    } catch {
      setRoomsError('حدث خطأ في الاتصال');
      return false;
    } finally {
      setRoomsLoading(false);
    }
  }, [apiCall]);
  
  // Delete room
  const deleteRoom = useCallback(async (roomId: string): Promise<boolean> => {
    setRoomsLoading(true);
    setRoomsError(null);
    
    try {
      const response = await apiCall(`/rooms?roomId=${roomId}`, 'DELETE');
      
      if (response.success) {
        return true;
      } else {
        setRoomsError(response.error || 'فشل حذف الغرفة');
        return false;
      }
    } catch {
      setRoomsError('حدث خطأ في الاتصال');
      return false;
    } finally {
      setRoomsLoading(false);
    }
  }, [apiCall]);
  
  // Fetch logs
  const fetchLogs = useCallback(async (filters?: {
    page?: number;
    action?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    setLogsLoading(true);
    setLogsError(null);
    
    try {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', filters.page.toString());
      if (filters?.action) params.set('action', filters.action);
      if (filters?.targetType) params.set('targetType', filters.targetType);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      
      const data = await apiCall(`/logs?${params.toString()}`, 'GET');
      
      if (data.success) {
        setLogs(data.logs);
        setLogsPagination(data.pagination);
        setLogsFilters(data.filters);
      } else {
        setLogsError(data.error || 'فشل تحميل السجلات');
      }
    } catch {
      setLogsError('حدث خطأ في الاتصال');
    } finally {
      setLogsLoading(false);
    }
  }, [apiCall]);
  
  // Clear errors
  const clearErrors = useCallback(() => {
    setAuthError(null);
    setStatsError(null);
    setUsersError(null);
    setRoomsError(null);
    setLogsError(null);
  }, []);
  
  return {
    // Auth
    admin,
    sessionToken,
    isAuthenticated: !!admin && !!sessionToken,
    authLoading,
    authError,
    
    // Stats
    stats,
    statsLoading,
    statsError,
    
    // Users
    users,
    usersPagination,
    usersLoading,
    usersError,
    
    // Rooms
    rooms,
    roomsStats,
    roomsLoading,
    roomsError,
    
    // Logs
    logs,
    logsPagination,
    logsFilters,
    logsLoading,
    logsError,
    
    // Actions
    login,
    logout,
    verifySession,
    fetchStats,
    fetchUsers,
    updateUser,
    fetchRooms,
    roomAction,
    deleteRoom,
    fetchLogs,
    clearErrors,
  };
}
