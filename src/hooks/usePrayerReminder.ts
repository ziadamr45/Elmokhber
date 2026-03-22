'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Types
export interface PrayerTime {
  name: string;
  nameAr: string;
  time: string;
  minutesUntil: number;
}

export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export type ReminderType = 'first-open' | 'game-start' | 'periodic' | 'prayer-time';

export interface ReminderState {
  shouldShow: boolean;
  type: ReminderType;
  prayerName?: string;
  prayerTime?: string;
}

// Storage keys
const STORAGE_KEYS = {
  firstOpenShown: 'prayer_reminder_first_open',
  lastPeriodicReminder: 'prayer_reminder_last_periodic',
  lastPrayerReminder: 'prayer_reminder_last_prayer',
  dismissedUntil: 'prayer_reminder_dismissed_until',
};

// Constants
const PERIODIC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const DISMISS_DURATION_MS = 10 * 60 * 1000; // 10 minutes after "remind me later"

export function usePrayerReminder() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes | null>(null);
  const [nextPrayer, setNextPrayer] = useState<PrayerTime | null>(null);
  const [reminderState, setReminderState] = useState<ReminderState>({
    shouldShow: false,
    type: 'first-open',
  });

  const hasCheckedFirstOpen = useRef(false);
  const periodicCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const prayerCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Check if we should show reminder
  const checkAndShowReminder = useCallback((type: ReminderType, prayerName?: string, prayerTime?: string) => {
    // Check if user dismissed reminders recently
    if (typeof window === 'undefined') return false;

    const dismissedUntil = localStorage.getItem(STORAGE_KEYS.dismissedUntil);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return false;
    }

    setReminderState({
      shouldShow: true,
      type,
      prayerName,
      prayerTime,
    });

    return true;
  }, []);

  // Fetch prayer times
  const fetchPrayerTimes = useCallback(async () => {
    try {
      const response = await fetch('/api/prayer-times');
      const data = await response.json();

      if (data.success && data.times) {
        setPrayerTimes(data.times);
        setNextPrayer(data.nextPrayer);
      }
    } catch (error) {
      console.error('[PrayerReminder] Error fetching prayer times:', error);
    }
  }, []);

  // Check for first open - show every time app opens
  const checkFirstOpen = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (hasCheckedFirstOpen.current) return;
    hasCheckedFirstOpen.current = true;

    // Always show reminder on app open (don't check localStorage)
    checkAndShowReminder('first-open');
  }, [checkAndShowReminder]);

  // Check for periodic reminder (every 30 minutes)
  const checkPeriodicReminder = useCallback(() => {
    if (typeof window === 'undefined') return;

    const lastPeriodic = localStorage.getItem(STORAGE_KEYS.lastPeriodicReminder);
    const now = Date.now();

    if (!lastPeriodic || now - parseInt(lastPeriodic) >= PERIODIC_INTERVAL_MS) {
      if (checkAndShowReminder('periodic')) {
        localStorage.setItem(STORAGE_KEYS.lastPeriodicReminder, now.toString());
      }
    }
  }, [checkAndShowReminder]);

  // Check for prayer time reminder
  const checkPrayerTimeReminder = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!nextPrayer) return;

    const lastPrayerReminder = localStorage.getItem(STORAGE_KEYS.lastPrayerReminder);

    // If we're within 5 minutes of prayer time
    if (nextPrayer.minutesUntil <= 5 && nextPrayer.minutesUntil > 0) {
      // Don't repeat for same prayer
      if (lastPrayerReminder !== nextPrayer.name) {
        if (checkAndShowReminder('prayer-time', nextPrayer.nameAr, nextPrayer.time)) {
          localStorage.setItem(STORAGE_KEYS.lastPrayerReminder, nextPrayer.name);
        }
      }
    }
  }, [nextPrayer, checkAndShowReminder]);

  // Show game start reminder (small popup)
  const showGameStartReminder = useCallback(() => {
    if (typeof window === 'undefined') return false;

    const dismissedUntil = localStorage.getItem(STORAGE_KEYS.dismissedUntil);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return false;
    }

    // Show small reminder for game start (not full modal)
    setReminderState({
      shouldShow: true,
      type: 'game-start',
    });

    return true;
  }, []);

  // Dismiss reminder
  const dismissReminder = useCallback((remindLater: boolean = false) => {
    if (typeof window === 'undefined') return;

    if (remindLater) {
      localStorage.setItem(STORAGE_KEYS.dismissedUntil, (Date.now() + DISMISS_DURATION_MS).toString());
    }

    // Don't save firstOpenShown - we want to show it every time
    setReminderState({ shouldShow: false, type: 'first-open' });
  }, []);

  // Initialize - fetch prayer times
  useEffect(() => {
    // Defer to avoid setState in effect
    const initTimeout = setTimeout(() => {
      fetchPrayerTimes();
      checkFirstOpen();
    }, 100);

    // Refresh prayer times every hour
    const refreshInterval = setInterval(fetchPrayerTimes, 60 * 60 * 1000);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(refreshInterval);
    };
  }, [fetchPrayerTimes, checkFirstOpen]);

  // Periodic reminder check (every 5 minutes)
  useEffect(() => {
    const checkTimeout = setTimeout(() => {
      periodicCheckInterval.current = setInterval(checkPeriodicReminder, 5 * 60 * 1000);
    }, 100);

    return () => {
      clearTimeout(checkTimeout);
      if (periodicCheckInterval.current) {
        clearInterval(periodicCheckInterval.current);
      }
    };
  }, [checkPeriodicReminder]);

  // Prayer time check (every minute)
  useEffect(() => {
    const checkTimeout = setTimeout(() => {
      prayerCheckInterval.current = setInterval(checkPrayerTimeReminder, 60 * 1000);
    }, 100);

    return () => {
      clearTimeout(checkTimeout);
      if (prayerCheckInterval.current) {
        clearInterval(prayerCheckInterval.current);
      }
    };
  }, [checkPrayerTimeReminder]);

  return {
    prayerTimes,
    nextPrayer,
    reminderState,
    showGameStartReminder,
    dismissReminder,
    fetchPrayerTimes,
  };
}
