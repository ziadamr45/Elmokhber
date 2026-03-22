'use client';

import { useState } from 'react';
import { Users, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SocialButtonProps {
  pendingRequestsCount?: number;
  unreadMessagesCount?: number;
  onClick?: () => void;
  className?: string;
}

export function SocialButton({
  pendingRequestsCount = 0,
  unreadMessagesCount = 0,
  onClick,
  className,
}: SocialButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const totalNotifications = pendingRequestsCount + unreadMessagesCount;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'relative flex h-14 w-14 items-center justify-center rounded-full',
        'bg-gradient-to-br from-cyan-500 to-blue-600',
        'shadow-lg shadow-cyan-500/30',
        'transition-all duration-300 ease-out',
        'hover:scale-110 hover:shadow-xl hover:shadow-cyan-500/40',
        'active:scale-95',
        'focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#050907]',
        className
      )}
      aria-label="فتح النظام الاجتماعي"
    >
      {/* Main icon */}
      <Users
        className={cn(
          'h-6 w-6 text-white transition-transform duration-300',
          isHovered && 'scale-110'
        )}
      />

      {/* Badge for notifications */}
      {totalNotifications > 0 && (
        <Badge
          className={cn(
            'absolute -top-1 -left-1 flex h-5 min-w-5 items-center justify-center',
            'bg-red-500 text-white text-xs font-bold',
            'animate-pulse shadow-lg shadow-red-500/50',
            'border-2 border-[#050907]'
          )}
        >
          {totalNotifications > 99 ? '99+' : totalNotifications}
        </Badge>
      )}

      {/* Subtle ring animation */}
      <span
        className={cn(
          'absolute inset-0 rounded-full',
          'border-2 border-cyan-400/50',
          'animate-ping',
          totalNotifications > 0 ? 'opacity-75' : 'opacity-0'
        )}
        style={{ animationDuration: '2s' }}
      />
    </button>
  );
}

// Mini version for inline use
export function SocialButtonMini({
  pendingRequestsCount = 0,
  onClick,
  className,
}: {
  pendingRequestsCount?: number;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-full',
        'bg-gradient-to-br from-cyan-500 to-blue-600',
        'transition-all duration-200',
        'hover:scale-105 active:scale-95',
        className
      )}
      aria-label="فتح النظام الاجتماعي"
    >
      <Users className="h-5 w-5 text-white" />
      {pendingRequestsCount > 0 && (
        <Badge
          className={cn(
            'absolute -top-1 -left-1 flex h-4 min-w-4 items-center justify-center',
            'bg-red-500 text-white text-[10px] font-bold',
            'border-2 border-[#050907]'
          )}
        >
          {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
        </Badge>
      )}
    </button>
  );
}

export default SocialButton;
