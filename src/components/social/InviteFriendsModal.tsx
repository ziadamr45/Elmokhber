'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserPlus, X, Check, Loader2, Users, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Friend, OnlineUser } from '@/hooks/useSocial';

interface InviteFriendsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: Friend[];
  onlineUsers: OnlineUser[];
  onInvite: (friendId: string) => Promise<boolean>;
  roomCode: string;
  gameMode: string;
}

export function InviteFriendsModal({
  open,
  onOpenChange,
  friends,
  onlineUsers,
  onInvite,
  roomCode,
  gameMode,
}: InviteFriendsModalProps) {
  const [invitedFriends, setInvitedFriends] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);

  // Get game mode name
  const getGameModeName = (mode: string) => {
    const modes: Record<string, string> = {
      'classic': 'كلاسيكي',
      'double-spies': 'مخبرين مزدوجين',
      'reversed': 'المقلوب',
      'silent': 'صامت',
    };
    return modes[mode] || mode;
  };

  // Check if friend is online
  const isFriendOnline = (friendId: string) => {
    return onlineUsers.some(u => u.id === friendId);
  };

  // Handle invite
  const handleInvite = async (friendId: string) => {
    if (invitedFriends.has(friendId)) return;
    
    setInviting(friendId);
    const success = await onInvite(friendId);
    
    if (success) {
      setInvitedFriends(prev => new Set([...prev, friendId]));
    }
    
    setInviting(null);
  };

  // Sort friends: online first, then offline
  const sortedFriends = [...friends].sort((a, b) => {
    const aOnline = isFriendOnline(a.id);
    const bOnline = isFriendOnline(b.id);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return 0;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0c120f] shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-bold">دعوة أصدقاء</h3>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-white/10 text-sm hover:bg-white/20 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Room Info */}
        <div className="p-3 bg-cyan-500/10 border-b border-cyan-500/20">
          <div className="text-center">
            <p className="text-xs text-white/60 mb-1">غرفة</p>
            <p className="font-mono text-lg font-bold text-cyan-400">{roomCode}</p>
            <p className="text-xs text-white/50 mt-1">وضع: {getGameModeName(gameMode)}</p>
          </div>
        </div>

        {/* Friends List */}
        <ScrollArea className="flex-1 p-3">
          {friends.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا يوجد أصدقاء</p>
              <p className="text-xs mt-1">أضف أصدقاء أولاً من "تواصل مع أصحابك!"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFriends.map((friend) => {
                const isOnline = isFriendOnline(friend.id);
                const isInvited = invitedFriends.has(friend.id);
                const isInviting = inviting === friend.id;

                return (
                  <div
                    key={friend.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl',
                      'border border-white/10',
                      isOnline ? 'bg-white/5' : 'bg-white/[0.02]',
                      !isOnline && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                          {friend.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Online indicator */}
                        <div className={cn(
                          'absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-[#0c120f]',
                          isOnline ? 'bg-green-500' : 'bg-white/30'
                        )} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{friend.name}</p>
                        <p className="text-xs text-white/50">
                          {isOnline ? (
                            <span className="text-green-400">متصل الآن</span>
                          ) : (
                            <span>غير متصل</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Invite Button */}
                    <button
                      type="button"
                      onClick={() => handleInvite(friend.id)}
                      disabled={!isOnline || isInvited || isInviting}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition',
                        isInvited
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : isOnline
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                            : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
                      )}
                    >
                      {isInviting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isInvited ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>تم الإرسال</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          <span>دعوة</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            الأصدقاء المتصلين فقط هيظهر لهم الإشعار فوراً
          </p>
        </div>
      </div>
    </div>
  );
}

export default InviteFriendsModal;
