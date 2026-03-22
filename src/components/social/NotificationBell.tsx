'use client';

import { useState } from 'react';
import { Bell, UserPlus, MessageCircle, Users, Gamepad2, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/useSocial';

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead?: (notificationIds?: string[]) => void;
  onMarkAllRead?: () => void;
  onJoinRoom?: (roomCode: string, gameType: string) => void;
  className?: string;
}

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'friend_request':
      return <UserPlus className="h-4 w-4 text-cyan-400" />;
    case 'friend_accepted':
      return <Users className="h-4 w-4 text-green-400" />;
    case 'new_message':
      return <MessageCircle className="h-4 w-4 text-blue-400" />;
    case 'room_invite':
      return <Gamepad2 className="h-4 w-4 text-purple-400" />;
    default:
      return <Bell className="h-4 w-4 text-white/60" />;
  }
}

function formatNotificationTime(date: string | number) {
  const now = new Date();
  const notificationDate = new Date(date);
  const diffMs = now.getTime() - notificationDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return notificationDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
}

export function NotificationBell({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllRead,
  onJoinRoom,
  className,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead([notification.id]);
    }
    
    // Handle room invite - join the room
    if (notification.type === 'room_invite' && notification.data) {
      const data = notification.data as { roomCode?: string; gameType?: string };
      if (data.roomCode && data.gameType && onJoinRoom) {
        onJoinRoom(data.roomCode, data.gameType);
        setIsOpen(false);
      }
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-full',
            'bg-white/5 hover:bg-white/10',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-cyan-400/50',
            className
          )}
          aria-label={`الإشعارات${unreadCount > 0 ? ` (${unreadCount} غير مقروءة)` : ''}`}
        >
          <Bell className={cn(
            'h-4 w-4 transition-transform duration-200',
            isOpen ? 'text-cyan-400 scale-110' : 'text-white/70'
          )} />
          
          {unreadCount > 0 && (
            <Badge
              className={cn(
                'absolute -top-0.5 -left-0.5 flex h-4 min-w-4 items-center justify-center px-1',
                'bg-red-500 text-white text-[10px] font-bold',
                'animate-pulse shadow-lg shadow-red-500/50',
                'border border-[#050907]'
              )}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={4}
        avoidCollisions={true}
        collisionPadding={8}
        className={cn(
          'w-[280px] max-w-[calc(100vw-16px)]',
          'bg-[#0c120f] border border-white/10 rounded-xl',
          'shadow-xl shadow-black/50',
          'z-50'
        )}
      >
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span className="text-white font-bold text-sm">الإشعارات</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              className="h-6 text-[10px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10 px-2"
            >
              <CheckCheck className="h-3 w-3 ml-1" />
              قراءة الكل
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />

        <ScrollArea className="max-h-60">
          {notifications.length === 0 ? (
            <div className="py-6 text-center text-white/50">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="py-1 px-1">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex items-start gap-2 p-2 cursor-pointer rounded-lg',
                    'hover:bg-white/5 focus:bg-white/5',
                    'transition-colors duration-150',
                    !notification.isRead && 'bg-cyan-500/5 border-r-2 border-cyan-400'
                  )}
                >
                  <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    'bg-white/5'
                  )}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className={cn(
                      'text-xs font-medium truncate',
                      notification.isRead ? 'text-white/70' : 'text-white'
                    )}>
                      {notification.title}
                    </p>
                    <p className="text-[10px] text-white/50 truncate">
                      {notification.content}
                    </p>
                    <p className="text-[9px] text-white/30 mt-0.5">
                      {formatNotificationTime(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0 mt-1" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[10px] text-white/60 hover:text-white hover:bg-white/5 h-7"
              >
                عرض كل الإشعارات
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
