'use client';

import { useState } from 'react';
import { shareRoom, copyShareMessage, isShareSupported, type GameType } from '@/lib/share';

interface RoomShareButtonProps {
  gameType: GameType;
  roomCode: string;
  playerName?: string;
  mode?: string;
  difficulty?: string;
  playType?: 'individual' | 'teams' | 'solo';
  className?: string;
  variant?: 'full' | 'icon' | 'text';
}

/**
 * مكون زر المشاركة الاحترافي لكود الغرفة
 * يدعم Web Share API والنسخ للحافظة
 */
export function RoomShareButton({
  gameType,
  roomCode,
  playerName,
  mode,
  difficulty,
  playType,
  className = '',
  variant = 'full',
}: RoomShareButtonProps) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    
    const shareOptions = {
      gameType,
      roomCode,
      playerName,
      mode,
      difficulty,
      playType: playType === 'solo' || playType === 'individual' ? 'individual' as const : playType === 'teams' ? 'teams' as const : undefined,
    };

    try {
      // Try native share first
      const shared = await shareRoom(shareOptions);
      
      if (shared) {
        if (!isShareSupported()) {
          // If native share not supported, it means we copied to clipboard
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }
    } catch (error) {
      console.error('Share error:', error);
      // Fallback: copy message to clipboard
      const copied = await copyShareMessage(shareOptions);
      if (copied) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } finally {
      setSharing(false);
    }
  };

  // Icon only variant
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className={`flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-all active:scale-95 disabled:opacity-50 ${className}`}
        title="مشاركة"
        aria-label="مشاركة كود الغرفة"
      >
        {copied ? (
          <span className="text-lg">✓</span>
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
      </button>
    );
  }

  // Text only variant
  if (variant === 'text') {
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={sharing}
        className={`font-bold transition-all active:scale-95 disabled:opacity-50 ${className}`}
      >
        {copied ? 'تم النسخ ✓' : sharing ? '...جاري' : 'مشاركة'}
      </button>
    );
  }

  // Full variant (default)
  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className={`flex items-center justify-center gap-2 rounded-full px-4 py-2 font-bold transition-all active:scale-95 disabled:opacity-50 ${className}`}
    >
      {copied ? (
        <>
          <span className="text-lg">✓</span>
          <span>تم النسخ</span>
        </>
      ) : (
        <>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>{sharing ? '...جاري' : 'مشاركة'}</span>
        </>
      )}
    </button>
  );
}

/**
 * مكون عرض كود الغرفة مع زر المشاركة
 * يحل محل عرض الكود البسيط
 */
interface RoomCodeDisplayProps {
  gameType: GameType;
  roomCode: string;
  roomName?: string | null;
  playerName?: string;
  mode?: string;
  difficulty?: string;
  playType?: 'individual' | 'teams' | 'solo';
  showCopyButton?: boolean;
}

export function RoomCodeDisplay({
  gameType,
  roomCode,
  roomName,
  playerName,
  mode,
  difficulty,
  playType,
  showCopyButton = true,
}: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="rounded-[2rem] bg-white px-5 py-5 text-center text-[#050907]">
      {roomName ? (
        <>
          <div className="text-sm font-bold mb-1">الغرفة</div>
          <div className="text-2xl font-black text-cyan-600 mb-2">{roomName}</div>
          <div className="text-xs text-gray-500 mb-2">كود: {roomCode}</div>
        </>
      ) : (
        <div className="text-sm font-bold mb-2">كود الغرفة</div>
      )}
      
      <div className="flex items-center justify-center gap-3">
        {/* Room Code Display */}
        <button
          type="button"
          onClick={handleCopyCode}
          className="text-4xl font-black tracking-[0.25em] hover:opacity-70 transition cursor-pointer"
          title="اضغط للنسخ"
        >
          {roomCode}
        </button>
        
        {/* Share Button */}
        <RoomShareButton
          gameType={gameType}
          roomCode={roomCode}
          playerName={playerName}
          mode={mode}
          difficulty={difficulty}
          playType={playType}
          variant="icon"
          className="h-10 w-10 bg-[#050907] text-white"
        />
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-center gap-3">
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopyCode}
            className="rounded-full bg-[#050907] px-4 py-2 text-sm font-black text-white transition hover:opacity-80 active:scale-95"
          >
            {copied ? 'تم النسخ ✓' : '📋 نسخ الكود'}
          </button>
        )}
        
        <RoomShareButton
          gameType={gameType}
          roomCode={roomCode}
          playerName={playerName}
          mode={mode}
          difficulty={difficulty}
          playType={playType}
          className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 text-sm"
        />
      </div>
    </div>
  );
}

export default RoomShareButton;
