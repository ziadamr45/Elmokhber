'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Ably from 'ably';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { RoomEvent } from 'livekit-client';
import { MessageCircle, Mic, MicOff, Volume2, VolumeX, Send, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

interface TitleInfo {
  title: string;
  level: number;
  color: string;
  icon: string;
}

interface RoomMessage {
  id: string;
  roomCode: string;
  playerId: string;
  playerName: string;
  playerTitle?: TitleInfo | null;
  content: string;
  gameType: string;
  createdAt: string | number;
}

interface RoomVoiceChatProps {
  roomCode: string;
  playerId: string;
  playerName: string;
  playerTitle?: TitleInfo | null;
  gameType?: 'spy' | 'quiz';
  className?: string;
}

// Ably configuration
const ABLY_KEY = process.env.NEXT_PUBLIC_ABLY_KEY || '';

// ==================== HELPER FUNCTIONS ====================

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

function formatMessageTime(date: string | number): string {
  const messageDate = new Date(date);
  return messageDate.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ==================== LIVEKIT INNER COMPONENT ====================

function VoiceRoomInner({
  isMuted,
  isDeafened,
}: {
  isMuted?: boolean;
  isDeafened?: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const prevMutedRef = useRef(isMuted);
  const hasInitializedMic = useRef(false);

  // Enable microphone automatically when connected
  useEffect(() => {
    if (!localParticipant || hasInitializedMic.current) return;

    const enableMic = async () => {
      try {
        console.log('[VoiceRoom] Auto-enabling microphone on connect...');
        await localParticipant.setMicrophoneEnabled(!isMuted);
        hasInitializedMic.current = true;
        console.log('[VoiceRoom] Microphone enabled successfully');
      } catch (err) {
        console.error('[VoiceRoom] Error enabling microphone:', err);
      }
    };

    // Small delay to ensure room is fully connected
    const timer = setTimeout(enableMic, 500);
    return () => clearTimeout(timer);
  }, [localParticipant, isMuted]);

  // Handle mute/unmute changes
  useEffect(() => {
    if (prevMutedRef.current === isMuted) return;
    prevMutedRef.current = isMuted;

    if (!localParticipant || !hasInitializedMic.current) return;

    const toggleMic = async () => {
      try {
        if (isMuted) {
          await localParticipant.setMicrophoneEnabled(false);
        } else {
          await localParticipant.setMicrophoneEnabled(true);
        }
      } catch (err) {
        console.error('[VoiceRoom] Error toggling mic:', err);
      }
    };

    toggleMic();
  }, [isMuted, localParticipant]);

  return (
    <div className="voice-room-inner">
      <RoomAudioRenderer volume={isDeafened ? 0 : 1} />
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function RoomVoiceChat({
  roomCode,
  playerId,
  playerName,
  playerTitle,
  gameType = 'spy',
  className,
}: RoomVoiceChatProps) {
  // Voice states
  const [voiceToken, setVoiceToken] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isVoiceDeafened, setIsVoiceDeafened] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceFetchingRef = useRef(false);
  const voiceMountedRef = useRef(true);

  // Chat states
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isChatConnected, setIsChatConnected] = useState(false);

  // UI states
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ably refs
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannel | null>(null);

  // ==================== VOICE CONNECTION ====================

  useEffect(() => {
    voiceMountedRef.current = true;

    const getToken = async () => {
      if (voiceFetchingRef.current) return;
      voiceFetchingRef.current = true;

      try {
        setVoiceError(null);

        const response = await fetch('/api/livekit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomCode,
            participantName: playerName,
            participantId: playerId,
          }),
        });

        if (!voiceMountedRef.current) return;

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'فشل في الحصول على رمز الوصول');
        }

        const data = await response.json();
        setVoiceToken(data.token);
        setVoiceUrl(data.url);
      } catch (err) {
        if (!voiceMountedRef.current) return;
        console.error('[VoiceRoom] Error getting token:', err);
        setVoiceError(err instanceof Error ? err.message : 'خطأ في الاتصال');
        voiceFetchingRef.current = false;
      }
    };

    getToken();

    return () => {
      voiceMountedRef.current = false;
    };
  }, [roomCode, playerName, playerId]);

  // ==================== ABLY CHAT CONNECTION ====================

  useEffect(() => {
    if (!roomCode || !playerId || !playerName) return;

    console.log(`[RoomVoiceChat] Connecting to Ably for room: ${roomCode}`);

    const ably = new Ably.Realtime({
      key: ABLY_KEY,
    });

    ablyRef.current = ably;

    ably.connection.on('connected', () => {
      console.log('[RoomVoiceChat] Ably connected');
      setIsChatConnected(true);
    });

    ably.connection.on('disconnected', () => {
      console.log('[RoomVoiceChat] Ably disconnected');
      setIsChatConnected(false);
    });

    const channel = ably.channels.get(`room:${roomCode}`);
    channelRef.current = channel;

    channel.subscribe('room-message', (message) => {
      const msgData = message.data as RoomMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === msgData.id)) {
          return prev;
        }
        return [...prev, msgData];
      });
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (ablyRef.current) {
        ablyRef.current.close();
      }
    };
  }, [roomCode, playerId, playerName]);

  // ==================== AUTO SCROLL ====================

  useEffect(() => {
    if (isChatExpanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatExpanded]);

  // ==================== SEND MESSAGE ====================

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      const response = await fetch('/api/social/room-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          content,
          gameType,
        }),
      });

      if (!response.ok) {
        console.error('[RoomVoiceChat] Failed to send message');
      }
    } catch (error) {
      console.error('[RoomVoiceChat] Send error:', error);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ==================== RENDER ====================

  return (
    <div className={cn('space-y-3', className)}>
      {/* Connection Status Bar */}
      <div className="flex items-center justify-between rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-2.5 w-2.5 rounded-full',
              isVoiceConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
            )} />
            <span className="text-xs text-white/60">صوت</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              'h-2.5 w-2.5 rounded-full',
              isChatConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
            )} />
            <span className="text-xs text-white/60">شات</span>
          </div>
        </div>

        {/* Voice Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsVoiceMuted(!isVoiceMuted)}
            className={cn(
              'p-2 rounded-full transition-all',
              isVoiceMuted
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
            title={isVoiceMuted ? 'تشغيل الميكروفون' : 'كتم الميكروفون'}
          >
            {isVoiceMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsVoiceDeafened(!isVoiceDeafened)}
            className={cn(
              'p-2 rounded-full transition-all',
              isVoiceDeafened
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
            title={isVoiceDeafened ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {isVoiceDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className={cn(
              'p-2 rounded-full transition-all relative',
              isChatExpanded
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
            title="محادثة الغرفة"
          >
            <MessageCircle className="h-4 w-4" />
            {messages.length > 0 && !isChatExpanded && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white">
                {messages.length > 9 ? '9+' : messages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Voice Error */}
      {voiceError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm text-red-300">{voiceError}</p>
        </div>
      )}

      {/* Voice Room (LiveKit) */}
      {voiceToken && voiceUrl && (
        <LiveKitRoom
          token={voiceToken}
          serverUrl={voiceUrl}
          connect={true}
          audio={true}
          video={false}
          onConnected={() => {
            setIsVoiceConnected(true);
            setVoiceError(null);
          }}
          onDisconnected={() => setIsVoiceConnected(false)}
          onError={(err) => {
            setVoiceError(err.message);
            setIsVoiceConnected(false);
          }}
          options={{
            adaptiveStream: false,
            dynacast: false,
          }}
        >
          <VoiceRoomInner
            isMuted={isVoiceMuted}
            isDeafened={isVoiceDeafened}
          />
        </LiveKitRoom>
      )}

      {/* Chat Panel */}
      {isChatExpanded && (
        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-2 bg-white/5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold">محادثة الغرفة</span>
            </div>
            <button
              type="button"
              onClick={() => setIsChatExpanded(false)}
              className="text-white/50 hover:text-white text-lg"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="h-48 p-2">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">ابدأ المحادثة مع اللاعبين</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => {
                  const isMine = message.playerId === playerId;

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'flex items-start gap-2',
                        isMine && 'flex-row-reverse'
                      )}
                    >
                      <Avatar className="h-6 w-6 shrink-0 border border-white/10">
                        <AvatarFallback
                          className={cn(
                            'text-xs font-bold',
                            isMine
                              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
                              : 'bg-white/10 text-white/70'
                          )}
                        >
                          {getInitials(message.playerName)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-2.5 py-1.5',
                          isMine
                            ? 'bg-cyan-500/20 text-white'
                            : 'bg-white/5 text-white/90'
                        )}
                      >
                        {!isMine && (
                          <span className="text-xs font-bold text-cyan-400 block mb-0.5">
                            {message.playerName}
                          </span>
                        )}
                        <p className="text-sm break-words">{message.content}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          {formatMessageTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="text"
                autoComplete="off"
                placeholder="اكتب رسالة..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending || !isChatConnected}
                className="flex-1 h-8 bg-white/5 border-white/10 text-white text-sm placeholder:text-white/40 disabled:opacity-50"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isSending || !isChatConnected}
                size="icon"
                className={cn(
                  'h-8 w-8 rounded-full',
                  'bg-gradient-to-br from-cyan-500 to-blue-600',
                  'hover:from-cyan-400 hover:to-blue-500',
                  'disabled:opacity-50'
                )}
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 -rotate-180" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomVoiceChat;
