import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// Types
interface QuizQuestion {
  question: string;
  answer: string;
  options?: string[];
  type: 'direct' | 'fill-blank' | 'multiple-choice';
  difficulty?: 'easy' | 'medium' | 'hard';
}

// Difficulty levels
export const difficultyLevels = [
  { id: 'easy', name: 'سهل', icon: '🌱', description: 'أسئلة بسيطة ومعلومات شائعة', color: '#22C55E' },
  { id: 'medium', name: 'متوسط', icon: '⚡', description: 'أسئلة تحتاج تفكير بسيط', color: '#F59E0B' },
  { id: 'hard', name: 'صعب', icon: '🔥', description: 'أسئلة أصعب ومعلومات أقل شهرة', color: '#EF4444' },
];

// Available categories - Egyptian and Arab culture focused
export const quizCategories = [
  { id: 'history', name: 'التاريخ', icon: '📜', description: 'تاريخ مصر والعالم العربي' },
  { id: 'geography', name: 'الجغرافيا', icon: '🌍', description: 'جغرافيا البلاد العربية' },
  { id: 'science', name: 'العلوم', icon: '🔬', description: 'معلومات علمية متنوعة' },
  { id: 'technology', name: 'التكنولوجيا', icon: '💻', description: 'أجهزة وتطبيقات' },
  { id: 'sports', name: 'الرياضة', icon: '⚽', description: 'كرة القدم والرياضات العربية' },
  { id: 'movies', name: 'الأفلام', icon: '🎬', description: 'أفلام ومسلسلات عربية' },
  { id: 'music', name: 'الموسيقى', icon: '🎵', description: 'أغاني ومطربين عرب' },
  { id: 'general', name: 'الثقافة العامة', icon: '📚', description: 'معلومات متنوعة' },
  { id: 'arabic', name: 'الثقافة العربية', icon: '🏛️', description: 'تراث وعادات عربية' },
  { id: 'islamic', name: 'الثقافة الإسلامية', icon: '🕌', description: 'معارف إسلامية' },
  { id: 'egypt', name: 'مصر', icon: '🇪🇬', description: 'معلومات عن مصر' },
  { id: 'food', name: 'الأكلات', icon: '🍽️', description: 'أكلات مصرية وعربية' },
  { id: 'celebrities', name: 'المشاهير', icon: '⭐', description: 'فنانين ورياضيين عرب' },
  { id: 'proverbs', name: 'الأمثال', icon: '💬', description: 'أمثال مصرية وعربية' },
];

// Game modes
export const quizModes = [
  { id: 'relaxed', name: 'سيبنا براحتنا', description: 'السرعة مش مهمة', icon: '🐢' },
  { id: 'speed', name: 'مين الأسرع', description: 'السرعة مهمة', icon: '⚡' },
];

// Helper functions
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Transform room data for frontend compatibility
function formatRoomForClient(room: any, players: any[] = []) {
  const roomPlayers = players.length > 0 ? players : room.players || [];
  
  // Create teams array for team games
  const teams = room.playType === 'teams' ? [
    { id: 'A', name: 'الفريق أ', color: '#EF4444' },
    { id: 'B', name: 'الفريق ب', color: '#3B82F6' }
  ] : [];

  return {
    ...room,
    players: roomPlayers.map((p: any) => ({
      ...p,
      hasAnswered: false, // Will be computed from answers
      matchScore: p.matchScore || p.score || 0
    })),
    teams,
    settings: {
      categoryId: room.categoryId,
      mode: room.mode,
      roundsTotal: room.roundsTotal,
      timePerRound: room.timePerRound,
      playType: room.playType || 'solo'
    },
    currentQuestion: null, // Will be set separately
    difficulty: room.difficulty || 'medium'
  };
}

