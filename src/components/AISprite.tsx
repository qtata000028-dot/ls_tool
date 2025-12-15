import React, { useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Zap } from 'lucide-react';
import useVoiceAssistant from '../hooks/useVoiceAssistant';

interface AISpriteProps {
  onNavigate: (view: string, params?: any) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const AISprite: React.FC<AISpriteProps> = ({ onNavigate }) => {
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 16, y: 16 };
    return { x: window.innerWidth - 92, y: window.innerHeight - 132 };
  });
  const dragStateRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  const { status, toggleListening } = useVoiceAssistant({
    onNavigate,
  });

  const { assistantState, isListening, transcript, feedback, indicator } = status;

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      setPosition((pos) => ({
        x: clamp(pos.x, 12, window.innerWidth - 88),
        y: clamp(pos.y, 12, window.innerHeight - 88),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = event;
    dragStateRef.current = {
      dragging: true,
      startX: pointer.clientX,
      startY: pointer.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.dragging) return;
    const pointer = event;
    const dx = pointer.clientX - dragStateRef.current.startX;
    const dy = pointer.clientY - dragStateRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragStateRef.current.moved = true;
    const nextX = clamp(dragStateRef.current.originX + dx, 12, window.innerWidth - 88);
    const nextY = clamp(dragStateRef.current.originY + dy, 12, window.innerHeight - 88);
    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = () => {
    if (!dragStateRef.current.dragging) return;
    const moved = dragStateRef.current.moved;
    dragStateRef.current.dragging = false;
    if (!moved) {
      toggleListening();
    }
  };

  const orbTone =
    indicator === 'green'
      ? 'from-emerald-400 to-lime-400 shadow-emerald-400/30'
      : indicator === 'yellow'
      ? 'from-amber-300 to-yellow-400 shadow-amber-400/30'
      : 'from-slate-300 to-slate-200 shadow-slate-400/30';

  const statusText = feedback ||
    (assistantState === 'awake'
      ? '待指令'
      : isListening
      ? '监听中'
      : '点击开启');

  const TranscriptBadge = () => {
    if (!transcript || !isListening) return null;
    return (
      <div
        className={`pointer-events-none mt-2 ${isMobileView ? 'max-w-[230px]' : 'max-w-[320px]'}`}
      >
        <div
          className={`flex items-center gap-2 rounded-full border shadow-lg backdrop-blur-xl px-3 py-2 text-xs ${
            isMobileView
              ? 'bg-slate-900/85 border-white/10 text-white'
              : 'bg-white/90 border-slate-200 text-slate-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="truncate">{transcript}</span>
        </div>
      </div>
    );
  };

  const FeedbackBubble = () => {
    if (!statusText) return null;
    const tone =
      assistantState === 'awake'
        ? 'bg-emerald-500/20 border-emerald-200/40 text-emerald-50'
        : isListening
        ? 'bg-amber-400/20 border-amber-200/40 text-amber-50'
        : 'bg-slate-900/80 border-white/10 text-white';

    return (
      <div className="pointer-events-none mb-2">
        <div
          className={`flex items-center gap-2 rounded-full ${tone} backdrop-blur-xl shadow-lg border px-3 py-2 text-xs whitespace-nowrap`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              assistantState === 'awake'
                ? 'bg-emerald-300'
                : isListening
                ? 'bg-amber-300'
                : 'bg-slate-300'
            }`}
          />
          <span>{statusText}</span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed z-50"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div className="flex flex-col items-center select-none">
        <FeedbackBubble />
        <button
          type="button"
          className={`relative h-14 w-14 rounded-full bg-gradient-to-br ${orbTone} shadow-xl flex items-center justify-center text-slate-900 transition-transform duration-200 active:scale-95 border border-white/40 backdrop-blur-xl`}
          aria-label={isListening ? '停止监听' : '开始监听'}
          onClick={(e) => {
            e.stopPropagation();
            toggleListening();
          }}
        >
          <div className="absolute inset-0 rounded-full bg-white/30 mix-blend-overlay" />
          <div className="relative flex items-center justify-center">
            {assistantState === 'awake' ? (
              <Zap size={22} className="text-emerald-700" />
            ) : isListening ? (
              <Mic size={22} className="text-amber-700" />
            ) : (
              <MicOff size={22} className="text-slate-700" />
            )}
          </div>
          <div className="absolute -left-6 -top-6">
            <div className="h-6 w-6 rounded-full bg-white/70 text-slate-800 flex items-center justify-center text-xs shadow">
              <Bot size={14} />
            </div>
          </div>
        </button>
        <TranscriptBadge />
      </div>
    </div>
  );
};

export default AISprite;
