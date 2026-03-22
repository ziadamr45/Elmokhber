'use client';

// Floating voice control panel for use during games
export function FloatingVoicePanel({
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  isConnected,
  participantCount = 0,
}: {
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  isConnected: boolean;
  participantCount?: number;
}) {
  return (
    <div className="fixed bottom-20 left-4 z-50 flex flex-col gap-2">
      {/* Connection status */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 rounded-full text-xs">
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
        <span className="text-white/70">
          {isConnected ? `الصوت متصل (${participantCount})` : 'غير متصل'}
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2">
        {/* Mute button */}
        <button
          onClick={onToggleMute}
          disabled={!isConnected}
          className={`p-3 rounded-full transition-all shadow-lg ${
            isMuted
              ? 'bg-red-500 text-white'
              : 'bg-green-500 text-white hover:bg-green-600'
          } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isMuted ? 'إلغاء كتم المايك' : 'كتم المايك'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} stroke="currentColor" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {/* Deafen button */}
        <button
          onClick={onToggleDeafen}
          disabled={!isConnected}
          className={`p-3 rounded-full transition-all shadow-lg ${
            isDeafened
              ? 'bg-red-500 text-white'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isDeafened ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
        >
          {isDeafened ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              <line x1="4" y1="4" x2="20" y2="20" strokeWidth={2} stroke="currentColor" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// Simple voice controls for inline use
export function VoiceControls({
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  isConnected,
}: {
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  isConnected: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Mute button */}
      <button
        onClick={onToggleMute}
        disabled={!isConnected}
        className={`p-2 rounded-full transition-colors ${
          isMuted
            ? 'bg-red-500/20 text-red-400'
            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
        } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isMuted ? 'إلغاء كتم المايك' : 'كتم المايك'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>

      {/* Deafen button */}
      <button
        onClick={onToggleDeafen}
        disabled={!isConnected}
        className={`p-2 rounded-full transition-colors ${
          isDeafened
            ? 'bg-red-500/20 text-red-400'
            : 'bg-white/10 text-white/70 hover:bg-white/20'
        } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isDeafened ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
      >
        {isDeafened ? '🔈' : '🔊'}
      </button>
    </div>
  );
}
