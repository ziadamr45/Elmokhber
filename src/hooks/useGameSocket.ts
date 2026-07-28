'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

interface Room {
  code: string;
  isPublic: boolean;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  status: 'lobby' | 'running' | 'ended';
  settings: GameSettings;
  players: Player[];
  game: Game | null;
}

interface PublicRoom {
  code: string;
  hostName: string;
  playerCount: number;
  settings: GameSettings;
  createdAt: number;
}

interface UseGameSocketOptions {
  serverUrl?: string;
  serverPort?: number;
  sessionToken?: string;
  onRoomCreated?: (room: Room, playerId: string) => void;
  onRoomJoined?: (room: Room, playerId: string) => void;
  onRoomUpdate?: (room: Room) => void;
  onRoomClosed?: (roomCode: string, reason: string) => void;
  onPlayerLeft?: (playerId: string, playerName: string, room: Room) => void;
  onPlayerJoined?: (player: Player, room: Room) => void;
  onPublicRooms?: (rooms: PublicRoom[]) => void;
  onRoleRevealed?: (data: {
    isSpy: boolean;
    isKnower: boolean;
    secretWord: string | null;
    partnerSpyName: string | null;
    gameMode: string;
    category?: { id: string; name: string; icon: string };
  }) => void;
  onGuessResult?: (success: boolean) => void;
  onError?: (message: string) => void;
  onRoomLeft?: (roomCode: string) => void;
  onConnected?: (id: string) => void;
  onAuthError?: (reason: string) => void;
}

