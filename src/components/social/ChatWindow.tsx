'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowRight, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Message, User } from '@/hooks/useSocial';

interface ChatWindowProps {
  otherUser: User;
  messages: Message[];
  currentUserId?: string;
  isTyping?: boolean;
  onSendMessage?: (content: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onBack?: () => void;
  className?: string;
}

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

function formatDateHeader(date: string | number): string {
  const messageDate = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (messageDate.toDateString() === today.toDateString()) {
    return 'اليوم';
  }
  if (messageDate.toDateString() === yesterday.toDateString()) {
    return 'أمس';
  }
  return messageDate.toLocaleDateString('ar-EG', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// Typing indicator dots animation
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 p-2">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-xs text-white/40 mr-1">يكتب...</span>
    </div>
  );
}

export function ChatWindow({
  otherUser,
  messages,
  currentUserId,
  isTyping = false,
  onSendMessage,
  onTyping,
  onBack,
  className,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle typing indicator
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    // Send typing indicator
    if (onTyping) {
      onTyping(true);

      // Clear previous timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of no input
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  }, [onTyping]);

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;

    setIsSending(true);
    const messageContent = inputValue.trim();
    setInputValue('');

    // Stop typing indicator
    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    try {
      await onSendMessage?.(messageContent);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = '';

  messages.forEach((message) => {
    const messageDate = formatDateHeader(message.createdAt);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({ date: messageDate, messages: [message] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  return (
    <div className={cn('flex flex-col h-full bg-[#0c120f]', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-[#0c120f]">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/5"
          onClick={onBack}
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <Avatar className="h-9 w-9 border border-white/10">
          <AvatarImage src={otherUser.avatar || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-bold">
            {getInitials(otherUser.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">{otherUser.name}</p>
          {otherUser.title && (
            <p className="text-xs text-cyan-400">{otherUser.title}</p>
          )}
        </div>
        {otherUser.level && (
          <div className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">
            مستوى {otherUser.level}
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/50">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm">ابدأ المحادثة مع {otherUser.name}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date header */}
                <div className="flex items-center justify-center my-4">
                  <div className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
                    {group.date}
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map((message, index) => {
                    const isMine = message.senderId === currentUserId || message.isMine;
                    const showAvatar = index === group.messages.length - 1 ||
                      group.messages[index + 1]?.senderId !== message.senderId;

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          'flex items-end gap-2',
                          isMine ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        {/* Avatar placeholder for alignment */}
                        <div className="w-7 shrink-0">
                          {showAvatar && !isMine && (
                            <Avatar className="h-7 w-7 border border-white/10">
                              <AvatarImage src={otherUser.avatar || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-bold">
                                {getInitials(otherUser.name)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>

                        {/* Message bubble */}
                        <div
                          className={cn(
                            'max-w-[70%] rounded-2xl px-4 py-2',
                            isMine
                              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-tl-sm'
                              : 'bg-white/10 text-white rounded-tr-sm'
                          )}
                        >
                          <p className="text-sm break-words">{message.content}</p>
                          <p className={cn(
                            'text-[10px] mt-1',
                            isMine ? 'text-white/60' : 'text-white/40'
                          )}>
                            {formatMessageTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-end gap-2">
                <Avatar className="h-7 w-7 border border-white/10">
                  <AvatarImage src={otherUser.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-xs font-bold">
                    {getInitials(otherUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white/10 rounded-2xl rounded-tr-sm px-4 py-2">
                  <TypingIndicator />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="اكتب رسالتك..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-400/50"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
            className={cn(
              'h-10 w-10 p-0 rounded-full',
              'bg-gradient-to-br from-cyan-500 to-blue-600',
              'hover:from-cyan-400 hover:to-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200'
            )}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4 -rotate-180" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
