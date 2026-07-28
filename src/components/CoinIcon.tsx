'use client';

// Coin/XP Icon - SVG component for instant rendering without loading
export default function CoinIcon({ 
  size = 24, 
  className = '' 
}: { 
  size?: number;
  className?: string;
}) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="coinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <linearGradient id="coinShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8DC" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#FFD700" stopOpacity="0" />
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0" />
        </linearGradient>
        <filter id="coinShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Main coin body */}
      <circle 
        cx="50" 
        cy="50" 
        r="45" 
        fill="url(#coinGradient)" 
        stroke="#B8860B" 
        strokeWidth="3"
        filter="url(#coinShadow)"
      />

      {/* Inner circle border */}
      <circle 
        cx="50" 
        cy="50" 
        r="38" 
        fill="none" 
        stroke="#B8860B" 
        strokeWidth="2"
        opacity="0.5"
      />

      {/* Shine effect */}
      <ellipse 
        cx="35" 
        cy="35" 
        rx="20" 
        ry="15" 
        fill="url(#coinShine)"
        transform="rotate(-30 35 35)"
      />

      {/* Star in center */}
      <path
        d="M50 20 L55 38 L74 38 L59 50 L65 68 L50 56 L35 68 L41 50 L26 38 L45 38 Z"
        fill="#B8860B"
        opacity="0.9"
      />

      {/* Small star highlight */}
      <path
        d="M50 25 L53 35 L63 35 L55 42 L58 52 L50 46 L42 52 L45 42 L37 35 L47 35 Z"
        fill="#FFF8DC"
        opacity="0.4"
      />
    </svg>
  );
}

// Smaller inline version for text
export function CoinIconInline({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-block align-middle ${className}`}>
      <CoinIcon size={16} />
    </span>
  );
}
