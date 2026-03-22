'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'full' | 'icon' | 'banner';
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function PWAInstallButton({
  className = '',
  variant = 'full',
  onInstall,
  onDismiss,
}: PWAInstallButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if already installed
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      
      // Show banner after a delay (don't annoy user immediately)
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed) {
          setShowBanner(true);
        }
      }, 3000);
    };

    const handleInstallAvailable = () => {
      const prompt = (window as any).pwaInstallPrompt;
      if (prompt) {
        setInstallPrompt(prompt);
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed) {
          setShowBanner(true);
        }
      }
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setInstallPrompt(null);
      onInstall?.();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('appinstalled', handleInstalled);

    // Check for existing prompt
    if ((window as any).pwaInstallPrompt) {
      setInstallPrompt((window as any).pwaInstallPrompt);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [onInstall]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowBanner(false);
        onInstall?.();
      }
      
      setInstallPrompt(null);
    } catch (error) {
      console.error('Install failed:', error);
    }
  }, [installPrompt, onInstall]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
    onDismiss?.();
  }, [onDismiss]);

  // Don't show if already installed
  if (isInstalled || isStandalone) {
    return null;
  }

  // iOS doesn't support beforeinstallprompt, show manual instructions
  if (isIOS && variant === 'banner') {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#050907] to-[#050907]/95 ${className}`}>
        <div className="max-w-md mx-auto bg-white/5 rounded-2xl p-4 border border-white/10">
          <div className="flex items-start gap-3">
            <div className="text-3xl">📱</div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">ثبّت التطبيق</h3>
              <p className="text-sm text-white/70">
                اضغط <Share className="inline h-4 w-4 mx-1" /> ثم "إضافة إلى الشاشة الرئيسية" <Plus className="inline h-4 w-4 mx-1" />
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/40 hover:text-white/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No install prompt available
  if (!installPrompt && !isIOS) {
    return null;
  }

  // Banner variant
  if (variant === 'banner' && showBanner) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-[#050907] to-[#050907]/95 ${className}`}>
        <div className="max-w-md mx-auto bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl p-4 border border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎮</div>
            <div className="flex-1">
              <h3 className="font-bold text-white">ثبّت الخبير على جهازك!</h3>
              <p className="text-sm text-white/70">العبه بدون متصفح وأسرع</p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-white/40 hover:text-white/70 mr-2"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={handleInstall}
              className="bg-white text-[#050907] px-4 py-2 rounded-full font-bold text-sm hover:bg-cyan-400 transition"
            >
              تثبيت
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Icon only variant
  if (variant === 'icon') {
    return (
      <button
        onClick={handleInstall}
        className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition ${className}`}
        title="ثبّت التطبيق"
      >
        <Download className="h-5 w-5 text-cyan-400" />
      </button>
    );
  }

  // Full variant
  return (
    <button
      onClick={handleInstall}
      className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full font-bold hover:opacity-90 transition ${className}`}
    >
      <Download className="h-5 w-5" />
      <span>ثبّت التطبيق</span>
    </button>
  );
}

export default PWAInstallButton;
