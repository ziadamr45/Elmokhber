'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, Info, AlertTriangle, AlertCircle, Gamepad2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastData {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error' | 'game';
  title: string;
  message: string;
  icon?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastNotificationProps {
  toasts: ToastData[];
  removeToast: (id: string) => void;
}

const toastIcons = {
  success: <CheckCircle className="h-5 w-5 text-green-400" />,
  info: <Info className="h-5 w-5 text-blue-400" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
  error: <AlertCircle className="h-5 w-5 text-red-400" />,
  game: <Gamepad2 className="h-5 w-5 text-purple-400" />,
};

const toastStyles = {
  success: 'border-green-500/30 bg-green-500/10',
  info: 'border-blue-500/30 bg-blue-500/10',
  warning: 'border-yellow-500/30 bg-yellow-500/10',
  error: 'border-red-500/30 bg-red-500/10',
  game: 'border-purple-500/30 bg-purple-500/10',
};

function SingleToast({ 
  toast, 
  onRemove 
}: { 
  toast: ToastData; 
  onRemove: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const duration = toast.duration || 5000;

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onRemove(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.id, duration, onRemove]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm',
        'shadow-lg shadow-black/20',
        'transition-all duration-300 transform',
        toastStyles[toast.type],
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
    >
      <div className="flex-shrink-0">
        {toast.icon ? (
          <span className="text-2xl">{toast.icon}</span>
        ) : (
          toastIcons[toast.type]
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm">{toast.title}</p>
        <p className="text-white/70 text-xs mt-0.5">{toast.message}</p>
        
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition"
          >
            {toast.action.label} ←
          </button>
        )}
      </div>
      
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-white/40 hover:text-white/70 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastNotification({ toasts, removeToast }: ToastNotificationProps) {
  return (
    <div className="fixed top-4 left-4 right-4 z-[100] pointer-events-none">
      <div className="flex flex-col gap-2 items-end max-w-sm ml-auto">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full">
            <SingleToast toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Hook لإدارة الـ Toasts
export function useToastNotifications() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Helper functions
  const showSuccess = useCallback((title: string, message: string, options?: Partial<ToastData>) => {
    addToast({ type: 'success', title, message, ...options });
  }, [addToast]);

  const showInfo = useCallback((title: string, message: string, options?: Partial<ToastData>) => {
    addToast({ type: 'info', title, message, ...options });
  }, [addToast]);

  const showWarning = useCallback((title: string, message: string, options?: Partial<ToastData>) => {
    addToast({ type: 'warning', title, message, ...options });
  }, [addToast]);

  const showError = useCallback((title: string, message: string, options?: Partial<ToastData>) => {
    addToast({ type: 'error', title, message, ...options });
  }, [addToast]);

  const showGame = useCallback((title: string, message: string, options?: Partial<ToastData>) => {
    addToast({ type: 'game', title, message, ...options });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    showSuccess,
    showInfo,
    showWarning,
    showError,
    showGame,
  };
}

export default ToastNotification;
