'use client';

import { useState, useCallback, useEffect } from 'react';
import { Users, MessageCircle, Bell, ArrowRight, Copy, Check, IdCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSocial, type Friend, type Conversation, type User } from '@/hooks/useSocial';
import { FriendsList } from './FriendsList';
import { ChatWindow } from './ChatWindow';
import { AddFriendModal } from './AddFriendModal';

interface SocialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onInviteToRoom?: (friendId: string) => void;
  onJoinRoom?: (roomCode: string, gameType: string) => void;
  currentRoomCode?: string;
  className?: string;
}

// Conversation list item component
function ConversationItem({
  conversation,
  onClick,
  isActive,
}: {
  conversation: Conversation;
  onClick: () => void;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg',
        'transition-colors duration-150',
        isActive
          ? 'bg-cyan-500/20 border border-cyan-400/30'
          : 'hover:bg-white/5'
      )}
    >
      <div className="relative shrink-0">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
          {conversation.user.name.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className={cn(
          'font-medium truncate',
          isActive ? 'text-cyan-400' : 'text-white'
        )}>
          {conversation.user.name}
        </p>
        <p className="text-xs text-white/50 truncate">
          {conversation.lastMessage.content}
        </p>
      </div>
      {conversation.unreadCount > 0 && (
        <Badge className="h-5 min-w-5 bg-cyan-500 text-white text-xs">
          {conversation.unreadCount}
        </Badge>
      )}
    </button>
  );
}

// Notification list item component
function NotificationItem({
  notification,
  onMarkRead,
  onJoinRoom,
}: {
  notification: {
    id: string;
    type: 'friend_request' | 'friend_accepted' | 'new_message' | 'room_invite';
    title: string;
    content: string;
    data?: unknown;
    isRead?: boolean;
    createdAt: string | number;
  };
  onMarkRead?: (id: string) => void;
  onJoinRoom?: (roomCode: string, gameType: string) => void;
}) {
  const getIcon = () => {
    switch (notification.type) {
      case 'friend_request':
        return '👋';
      case 'friend_accepted':
        return '✅';
      case 'new_message':
        return '💬';
      case 'room_invite':
        return '🎮';
      default:
        return '🔔';
    }
  };

  const formatTime = (date: string | number) => {
    const now = new Date();
    const notifDate = new Date(date);
    const diffMs = now.getTime() - notifDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffMins < 1440) return `منذ ${Math.floor(diffMins / 60)} ساعة`;
    return notifDate.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
  };

  // Parse invite data for room_invite type
  const inviteData = notification.type === 'room_invite' && notification.data
    ? (notification.data as { roomCode?: string; gameType?: string; inviteId?: string })
    : null;

  const handleJoinClick = () => {
    if (inviteData?.roomCode && inviteData?.gameType) {
      onJoinRoom?.(inviteData.roomCode, inviteData.gameType);
      onMarkRead?.(notification.id);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 p-3 rounded-lg',
        'transition-colors duration-150',
        notification.isRead ? 'bg-transparent' : 'bg-cyan-500/5 border-r-2 border-cyan-400'
      )}
      onClick={() => !notification.isRead && notification.type !== 'room_invite' && onMarkRead?.(notification.id)}
    >
      <div className="flex items-start gap-3">
        <div className="text-xl shrink-0">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium',
            notification.isRead ? 'text-white/60' : 'text-white'
          )}>
            {notification.title}
          </p>
          <p className="text-xs text-white/40 truncate">{notification.content}</p>
          <p className="text-[10px] text-white/30 mt-1">{formatTime(notification.createdAt)}</p>
        </div>
      </div>
      
      {/* Join Now button for room invites */}
      {notification.type === 'room_invite' && inviteData?.roomCode && (
        <div className="flex gap-2 mr-8">
          <button
            type="button"
            onClick={handleJoinClick}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-500 hover:bg-green-400 text-white text-sm font-bold py-2 transition"
          >
            <span>🎮</span>
            <span>انضم الآن</span>
          </button>
          <button
            type="button"
            onClick={() => onMarkRead?.(notification.id)}
            className="px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 text-sm transition"
          >
            تجاهل
          </button>
        </div>
      )}
    </div>
  );
}

