import ZAI from 'z-ai-web-dev-sdk';

// Categories and their Arabic names
const CATEGORY_NAMES: Record<string, string> = {
  egypt: 'مصر',
  history: 'التاريخ',
  geography: 'الجغرافيا',
  science: 'العلوم',
  technology: 'التكنولوجيا',
  sports: 'الرياضة',
  movies: 'الأفلام',
  music: 'الموسيقى',
  general: 'الثقافة العامة',
  arabic: 'الثقافة العربية',
  islamic: 'الثقافة الإسلامية',
  food: 'الأكلات',
  celebrities: 'المشاهير',
  proverbs: 'الأمثال',
};

const DIFFICULTY_NAMES: Record<string, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
};

// Question types with descriptions
const QUESTION_TYPES = {
  direct: 'سؤال مباشر (إجابة قصيرة)',
  'fill-blank': 'املأ الفراغ',
  'multiple-choice': 'اختيار من متعدد',
};

interface GeneratedQuestion {
  question: string;
  answer: string;
  options?: string[];
  type: 'direct' | 'fill-blank' | 'multiple-choice';
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
}

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

/**
 * Generate a quiz question using AI
 */
export async function generateAIQuestion(
  category: string,
  difficulty: 'easy' | 'medium' | 'hard',
  previousAnswers: string[] = [],
  questionType?: 'direct' | 'fill-blank' | 'multiple-choice'
): Promise<GeneratedQuestion> {
  try {
    const zai = await getZAI();
    const categoryName = CATEGORY_NAMES[category] || category;
    const difficultyName = DIFFICULTY_NAMES[difficulty] || difficulty;

    // Choose question type randomly if not specified
    const types: Array<'direct' | 'fill-blank' | 'multiple-choice'> = ['direct', 'fill-blank', 'multiple-choice'];
    const selectedType = questionType || types[Math.floor(Math.random() * types.length)];

    const previousAnswersText = previousAnswers.length > 0
      ? `\n\nتجنب هذه الإجابات السابقة (لا تكررها): ${previousAnswers.slice(-10).join('، ')}`
      : '';

    const systemPrompt = `أنت خبير في إنشاء أسئلة مسابقات ثقافية مصرية وعربية.
مهمتك: إنشاء سؤال واحد فقط في موضوع "${categoryName}" بمستوى صعوبة "${difficultyName}".

قواعد مهمة جداً:
1. السؤال يجب أن يكون واضحاً ومحدداً
2. الإجابة يجب أن تكون كلمة أو عبارة قصيرة وواضحة (لا تكن جمل طويلة)
3. الإجابة يجب أن تكون صحيحة 100%
4. اجعل السؤال مناسب للثقافة المصرية والعربية
5. تجنب الأسئلة المحيرة أو التي تحتمل أكثر من إجابة

${selectedType === 'multiple-choice' ? `
للاختيار من متعدد:
- قدم 4 خيارات مختلفين تماماً
- خيار واحد صحيح والباقي خاطئ
- الخيارات الخاطئة يجب أن تكون منطقية ولكن خاطئة بوضوح
` : ''}

${selectedType === 'fill-blank' ? `
لملء الفراغ:
- اكتب السؤال مع ______ في مكان الفراغ
- الإجابة تكون الكلمة التي تملأ الفراغ
` : ''}

أرجع الإجابة بصيغة JSON فقط بدون أي نص إضافي:
{
  "question": "السؤال هنا",
  "answer": "الإجابة الصحيحة هنا",
  ${selectedType === 'multiple-choice' ? '"options": ["خيار1", "خيار2", "خيار3", "خيار4"],' : ''}
  "type": "${selectedType}",
  "difficulty": "${difficulty}",
  "category": "${category}"
}`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `أنشئ سؤال ${categoryName} بمستوى ${difficultyName}.${previousAnswersText}`
        }
      ],
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('Empty AI response');
    }

    // Parse JSON from response
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]) as GeneratedQuestion;
      
      // Validate required fields
      if (!parsed.question || !parsed.answer) {
        throw new Error('Missing required fields');
      }

      // Ensure type is valid
      if (!['direct', 'fill-blank', 'multiple-choice'].includes(parsed.type)) {
        parsed.type = selectedType;
      }

      // Ensure options for multiple choice
      if (parsed.type === 'multiple-choice' && (!parsed.options || parsed.options.length < 4)) {
        // Generate options if missing
        parsed.options = await generateOptions(parsed.answer, parsed.question);
      }

      return {
        ...parsed,
        difficulty,
        category,
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', response);
      throw parseError;
    }
  } catch (error) {
    console.error('AI question generation error:', error);
    throw error;
  }
}

