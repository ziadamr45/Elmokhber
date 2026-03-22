'use client';

import { useEffect, useState, useRef } from 'react';
import Ably from 'ably';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { MessageCircle, Mic, MicOff, Volume2, VolumeX, Send, X, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ==================== TYPES ====================

interface InGameVoiceChatProps {
  roomCode: string;
  playerId: string;
  playerName: string;
  gameType?: 'spy' | 'quiz';
}

interface RoomMessage {
  id: string;
  roomCode: string;
  playerId: string;
  playerName: string;
  content: string;
  gameType: string;
  createdAt: string | number;
}

// Ably configuration
const ABLY_KEY = process.env.NEXT_PUBLIC_ABLY_KEY || '';

// ==================== LIVEKIT INNER ====================

function VoiceInner({ isMuted, isDeafened }: { isMuted: boolean; isDeafened: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const prevMutedRef = useRef(isMuted);
  const hasInitializedMic = useRef(false);

  // Enable microphone automatically when connected
  useEffect(() => {
    if (!localParticipant || hasInitializedMic.current) return;

    const enableMic = async () => {
      try {
        console.log('[InGameVoice] Auto-enabling microphone on connect...');
        await localParticipant.setMicrophoneEnabled(!isMuted);
        hasInitializedMic.current = true;
        console.log('[InGameVoice] Microphone enabled successfully');
      } catch (err) {
        console.error('[InGameVoice] Error enabling microphone:', err);
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
        await localParticipant.setMicrophoneEnabled(!isMuted);
      } catch (err) {
        console.error('[InGameVoice] Mic toggle error:', err);
      }
    };

    toggleMic();
  }, [isMuted, localParticipant]);

  return <RoomAudioRenderer volume={isDeafened ? 0 : 1} />;
}

// ==================== MAIN COMPONENT ====================

export function InGameVoiceChat({
  roomCode,
  playerId,
  playerName,
  gameType = 'spy',
}: InGameVoiceChatProps) {
  // Voice states
  const [voiceToken, setVoiceToken] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted
  const [isDeafened, setIsDeafened] = useState(false);
  const [isVoiceAvailable, setIsVoiceAvailable] = useState(true);

  // Chat states
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isChatConnected, setIsChatConnected] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Refs
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ==================== VOICE CONNECTION ====================

  useEffect(() => {
    // Don't fetch voice token if no room or player
    if (!roomCode || !playerId) {
      return;
    }

    let cancelled = false;

    const getToken = async () => {
      try {
        const response = await fetch('/api/livekit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomCode,
            participantName: playerName,
            participantId: playerId,
          }),
        });

        if (cancelled) return;

        if (!response.ok) {
          console.log('[InGameVoice] Voice not available - server returned error');
          setIsVoiceAvailable(false);
          return;
        }

        const data = await response.json();

        if (cancelled) return;

        if (data.token && data.url) {
          setVoiceToken(data.token);
          setVoiceUrl(data.url);
        } else {
          console.log('[InGameVoice] Voice not available - missing token/url');
          setIsVoiceAvailable(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.log('[InGameVoice] Voice error:', err);
          setIsVoiceAvailable(false);
        }
      }
    };

    getToken();

    return () => {
      cancelled = true;
    };
  }, [roomCode, playerName, playerId]);

  // ==================== ABLY CHAT ====================

  useEffect(() => {
    if (!roomCode || !playerId || !ABLY_KEY) {
      console.log('[InGameVoice] Missing required data for chat');
      return;
    }

    let ably: Ably.Realtime | null = null;
    let channel: Ably.Types.RealtimeChannel | null = null;

    try {
      ably = new Ably.Realtime({ key: ABLY_KEY });
      ablyRef.current = ably;

      ably.connection.on('connected', () => {
        console.log('[InGameVoice] Chat connected');
        setIsChatConnected(true);
      });
      ably.connection.on('disconnected', () => {
        console.log('[InGameVoice] Chat disconnected');
        setIsChatConnected(false);
      });
      ably.connection.on('failed', (err) => {
        console.error('[InGameVoice] Chat connection failed:', err);
        setIsChatConnected(false);
      });

      channel = ably.channels.get(`room:${roomCode}`);
      channelRef.current = channel;

      channel.subscribe('room-message', (message) => {
        try {
          const msgData = message.data as RoomMessage;
          setMessages(prev => {
            if (prev.some(m => m.id === msgData.id)) return prev;
            return [...prev, msgData];
          });
        } catch (err) {
          console.error('[InGameVoice] Message parse error:', err);
        }
      });
    } catch (err) {
      console.error('[InGameVoice] Ably init error:', err);
      setIsChatConnected(false);
    }

    return () => {
      try {
        channel?.unsubscribe();
        ably?.close();
      } catch (err) {
        console.error('[InGameVoice] Cleanup error:', err);
      }
    };
  }, [roomCode, playerId]);

  // ==================== AUTO SCROLL ====================

  useEffect(() => {
    if (isChatOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatOpen]);

  // ==================== SEND MESSAGE ====================

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      await fetch('/api/social/room-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode, content, gameType }),
      });
    } catch (err) {
      console.error('[InGameVoice] Send error:', err);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // ==================== RENDER ====================

  const unreadCount = messages.filter(m => !m.playerId.includes(playerId)).length;

  return (
    <>
      {/* Voice Connection (LiveKit) - Always running in background */}
      {isVoiceAvailable && voiceToken && voiceUrl && (
        <LiveKitRoom
          token={voiceToken}
          serverUrl={voiceUrl}
          connect={true}
          audio={true}
          video={false}
          onConnected={() => setIsVoiceConnected(true)}
          onDisconnected={() => setIsVoiceConnected(false)}
          onError={() => setIsVoiceAvailable(false)}
        >
          <VoiceInner isMuted={isMuted} isDeafened={isDeafened} />
        </LiveKitRoom>
      )}

      {/* Compact Controls Bar - Fixed at bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
        {/* Mic Button */}
        {isVoiceAvailable && (
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-lg',
              isMuted
                ? 'bg-red-500/90 text-white'
                : 'bg-green-500/90 text-white'
            )}
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}

        {/* Speaker Button */}
        {isVoiceAvailable && (
          <button
            type="button"
            onClick={() => setIsDeafened(!isDeafened)}
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-lg',
              isDeafened
                ? 'bg-red-500/90 text-white'
                : 'bg-white/20 backdrop-blur-sm text-white'
            )}
          >
            {isDeafened ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
        )}

        {/* Chat Button */}
        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-lg relative',
            isChatOpen
              ? 'bg-cyan-500/90 text-white'
              : 'bg-white/20 backdrop-blur-sm text-white'
          )}
        >
          <MessageCircle className="h-5 w-5" />
          {!isChatOpen && messages.length > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
              {messages.length > 9 ? '9+' : messages.length}
            </span>
          )}
        </button>
      </div>

      {/* Chat Drawer - Slides up from bottom */}
      {isChatOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsChatOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-[#0a0f0c]/95 backdrop-blur-lg rounded-t-3xl border-t border-white/10 max-h-[60vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-cyan-400" />
                <span className="font-bold">محادثة الغرفة</span>
                <div className={cn(
                  'h-2 w-2 rounded-full',
                  isChatConnected ? 'bg-green-500' : 'bg-red-500'
                )} />
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[40vh]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-white/40">
                  <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">لا توجد رسائل بعد</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.playerId === playerId;
                  return (
                    <div
                      key={msg.id}
                      className={cn('flex gap-2', isMine && 'flex-row-reverse')}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={cn(
                          'text-xs',
                          isMine ? 'bg-cyan-500 text-white' : 'bg-white/20 text-white'
                        )}>
                          {msg.playerName?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2',
                        isMine ? 'bg-cyan-500/20' : 'bg-white/10'
                      )}>
                        {!isMine && (
                          <span className="text-xs text-cyan-400 font-bold block mb-1">
                            {msg.playerName}
                          </span>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        <span className="text-[10px] text-white/40 block mt-1">
                          {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="اكتب رسالة..."
                  disabled={!isChatConnected}
                  className="flex-1 h-10 bg-white/10 border-white/10 text-white placeholder:text-white/40"
                />
                <Button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || !isChatConnected}
                  className="h-10 px-4 bg-cyan-500 hover:bg-cyan-400"
                >
                  <Send className="h-4 w-4 -rotate-180" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InGameVoiceChat;