export function SocialPanel({
  isOpen,
  onClose,
  userId,
  userName,
  onInviteToRoom,
  currentRoomCode,
  className,
}: SocialPanelProps) {
  const [activeTab, setActiveTab] = useState('friends');
  const [selectedChatUser, setSelectedChatUser] = useState<User | null>(null);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);

  // Initialize social hook
  const {
    isConnected,
    onlineUsers,
    friends,
    pendingRequests,
    sentRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    refreshFriends,
    conversations,
    currentConversation,
    sendMessage,
    getConversation,
    typingUsers,
    sendTypingIndicator,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    markAllNotificationsRead,
  } = useSocial({
    userId,
    userName,
    autoConnect: true,
  });

  // Handle sending a message to a friend
  const handleSendMessage = useCallback(async (friendId: string) => {
    const friend = friends.find((f) => f.id === friendId);
    if (friend) {
      setSelectedChatUser(friend);
      await getConversation(friendId);
    }
  }, [friends, getConversation]);

  // Handle inviting a friend to a room
  const handleInviteToRoom = useCallback((friendId: string) => {
    onInviteToRoom?.(friendId);
  }, [onInviteToRoom]);

  // Handle sending a friend request
  const handleSendFriendRequest = useCallback(async (friendId: string) => {
    return sendFriendRequest(friendId);
  }, [sendFriendRequest]);

  // Handle sending a chat message
  const handleSendChatMessage = useCallback(async (content: string) => {
    if (selectedChatUser) {
      await sendMessage(selectedChatUser.id, content);
    }
  }, [selectedChatUser, sendMessage]);

  // Handle typing indicator
  const handleTyping = useCallback((isTyping: boolean) => {
    if (selectedChatUser) {
      sendTypingIndicator(selectedChatUser.id, isTyping);
    }
  }, [selectedChatUser, sendTypingIndicator]);

  // Mark notification as read
  const handleMarkNotificationRead = useCallback((notificationId: string) => {
    markNotificationsRead([notificationId]);
  }, [markNotificationsRead]);

  // Close chat window
  const handleBackFromChat = useCallback(() => {
    setSelectedChatUser(null);
  }, []);

  // Calculate pending requests count for badge
  const pendingCount = pendingRequests.length;
  const unreadMessagesCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Copy ID state
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch (err) {
      console.error('Failed to copy ID:', err);
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Panel - slides from the left (RTL) */}
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50',
          'w-full max-w-sm',
          'bg-[#0c120f] border-r border-white/10',
          'shadow-xl shadow-black/50',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/5"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-bold text-white">النظام الاجتماعي</h2>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )}
              title={isConnected ? 'متصل' : 'غير متصل'}
            />
          </div>
        </div>

        {/* User ID Section */}
        <div className="p-3 border-b border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IdCard className="h-4 w-4 text-cyan-400" />
              <span className="text-xs text-white/60">كودك الخاص:</span>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                'bg-white/5 hover:bg-white/10 transition-colors',
                'border border-white/10',
                copiedId && 'border-green-500/50 bg-green-500/10'
              )}
            >
              <span className="font-mono text-sm text-white font-bold">{userId}</span>
              {copiedId ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-white/50" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-white/40 mt-1 text-center">
            شارك الكود ده مع أصحابك عشان يضيفوك
          </p>
        </div>

        {/* Content */}
        {selectedChatUser && currentConversation ? (
          // Chat window view
          <ChatWindow
            otherUser={selectedChatUser}
            messages={currentConversation.messages}
            currentUserId={userId}
            isTyping={typingUsers.get(selectedChatUser.id) || false}
            onSendMessage={handleSendChatMessage}
            onTyping={handleTyping}
            onBack={handleBackFromChat}
            className="h-[calc(100vh-57px)]"
          />
        ) : (
          // Tabs view
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-[calc(100vh-57px)] flex flex-col"
          >
            <TabsList className="w-full justify-start bg-transparent p-0 border-b border-white/10 rounded-none">
              <TabsTrigger
                value="friends"
                className="gap-2 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 data-[state=active]:text-cyan-400 rounded-none"
              >
                <Users className="h-4 w-4" />
                الأصدقاء
                {pendingCount > 0 && (
                  <Badge className="h-4 min-w-4 bg-red-500 text-white text-[10px]">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="gap-2 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-cyan-400 data-[state=active]:text-cyan-400 rounded-none"
              >
                <MessageCircle className="h-4 w-4" />
                المحادثات
                {unreadMessagesCount > 0 && (
                  <Badge className="h-4 min-w-4 bg-cyan-500 text-white text-[10px]">
                    {unreadMessagesCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Friends Tab */}
            <TabsContent value="friends" className="flex-1 m-0 overflow-hidden">
              <FriendsList
                friends={friends}
                pendingRequests={pendingRequests}
                sentRequests={sentRequests}
                onlineUsers={onlineUsers}
                onSendMessage={handleSendMessage}
                onInviteToRoom={handleInviteToRoom}
                onAcceptRequest={acceptFriendRequest}
                onRejectRequest={rejectFriendRequest}
                onRemoveFriend={removeFriend}
                onAddFriend={() => setShowAddFriendModal(true)}
                className="h-full"
              />
            </TabsContent>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-white/50">
                    <MessageCircle className="h-12 w-12 mb-2 opacity-30" />
                    <p className="text-sm">لا توجد محادثات</p>
                    <p className="text-xs mt-1">ابدأ محادثة مع صديقك</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {conversations.map((conversation) => (
                      <ConversationItem
                        key={conversation.user.id}
                        conversation={conversation}
                        onClick={() => {
                          setSelectedChatUser(conversation.user);
                          getConversation(conversation.user.id);
                        }}
                        isActive={selectedChatUser?.id === conversation.user.id}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

          </Tabs>
        )}
      </div>

      {/* Add Friend Modal */}
      <AddFriendModal
        open={showAddFriendModal}
        onOpenChange={setShowAddFriendModal}
        friends={friends}
        sentRequests={sentRequests}
        onSendRequest={handleSendFriendRequest}
      />
    </>
  );
}

export default SocialPanel;