/**
 * Generate multiple choice options for an answer
 */
async function generateOptions(correctAnswer: string, question: string): Promise<string[]> {
  try {
    const zai = await getZAI();
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `أنت خبير مسابقات. مهمتك إنشاء 3 خيارات خاطئة ولكن منطقية لسؤال مسابقة.
الخيارات يجب أن تكون:
- مختلفة تماماً عن الإجابة الصحيحة
- منطقية ولكن خاطئة بوضوح
- من نفس نوع الإجابة الصحيحة (أسماء، أرقام، إلخ)

أرجع الخيارات كـ JSON array فقط: ["خيار1", "خيار2", "خيار3"]`
        },
        {
          role: 'user',
          content: `السؤال: ${question}\nالإجابة الصحيحة: ${correctAnswer}\n\nأنشئ 3 خيارات خاطئة.`
        }
      ],
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error('Empty response');

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No array found');

    const wrongOptions = JSON.parse(jsonMatch[0]) as string[];
    
    // Combine correct answer with wrong options and shuffle
    const allOptions = [correctAnswer, ...wrongOptions.slice(0, 3)];
    return shuffleArray(allOptions);
  } catch {
    // Fallback: create simple variations
    return [correctAnswer, 'خيار آخر 1', 'خيار آخر 2', 'خيار آخر 3'];
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Smart answer verification with AI assistance
 */
export async function verifyAnswerWithAI(
  playerAnswer: string,
  correctAnswer: string,
  question?: string
): Promise<{ isCorrect: boolean; confidence: number; reason?: string }> {
  try {
    const zai = await getZAI();
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `أنت حكم في مسابقات. مهمتك تحديد ما إذا كانت إجابة اللاعب صحيحة أم لا.

قواعد التحكيم:
1. تقبل الأخطاء الإملائية البسيطة (مثل: القاهره بدلاً من القاهرة)
2. تقبل الاختلافات في الحروف (أ/إ/آ، ة/ه، ى/ي، إلخ)
3. تقبل الأرقام العربية والإنجليزية
4. تقبل الإجابات المختصرة إذا كانت واضحة
5. رفض الإجابات الخاطئة تماماً

أرجع النتيجة كـ JSON فقط:
{
  "isCorrect": true/false,
  "confidence": 0-100,
  "reason": "سبب القرار (اختياري)"
}`
        },
        {
          role: 'user',
          content: `إجابة اللاعب: "${playerAnswer}"
الإجابة الصحيحة: "${correctAnswer}"
${question ? `السؤال: "${question}"` : ''}

هل إجابة اللاعب صحيحة؟`
        }
      ],
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) throw new Error('Empty response');

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');

    const result = JSON.parse(jsonMatch[0]) as { isCorrect: boolean; confidence: number; reason?: string };
    
    return {
      isCorrect: result.isCorrect,
      confidence: result.confidence,
      reason: result.reason,
    };
  } catch (error) {
    console.error('AI verification error:', error);
    // Fallback to basic matching
    return {
      isCorrect: basicArabicMatch(playerAnswer, correctAnswer),
      confidence: 50,
      reason: 'تم التحديد بدون AI',
    };
  }
}

/**
 * Basic Arabic text matching (fallback)
 */
function basicArabicMatch(text1: string, text2: string): boolean {
  const normalize = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      // Normalize Arabic letters
      .replace(/[آإأ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ؤئ]/g, 'ء')
      // Remove diacritics
      .replace(/[\u064B-\u065F]/g, '')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  };

  const norm1 = normalize(text1);
  const norm2 = normalize(text2);

  // Direct match
  if (norm1 === norm2) return true;

  // Check if one contains the other
  if (norm1.length >= 3 && norm2.includes(norm1)) return true;
  if (norm2.length >= 3 && norm1.includes(norm2)) return true;

  // Calculate similarity
  const similarity = calculateSimilarity(norm1, norm2);
  return similarity >= 0.75;
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return (maxLen - distance) / maxLen;
}

/**
 * Combined answer check: Fast local check + AI verification for uncertain cases
 */
export async function smartAnswerCheck(
  playerAnswer: string,
  correctAnswer: string,
  question?: string
): Promise<{ isCorrect: boolean; confidence: number }> {
  // Step 1: Fast local check first
  const localResult = localAnswerCheck(playerAnswer, correctAnswer);
  
  // If high confidence match or clear mismatch, return immediately
  if (localResult.confidence >= 90) {
    return { isCorrect: true, confidence: localResult.confidence };
  }
  
  if (localResult.confidence < 30) {
    return { isCorrect: false, confidence: 100 - localResult.confidence };
  }
  
  // Step 2: For uncertain cases, use AI
  const aiResult = await verifyAnswerWithAI(playerAnswer, correctAnswer, question);
  return aiResult;
}