export function useGameSocket(options: UseGameSocketOptions = {}) {
  const {
    serverUrl,
    serverPort = 3003,
    sessionToken,
    onRoomCreated,
    onRoomJoined,
    onRoomUpdate,
    onRoomClosed,
    onPlayerLeft,
    onPlayerJoined,
    onPublicRooms,
    onRoleRevealed,
    onGuessResult,
    onError,
    onRoomLeft,
    onConnected,
    onAuthError,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);

  // ===== Stable refs to avoid re-triggering socket effect on every render =====
  // These refs hold the latest values of callbacks and sessionToken so that
  // the socket setup effect only runs once (on mount) instead of every render.
  const sessionTokenRef = useRef(sessionToken);
  const onConnectedRef = useRef(onConnected);
  const onRoomCreatedRef = useRef(onRoomCreated);
  const onRoomJoinedRef = useRef(onRoomJoined);
  const onRoomUpdateRef = useRef(onRoomUpdate);
  const onRoomClosedRef = useRef(onRoomClosed);
  const onPlayerLeftRef = useRef(onPlayerLeft);
  const onPlayerJoinedRef = useRef(onPlayerJoined);
  const onPublicRoomsRef = useRef(onPublicRooms);
  const onRoleRevealedRef = useRef(onRoleRevealed);
  const onGuessResultRef = useRef(onGuessResult);
  const onErrorRef = useRef(onError);
  const onRoomLeftRef = useRef(onRoomLeft);
  const onAuthErrorRef = useRef(onAuthError);

  // Keep refs in sync with latest props on every render
  sessionTokenRef.current = sessionToken;
  onConnectedRef.current = onConnected;
  onRoomCreatedRef.current = onRoomCreated;
  onRoomJoinedRef.current = onRoomJoined;
  onRoomUpdateRef.current = onRoomUpdate;
  onRoomClosedRef.current = onRoomClosed;
  onPlayerLeftRef.current = onPlayerLeft;
  onPlayerJoinedRef.current = onPlayerJoined;
  onPublicRoomsRef.current = onPublicRooms;
  onRoleRevealedRef.current = onRoleRevealed;
  onGuessResultRef.current = onGuessResult;
  onErrorRef.current = onError;
  onRoomLeftRef.current = onRoomLeft;
  onAuthErrorRef.current = onAuthError;

  // Initialize socket connection
  useEffect(() => {
    if (socketRef.current) return;

    console.log('[GameSocket] Connecting to server...');

    // Use Railway URL if provided, otherwise fall back to local dev (same origin with XTransformPort)
    const socket = serverUrl
      ? io(serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        })
      : io('/?XTransformPort=' + serverPort, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

    socketRef.current = socket;

    // Helper to send authentication using the latest sessionToken
    const sendAuth = () => {
      const token = sessionTokenRef.current;
      if (token) {
        console.log('[GameSocket] Sending authentication...');
        socket.emit('authenticate', { sessionToken: token });
      } else {
        console.log('[GameSocket] No session token, connection will be rejected');
        socket.emit('authenticate', { sessionToken: null });
      }
    };

    socket.on('connect', () => {
      console.log('[GameSocket] Connected:', socket.id);
      // Don't set isConnected yet - wait for authentication
      sendAuth();
    });

    // Re-authenticate on every reconnect (after transient disconnects)
    socket.io.on('reconnect', () => {
      console.log('[GameSocket] Reconnected - re-authenticating...');
      sendAuth();
    });

    socket.on('disconnect', (reason) => {
      console.log('[GameSocket] Disconnected:', reason);
      setIsConnected(false);
      setIsAuthenticated(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[GameSocket] Connection error:', error);
    });

    // Authentication events
    socket.on('connected', (data: { id: string; authenticated?: boolean }) => {
      console.log('[GameSocket] Server confirmed connection:', data.id, 'authenticated:', data.authenticated);
      if (data.authenticated) {
        setIsConnected(true);
        setIsAuthenticated(true);
        onConnectedRef.current?.(data.id);
      }
    });

    socket.on('auth-error', (data: { reason: string; sessionInvalid: boolean }) => {
      console.error('[GameSocket] Auth error:', data.reason);
      setIsConnected(false);
      setIsAuthenticated(false);
      // Use ref to call latest callback without re-triggering the effect
      onAuthErrorRef.current?.(data.reason);
    });

    socket.on('room-created', (data: { room: Room; playerId: string }) => {
      console.log('[GameSocket] Room created:', data.room.code);
      setCurrentRoom(data.room);
      setPlayerId(data.playerId);
      onRoomCreatedRef.current?.(data.room, data.playerId);
    });

    socket.on('room-joined', (data: { room: Room; playerId: string }) => {
      console.log('[GameSocket] Room joined:', data.room.code);
      setCurrentRoom(data.room);
      setPlayerId(data.playerId);
      onRoomJoinedRef.current?.(data.room, data.playerId);
    });

    socket.on('room-update', (data: { room: Room }) => {
      console.log('[GameSocket] Room update:', data.room.code, 'players:', data.room.players.length);
      setCurrentRoom(data.room);
      onRoomUpdateRef.current?.(data.room);
    });

    socket.on('room-closed', (data: { roomCode: string; reason: string }) => {
      console.log('[GameSocket] Room closed:', data.roomCode, 'reason:', data.reason);
      setCurrentRoom(null);
      setPlayerId(null);
      onRoomClosedRef.current?.(data.roomCode, data.reason);
    });

    socket.on('room-left', (data: { roomCode: string }) => {
      console.log('[GameSocket] Left room:', data.roomCode);
      onRoomLeftRef.current?.(data.roomCode);
    });

    socket.on('player-left', (data: { playerId: string; playerName: string; room: Room }) => {
      console.log('[GameSocket] Player left:', data.playerName);
      setCurrentRoom(data.room);
      onPlayerLeftRef.current?.(data.playerId, data.playerName, data.room);
    });

    socket.on('player-joined', (data: { player: Player; room: Room }) => {
      console.log('[GameSocket] Player joined:', data.player.name);
      setCurrentRoom(data.room);
      onPlayerJoinedRef.current?.(data.player, data.room);
    });

    socket.on('public-rooms', (data: { rooms: PublicRoom[] }) => {
      console.log('[GameSocket] Public rooms:', data.rooms.length);
      setPublicRooms(data.rooms);
      onPublicRoomsRef.current?.(data.rooms);
    });

    socket.on('role-revealed', (data: {
      isSpy: boolean;
      isKnower: boolean;
      secretWord: string | null;
      partnerSpyName: string | null;
      gameMode: string;
      category?: { id: string; name: string; icon: string };
    }) => {
      console.log('[GameSocket] Role revealed, isSpy:', data.isSpy);
      onRoleRevealedRef.current?.(data);
    });

    socket.on('guess-result', (data: { success: boolean }) => {
      console.log('[GameSocket] Guess result:', data.success);
      onGuessResultRef.current?.(data.success);
    });

    socket.on('error', (data: { message: string }) => {
      console.error('[GameSocket] Error:', data.message);
      onErrorRef.current?.(data.message);
    });

    // ========== DISCONNECTION DETECTION ==========
    // Handle page visibility changes (user switches apps, minimizes browser, locks phone)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && socket.connected) {
        console.log('[GameSocket] App went to background - notifying server');
        // Give a small grace period before marking as left
        // If user comes back quickly, they won't be removed
        socket.emit('going-background');
      } else if (document.visibilityState === 'visible' && socket.connected) {
        console.log('[GameSocket] App came to foreground - notifying server');
        socket.emit('back-to-foreground');
      }
    };

    // Handle page close/refresh
    const handleBeforeUnload = () => {
      if (socket.connected) {
        console.log('[GameSocket] Page closing - notifying server');
        socket.emit('manual-leave');
      }
    };

    // Handle mobile app state changes (for mobile browsers)
    const handlePageHide = () => {
      if (socket.connected) {
        console.log('[GameSocket] Page hidden (mobile) - notifying server');
        socket.emit('manual-leave');
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    // Cleanup on unmount
    return () => {
      console.log('[GameSocket] Cleaning up socket connection');
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      // Notify server before disconnecting
      if (socket.connected) {
        socket.emit('manual-leave');
      }
      socket.disconnect();
      socketRef.current = null;
    };
    // Only depend on serverUrl and serverPort — never on callbacks/sessionToken
    // (those are kept in refs and read on every event trigger)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, serverPort]);

  // Actions
  const createRoom = useCallback((data: {
    playerName: string;
    isPublic: boolean;
    settings: GameSettings;
    playerGold?: number;
  }) => {
    if (!socketRef.current || !isConnected) {
      console.error('[GameSocket] Cannot create room: not connected');
      return;
    }
    console.log('[GameSocket] Creating room for:', data.playerName);
    socketRef.current.emit('create-room', data);
  }, [isConnected]);

  const joinRoom = useCallback((data: {
    roomCode: string;
    playerName: string;
    playerGold?: number;
  }) => {
    if (!socketRef.current || !isConnected) {
      console.error('[GameSocket] Cannot join room: not connected');
      return;
    }
    console.log('[GameSocket] Joining room:', data.roomCode);
    socketRef.current.emit('join-room', data);
  }, [isConnected]);

  const leaveRoom = useCallback(() => {
    if (!socketRef.current) return;
    console.log('[GameSocket] Leaving room');
    socketRef.current.emit('leave-room');
    setCurrentRoom(null);
    setPlayerId(null);
  }, []);

  const getPublicRooms = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('get-public-rooms');
  }, []);

  const updateSettings = useCallback((settings: GameSettings) => {
    if (!socketRef.current) return;
    socketRef.current.emit('update-settings', { settings });
  }, []);

  const startGame = useCallback(() => {
    if (!socketRef.current) return;
    console.log('[GameSocket] Starting game');
    socketRef.current.emit('start-game');
  }, []);

  const getRole = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('get-role');
  }, []);

  const guessWord = useCallback((guess: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('guess-word', { guess });
  }, []);

  const voteSpy = useCallback((targetId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('vote-spy', { playerId: targetId });
  }, []);

  const openVoting = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('open-voting');
  }, []);

  const calculateVotes = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit('calculate-votes');
  }, []);

  const playAgain = useCallback(() => {
    if (!socketRef.current) return;
    console.log('[GameSocket] Playing again');
    socketRef.current.emit('play-again');
  }, []);

  return {
    isConnected,
    isAuthenticated,
    currentRoom,
    playerId,
    publicRooms,
    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    getPublicRooms,
    updateSettings,
    startGame,
    getRole,
    guessWord,
    voteSpy,
    openVoting,
    calculateVotes,
    playAgain,
  };
}

export type { Room, Player, GameSettings, Game, PublicRoom, TitleInfo };
