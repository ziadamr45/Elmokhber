'use client';

import { useState, useCallback } from 'react';
import { Users, MessageCircle, Copy, Check, IdCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSocial, type Conversation, type User } from '@/hooks/useSocial';
import { FriendsList } from './FriendsList';
import { ChatWindow } from './ChatWindow';
import { AddFriendModal } from './AddFriendModal';

interface SocialViewProps {
  onBack: () => void;
  userId: string;
  userName: string;
  onInviteToRoom?: (friendId: string) => void;
  onJoinRoom?: (roomCode: string, gameType: string) => void;
  currentRoomCode?: string;
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

export function SocialView({
  onBack,
  userId,
  userName,
  onInviteToRoom,
  onJoinRoom,
  currentRoomCode,
}: SocialViewProps) {
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
    <div dir="rtl" className="min-h-screen bg-[#050907] text-white select-none">
      <div className="mx-auto min-h-screen w-full max-w-md px-5 py-6 flex flex-col">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-2xl text-white transition hover:bg-white/10"
          >
            →
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight">تواصل مع أصحابك!</h1>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <div
              className={cn(
                'h-3 w-3 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
              )}
              title={isConnected ? 'متصل' : 'غير متصل'}
            />
          </div>
        </div>

        {/* User ID Section */}
        <div className="mb-4 p-3 rounded-2xl border border-white/10 bg-white/5">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <IdCard className="h-4 w-4 text-cyan-400" />
              <span className="text-xs text-white/60">كودك الخاص:</span>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                'bg-white/5 hover:bg-white/10 transition-colors',
                'border border-white/10',
                copiedId && 'border-green-500/50 bg-green-500/10'
              )}
            >
              <span className="font-mono text-sm text-white font-bold truncate max-w-[120px]">{userId}</span>
              {copiedId ? (
                <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-white/50 shrink-0" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-white/40 mt-2 text-center">
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
            className="flex-1"
          />
        ) : (
          // Tabs view
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
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

        {/* Add Friend Modal */}
        <AddFriendModal
          open={showAddFriendModal}
          onOpenChange={setShowAddFriendModal}
          friends={friends}
          sentRequests={sentRequests}
          onSendRequest={handleSendFriendRequest}
        />
      </div>
    </div>
  );
}

export default SocialView;