/**
 * Fast local answer checking with confidence score
 */
function localAnswerCheck(playerAnswer: string, correctAnswer: string): { isCorrect: boolean; confidence: number } {
  // Comprehensive Arabic normalization
  const normalize = (text: string) => {
    return text
      .trim()
      .toLowerCase()
      // Normalize Arabic letters
      .replace(/[آإأ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ؤئء]/g, 'ء')
      // Remove diacritics
      .replace(/[\u064B-\u065F]/g, '')
      // Remove tatweel
      .replace(/ـ/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normPlayer = normalize(playerAnswer);
  const normCorrect = normalize(correctAnswer);

  // Direct match = 100% confidence
  if (normPlayer === normCorrect) {
    return { isCorrect: true, confidence: 100 };
  }

  // Arabic number word conversions
  const arabicNumbers: Record<string, string> = {
    'صفر': '0', 'واحد': '1', 'واحده': '1', 'اثنان': '2', 'اثنين': '2', 'اتنين': '2',
    'ثلاثة': '3', 'ثلاثه': '3', 'تلاته': '3', 'تلاتة': '3',
    'اربعة': '4', 'اربعه': '4', 'أربعة': '4', 'اربعه': '4', 'أربعه': '4',
    'خمسة': '5', 'خمسه': '5', 'خمسه': '5',
    'ستة': '6', 'سته': '6', 'سته': '6',
    'سبعة': '7', 'سبعه': '7', 'سبعه': '7',
    'ثمانية': '8', 'ثمانيه': '8', 'تمانيه': '8', 'تمانية': '8',
    'تسعة': '9', 'تسعه': '9', 'تسعه': '9',
    'عشرة': '10', 'عشره': '10', 'عشره': '10',
    'احدعشر': '11', 'احدعشر': '11', 'حدعشر': '11',
    'اتناعشر': '12', 'اطناعشر': '12',
  };

  // Check number conversions
  if (arabicNumbers[normPlayer] === normCorrect || arabicNumbers[normCorrect] === normPlayer) {
    return { isCorrect: true, confidence: 100 };
  }

  // Check if both are numbers (Arabic or Western digits)
  const toNumber = (s: string) => {
    const arabicToWestern: Record<string, string> = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
      '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    let result = '';
    for (const c of s) {
      result += arabicToWestern[c] || c;
    }
    return result;
  };

  const numPlayer = toNumber(normPlayer);
  const numCorrect = toNumber(normCorrect);
  if (numPlayer === numCorrect && !isNaN(Number(numPlayer))) {
    return { isCorrect: true, confidence: 100 };
  }

  // Partial match - one contains the other
  if (normPlayer.length >= 3 && normCorrect.includes(normPlayer)) {
    return { isCorrect: true, confidence: 85 };
  }
  if (normCorrect.length >= 3 && normPlayer.includes(normCorrect)) {
    return { isCorrect: true, confidence: 85 };
  }

  // Calculate similarity
  const similarity = calculateSimilarity(normPlayer, normCorrect);
  
  if (similarity >= 0.85) {
    return { isCorrect: true, confidence: Math.round(similarity * 100) };
  }
  
  if (similarity >= 0.7) {
    return { isCorrect: true, confidence: Math.round(similarity * 100) - 10 };
  }

  // Check for common Egyptian/Arabic variations
  const variations = generateVariations(normCorrect);
  for (const variation of variations) {
    if (normPlayer === variation) {
      return { isCorrect: true, confidence: 90 };
    }
  }

  return { isCorrect: similarity > 0.5, confidence: Math.round(similarity * 100) };
}

/**
 * Generate common spelling variations for Arabic words
 */
function generateVariations(word: string): string[] {
  const variations: string[] = [word];
  
  // Common substitutions
  const substitutions: [RegExp, string][] = [
    [/ا/g, 'أ'],
    [/ا/g, 'إ'],
    [/ه/g, 'ة'],
    [/ي/g, 'ى'],
    [/و/g, 'ؤ'],
  ];

  for (const [pattern, replacement] of substitutions) {
    const newVar = word.replace(pattern, replacement);
    if (newVar !== word) {
      variations.push(newVar);
    }
  }

  return variations;
}

export type { GeneratedQuestion };
