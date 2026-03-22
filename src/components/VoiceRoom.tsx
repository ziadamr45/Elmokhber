'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Room, RoomEvent } from 'livekit-client';

interface VoiceRoomProps {
  roomName: string;
  participantName: string;
  participantId: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
  isMuted?: boolean;
  isDeafened?: boolean;
}

// Inner component that has access to LiveKit context
function VoiceRoomInner({
  onConnected,
  onDisconnected,
  isMuted,
  isDeafened,
}: {
  onConnected?: () => void;
  onDisconnected?: () => void;
  isMuted?: boolean;
  isDeafened?: boolean;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const connectedRef = useRef(false);
  const prevMutedRef = useRef(isMuted);

  // Handle mic mute/unmute
  useEffect(() => {
    // Only toggle if the value actually changed
    if (prevMutedRef.current === isMuted) return;
    prevMutedRef.current = isMuted;

    if (!localParticipant) return;

    const toggleMic = async () => {
      try {
        if (isMuted) {
          await localParticipant.setMicrophoneEnabled(false);
          console.log('[VoiceRoom] 🔇 Mic muted');
        } else {
          await localParticipant.setMicrophoneEnabled(true);
          console.log('[VoiceRoom] 🎤 Mic unmuted');
        }
      } catch (err) {
        console.error('[VoiceRoom] Error toggling mic:', err);
      }
    };

    toggleMic();
  }, [isMuted, localParticipant]);

  // Connection state handling
  useEffect(() => {
    const handleConnected = () => {
      if (!connectedRef.current) {
        connectedRef.current = true;
        console.log('[VoiceRoom] ✅ Connected to room, participants:', participants.length);
        if (onConnected) onConnected();

        // Auto-enable mic on connect
        localParticipant?.setMicrophoneEnabled(true).catch(err => {
          console.error('[VoiceRoom] Error enabling mic:', err);
        });
      }
    };

    const handleDisconnected = () => {
      connectedRef.current = false;
      console.log('[VoiceRoom] Disconnected from room');
      if (onDisconnected) onDisconnected();
    };

    const handleConnectionError = (error: Error) => {
      console.error('[VoiceRoom] Connection error in handler:', error);
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    room.on(RoomEvent.ConnectionError, handleConnectionError);

    // If already connected, trigger callback
    if (room.state === 'connected' && !connectedRef.current) {
      handleConnected();
    }

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.off(RoomEvent.ConnectionError, handleConnectionError);
    };
  }, [room, onConnected, onDisconnected, participants.length, localParticipant]);

  return (
    <div className="voice-room-inner">
      {/* Audio renderer - plays all remote audio */}
      <RoomAudioRenderer volume={isDeafened ? 0 : 1} />
    </div>
  );
}

export default function VoiceRoom({
  roomName,
  participantName,
  participantId,
  onConnected,
  onDisconnected,
  onError,
  isMuted = false,
  isDeafened = false,
}: VoiceRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Use refs to prevent multiple fetches
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  // Get token from our API - only once
  useEffect(() => {
    mountedRef.current = true;

    // Skip if already fetched
    if (hasFetchedRef.current) return;

    const getToken = async () => {
      // Prevent multiple simultaneous fetches
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        setStatus('connecting');
        setError(null);

        console.log('[VoiceRoom] Fetching token for room:', roomName, 'participant:', participantName);

        const response = await fetch('/api/livekit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName,
            participantName,
            participantId,
          }),
        });

        if (!mountedRef.current) return;

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'فشل في الحصول على رمز الوصول');
        }

        const data = await response.json();

        console.log('[VoiceRoom] ✅ Got token successfully');
        hasFetchedRef.current = true;

        setToken(data.token);
        setServerUrl(data.url);
      } catch (err) {
        if (!mountedRef.current) return;

        console.error('[VoiceRoom] ❌ Error getting token:', err);
        const errorMessage = err instanceof Error ? err.message : 'حدث خطأ في الاتصال';
        setError(errorMessage);
        setStatus('error');
        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
        fetchingRef.current = false;
      }
    };

    getToken();

    return () => {
      mountedRef.current = false;
    };
  }, [roomName, participantName, participantId, onError]);

  // Handle connection error
  const handleConnectionError = useCallback((err: Error) => {
    console.error('[VoiceRoom] Connection error:', err);
    setError(err.message);
    setStatus('error');
    if (onError) {
      onError(err);
    }
  }, [onError]);

  // Handle connection success
  const handleConnected = useCallback(() => {
    console.log('[VoiceRoom] Room connected callback');
    setStatus('connected');
    if (onConnected) onConnected();
  }, [onConnected]);

  // Handle disconnection
  const handleDisconnected = useCallback(() => {
    console.log('[VoiceRoom] Room disconnected callback');
    setStatus('idle');
    if (onDisconnected) onDisconnected();
  }, [onDisconnected]);

  // Memoize the callbacks to prevent re-renders
  const callbacks = useMemo(() => ({
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onError: handleConnectionError,
  }), [handleConnected, handleDisconnected, handleConnectionError]);

  // Loading state
  if (status === 'connecting' && !token) {
    return (
      <div className="flex items-center justify-center gap-2 p-3 bg-cyan-500/10 rounded-xl">
        <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-cyan-300">جاري الاتصال...</span>
      </div>
    );
  }

  // Error state
  if (status === 'error' || !token || !serverUrl) {
    return (
      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
        <p className="text-sm text-red-300">
          {error || 'غير قادر على الاتصال بالصوت'}
        </p>
      </div>
    );
  }

  // Connected state - render LiveKit room
  return (
    <div className="voice-room">
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        audio={true}
        video={false}
        onConnected={callbacks.onConnected}
        onDisconnected={callbacks.onDisconnected}
        onError={callbacks.onError}
        options={{
          adaptiveStream: false,
          dynacast: false,
        }}
      >
        <VoiceRoomInner
          onConnected={onConnected}
          onDisconnected={onDisconnected}
          isMuted={isMuted}
          isDeafened={isDeafened}
        />
      </LiveKitRoom>

      {/* Connection status indicator */}
      <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
        <span>{status === 'connected' ? 'متصل' : 'جاري الاتصال'}</span>
      </div>
    </div>
  );
}
