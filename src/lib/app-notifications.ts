// App Notification System - الإشعارات التطبيقية

export interface AppNotification {
  id: string;
  type: 'play_now' | 'friends_online' | 'daily_reward' | 'achievement' | 'event' | 'update';
  title: string;
  message: string;
  icon: string;
  action?: {
    label: string;
    screen?: string;
    data?: Record<string, unknown>;
  };
  createdAt: number;
  isRead: boolean;
}

// إشعارات التطبيق المقترحة
export const APP_NOTIFICATION_TEMPLATES = {
  play_now: {
    title: '🎮 خش العب!',
    messages: [
      'في ناس مستنية تلعب معاك!',
      'اعمل غرفة جديدة واستنى أصدقائك!',
      'وقت اللعب! شوف الغرف العامة.',
      'في غرف مفتوحة مستنيةك تنضم!',
    ],
    icon: '🎮',
    action: { label: 'شوف الغرف', screen: 'online' },
  },
  friends_online: {
    title: '👥 أصدقائك أونلاين',
    messages: [
      'في {count} من أصدقائك متصلين دلوقتي!',
      'أصدقائك مستنيينك! خش العب معاهم.',
      'صاحبك {friendName} دخل دلوقتي!',
    ],
    icon: '👥',
    action: { label: 'تواصل', screen: 'social' },
  },
  daily_reward: {
    title: '🎁 المكافأة اليومية',
    messages: [
      'مكافأتك اليومية جاهزة! ادخل واخدها.',
      'لا تنسى المكافأة اليومية!',
      'الreward اليومي مستنيك!',
    ],
    icon: '🎁',
    action: { label: 'اخد المكافأة', screen: 'home' },
  },
  achievement: {
    title: '🏆 إنجاز جديد!',
    messages: [
      'مبروك! وصلت للمستوى التالي!',
      'أحسنت! كسبت {xp} خبرة جديدة!',
      'إنجاز جديد: {achievement}!',
    ],
    icon: '🏆',
  },
  event: {
    title: '⚡ حدث خاص!',
    messages: [
      'في حدث خاص دلوقتي! شارك وكسب جوايز!',
      'الحدث الأسبوعي بدأ! خش العب.',
    ],
    icon: '⚡',
    action: { label: 'اشترك', screen: 'home' },
  },
  update: {
    title: '✨ تحديث جديد',
    messages: [
      'في ميزات جديدة في التطبيق!',
      'تم تحديث التطبيق! شوف الجديد.',
    ],
    icon: '✨',
  },
};

// توليد إشعار عشوائي من نوع معين
export function generateAppNotification(
  type: keyof typeof APP_NOTIFICATION_TEMPLATES,
  variables?: Record<string, string | number>
): AppNotification {
  const template = APP_NOTIFICATION_TEMPLATES[type];
  let message = template.messages[Math.floor(Math.random() * template.messages.length)];
  
  // استبدال المتغيرات
  if (variables) {
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, String(value));
    });
  }
  
  return {
    id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    title: template.title,
    message,
    icon: template.icon,
    action: template.action,
    createdAt: Date.now(),
    isRead: false,
  };
}

// التحقق من الإشعارات المستحقة
export function checkForAppNotifications(params: {
  friendsOnlineCount: number;
  onlineFriends?: string[];
  hasDailyReward: boolean;
  lastPlayed?: number;
  currentXP?: number;
  level?: number;
}): AppNotification[] {
  const notifications: AppNotification[] = [];
  const now = Date.now();
  
  // إشعار الأصدقاء الأونلاين
  if (params.friendsOnlineCount > 0 && Math.random() < 0.3) {
    notifications.push(generateAppNotification('friends_online', {
      count: params.friendsOnlineCount,
      friendName: params.onlineFriends?.[0] || 'صاحبك',
    }));
  }
  
  // إشعار اللعب الآن (لو مضى وقت طويل)
  if (params.lastPlayed) {
    const hoursSinceLastPlay = (now - params.lastPlayed) / (1000 * 60 * 60);
    if (hoursSinceLastPlay > 2 && Math.random() < 0.4) {
      notifications.push(generateAppNotification('play_now'));
    }
  } else if (Math.random() < 0.2) {
    // لو ملعبش قبل كده
    notifications.push(generateAppNotification('play_now'));
  }
  
  // إشعار المكافأة اليومية
  if (params.hasDailyReward && Math.random() < 0.5) {
    notifications.push(generateAppNotification('daily_reward'));
  }
  
  return notifications;
}

// إشعار Toast للعرض الفوري
export interface ToastNotification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error' | 'game';
  title: string;
  message: string;
  icon?: string;
  duration?: number; // بالمللي ثانية
  action?: {
    label: string;
    onClick: () => void;
  };
}

let toastId = 0;
export function createToast(
  type: ToastNotification['type'],
  title: string,
  message: string,
  options?: Partial<Omit<ToastNotification, 'id' | 'type' | 'title' | 'message'>>
): ToastNotification {
  return {
    id: `toast_${++toastId}`,
    type,
    title,
    message,
    ...options,
  };
}
