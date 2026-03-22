import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Fallback fuzzy matching functions
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Normalize Arabic characters
    .replace(/[آإأ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    // Remove diacritics
    .replace(/[\u064B-\u065F]/g, '')
    // Remove all spaces and punctuation
    .replace(/[\s\-\_\.]/g, '')
    // Normalize English
    .replace(/[^\u0600-\u06FFa-z0-9]/gi, '');
}

// Calculate Levenshtein distance
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Calculate similarity percentage
function similarity(a: string, b: string): number {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0;
  
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  
  return 1 - distance / maxLength;
}

// Common variations mapping
const COMMON_VARIATIONS: Record<string, string[]> = {
  // Countries
  'كندا': ['كنده', 'كند', 'canada'],
  'مصر': ['مصريه', 'مصرية', 'egypt'],
  'السعودية': ['سعوديه', 'سعودية', 'السعوديه', 'saudi'],
  'الإمارات': ['امارات', 'الامارات', 'emirates', 'uae'],
  'فلسطين': ['فلسطني', 'palestine'],
  'الأردن': ['اردن', 'الاردن', 'jordan'],
  'الجزائر': ['جزائر', 'algeria'],
  'المغرب': ['مغرب', 'morocco'],
  'تونس': ['tunisia'],
  'سوريا': ['syria'],
  'العراق': ['عراق', 'iraq'],
  'لبنان': ['lebanon'],
  'عمان': ['oman'],
  'قطر': ['qatar'],
  'البحرين': ['بحرين', 'bahrain'],
  'الكويت': ['kuwait'],
  
  // Cities
  'القاهرة': ['قاهره', 'قاهرة', 'القاهره', 'cairo'],
  'الرياض': ['رياض', 'الرياظ', 'riyadh'],
  'دبي': ['دباي', 'dubai'],
  'جدة': ['جده', 'jeddah'],
  'مكة': ['مكه', 'mecca'],
  'المدينة': ['مدينه', 'madinah', 'medina'],
  'بيروت': ['beirut'],
  'دمشق': ['damascus'],
  'عمان': ['amman'],
  'الخبر': ['خبر'],
  'الدمام': ['دمام'],
  'نيويورك': ['نيو يورك', 'new york', 'ny'],
  'لندن': ['london'],
  'باريس': ['paris'],
  'طوكيو': ['tokyo'],
  
  // Tech companies
  'اتش بي': ['إتش بي', 'hp', 'h.p', 'اتشبي'],
  'آبل': ['ابل', 'apple', 'أبل'],
  'مايكروسوفت': ['microsoft', 'ms'],
  'جوجل': ['google'],
  'فيسبوك': ['facebook', 'meta'],
  'أمازون': ['امازون', 'amazon', 'أمازون'],
  'سامسونج': ['samsung'],
  'سوني': ['sony'],
  
  // Food
  'كباب': ['كباب'],
  'شاورما': ['شاورمه', 'shawarma'],
  'فلافل': ['فلافيل', 'falafel'],
  'حمص': ['hummus'],
  'طعمية': ['طعميه', 'falafel'],
  'ملوخية': ['ملوخيه', 'molokhia'],
  'كشري': ['كشري', 'koshari'],
  'مندي': ['مندى', 'mandi'],
  'برياني': ['برياني', 'biryani'],
  
  // Sports
  'كرة القدم': ['قدم', 'football', 'soccer'],
  'كرة السلة': ['سله', 'basketball'],
  'تنس': ['tennis'],
  'سباحة': ['swimming'],
  'جري': ['running'],
  
  // Jobs
  'طبيب': ['دكتور', 'doctor'],
  'مهندس': ['engineer'],
  'معلم': ['مدرس', 'teacher'],
  'محامي': ['lawyer'],
  'مبرمج': ['programmer', 'developer'],
  'طيار': ['pilot'],
  'شرطي': ['police'],
  'طباخ': ['شيف', 'chef'],
};

// Check if guess matches any variation
function checkVariations(guess: string, answer: string): boolean {
  const normalizedGuess = normalizeText(guess);
  const normalizedAnswer = normalizeText(answer);
  
  // Direct match after normalization
  if (normalizedGuess === normalizedAnswer) return true;
  
  // Check known variations
  for (const [correct, variations] of Object.entries(COMMON_VARIATIONS)) {
    const normalizedCorrect = normalizeText(correct);
    if (normalizedCorrect === normalizedAnswer || normalizedCorrect === normalizedGuess) {
      // Check if guess or answer is in variations
      if (variations.some(v => normalizeText(v) === normalizedGuess || normalizeText(v) === normalizedAnswer)) {
        return true;
      }
    }
  }
  
  // Check both directions in variations
  for (const [correct, variations] of Object.entries(COMMON_VARIATIONS)) {
    const allVariants = [correct, ...variations].map(v => normalizeText(v));
    if (allVariants.includes(normalizedGuess) && allVariants.includes(normalizedAnswer)) {
      return true;
    }
  }
  
  return false;
}

// Use AI for smart comparison
async function aiCheckAnswer(guess: string, answer: string): Promise<{ isCorrect: boolean; confidence: number; reason?: string }> {
  try {
    const zai = await ZAI.create();
    
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `أنت مساعد ذكي متخصص في مقارنة الإجابات في الألعاب. مهمتك تحديد ما إذا كانت إجابة اللاعب صحيحة أم لا.

القواعد:
1. يجب أن تقبل الإجابات المتشابهة معنوياً
2. تقبل الأخطاء الإملائية البسيطة
3. تقبل اختلافات التشكيل والهمزات
4. تقبل الفرق بين (ه/ة) و (ى/ي)
5. تقبل المسافات الزائدة أو الناقصة
6. تقبل الترجمات (عربي/إنجليزي)
7. تقبل النطق الصوتي (مثل "اتش بي" = HP)

أرجع JSON فقط:
{
  "isCorrect": true/false,
  "confidence": 0-1,
  "reason": "سبب مختصر بالعربية"
}`
        },
        {
          role: 'user',
          content: `هل إجابة "${guess}" صحيحة لسؤال إجابته "${answer}"؟

قارن المعنى وليس النص فقط.`
        }
      ],
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: parsed.isCorrect === true,
        confidence: parsed.confidence || 0.5,
        reason: parsed.reason
      };
    }
  } catch (error) {
    console.error('AI check error:', error);
  }
  
  return { isCorrect: false, confidence: 0 };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guess, answer, useAI = true } = body;

    if (!guess || !answer) {
      return NextResponse.json({ 
        success: false, 
        error: 'الإجابة والكلمة السرية مطلوبان' 
      }, { status: 400 });
    }

    // Step 1: Check variations (instant)
    if (checkVariations(guess, answer)) {
      return NextResponse.json({
        success: true,
        isCorrect: true,
        confidence: 1,
        method: 'variation_match'
      });
    }

    // Step 2: Check similarity (fast)
    const similarityScore = similarity(guess, answer);
    
    // High similarity threshold - accept without AI
    if (similarityScore >= 0.85) {
      return NextResponse.json({
        success: true,
        isCorrect: true,
        confidence: similarityScore,
        method: 'fuzzy_match'
      });
    }

    // Step 3: Use AI for borderline cases
    if (useAI && similarityScore >= 0.3) {
      const aiResult = await aiCheckAnswer(guess, answer);
      
      if (aiResult.isCorrect && aiResult.confidence >= 0.7) {
        return NextResponse.json({
          success: true,
          isCorrect: true,
          confidence: aiResult.confidence,
          reason: aiResult.reason,
          method: 'ai_match'
        });
      }
    }

    // Step 4: Accept medium similarity as fallback
    if (similarityScore >= 0.7) {
      return NextResponse.json({
        success: true,
        isCorrect: true,
        confidence: similarityScore,
        method: 'fuzzy_match'
      });
    }

    // Not correct
    return NextResponse.json({
      success: true,
      isCorrect: false,
      confidence: similarityScore,
      method: similarityScore >= 0.5 ? 'close_guess' : 'no_match'
    });

  } catch (error) {
    console.error('Answer check error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'حدث خطأ في التحقق من الإجابة' 
    }, { status: 500 });
  }
}
