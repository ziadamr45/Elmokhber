/**
 * نظام المشاركة الاحترافي لكود الغرفة
 * Professional Room Code Sharing System
 */

// روابط التواصل الاجتماعي
export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/ziad7mr',
  telegram: 'https://t.me/ziadamr',
} as const;

// معلومات المطور
export const DEVELOPER_INFO = {
  name: 'زياد عمرو',
  signature: 'إعداد وتطوير / زياد عمرو',
} as const;

// أنواع الألعاب
export type GameType = 'spy' | 'quiz';

// معلومات اللعبة
export const GAME_INFO: Record<GameType, { name: string; emoji: string }> = {
  spy: {
    name: 'المخبر',
    emoji: '🕵️',
  },
  quiz: {
    name: 'المسابقة',
    emoji: '🧠',
  },
};

// أوضاع اللعب للعبة المخبر
export const SPY_MODES: Record<string, string> = {
  classic: 'كلاسيك',
  'double-spies': 'جاسوسين',
  reversed: 'المعكوس',
  silent: 'الصامت',
};

// أوضاع اللعب للمسابقة
export const QUIZ_MODES: Record<string, string> = {
  relaxed: 'سيبنا براحتنا',
  speed: 'مين الأسرع',
};

// مستويات الصعوبة
export const DIFFICULTY_LEVELS: Record<string, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

// خيارات إنشاء رسالة المشاركة - موحد لكل الألعاب
interface ShareOptions {
  gameType: GameType;
  roomCode: string;
  playerName?: string;
  mode?: string;
  difficulty?: string;
  category?: string;
  playType?: 'individual' | 'teams';
}

/**
 * إنشاء رسالة المشاركة ديناميكياً
 */
export function createShareMessage(options: ShareOptions): string {
  const { gameType, roomCode, playerName, mode, difficulty, playType } = options;
  const game = GAME_INFO[gameType];
  
  // بناء الرسالة حسب نوع اللعبة
  let message = '';
  
  if (gameType === 'spy') {
    message = `أنا في غرفة دلوقتي في لعبة ${game.name} ${game.emoji}
تعالى انضم ليا بسرعة!`;
    
    // إضافة المود إن وجد
    if (mode && SPY_MODES[mode]) {
      message += `\nوضع اللعب: ${SPY_MODES[mode]}`;
    }
    
    // إضافة اسم المستخدم إن وجد
    if (playerName) {
      message += `\nالاسم في الغرفة: ${playerName}`;
    }
    
  } else if (gameType === 'quiz') {
    message = `أنا بلعب دلوقتي في لعبة ${game.name} ${game.emoji}
تعالى ننافس بعض!`;
    
    // إضافة المود إن وجد
    if (mode && QUIZ_MODES[mode]) {
      message += `\nوضع اللعب: ${QUIZ_MODES[mode]}`;
    }
    
    // إضافة مستوى الصعوبة إن وجد
    if (difficulty && DIFFICULTY_LEVELS[difficulty]) {
      message += `\nالمستوى: ${DIFFICULTY_LEVELS[difficulty]}`;
    }
    
    // إضافة نوع اللعب (فردي/فرق)
    if (playType === 'teams') {
      message += `\nلعب فرق 👥`;
    }
    
    // إضافة اسم المستخدم إن وجد
    if (playerName) {
      message += `\nالاسم في الغرفة: ${playerName}`;
    }
  }
  
  // إضافة كود الغرفة
  message += `\n
🔐 كود الغرفة: ${roomCode}`;
  
  // إضافة التوقيع وروابط التواصل
  message += `\n
─────────────────
${DEVELOPER_INFO.signature}
📘 فيسبوك: ${SOCIAL_LINKS.facebook}
📱 تيليجرام: ${SOCIAL_LINKS.telegram}`;
  
  return message;
}

/**
 * مشاركة باستخدام Web Share API
 * يدعم جميع التطبيقات (واتساب، تيليجرام، إلخ)
 */
export async function shareRoom(options: ShareOptions): Promise<boolean> {
  const message = createShareMessage(options);
  
  // التحقق من دعم المتصفح لـ Web Share API
  if (navigator.share) {
    try {
      await navigator.share({
        title: `انضم لغرفة ${GAME_INFO[options.gameType].name}`,
        text: message,
      });
      return true;
    } catch (error) {
      // المستخدم ألغى المشاركة أو حدث خطأ
      if ((error as Error).name !== 'AbortError') {
        console.error('خطأ في المشاركة:', error);
      }
      return false;
    }
  }
  
  // Fallback: نسخ الرسالة للحافظة
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch (error) {
    console.error('خطأ في نسخ الرسالة:', error);
    return false;
  }
}

/**
 * نسخ رسالة المشاركة للحافظة فقط
 */
export async function copyShareMessage(options: ShareOptions): Promise<boolean> {
  const message = createShareMessage(options);
  
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch (error) {
    console.error('خطأ في نسخ الرسالة:', error);
    return false;
  }
}

/**
 * الحصول على رابط مشاركة واتساب
 */
export function getWhatsAppShareLink(options: ShareOptions): string {
  const message = createShareMessage(options);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * الحصول على رابط مشاركة تيليجرام
 */
export function getTelegramShareLink(options: ShareOptions): string {
  const message = createShareMessage(options);
  return `https://t.me/share/url?text=${encodeURIComponent(message)}`;
}

/**
 * التحقق من دعم Web Share API
 */
export function isShareSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * التحقق من دعم clipboard API
 */
export function isClipboardSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.clipboard;
}
