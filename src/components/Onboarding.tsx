'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';

// Detective MaskLogo Component
function MaskLogo({ size = 150 }: { size?: number }) {
  const id = useId();
  const glowId = `glow-${id}`;
  const gradientId = `grad-${id}`;

  return (
    <svg width={size} height={size} viewBox="0 0 200 250" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="30" y1="10" x2="170" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6CF6FF" />
          <stop offset="0.5" stopColor="#2FD6FF" />
          <stop offset="1" stopColor="#3D7CFF" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ambient particles */}
      <g opacity="0.5">
        <circle cx="20" cy="30" r="1.5" fill="#66F6FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="180" cy="25" r="2" fill="#66F6FF">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="15" cy="200" r="1.5" fill="#66F6FF">
          <animate attributeName="opacity" values="0.35;0.9;0.35" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="185" cy="195" r="2" fill="#66F6FF">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="3.2s" repeatCount="indefinite" />
        </circle>
      </g>

      {/* Detective Coat/Shoulders - bottom layer */}
      <g filter={`url(#${glowId})`}>
        <path
          d="M30 195 Q50 240 100 250 Q150 240 170 195 L165 220 Q140 250 100 250 Q60 250 35 220 Z"
          fill={`url(#${gradientId})`}
          opacity="0.75"
        />
        {/* Coat collar V-shape */}
        <path
          d="M70 195 L100 215 L130 195"
          stroke="#0A1628"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
      </g>

      {/* Face/Head - oval shape */}
      <g filter={`url(#${glowId})`}>
        <ellipse cx="100" cy="135" rx="50" ry="58" fill="#0A1628" stroke={`url(#${gradientId})`} strokeWidth="3">
          <animate attributeName="stroke-opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* Fedora Hat - Complete and proper */}
      <g filter={`url(#${glowId})`}>
        {/* Hat brim - full ellipse */}
        <ellipse cx="100" cy="85" rx="68" ry="14" fill={`url(#${gradientId})`} />

        {/* Hat top - complete rounded shape */}
        <ellipse cx="100" cy="55" rx="52" ry="35" fill={`url(#${gradientId})`} />

        {/* Hat pinched center top */}
        <ellipse cx="100" cy="28" rx="20" ry="8" fill={`url(#${gradientId})`} />

        {/* Hat band */}
        <rect x="48" y="68" width="104" height="12" rx="2" fill="#0A1628" opacity="0.85" />
      </g>

      {/* Eyes - Slow blinking */}
      <g filter={`url(#${glowId})`}>
        {/* Left Eye */}
        <g>
          <ellipse cx="75" cy="130" rx="12" ry="8" fill="#050A15" stroke="#6CF6FF" strokeWidth="1.5">
            <animate 
              attributeName="ry" 
              values="8;8;1;1;8;8;8;1;1;8" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
          <ellipse cx="75" cy="130" rx="6" ry="5" fill="#C6FFFF">
            <animate 
              attributeName="ry" 
              values="5;5;0;0;5;5;5;0;0;5" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
        </g>
        
        {/* Right Eye */}
        <g>
          <ellipse cx="125" cy="130" rx="12" ry="8" fill="#050A15" stroke="#6CF6FF" strokeWidth="1.5">
            <animate 
              attributeName="ry" 
              values="8;8;1;1;8;8;8;1;1;8" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
          <ellipse cx="125" cy="130" rx="6" ry="5" fill="#C6FFFF">
            <animate 
              attributeName="ry" 
              values="5;5;0;0;5;5;5;0;0;5" 
              dur="10s" 
              repeatCount="indefinite"
              keyTimes="0;0.35;0.4;0.45;0.5;0.85;0.9;0.93;0.96;1"
            />
          </ellipse>
        </g>
      </g>
    </svg>
  );
}

// Onboarding slides data with rich content
const ONBOARDING_SLIDES = [
  {
    id: 1,
    useLogo: true, // Use MaskLogo instead of emoji
    title: 'المخبر',
    subtitle: 'لعبة الذكاء والإثارة',
    description: 'اكشف المخبر بينكم أو خد الكلمة السرية وهرب!',
    features: ['🎮 ألعاب أونلاين', '💬 دردشة صوتية', '🏆 تحديات يومية'],
    gradient: 'from-cyan-600 via-blue-600 to-purple-600',
    accentColor: 'cyan',
    particles: ['✨', '🔍', '🎯'],
  },
  {
    id: 2,
    icon: '🎮',
    title: 'العب مع أصحابك',
    subtitle: 'أونلاين أو أوفلاين',
    description: 'اعمل غرفة خاصة بدعوة أصحابك أو انضم لغرفة عامة',
    features: ['🏠 غرف خاصة', '🌍 غرف عامة', '📱 شارك الكود'],
    gradient: 'from-purple-600 via-pink-600 to-rose-600',
    accentColor: 'purple',
    particles: ['🎮', '👥', '🏠'],
  },
  {
    id: 3,
    icon: '🎭',
    title: 'أوضاع متعددة',
    subtitle: 'اختر تحديك',
    description: 'كلاسيكي، مخبرين مزدوجين، مقلوب، أو صامت',
    features: ['🕵️ كلاسيكي', '👥 مخبرين مزدوجين', '🔄 مقلوب', '🤫 صامت'],
    gradient: 'from-emerald-600 via-teal-600 to-cyan-600',
    accentColor: 'emerald',
    particles: ['🎭', '🎲', '⚡'],
  },
  {
    id: 4,
    icon: '🏆',
    title: 'تقدم وارتقي',
    subtitle: 'اجمع الخبرة',
    description: 'اكسب خبرة مع كل لعبة وافتح ألقاب جديدة',
    features: ['⭐ مستويات', '👑 ألقاب', '📊 إحصائيات'],
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    accentColor: 'amber',
    particles: ['🏆', '⭐', '👑'],
  },
  {
    id: 5,
    useLogo: true, // Use MaskLogo on last slide too
    title: 'جاهز للانطلاق؟',
    subtitle: 'انضم للملايين',
    description: 'سجل دلوقتي وابدأ اللعب فوراً!',
    features: ['⚡ تسجيل سريع', '🎁 مكافأة بداية', '🎮 العب فوراً'],
    gradient: 'from-rose-500 via-pink-500 to-purple-500',
    accentColor: 'rose',
    particles: ['🚀', '✨', '💫'],
    isLast: true,
  },
];

