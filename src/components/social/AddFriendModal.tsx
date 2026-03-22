'use client';

import { useState, useCallback, useEffect } from 'react';
import { Search, UserPlus, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { User, Friend, FriendRequest } from '@/hooks/useSocial';

interface SearchResultUser {
  id: string;
  name: string;
  avatar?: string | null;
  level?: number;
  title?: string | null;
}

interface AddFriendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friends: Friend[];
  sentRequests: FriendRequest[];
  onSendRequest: (friendId: string) => Promise<{ success: boolean; error?: string }>;
  onSearchUsers?: (query: string) => Promise<SearchResultUser[]>;
  className?: string;
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function AddFriendModal({
  open,
  onOpenChange,
  friends,
  sentRequests,
  onSendRequest,
  onSearchUsers,
  className,
}: AddFriendModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Search users when query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setIsSearching(true);
      setError(null);

      try {
        if (onSearchUsers) {
          const results = await onSearchUsers(debouncedQuery);
          setSearchResults(results);
        } else {
          // Default API search
          const response = await fetch(`/api/social/users/search?q=${encodeURIComponent(debouncedQuery)}`);
          if (response.ok) {
            const data = await response.json();
            setSearchResults(data.users || []);
          } else {
            setSearchResults([]);
          }
        }
      } catch {
        setError('حدث خطأ أثناء البحث');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    search();
  }, [debouncedQuery, onSearchUsers]);

  // Check if user is already a friend or has pending request
  const getUserStatus = (userId: string): 'friend' | 'pending' | 'sent' | 'none' => {
    if (friends.some((f) => f.id === userId)) return 'friend';
    if (sentRequests.some((r) => r.user.id === userId) || sentTo.has(userId)) return 'sent';
    return 'none';
  };

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    setError(null);

    try {
      const result = await onSendRequest(userId);
      if (result.success) {
        setSentTo((prev) => new Set(prev).add(userId));
      } else {
        setError(result.error || 'حدث خطأ أثناء إرسال الطلب');
      }
    } catch {
      setError('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setSendingTo(null);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'bg-[#0c120f] border-white/10 text-white',
          'max-w-md',
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">إضافة صديق</DialogTitle>
          <DialogDescription className="text-white/60">
            ابحث عن صديق باستخدام اسمه أو كوده الخاص
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="ابحث عن صديق..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400 animate-spin" />
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-2 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Search results */}
          <ScrollArea className="max-h-60">
            {searchQuery.trim() === '' ? (
              <div className="py-8 text-center text-white/50">
                <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">اكتب اسم صديقك للبحث عنه</p>
              </div>
            ) : isSearching ? (
              <div className="py-8 text-center text-white/50">
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-cyan-400 animate-spin" />
                <p className="text-sm">جاري البحث...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center text-white/50">
                <UserPlus className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">لم يتم العثور على مستخدمين</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((user) => {
                  const status = getUserStatus(user.id);
                  const isSending = sendingTo === user.id;

                  return (
                    <div
                      key={user.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-lg',
                        'bg-white/5 hover:bg-white/10 transition-colors'
                      )}
                    >
                      <Avatar className="h-10 w-10 border border-white/10">
                        <AvatarImage src={user.avatar || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white text-sm font-bold">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{user.name}</p>
                        {user.title && (
                          <p className="text-xs text-cyan-400">{user.title}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {status === 'friend' ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <Check className="h-3 w-3 ml-1" />
                            صديق
                          </Badge>
                        ) : status === 'sent' ? (
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            قيد الانتظار
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSendRequest(user.id)}
                            disabled={isSending}
                            className={cn(
                              'h-8 px-3',
                              'bg-cyan-500 hover:bg-cyan-400',
                              'text-white'
                            )}
                          >
                            {isSending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 ml-1" />
                                إضافة
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Tips */}
          <div className="text-xs text-white/40 bg-white/5 p-3 rounded-lg">
            <p className="font-medium text-white/60 mb-1">نصيحة:</p>
            <p>يمكنك البحث عن صديق باستخدام اسمه أو كوده الخاص.</p>
            <p className="mt-1">اطلب من صديقك يشاركك كوده الخاص عشان تلاقيه بسهولة.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddFriendModal;