// Create a fingerprint for a question to detect duplicates
function createQuestionFingerprint(question: string, answer: string): string {
  const normalize = (text: string) => text
    .trim()
    .toLowerCase()
    .replace(/[آإأ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return `${normalize(question)}|${normalize(answer)}`;
}

// Get difficulty instructions for AI prompt
function getDifficultyInstructions(difficulty: 'easy' | 'medium' | 'hard'): string {
  switch (difficulty) {
    case 'easy':
      return `مستوى الصعوبة: سهل جداً
- أسئلة بسيطة ومفهومة للجميع
- معلومات شائعة ومعروفة في البيئة المصرية والعربية
- إجابات واضحة ومباشرة (كلمة أو كلمتان فقط)
- أمثلة: عاصمة مصر، أشهر نادي مصري، أكلة مصرية مشهورة`;
    case 'medium':
      return `مستوى الصعوبة: متوسط
- أسئلة تحتاج تفكير بسيط
- معلومات متوسطة الانتشار
- إجابات محددة لكن تحتاج معرفة
- أمثلة: تاريخ تأسيس نادي، اسم ممثل في مسلسل مشهور، تفاصيل عن مدينة مصرية`;
    case 'hard':
      return `مستوى الصعوبة: صعب
- أسئلة أصعب تحتاج ثقافة عالية
- معلومات أقل شهرة وتفاصيل دقيقة
- إجابات محددة جداً
- أمثلة: تفاصيل تاريخية دقيقة، إحصائيات، معلومات نادرة عن مشاهير`;
  }
}

// Get category-specific instructions
function getCategoryInstructions(category: string): string {
  const instructions: Record<string, string> = {
    'history': `تصنيف: التاريخ
- ركز على تاريخ مصر والعالم العربي
- أحداث تاريخية مهمة للمصريين
- شخصيات تاريخية عربية
- حضارات مرت على مصر`,
    
    'geography': `تصنيف: الجغرافيا
- مدن ومحافظات مصر
- عواصم ومدن عربية
- أنهار وبحار في المنطقة العربية
- معالم جغرافية مصرية`,
    
    'science': `تصنيف: العلوم
- معلومات علمية بسيطة ومفهومة
- اكتشافات علمية مشهورة
- حقائق علمية عن جسم الإنسان
- ظواهر طبيعية`,
    
    'technology': `تصنيف: التكنولوجيا
- تطبيقات ومواقع مشهورة
- شركات تقنية معروفة
- أجهزة وموبايلات
- مصطلحات تقنية شائعة`,
    
    'sports': `تصنيف: الرياضة
- كرة القدم المصرية والعربية
- أندية مصرية (الأهلي، الزمالك، إلخ)
- لاعبين مصريين وعرب مشهورين
- بطولات عربية وأفريقية`,
    
    'movies': `تصنيف: الأفلام والمسلسلات
- أفلام مصرية كلاسيكية وحديثة
- مسلسلات رمضان المشهورة
- ممثلين وممثلات مصريين وعرب
- مخرجين مشهورين`,
    
    'music': `تصنيف: الموسيقى
- مطربين ومطربات عرب
- أغاني مصرية مشهورة
- ألبومات ومهرجانات
- ملحنين وكلمات أغاني معروفة`,
    
    'general': `تصنيف: الثقافة العامة
- معلومات متنوعة من الحياة اليومية
- معلومات يعرفها المصري العادي
- عادات وتقاليد
- أشياء من البيئة المصرية`,
    
    'arabic': `تصنيف: الثقافة العربية
- تراث وعادات عربية
- شعراء وكتاب عرب
- أمثال وحكم عربية
- تقاليد البلاد العربية`,
    
    'islamic': `تصنيف: الثقافة الإسلامية
- معلومات إسلامية عامة
- أحاديث وسور معروفة
- شخصيات إسلامية
- مناسبات إسلامية`,
    
    'egypt': `تصنيف: مصر
- كل ما يخص مصر
- محافظات ومدن مصرية
- شخصيات مصرية
- أكلات مصرية
- عادات وتقاليد مصرية`,
    
    'food': `تصنيف: الأكلات
- أكلات مصرية مشهورة (كشري، فلافل، ملوخية)
- أكلات عربية من بلاد مختلفة
- مكونات وطرق تحضير
- مشروبات مصرية وعربية`,
    
    'celebrities': `تصنيف: المشاهير
- فنانين مصريين وعرب
- رياضيين مشهورين
- إعلاميين معروفين`,
    
    'proverbs': `تصنيف: الأمثال
- أمثال مصرية شعبية
- حكم عربية مشهورة
- أقوال مأثورة`
  };
  
  return instructions[category] || instructions['general'];
}

// Generate question using AI with better anti-repetition
async function generateQuestion(
  category: string,
  difficulty: 'easy' | 'medium' | 'hard',
  previousAnswers: string[] = [],
  maxRetries: number = 3
): Promise<QuizQuestion> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const zai = await ZAI.create();
      const categoryInfo = quizCategories.find(c => c.id === category) || quizCategories[7];
      
      const previousText = previousAnswers.length > 0
        ? `⚠️ تنبيه هام: هذه الإجابات تم استخدامها بالفعل - ممنوع تكرارها:
${previousAnswers.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
        : '';

      const prompt = `أنت خبير في إنشاء أسئلة مسابقات ثقافية للمجتمع المصري والعربي.

المطلوب: أنشئ سؤالاً جديداً ومبتكراً في فئة "${categoryInfo.name}".

${getDifficultyInstructions(difficulty)}

${getCategoryInstructions(category)}

${previousText}

قواعد صارمة جداً:
1. السؤال والأجوبة بالعربية الفصحى أو المصرية فقط
2. الإجابة يجب أن تكون قصيرة جداً (كلمة واحدة أو كلمتان فقط - لا تزيد!)
3. السؤال يجب أن يكون واضحاً ومحدداً بدون غموض
4. لا تسأل عن شيء تم السؤال عنه من قبل (انظر القائمة أعلاه)
5. اختر نوع السؤال:
   - direct: سؤال مباشر واضح (مثل: ما عاصمة مصر؟)
   - fill-blank: املأ الفراغ (مثل: عاصمة مصر هي مدينة ______)
   - multiple-choice: اختيار من 4 خيارات

أرجع JSON فقط بدون أي نص إضافي:
{
  "question": "نص السؤال الواضح",
  "answer": "الإجابة القصيرة",
  "type": "direct أو fill-blank أو multiple-choice",
  "options": ["الإجابة الصحيحة", "خيار خاطئ 1", "خيار خاطئ 2", "خيار خاطئ 3"] (للاختيار من متعدد فقط)
}`;

      const completion = await zai.chat.completions.create({
        messages: [
          { 
            role: 'system', 
            content: `أنت مساعد متخصص في إنشاء أسئلة مسابقات ثقافية للمصريين والعرب.
- كل الأسئلة بالعربية فقط
- الإجابات قصيرة جداً (كلمة أو كلمتان فقط)
- الأسئلة واضحة وغير غامضة
- مراعاة الثقافة المصرية والعربية
- ترد بتنسيق JSON فقط بدون أي نص إضافي`
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9 + (attempt * 0.1),
      });

      const content = completion.choices[0]?.message?.content || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('No JSON found in response, retrying...');
        continue;
      }

      const parsed = JSON.parse(jsonMatch[0]) as QuizQuestion;

      if (!parsed.question || !parsed.answer || !parsed.type) {
        console.log('Invalid question format, retrying...');
        continue;
      }

      // Check for repetition
      if (previousAnswers.some(a => a.toLowerCase() === parsed.answer.toLowerCase())) {
        console.log('Question repeated, retrying... Attempt:', attempt + 1);
        continue;
      }

      // Ensure options for multiple-choice
      if (parsed.type === 'multiple-choice') {
        if (!parsed.options || parsed.options.length < 4) {
          parsed.type = 'direct';
          delete parsed.options;
        } else {
          const correctAnswer = parsed.answer;
          const wrongOptions = parsed.options.filter(o => o !== correctAnswer);
          const allOptions = [correctAnswer, ...wrongOptions.slice(0, 3)];
          for (let i = allOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
          }
          parsed.options = allOptions;
        }
      }

      parsed.difficulty = difficulty;

      return parsed;
    } catch (error) {
      console.error('Error generating question:', error);
    }
  }

  // Fallback questions
  const fallbackQuestions: QuizQuestion[] = [
    { question: 'ما عاصمة مصر؟', answer: 'القاهرة', type: 'direct', difficulty: 'easy' },
    { question: 'كم عدد أركان الإسلام؟', answer: 'خمسة', type: 'direct', difficulty: 'easy' },
    { question: 'ما أكبر نادي مصري من حيث عدد البطولات؟', answer: 'الأهلي', type: 'multiple-choice', options: ['الأهلي', 'الزمالك', 'الإسماعيلي', 'المصري'], difficulty: 'easy' },
    { question: 'نهر ______ هو أطول نهر في العالم', answer: 'النيل', type: 'fill-blank', difficulty: 'easy' },
    { question: 'في أي سنة تأسس نادي الأهلي المصري؟', answer: '1907', type: 'direct', difficulty: 'medium' },
    { question: 'ما أشهر أكلة مصرية مكونة من الأرز والمكرونة والعدس؟', answer: 'كشري', type: 'direct', difficulty: 'easy' },
    { question: 'ما هي عملة مصر؟', answer: 'الجنيه', type: 'direct', difficulty: 'easy' },
    { question: 'أين يقع معبد الكرنك؟', answer: 'الأقصر', type: 'direct', difficulty: 'easy' },
    { question: 'ما هي عاصمة المملكة العربية السعودية؟', answer: 'الرياض', type: 'direct', difficulty: 'easy' },
    { question: 'من هو أول رئيس لمصر؟', answer: 'محمد نجيب', type: 'direct', difficulty: 'medium' },
  ];

  const availableFallbacks = fallbackQuestions.filter(fq => 
    !previousAnswers.some(a => a.toLowerCase() === fq.answer.toLowerCase())
  );
  
  if (availableFallbacks.length > 0) {
    return availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)];
  }
  
  return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
}

// Smart answer checking using AI
async function smartCheckAnswer(
  playerAnswer: string, 
  correctAnswer: string,
  useAI: boolean = true
): Promise<{ isCorrect: boolean; confidence: number }> {
  const normalize = (text: string) => text
    .trim()
    .toLowerCase()
    .replace(/[آإأ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u0640/g, '')
    .replace(/\u0671/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedPlayer = normalize(playerAnswer);
  const normalizedCorrect = normalize(correctAnswer);

  if (normalizedPlayer === normalizedCorrect) {
    return { isCorrect: true, confidence: 1 };
  }

  // Arabic number conversions
  const arabicNumbers: Record<string, string> = {
    'صفر': '0', 'واحد': '1', 'واحده': '1', 'اثنان': '2', 'اثنين': '2', 'اثنتين': '2',
    'ثلاثة': '3', 'ثلاثه': '3', 'ثلاث': '3', 'اربعة': '4', 'اربعه': '4', 'أربعة': '4',
    'خمسة': '5', 'خمسه': '5', 'خمس': '5', 'ستة': '6', 'سته': '6', 'ست': '6',
    'سبعة': '7', 'سبعه': '7', 'سبع': '7', 'ثمانية': '8', 'ثمانيه': '8', 'ثمان': '8',
    'تسعة': '9', 'تسعه': '9', 'تسع': '9', 'عشرة': '10', 'عشره': '10', 'عشر': '10'
  };

  const playerNum = arabicNumbers[normalizedPlayer] || normalizedPlayer;
  const correctNum = arabicNumbers[normalizedCorrect] || normalizedCorrect;
  if (playerNum === correctNum) {
    return { isCorrect: true, confidence: 1 };
  }

  // Partial matches
  if (normalizedPlayer.length >= 2 && normalizedCorrect.length >= 2) {
    if (normalizedCorrect.includes(normalizedPlayer) || normalizedPlayer.includes(normalizedCorrect)) {
      const shorterLength = Math.min(normalizedPlayer.length, normalizedCorrect.length);
      const longerLength = Math.max(normalizedPlayer.length, normalizedCorrect.length);
      const coverageRatio = shorterLength / longerLength;
      if (coverageRatio >= 0.7) {
        return { isCorrect: true, confidence: 0.85 };
      }
    }
  }

  // Use AI for complex matching
  if (useAI) {
    try {
      const zai = await ZAI.create();
      
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `أنت مساعد ذكي متخصص في مقارنة الإجابات للمسابقات.
قواعد التصحيح:
- تقبل الأخطاء الإملائية البسيطة
- تقبل اختلاف ه/ة و ى/ي و أ/إ/آ
- تقبل الأرقام العربية مقابل الكلمات (5 = خمسة)
- تقبل الإجابات المتشابهة معنوياً (نهر النيل = النيل)
- كن صارماً: لا تقبل إجابات غير مرتبطة بالموضوع
أرجع JSON فقط: {"isCorrect": true/false, "confidence": 0-1}`
          },
          {
            role: 'user',
            content: `الإجابة الصحيحة: "${correctAnswer}"
إجابة اللاعب: "${playerAnswer}"
هل إجابة اللاعب صحيحة؟`
          }
        ],
        thinking: { type: 'disabled' }
      });

      const response = completion.choices[0]?.message?.content || '';
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.isCorrect && result.confidence >= 0.7) {
          return { isCorrect: true, confidence: result.confidence };
        }
      }
    } catch (error) {
      console.error('AI check error:', error);
    }
  }

  // Calculate similarity as fallback
  const similarity = (a: string, b: string) => {
    if (a === b) return 1;
    if (!a || !b) return 0;
    
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b[i-1] === a[j-1]) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j]) + 1;
        }
      }
    }
    
    return 1 - matrix[b.length][a.length] / Math.max(a.length, b.length);
  };

  const simScore = similarity(normalizedPlayer, normalizedCorrect);
  
  if (simScore >= 0.8) {
    return { isCorrect: true, confidence: simScore };
  }

  return { isCorrect: false, confidence: simScore };
}

// Cleanup old rooms (called on each request instead of interval)
async function cleanupOldRooms() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // Delete ended rooms older than 5 minutes
    await db.quizRoom.deleteMany({
      where: {
        status: 'ended',
        updatedAt: { lt: fiveMinutesAgo }
      }
    });

    // Delete lobby rooms with no activity for 2 minutes
    await db.quizRoom.deleteMany({
      where: {
        status: 'lobby',
        updatedAt: { lt: twoMinutesAgo }
      }
    });

    // Delete running rooms with no activity for 30 minutes
    await db.quizRoom.deleteMany({
      where: {
        status: 'running',
        updatedAt: { lt: thirtyMinutesAgo }
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    // Run cleanup occasionally (every ~10% of requests)
    if (Math.random() < 0.1) {
      cleanupOldRooms().catch(console.error);
    }

    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'generate': {
        const { category, difficulty, previousAnswers } = data;
        const question = await generateQuestion(
          category, 
          difficulty || 'medium',
          previousAnswers || []
        );
        return NextResponse.json({ success: true, question });
      }

      case 'create-room': {
        const { playerName, isPublic, categoryId, mode, difficulty, roundsTotal, timePerRound, playType } = data;
        const code = generateRoomCode();
        const playerId = generateId();

        // Check if player already in a room
        const existingPlayer = await db.quizPlayer.findFirst({
          where: { id: playerId },
          include: { room: true }
        });

        if (existingPlayer && existingPlayer.room.status !== 'ended') {
          return NextResponse.json({ 
            success: true, 
            room: existingPlayer.room, 
            playerId,
            players: await db.quizPlayer.findMany({ where: { roomId: existingPlayer.roomId } })
          });
        }

        const room = await db.quizRoom.create({
          data: {
            code,
            isPublic: isPublic ?? true,
            hostId: playerId,
            categoryId: categoryId || 'general',
            mode: mode || 'relaxed',
            playType: playType || 'solo',
            difficulty: difficulty || 'medium',
            roundsTotal: roundsTotal || 10,
            timePerRound: timePerRound || 30,
            status: 'lobby',
            currentRound: 0,
            players: {
              create: {
                id: playerId,
                name: playerName,
                isHost: true,
                isReady: true,
              }
            }
          },
          include: { players: true }
        });

        return NextResponse.json({ success: true, room: formatRoomForClient(room), playerId });
      }

      case 'join-room': {
        const { roomCode, playerName, teamId } = data;
        const code = roomCode.toUpperCase();
        
        const room = await db.quizRoom.findUnique({
          where: { code },
          include: { players: true }
        });

        if (!room) {
          return NextResponse.json({ success: false, error: 'الغرفة مش موجودة' }, { status: 404 });
        }

        if (room.status !== 'lobby') {
          return NextResponse.json({ success: false, error: 'اللعبة بدأت بالفعل' }, { status: 400 });
        }

        if (room.players.length >= 8) {
          return NextResponse.json({ success: false, error: 'الغرفة ممتلئة' }, { status: 400 });
        }

        const playerId = generateId();

        await db.quizPlayer.create({
          data: {
            id: playerId,
            roomId: room.id,
            name: playerName,
            isHost: false,
            isReady: true,
            teamId: teamId || null,
          }
        });

        const updatedRoom = await db.quizRoom.update({
          where: { id: room.id },
          data: { updatedAt: new Date() },
          include: { players: true }
        });

        return NextResponse.json({ success: true, room: formatRoomForClient(updatedRoom), playerId });
      }

      case 'switch-team': {
        const { playerId, teamId } = data;
        console.log('[Quiz API] switch-team called:', { playerId, teamId });
        
        try {
          const player = await db.quizPlayer.findUnique({
            where: { id: playerId },
            include: { room: true }
          });

          if (!player) {
            console.log('[Quiz API] Player not found:', playerId);
            return NextResponse.json({ success: false, error: 'اللاعب مش موجود' }, { status: 404 });
          }

          console.log('[Quiz API] Updating player team:', { playerId, teamId, roomId: player.roomId });

          await db.quizPlayer.update({
            where: { id: playerId },
            data: { teamId: teamId as string }
          });

          const updatedRoom = await db.quizRoom.findUnique({
            where: { id: player.roomId },
            include: { players: true }
          });

          console.log('[Quiz API] Team switched successfully:', { 
            playerId, 
            teamId, 
            playersCount: updatedRoom?.players.length 
          });

          return NextResponse.json({ success: true, room: formatRoomForClient(updatedRoom) });
        } catch (error) {
          console.error('[Quiz API] switch-team error:', error);
          return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
        }
      }

      case 'update-team-name': {
        const { playerId, teamId, name } = data;
        
        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { room: true }
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, error: 'مش في غرفة' }, { status: 400 });
        }

        // This could be stored in a separate table, but for simplicity we'll skip it
        // Team names are handled client-side in this version
        return NextResponse.json({ success: true });
      }

      case 'leave-room': {
        const { playerId } = data;
        
        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { players: true } } }
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: true });
        }

        const room = player.room;
        const wasHost = room.hostId === playerId;

        // Delete the player
        await db.quizPlayer.delete({ where: { id: playerId } });

        // If no players left, delete the room
        const remainingPlayers = room.players.filter(p => p.id !== playerId);
        if (remainingPlayers.length === 0) {
          await db.quizRoom.delete({ where: { id: room.id } });
          return NextResponse.json({ success: true, roomDeleted: true });
        }

        // If host left during game, end the game
        if (wasHost && room.status === 'running') {
          await db.quizRoom.update({
            where: { id: room.id },
            data: { status: 'ended', endedAt: new Date() }
          });
          return NextResponse.json({ 
            success: true, 
            roomDeleted: true, 
            reason: 'صاحب الغرفة غادر أثناء اللعب' 
          });
        }

        // Transfer host to another player
        if (wasHost && remainingPlayers.length > 0) {
          const newHost = remainingPlayers[0];
          await db.quizPlayer.update({
            where: { id: newHost.id },
            data: { isHost: true }
          });
          await db.quizRoom.update({
            where: { id: room.id },
            data: { hostId: newHost.id, updatedAt: new Date() }
          });
        }

        return NextResponse.json({ success: true });
      }

      case 'start-game': {
        const { playerId } = data;
        
        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { players: true } } }
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, error: 'مش في غرفة' }, { status: 400 });
        }

        const room = player.room;
        if (room.hostId !== playerId) {
          return NextResponse.json({ success: false, error: 'مش صاحب الغرفة' }, { status: 403 });
        }

        if (room.players.length < 2) {
          return NextResponse.json({ success: false, error: 'لازم لاعبين على الأقل' }, { status: 400 });
        }

        // Reset matchScore for all players at the start of a new game
        await db.quizPlayer.updateMany({
          where: { roomId: room.id },
          data: { matchScore: 0 }
        });

        // Generate first question
        const question = await generateQuestion(room.categoryId, room.difficulty || 'medium', []);

        // Create the first match/round
        const match = await db.quizMatch.create({
          data: {
            roomId: room.id,
            roundNumber: 1,
            question: question.question,
            answer: question.answer,
            questionType: question.type,
            options: question.options ? JSON.stringify(question.options) : null,
            categoryName: room.categoryId,
          }
        });

        // Update room status
        const updatedRoom = await db.quizRoom.update({
          where: { id: room.id },
          data: {
            status: 'running',
            currentRound: 1,
            startedAt: new Date(),
            updatedAt: new Date()
          },
          include: { players: true, matches: true }
        });

        // Format players with matchScore reset
        const formattedPlayers = updatedRoom.players.map(p => ({
          ...p,
          matchScore: 0,
          hasAnswered: false
        }));

        return NextResponse.json({ 
          success: true, 
          room: {
            ...formatRoomForClient({ ...updatedRoom, players: formattedPlayers }),
            currentQuestion: question,
            currentMatchId: match.id
          }
        });
      }

      case 'submit-answer': {
        const { playerId, answer, timeTaken, matchId } = data;
        console.log('[Quiz API] submit-answer called:', { playerId, answer: answer?.substring(0, 20), timeTaken });
        
        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { players: true, matches: { orderBy: { roundNumber: 'desc' }, take: 1 } } } }
        });

        if (!player || !player.room) {
          console.log('[Quiz API] Player or room not found');
          return NextResponse.json({ success: false, error: 'مش في غرفة' }, { status: 400 });
        }

        const room = player.room;
        console.log('[Quiz API] Room status:', room.status, 'currentMatch:', room.matches[0]?.id);
        
        if (room.status !== 'running') {
          console.log('[Quiz API] Room not running');
          return NextResponse.json({ success: false, error: 'مفيش لعبة' }, { status: 400 });
        }

        // Get current match
        const currentMatch = room.matches[0];
        if (!currentMatch) {
          console.log('[Quiz API] No current match');
          return NextResponse.json({ success: false, error: 'مفيش سؤال حالي' }, { status: 400 });
        }

        // Check if already answered
        const existingAnswer = await db.quizAnswer.findUnique({
          where: { matchId_playerId: { matchId: currentMatch.id, playerId } }
        });

        if (existingAnswer) {
          console.log('[Quiz API] Already answered');
          return NextResponse.json({ success: false, error: 'أجبت بالفعل' }, { status: 400 });
        }

        console.log('[Quiz API] Checking answer:', answer, 'vs', currentMatch.answer);
        const checkResult = await smartCheckAnswer(answer, currentMatch.answer, true);
        const isCorrect = checkResult.isCorrect;
        console.log('[Quiz API] Check result:', isCorrect, 'confidence:', checkResult.confidence);

        let points = 0;
        if (isCorrect) {
          const difficulty = room.difficulty || 'medium';
          const basePoints = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 15 : 20;
          points = basePoints;

          if (room.mode === 'speed' && timeTaken) {
            const maxTime = room.timePerRound * 1000;
            const speedBonus = Math.floor((maxTime - timeTaken) / 1000);
            points += Math.max(0, speedBonus);
          }
        }
        console.log('[Quiz API] Points:', points);

        // Save answer
        await db.quizAnswer.create({
          data: {
            matchId: currentMatch.id,
            playerId,
            answer,
            isCorrect,
            points,
            timeTaken: timeTaken || 0,
          }
        });

        // Update player score (increment total score)
        const updatedPlayer = await db.quizPlayer.update({
          where: { id: playerId },
          data: { 
            score: { increment: points },
            matchScore: { increment: points } // Also update matchScore for current game
          }
        });

        // Update room activity
        await db.quizRoom.update({
          where: { id: room.id },
          data: { updatedAt: new Date() }
        });

        // Calculate team scores if team game
        let teamScores = null;
        if (room.playType === 'teams') {
          const allPlayers = await db.quizPlayer.findMany({ where: { roomId: room.id } });
          teamScores = {
            teamA: allPlayers.filter(p => p.teamId === 'A').reduce((sum, p) => sum + p.matchScore, 0),
            teamB: allPlayers.filter(p => p.teamId === 'B').reduce((sum, p) => sum + p.matchScore, 0)
          };
        }

        // Count how many have answered this match
        const answers = await db.quizAnswer.findMany({
          where: { matchId: currentMatch.id },
          select: { playerId: true }
        });
        const answeredCount = answers.length;
        const totalPlayers = room.players.length;
        console.log('[Quiz API] Answered count:', answeredCount, '/', totalPlayers);

        return NextResponse.json({
          success: true,
          isCorrect,
          points,
          confidence: checkResult.confidence,
          correctAnswer: currentMatch.answer,
          playerScore: updatedPlayer.score,
          matchScore: updatedPlayer.matchScore,
          teamScores,
          answeredCount,
          totalPlayers
        });
      }

      case 'next-round': {
        const { playerId } = data;
        
        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { room: { include: { players: true } } }
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, error: 'مش في غرفة' }, { status: 400 });
        }

        const room = player.room;
        if (room.hostId !== playerId) {
          return NextResponse.json({ success: false, error: 'مش صاحب الغرفة' }, { status: 403 });
        }

        if (room.status !== 'running') {
          return NextResponse.json({ success: false, error: 'اللعبة مش شغالة' }, { status: 400 });
        }

        if (room.currentRound >= room.roundsTotal) {
          const updatedRoom = await db.quizRoom.update({
            where: { id: room.id },
            data: { status: 'ended', endedAt: new Date(), updatedAt: new Date() },
            include: { players: true }
          });
          return NextResponse.json({ success: true, room: formatRoomForClient(updatedRoom), gameEnded: true });
        }

        // Get previous answers to avoid repetition
        const previousMatches = await db.quizMatch.findMany({
          where: { roomId: room.id },
          select: { answer: true }
        });
        const previousAnswers = previousMatches.map(m => m.answer);

        // Generate next question with room's difficulty
        const question = await generateQuestion(room.categoryId, room.difficulty || 'medium', previousAnswers);

        const newRound = room.currentRound + 1;

        // Create new match
        const match = await db.quizMatch.create({
          data: {
            roomId: room.id,
            roundNumber: newRound,
            question: question.question,
            answer: question.answer,
            questionType: question.type,
            options: question.options ? JSON.stringify(question.options) : null,
            categoryName: room.categoryId,
          }
        });

        // Update room
        const updatedRoom = await db.quizRoom.update({
          where: { id: room.id },
          data: {
            currentRound: newRound,
            updatedAt: new Date()
          },
          include: { players: true }
        });

        // Format players with hasAnswered: false for new round
        const formattedPlayers = updatedRoom.players.map(p => ({
          ...p,
          hasAnswered: false
        }));

        return NextResponse.json({ 
          success: true, 
          room: {
            ...formatRoomForClient({ ...updatedRoom, players: formattedPlayers }),
            currentQuestion: question,
            currentMatchId: match.id
          }
        });
      }

      case 'get-state': {
        const { playerId } = data;
        
        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { 
            room: { 
              include: { 
                players: true,
                matches: { orderBy: { roundNumber: 'desc' }, take: 1 }
              } 
            } 
          }
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, inRoom: false });
        }

        const room = player.room;
        const currentMatch = room.matches[0];

        // Get who has answered
        let answeredPlayerIds: string[] = [];
        if (currentMatch) {
          const answers = await db.quizAnswer.findMany({
            where: { matchId: currentMatch.id },
            select: { playerId: true }
          });
          answeredPlayerIds = answers.map(a => a.playerId);
        }

        // Update room activity
        await db.quizRoom.update({
          where: { id: room.id },
          data: { updatedAt: new Date() }
        });

        return NextResponse.json({ 
          success: true, 
          inRoom: true, 
          room: {
            ...formatRoomForClient(room),
            currentQuestion: currentMatch ? {
              question: currentMatch.question,
              answer: currentMatch.answer,
              type: currentMatch.questionType,
              options: currentMatch.options ? JSON.parse(currentMatch.options) : undefined
            } : null,
            currentMatchId: currentMatch?.id,
            answeredPlayerIds
          }
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
    }
  } catch (error) {
    console.error('Quiz API error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}

// GET handler
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const code = searchParams.get('roomCode');

  try {
    switch (action) {
      case 'public-rooms': {
        const rooms = await db.quizRoom.findMany({
          where: {
            isPublic: true,
            status: 'lobby'
          },
          include: { players: true },
          orderBy: { createdAt: 'desc' }
        });

        const publicRooms = rooms.map(r => ({
          code: r.code,
          hostName: r.players.find(p => p.id === r.hostId)?.name || 'غير معروف',
          playerCount: r.players.length,
          categoryId: r.categoryId,
          mode: r.mode,
          difficulty: r.difficulty,
          playType: r.playType,
          teamCount: r.playType === 'teams' ? {
            teamA: r.players.filter(p => p.teamId === 'A').length,
            teamB: r.players.filter(p => p.teamId === 'B').length
          } : undefined,
          createdAt: r.createdAt.getTime()
        }));

        return NextResponse.json({ success: true, rooms: publicRooms });
      }

      case 'categories':
        return NextResponse.json({ success: true, categories: quizCategories });

      case 'modes':
        return NextResponse.json({ success: true, modes: quizModes });

      case 'difficulties':
        return NextResponse.json({ success: true, difficulties: difficultyLevels });

      case 'get-room': {
        if (!code) {
          return NextResponse.json({ success: false, error: 'كود الغرفة مطلوب' }, { status: 400 });
        }

        const room = await db.quizRoom.findUnique({
          where: { code: code.toUpperCase() },
          include: { players: true }
        });

        if (!room) {
          return NextResponse.json({ success: false, error: 'الغرفة مش موجودة' }, { status: 404 });
        }

        return NextResponse.json({ success: true, room: formatRoomForClient(room) });
      }

      case 'poll': {
        const playerId = searchParams.get('playerId');
        
        if (!playerId) {
          return NextResponse.json({ success: false, error: 'معرف اللاعب مطلوب' }, { status: 400 });
        }

        const player = await db.quizPlayer.findUnique({
          where: { id: playerId },
          include: { 
            room: { 
              include: { 
                players: true,
                matches: { orderBy: { roundNumber: 'desc' }, take: 1 }
              } 
            } 
          }
        });

        if (!player || !player.room) {
          return NextResponse.json({ success: false, inRoom: false });
        }

        const room = player.room;
        const currentMatch = room.matches[0];

        // Get who has answered
        let answeredPlayerIds: string[] = [];
        if (currentMatch) {
          const answers = await db.quizAnswer.findMany({
            where: { matchId: currentMatch.id },
            select: { playerId: true }
          });
          answeredPlayerIds = answers.map(a => a.playerId);
        }

        // Update room activity
        await db.quizRoom.update({
          where: { id: room.id },
          data: { updatedAt: new Date() }
        });

        return NextResponse.json({ 
          success: true, 
          inRoom: true, 
          room: {
            ...formatRoomForClient(room),
            currentQuestion: currentMatch ? {
              question: currentMatch.question,
              answer: currentMatch.answer,
              type: currentMatch.questionType,
              options: currentMatch.options ? JSON.parse(currentMatch.options) : undefined
            } : null,
            currentMatchId: currentMatch?.id,
            answeredPlayerIds
          }
        });
      }

      default:
        return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
    }
  } catch (error) {
    console.error('Quiz API error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ' }, { status: 500 });
  }
}