// Storage key for onboarding status
const ONBOARDING_STORAGE_KEY = 'elmokhber_onboarding_completed';

/**
 * Check if user has completed onboarding
 */
export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
}

/**
 * Mark onboarding as completed
 */
export function completeOnboarding(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
}

/**
 * Reset onboarding (for testing)
 */
export function resetOnboarding(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

interface OnboardingProps {
  onComplete: () => void;
}

// Floating Particle Component
function FloatingParticle({ emoji, delay, duration }: { emoji: string; delay: number; duration: number }) {
  return (
    <div
      className="absolute text-2xl opacity-20 pointer-events-none"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animation: `float ${duration}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      {emoji}
    </div>
  );
}

// Animated Background Shapes
function BackgroundShapes({ gradient }: { gradient: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient Orbs */}
      <div 
        className={`absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br ${gradient} opacity-30 blur-3xl rounded-full transition-all duration-1000`}
        style={{ transform: 'scale(1.5)' }}
      />
      <div 
        className={`absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tl ${gradient} opacity-20 blur-3xl rounded-full transition-all duration-1000`}
        style={{ transform: 'scale(1.5)' }}
      />
      
      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Animated Lines */}
      <div className="absolute inset-0">
        <div 
          className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent"
          style={{ animation: 'slideDown 3s ease-in-out infinite' }}
        />
        <div 
          className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-white/10 to-transparent"
          style={{ animation: 'slideDown 3s ease-in-out infinite 1s' }}
        />
      </div>
    </div>
  );
}

// Progress Ring Component
function ProgressRing({ progress, size = 60, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="url(#progressGradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        style={{
          strokeDasharray: circumference,
          strokeDashoffset: offset,
          transition: 'stroke-dashoffset 0.5s ease-out',
        }}
      />
      <defs>
        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * Onboarding Component - Premium interactive welcome screens
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const totalSlides = ONBOARDING_SLIDES.length;
  const currentSlideData = ONBOARDING_SLIDES[currentSlide];

  // Handle mouse move for parallax effect
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  }, []);

  // Handle next slide
  const goToNext = useCallback(() => {
    if (isAnimating) return;
    
    if (currentSlide < totalSlides - 1) {
      setIsAnimating(true);
      setCurrentSlide(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 500);
    } else {
      completeOnboarding();
      onComplete();
    }
  }, [currentSlide, isAnimating, totalSlides, onComplete]);

  // Handle previous slide
  const goToPrev = useCallback(() => {
    if (isAnimating || currentSlide === 0) return;
    
    setIsAnimating(true);
    setCurrentSlide(prev => prev - 1);
    setTimeout(() => setIsAnimating(false), 500);
  }, [currentSlide, isAnimating]);

  // Go to specific slide
  const goToSlide = useCallback((index: number) => {
    if (isAnimating || index === currentSlide) return;
    
    setIsAnimating(true);
    setCurrentSlide(index);
    setTimeout(() => setIsAnimating(false), 500);
  }, [currentSlide, isAnimating]);

  // Skip onboarding
  const handleSkip = () => {
    completeOnboarding();
    onComplete();
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToNext();
      } else if (e.key === 'ArrowRight') {
        goToPrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      } else if (e.key === 'Enter' || e.key === ' ') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev]);

  const progress = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-[#030712] flex flex-col overflow-hidden"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={handleMouseMove}
    >
      {/* Dynamic Background */}
      <BackgroundShapes gradient={currentSlideData?.gradient || ''} />
      
      {/* Floating Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {currentSlideData?.particles?.map((particle, i) => (
          <FloatingParticle 
            key={i} 
            emoji={particle} 
            delay={i * 0.5} 
            duration={4 + i} 
          />
        ))}
      </div>

      {/* Top Bar */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4">
        {/* Progress with Ring */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <ProgressRing progress={progress} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white/80">{currentSlide + 1}/{totalSlides}</span>
            </div>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-2">
          {ONBOARDING_SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all duration-500 ${
                index === currentSlide 
                  ? 'w-8 bg-gradient-to-r from-cyan-400 to-purple-400' 
                  : index < currentSlide 
                    ? 'w-2 bg-white/60' 
                    : 'w-2 bg-white/20'
              }`}
              aria-label={`الشاشة ${index + 1}`}
            />
          ))}
        </div>

        {/* Skip Button */}
        {!currentSlideData?.isLast && (
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-bold text-white/50 hover:text-white transition-colors"
          >
            تخطي
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div 
          className={`w-full max-w-md text-center transition-all duration-500 ${
            isAnimating ? 'opacity-0 translate-y-8' : 'opacity-100 translate-y-0'
          }`}
          style={{
            transform: `perspective(1000px) rotateY(${mousePos.x * 5}deg) rotateX(${-mousePos.y * 5}deg)`,
          }}
        >
          {/* Icon Container with Glow */}
          <div className="relative mx-auto mb-10">
            {/* Glow Effect */}
            <div 
              className={`absolute inset-0 bg-gradient-to-br ${currentSlideData?.gradient} opacity-50 blur-3xl rounded-full scale-150 transition-all duration-1000`}
            />
            
            {/* Icon Circle */}
            <div 
              className={`relative h-36 w-36 mx-auto rounded-3xl bg-gradient-to-br ${currentSlideData?.gradient} p-[2px] shadow-2xl transition-all duration-700`}
              style={{
                boxShadow: `0 0 60px ${currentSlideData?.accentColor === 'cyan' ? 'rgba(6, 182, 212, 0.4)' : 
                           currentSlideData?.accentColor === 'purple' ? 'rgba(147, 51, 234, 0.4)' :
                           currentSlideData?.accentColor === 'emerald' ? 'rgba(16, 185, 129, 0.4)' :
                           currentSlideData?.accentColor === 'amber' ? 'rgba(245, 158, 11, 0.4)' :
                           'rgba(244, 63, 94, 0.4)'}`,
              }}
            >
              <div className="h-full w-full rounded-3xl bg-[#030712] flex items-center justify-center">
                {currentSlideData?.useLogo ? (
                  <div 
                    className="transition-transform duration-500"
                    style={{ 
                      transform: isAnimating ? 'scale(0.5)' : 'scale(1)',
                    }}
                  >
                    <MaskLogo size={120} />
                  </div>
                ) : (
                  <span 
                    className="text-7xl transition-transform duration-500"
                    style={{ 
                      transform: isAnimating ? 'scale(0.5)' : 'scale(1)',
                      filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.3))',
                    }}
                  >
                    {currentSlideData?.icon}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Title with Gradient */}
          <h1 
            className={`text-4xl font-black bg-gradient-to-r ${currentSlideData?.gradient} bg-clip-text text-transparent mb-2 transition-all duration-500`}
          >
            {currentSlideData?.title}
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-white/60 mb-4 font-medium">
            {currentSlideData?.subtitle}
          </p>

          {/* Description */}
          <p className="text-base text-white/80 leading-relaxed mb-8 max-w-sm mx-auto">
            {currentSlideData?.description}
          </p>

          {/* Features Pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {currentSlideData?.features?.map((feature, index) => (
              <div
                key={index}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="relative z-20 p-6 pb-8">
        {/* Main Action Button */}
        <button
          type="button"
          onClick={goToNext}
          className={`w-full rounded-2xl py-5 text-lg font-bold transition-all duration-300 active:scale-[0.98] relative overflow-hidden group ${
            currentSlideData?.isLast
              ? `bg-gradient-to-r ${currentSlideData?.gradient} text-white shadow-2xl`
              : 'bg-white text-[#030712]'
          }`}
          style={currentSlideData?.isLast ? {
            boxShadow: '0 0 40px rgba(244, 63, 94, 0.4)',
          } : {}}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            {currentSlideData?.isLast ? (
              <>
                <span>ابدأ المغامرة</span>
                <span className="text-2xl">🚀</span>
              </>
            ) : (
              <>
                <span>التالي</span>
                <span className="text-xl">←</span>
              </>
            )}
          </span>
          
          {/* Shine Effect */}
          {currentSlideData?.isLast && (
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
            />
          )}
        </button>

        {/* Navigation Dots for Mobile */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {currentSlide > 0 && (
            <button
              type="button"
              onClick={goToPrev}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/5 text-lg text-white transition-all hover:bg-white/10"
            >
              →
            </button>
          )}
          
          {currentSlide === 0 && (
            <div className="text-center text-sm text-white/40">
              اسحب للتنقل
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.2;
          }
          50% {
            transform: translateY(-30px) rotate(10deg);
            opacity: 0.4;
          }
        }
        
        @keyframes slideDown {
          0%, 100% {
            transform: translateY(-100%);
            opacity: 0;
          }
          50% {
            transform: translateY(100%);
            opacity: 1;
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}

export default Onboarding;
