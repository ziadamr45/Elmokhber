'use client';

import { useState, useEffect, useRef } from 'react';
import Ably from 'ably';
import { MessageCircle, Send, ChevronUp, ChevronDown, Volume2, VolumeX, Loader2, WifiOff } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

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

interface RoomChatProps {
  roomCode: string;
  messages?: RoomMessage[];
  currentUserId?: string;
  currentUserName?: string;
  currentUserTitle?: TitleInfo | null;
  gameType?: string;
  onSendMessage?: (content: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

// Ably configuration
const ABLY_KEY = process.env.NEXT_PUBLIC_ABLY_KEY || '';
console.log('[RoomChat] ABLY_KEY configured:', ABLY_KEY ? 'YES' : 'NO');

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

export function RoomChat({
  roomCode,
  messages: externalMessages,
  currentUserId,
  currentUserName,
  currentUserTitle,
  gameType = 'spy',
  onSendMessage: externalSendMessage,
  collapsed: externalCollapsed,
  onToggleCollapse,
  className,
}: RoomChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [internalMessages, setInternalMessages] = useState<RoomMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannel | null>(null);

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const allMessages = externalMessages ? [...externalMessages, ...internalMessages] : internalMessages;

  const uniqueMessages = Array.from(
    new Map(allMessages.map(m => [m.id, m])).values()
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Connect to Ably and subscribe to room channel
  useEffect(() => {
    if (!roomCode || !currentUserId || !currentUserName) return;

    console.log(`[RoomChat] Connecting to Ably for room: ${roomCode}`);
    console.log(`[RoomChat] ABLY_KEY length:`, ABLY_KEY.length);

    if (!ABLY_KEY) {
      console.error('[RoomChat] No ABLY_KEY found!');
      setConnectionError('خطأ في التكوين');
      return;
    }

    // Initialize Ably
    const ably = new Ably.Realtime({
      key: ABLY_KEY,
    });

    ablyRef.current = ably;

    ably.connection.on('connected', () => {
      console.log('[RoomChat] Ably connected');
      setIsConnected(true);
      setConnectionError(null);
    });

    ably.connection.on('disconnected', () => {
      console.log('[RoomChat] Ably disconnected');
      setIsConnected(false);
      setConnectionError('انقطع الاتصال');
    });

    ably.connection.on('failed', (err) => {
      console.error('[RoomChat] Ably connection failed:', err);
      setConnectionError('خطأ في الاتصال');
      setIsConnected(false);
    });

    // Subscribe to room channel
    const channel = ably.channels.get(`room:${roomCode}`);
    channelRef.current = channel;

    channel.subscribe('room-message', (message) => {
      console.log('[RoomChat] Received message:', message.data);
      const msgData = message.data as RoomMessage;
      setInternalMessages(prev => {
        if (prev.some(m => m.id === msgData.id)) {
          return prev;
        }
        return [...prev, msgData];
      });
    });

    console.log(`[RoomChat] Subscribed to room:${roomCode}`);

    return () => {
      console.log('[RoomChat] Cleaning up Ably');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (ablyRef.current) {
        ablyRef.current.close();
      }
    };
  }, [roomCode, currentUserId, currentUserName]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isCollapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [uniqueMessages, isCollapsed]);

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    try {
      if (externalSendMessage) {
        await externalSendMessage(messageContent);
      } else {
        // Send via API route
        const response = await fetch('/api/social/room-messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomCode,
            content: messageContent,
            gameType,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('[RoomChat] Failed to send message:', error);
          setConnectionError('فشل إرسال الرسالة');
        }
      }
    } catch (error) {
      console.error('[RoomChat] Send error:', error);
      setConnectionError('فشل إرسال الرسالة');
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const unreadCount = isCollapsed ? uniqueMessages.length : 0;

  return (
    <div
      className={cn(
        'flex flex-col bg-[#0c120f]/95 backdrop-blur-sm rounded-lg overflow-hidden',
        'border border-white/10 shadow-lg shadow-black/30',
        'transition-all duration-300 ease-out',
        isCollapsed ? 'h-auto' : 'h-80',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex items-center justify-between w-full p-2 px-3',
          'bg-gradient-to-r from-cyan-500/20 to-blue-600/20',
          'hover:from-cyan-500/30 hover:to-blue-600/30',
          'transition-all duration-200 cursor-pointer'
        )}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">محادثة الغرفة</span>
          {isCollapsed && unreadCount > 0 && (
            <Badge className="h-5 min-w-5 bg-red-500 text-white text-xs animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          {/* Connection indicator */}
          <div className={cn(
            'h-2 w-2 rounded-full',
            isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
          )} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className={cn(
              'h-6 w-6 flex items-center justify-center rounded-full',
              'hover:bg-white/10 transition-colors',
              isMuted ? 'text-red-400' : 'text-white/60'
            )}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4 text-white/60" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/60" />
          )}
        </div>
      </button>

      {/* Chat content - not collapsed */}
      {!isCollapsed && (
        <>
          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-2">
            {uniqueMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/40">
                <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">ابدأ المحادثة مع اللاعبين</p>
              </div>
            ) : (
              <div className="space-y-2">
                {uniqueMessages.map((message) => {
                  const isMine = message.playerId === currentUserId;
                  const hasTitle = message.playerTitle && message.playerTitle.title;

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
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold text-cyan-400">
                              {message.playerName}
                            </span>
                            {hasTitle && (
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                                style={{
                                  backgroundColor: message.playerTitle!.color + '25',
                                  color: message.playerTitle!.color
                                }}
                              >
                                {message.playerTitle!.icon} {message.playerTitle!.title}
                              </span>
                            )}
                          </div>
                        )}
                        {isMine && hasTitle && (
                          <div className="flex items-center justify-end gap-1.5 mb-0.5">
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                              style={{
                                backgroundColor: message.playerTitle!.color + '25',
                                color: message.playerTitle!.color
                              }}
                            >
                              {message.playerTitle!.icon} {message.playerTitle!.title}
                            </span>
                          </div>
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

          {/* Connection error warning */}
          {!isConnected && connectionError && (
            <div className="px-2 py-1 bg-red-500/10 border-t border-red-500/20 flex items-center gap-2">
              <WifiOff className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-400">{connectionError}</span>
            </div>
          )}

          {/* Input */}
          <div className="p-2 border-t border-white/5">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="اكتب رسالة..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  inputRef.current?.focus();
                }}
                disabled={isSending}
                className="flex-1 h-8 bg-white/5 border-white/10 text-white text-sm placeholder:text-white/40 touch-manipulation disabled:opacity-50"
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isSending}
                size="icon"
                className={cn(
                  'h-8 w-8 rounded-full',
                  'bg-gradient-to-br from-cyan-500 to-blue-600',
                  'hover:from-cyan-400 hover:to-blue-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
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
        </>
      )}
    </div>
  );
}

// Mini version for overlay during gameplay
export function RoomChatMini({
  roomCode,
  messages,
  currentUserId,
  currentUserName,
  currentUserTitle,
  gameType = 'spy',
  onSendMessage,
  className,
}: RoomChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalMessages, setInternalMessages] = useState<RoomMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const channelRef = useRef<Ably.Types.RealtimeChannel | null>(null);

  useEffect(() => {
    if (!roomCode || !currentUserId || !currentUserName) return;

    // Skip Ably connection if no key is configured
    if (!ABLY_KEY) {
      console.log('[RoomChat] Ably key not configured, skipping chat connection');
      return;
    }

    const ably = new Ably.Realtime({
      key: ABLY_KEY,
    });

    ablyRef.current = ably;

    ably.connection.on('connected', () => {
      setIsConnected(true);
    });

    ably.connection.on('disconnected', () => {
      setIsConnected(false);
    });

    const channel = ably.channels.get(`room:${roomCode}`);
    channelRef.current = channel;

    channel.subscribe('room-message', (message) => {
      const msgData = message.data as RoomMessage;
      setInternalMessages(prev => [...prev, msgData]);
    });

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
      if (ablyRef.current) {
        ablyRef.current.close();
      }
    };
  }, [roomCode, currentUserId, currentUserName]);

  const allMessages = messages ? [...messages, ...internalMessages] : internalMessages;
  const lastMessage = allMessages[allMessages.length - 1];

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const messageContent = inputValue.trim();

    if (onSendMessage) {
      onSendMessage(messageContent);
    } else {
      try {
        await fetch('/api/social/room-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode,
            content: messageContent,
            gameType,
          }),
        });
      } catch (error) {
        console.error('[RoomChatMini] Send error:', error);
      }
    }

    setInputValue('');
  };

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-[#0c120f]/80 backdrop-blur-sm',
          'border border-white/10',
          'hover:bg-white/5 transition-colors',
          className
        )}
      >
        <MessageCircle className="h-4 w-4 text-cyan-400" />
        <div className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')} />
        {lastMessage && (
          <span className="text-xs text-white/70 truncate max-w-32">
            {lastMessage.playerName}: {lastMessage.content}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed inset-x-4 bottom-20 z-40',
        'bg-[#0c120f]/95 backdrop-blur-sm',
        'rounded-lg border border-white/10',
        'shadow-xl shadow-black/50',
        'max-h-60 flex flex-col',
        className
      )}
    >
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">محادثة الغرفة</span>
          <div className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(false)}
          className="h-6 w-6 p-0 text-white/60 hover:text-white"
        >
          ✕
        </Button>
      </div>
      <ScrollArea className="flex-1 max-h-32 p-2">
        {allMessages.slice(-10).map((message) => {
          const hasTitle = message.playerTitle && message.playerTitle.title;
          return (
            <div key={message.id} className="text-xs mb-1 flex items-center gap-1">
              <span className="text-cyan-400 font-bold">{message.playerName}</span>
              {hasTitle && (
                <span
                  className="text-[9px] px-1 py-0.5 rounded-full font-bold"
                  style={{
                    backgroundColor: message.playerTitle!.color + '25',
                    color: message.playerTitle!.color
                  }}
                >
                  {message.playerTitle!.icon}
                </span>
              )}
              <span className="text-white/80">: {message.content}</span>
            </div>
          );
        })}
      </ScrollArea>
      <div className="p-2 border-t border-white/10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="اكتب رسالة..."
            disabled={!isConnected}
            className="h-8 text-sm bg-white/5 border-white/10 touch-manipulation"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!isConnected}
            className="h-8 px-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50"
          >
            إرسال
          </Button>
        </form>
      </div>
    </div>
  );
}

export default RoomChat;
