'use client';

import { useEffect, useState, useCallback } from 'react';
import type { ReminderType } from '@/hooks/usePrayerReminder';

interface PrayerReminderProps {
  type: ReminderType;
  prayerName?: string;
  prayerTime?: string;
  onDismiss: (remindLater: boolean) => void;
}

// Get content based on reminder type
function getReminderContent(type: ReminderType, prayerName?: string, prayerTime?: string) {
  switch (type) {
    case 'first-open':
      return {
        title: '⚠️ تنويه هام',
        message: 'لا تجعل اللعب يُلهيك عن الصلاة والعبادة 🤲\nخذ دقيقة وصلّي وارجع كمل لعبك 💙',
        isFullModal: true,
        icon: '🕌',
      };
    case 'prayer-time':
      return {
        title: `🕌 حان وقت صلاة ${prayerName}`,
        message: `الصلاة ${prayerTime}\nتوكل على الله وقم للصلاة 🤲`,
        isFullModal: true,
        icon: '📿',
      };
    case 'periodic':
      return {
        title: '⏰ تذكير',
        message: 'لا تنسَ الصلاة في وقتها\nاللعب ممتع لكن الصلاة أهم 💙',
        isFullModal: false,
        icon: '🤲',
      };
    case 'game-start':
      return {
        title: '⚠️ تذكير',
        message: 'لا تنسَ الصلاة في وقتها 🤲',
        isFullModal: false,
        icon: '🕌',
      };
    default:
      return {
        title: '⚠️ تنويه',
        message: 'لا تنسَ الصلاة في وقتها',
        isFullModal: false,
        icon: '🕌',
      };
  }
}

// Full Modal Component (for first open and prayer time)
function FullModal({
  title,
  message,
  icon,
  onDismiss,
}: {
  title: string;
  message: string;
  icon: string;
  onDismiss: (remindLater: boolean) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'bg-black/80' : 'bg-black/0'
      }`}
    >
      <div
        className={`w-full max-w-sm transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#0c120f] to-[#050907] p-6 shadow-2xl">
          {/* Icon */}
          <div className="mb-4 text-center text-5xl">{icon}</div>

          {/* Title */}
          <h2 className="mb-3 text-center text-xl font-black text-white">{title}</h2>

          {/* Message */}
          <p className="mb-6 whitespace-pre-line text-center text-base leading-relaxed text-white/80">
            {message}
          </p>

          {/* Decorative line */}
          <div className="mb-6 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => onDismiss(false)}
              className="w-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4 text-lg font-black text-white shadow-lg transition hover:opacity-90 active:scale-98"
            >
              حسنًا، فهمت ✅
            </button>
            <button
              onClick={() => onDismiss(true)}
              className="w-full rounded-full border border-white/20 bg-white/5 px-6 py-3 text-base font-bold text-white/70 transition hover:bg-white/10"
            >
              ذكرّني لاحقًا ⏰
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small Popup Component (for periodic and game start)
function SmallPopup({
  title,
  message,
  icon,
  onDismiss,
}: {
  title: string;
  message: string;
  icon: string;
  onDismiss: (remindLater: boolean) => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = useCallback((remindLater: boolean) => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(() => onDismiss(remindLater), 300);
  }, [onDismiss]);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 50);

    // Auto close after 10 seconds
    const autoClose = setTimeout(() => {
      handleClose(false);
    }, 10000);

    return () => clearTimeout(autoClose);
  }, [handleClose]);

  return (
    <div
      className={`fixed top-4 left-4 right-4 z-[100] flex justify-center transition-all duration-300 ${
        isVisible && !isClosing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="text-2xl">{icon}</div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="text-sm font-bold text-cyan-300">{title}</h3>
              <p className="mt-1 text-xs text-white/70">{message}</p>
            </div>

            {/* Close button */}
            <button
              onClick={() => handleClose(false)}
              className="text-white/50 hover:text-white transition"
            >
              ✕
            </button>
          </div>

          {/* Quick actions */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleClose(false)}
              className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/20"
            >
              حسنًا ✅
            </button>
            <button
              onClick={() => handleClose(true)}
              className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/60 transition hover:bg-white/5"
            >
              لاحقًا ⏰
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function PrayerReminder({
  type,
  prayerName,
  prayerTime,
  onDismiss,
}: PrayerReminderProps) {
  const content = getReminderContent(type, prayerName, prayerTime);

  if (content.isFullModal) {
    return (
      <FullModal
        title={content.title}
        message={content.message}
        icon={content.icon}
        onDismiss={onDismiss}
      />
    );
  }

  return (
    <SmallPopup
      title={content.title}
      message={content.message}
      icon={content.icon}
      onDismiss={onDismiss}
    />
  );
}

// Prayer times display component
export function PrayerTimesDisplay({
  prayerTimes,
  nextPrayer,
}: {
  prayerTimes: {
    Fajr: string;
    Sunrise: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  } | null;
  nextPrayer: {
    name: string;
    nameAr: string;
    time: string;
    minutesUntil: number;
  } | null;
}) {
  if (!prayerTimes) return null;

  const prayers = [
    { key: 'Fajr', name: 'الفجر', time: prayerTimes.Fajr, icon: '🌅' },
    { key: 'Sunrise', name: 'الشروق', time: prayerTimes.Sunrise, icon: '☀️' },
    { key: 'Dhuhr', name: 'الظهر', time: prayerTimes.Dhuhr, icon: '🌞' },
    { key: 'Asr', name: 'العصر', time: prayerTimes.Asr, icon: '🌤️' },
    { key: 'Maghrib', name: 'المغرب', time: prayerTimes.Maghrib, icon: '🌅' },
    { key: 'Isha', name: 'العشاء', time: prayerTimes.Isha, icon: '🌙' },
  ];

  return (
    <div className="rounded-xl bg-white/5 p-3 border border-white/10">
      <div className="text-xs text-white/50 mb-2 text-center">مواعيد الصلاة</div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {prayers.map((prayer) => (
          <div
            key={prayer.key}
            className={`rounded-lg p-2 ${
              nextPrayer?.name === prayer.key
                ? 'bg-cyan-500/20 border border-cyan-500/30'
                : 'bg-white/5'
            }`}
          >
            <div className="text-sm">{prayer.icon}</div>
            <div className="font-bold text-white/80">{prayer.name}</div>
            <div className="text-white/50">{prayer.time}</div>
          </div>
        ))}
      </div>
      {nextPrayer && (
        <div className="mt-2 text-center text-xs text-cyan-300">
          الصلاة القادمة: {nextPrayer.nameAr} ({nextPrayer.minutesUntil} دقيقة)
        </div>
      )}
    </div>
  );
}
