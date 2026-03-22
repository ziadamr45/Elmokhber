'use client';

import { useState } from 'react';
import { MessageCircle, Gamepad2, UserPlus, Check, X, Search, MoreVertical, UserMinus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Friend, FriendRequest, OnlineUser } from '@/hooks/useSocial';

// Extended Friend type with isOnline from API
interface FriendWithStatus extends Friend {
  isOnline?: boolean;
  lastSeenAt?: Date | string | null;
}

interface FriendsListProps {
  friends: FriendWithStatus[];
  pendingRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  onlineUsers: OnlineUser[];
  onSendMessage?: (friendId: string) => void;
  onInviteToRoom?: (friendId: string) => void;
  onAcceptRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string) => void;
  onRemoveFriend?: (friendId: string) => void;
  onAddFriend?: () => void;
  className?: string;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Check if friend is online (prefer isOnline from API, fallback to onlineUsers list)
function isUserOnline(friend: FriendWithStatus, onlineUsers: OnlineUser[]): boolean {
  // If API provides isOnline, use it
  if (friend.isOnline !== undefined) {
    return friend.isOnline;
  }
  // Fallback to onlineUsers list from WebSocket
  return onlineUsers.some((u) => u.id === friend.id);
}

// Get user status
function getUserStatus(friend: FriendWithStatus, onlineUsers: OnlineUser[]): 'online' | 'away' | 'busy' | 'offline' {
  if (isUserOnline(friend, onlineUsers)) {
    // Check for specific status in onlineUsers
    const onlineUser = onlineUsers.find((u) => u.id === friend.id);
    return onlineUser?.status || 'online';
  }
  return 'offline';
}

export function FriendsList({
  friends,
  pendingRequests,
  sentRequests,
  onlineUsers,
  onSendMessage,
  onInviteToRoom,
  onAcceptRequest,
  onRejectRequest,
  onRemoveFriend,
  onAddFriend,
  className,
}: FriendsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineFriends = filteredFriends.filter((f) => isUserOnline(f, onlineUsers));
  const offlineFriends = filteredFriends.filter((f) => !isUserOnline(f, onlineUsers));

  const sortedFriends = [...onlineFriends, ...offlineFriends];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search and Add Friend */}
      <div className="p-3 space-y-3 border-b border-white/10">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <Input
            placeholder="ابحث عن أصدقائك..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
          />
        </div>
        <Button
          onClick={onAddFriend}
          variant="outline"
          className="w-full border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
        >
          <UserPlus className="h-4 w-4 ml-2" />
          إضافة صديق
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors',
            activeTab === 'friends'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-white/60 hover:text-white'
          )}
        >
          الأصدقاء ({friends.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'pending'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-white/60 hover:text-white'
          )}
        >
          الطلبات
          {pendingRequests.length > 0 && (
            <Badge className="absolute -top-1 left-2 h-5 min-w-5 bg-red-500 text-white text-xs">
              {pendingRequests.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'friends' ? (
          <div className="p-2">
            {sortedFriends.length === 0 ? (
              <div className="py-12 text-center text-white/50">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {searchQuery ? 'لم يتم العثور على أصدقاء' : 'لا يوجد أصدقاء بعد'}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={onAddFriend}
                    variant="link"
                    className="text-cyan-400 mt-2"
                  >
                    أضف صديقك الأول
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {sortedFriends.map((friend) => {
                  const isOnline = isUserOnline(friend, onlineUsers);
                  const status = getUserStatus(friend, onlineUsers);

                  return (
                    <div
                      key={friend.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg',
                        'hover:bg-white/5 transition-colors',
                        'group'
                      )}
                    >
                      {/* Avatar with status */}
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarImage src={friend.avatar || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-bold">
                            {getInitials(friend.name)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Status indicator */}
                        <div
                          className={cn(
                            'absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-[#0c120f]',
                            status === 'online' && 'bg-green-500',
                            status === 'away' && 'bg-yellow-500',
                            status === 'busy' && 'bg-red-500',
                            status === 'offline' && 'bg-gray-500'
                          )}
                        />
                      </div>

                      {/* Name and info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium truncate',
                          isOnline ? 'text-white' : 'text-white/60'
                        )}>
                          {friend.name}
                        </p>
                        <p className="text-xs text-white/40">
                          {isOnline ? 'متصل الآن' : 'غير متصل'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-cyan-400 hover:bg-cyan-400/10"
                          onClick={() => onSendMessage?.(friend.id)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-purple-400 hover:bg-purple-400/10"
                          onClick={() => onInviteToRoom?.(friend.id)}
                          disabled={!isOnline}
                        >
                          <Gamepad2 className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-[#0c120f] border-white/10">
                            <DropdownMenuItem
                              onClick={() => onRemoveFriend?.(friend.id)}
                              className="text-red-400 focus:text-red-400"
                            >
                              <UserMinus className="h-4 w-4 ml-2" />
                              إزالة الصديق
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-3">
            {/* Pending requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-white/50 px-2 font-medium">طلبات الصداقة</h4>
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-cyan-500/5 border border-cyan-400/20"
                  >
                    <Avatar className="h-10 w-10 border border-white/10">
                      <AvatarImage src={request.user.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-bold">
                        {getInitials(request.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{request.user.name}</p>
                      <p className="text-xs text-white/40">يريد أن يكون صديقك</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-400 hover:bg-green-400/10"
                        onClick={() => onAcceptRequest?.(request.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:bg-red-400/10"
                        onClick={() => onRejectRequest?.(request.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sent requests */}
            {sentRequests.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-white/50 px-2 font-medium">طلبات مرسلة</h4>
                {sentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                  >
                    <Avatar className="h-10 w-10 border border-white/10">
                      <AvatarImage src={request.user.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white text-sm font-bold">
                        {getInitials(request.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white/70 truncate">{request.user.name}</p>
                      <p className="text-xs text-white/40">في انتظار الرد...</p>
                    </div>
                    <Badge variant="outline" className="text-white/40 border-white/20">
                      قيد الانتظار
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div className="py-12 text-center text-white/50">
                <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا توجد طلبات صداقة</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default FriendsList;
