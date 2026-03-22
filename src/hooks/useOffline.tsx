'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface OfflineState {
  isOnline: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  lastOnlineTime: number | null;
  showOfflineMessage: boolean;
}

export function useOffline(): OfflineState & {
  hideOfflineMessage: () => void;
  showOfflineMessage: () => void;
} {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(null);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);
    
    if (navigator.onLine) {
      setLastOnlineTime(Date.now());
    }

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineTime(Date.now());
      
      // Show welcome back message if was offline
      if (wasOffline) {
        setShowOfflineMessage(true);
        setTimeout(() => setShowOfflineMessage(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowOfflineMessage(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const hideOfflineMessage = useCallback(() => {
    setShowOfflineMessage(false);
  }, []);

  const showOfflineMsg = useCallback(() => {
    setShowOfflineMessage(true);
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline,
    lastOnlineTime,
    showOfflineMessage,
    hideOfflineMessage,
    showOfflineMessage: showOfflineMsg,
  };
}

// Component to show offline status
export function OfflineIndicator() {
  const { isOffline, showOfflineMessage, hideOfflineMessage } = useOffline();

  if (!showOfflineMessage) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-bounce">
      <div className={`max-w-md mx-auto mt-2 p-3 rounded-b-xl text-center text-sm font-bold ${
        isOffline 
          ? 'bg-red-500/90 text-white' 
          : 'bg-green-500/90 text-white'
      }`}>
        {isOffline ? (
          <span>📡 غير متصل بالإنترنت - الأونلاين غير متاح</span>
        ) : (
          <span>✅ عاد الاتصال بالإنترنت!</span>
        )}
        <button 
          onClick={hideOfflineMessage}
          className="mr-2 text-white/70 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default useOffline;
