import React, { useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff, Zap } from 'lucide-react';

interface AISpriteProps {
  onNavigate: (view: string, params?: any) => void;
}

const AISprite: React.FC<AISpriteProps> = ({ onNavigate }) => {
  const [isListening, setIsListening] = useState(false);
  const [capturedSpeech, setCapturedSpeech] = useState('');
  const [feedback, setFeedback] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'awake' | 'executing'>('idle');
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [position, setPosition] = useState(() => {
    if (typeof window === 'undefined') return { x: 16, y: 16 };
    return { x: window.innerWidth - 96, y: window.innerHeight - 120 };
  });
  const dragStateRef = useRef({
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const feedbackTimeoutRef = useRef<number | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isListeningRef = useRef(false);
  const shouldResumeRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const isWakeWordActiveRef = useRef(false);
  const wakeTimerRef = useRef<number | null>(null);
  const aliRecorderRef = useRef<MediaRecorder | null>(null);
  const aliChunksRef = useRef<Blob[]>([]);
  const aliActiveRef = useRef(false);

  const speak = (text: string) => {
    try {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.1;
      synthRef.current.speak(utterance);
    } catch {
      // ignore
    }
  };

  const showFeedback = (text: string) => {
    setFeedback(text);
    if (text.includes('请说出指令') || text.includes('请说指令') || text.includes('我在'))
      setVoiceState('awake');
    else if (text.includes('正在')) setVoiceState('executing');
    else if (text.toLowerCase().includes('监听')) setVoiceState('listening');
    if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 2800);
  };

  const normalize = (s: string) =>
    (s || '').replace(/[，。！？、,.!?]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  const transcribeWithAli = async (blob: Blob) => {
    const apiKey = (import.meta as any).env?.VITE_ALI_API_KEY;
    const endpoint =
      (import.meta as any).env?.VITE_ALI_ASR_ENDPOINT ||
      'https://dashscope.aliyuncs.com/api/v1/services/real-time-asr/recognize';

    if (!apiKey) throw new Error('缺少阿里云语音密钥');

    const buffer = await blob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'paraformer-realtime-v2',
        audio_format: 'wav',
        sample_rate: 16000,
        input: base64Audio,
        enable_punctuation: true,
      }),
    });

    if (!res.ok) throw new Error(`阿里云接口异常: ${res.status}`);
    const data = await res.json();
    const outputText = data?.output?.text || data?.result || '';
    if (!outputText) throw new Error('未返回文本');
    return outputText as string;
  };

  // 双唤醒：小朗小朗（兼容小浪/小狼/小郎/小廊），以及拼音 xiaolang xiaolang
  const doubleWakeTest = /小[朗浪狼郎廊]\s*小[朗浪狼郎廊]/;
  const pinyinDoubleWakeTest = /xiao\s*lang\s*xiao\s*lang|xiaolang\s*xiaolang/i;

  const detectWakeWord = (text: string) => {
    const t = (text || '').replace(/\s+/g, '');
    const singleWake = /小[朗浪狼郎廊]/.test(t) || /xiao\s*lang/i.test(text);
    return doubleWakeTest.test(t) || pinyinDoubleWakeTest.test(t) || singleWake;
  };

  const stripWakeWord = (text: string) =>
    normalize(text)
      .replace(/小[朗浪狼郎廊]\s*小[朗浪狼郎廊]/g, ' ')
      .replace(/小[朗浪狼郎廊]/g, ' ')
      .replace(/xiao\s*lang\s*xiao\s*lang|xiaolang\s*xiaolang/gi, ' ')
      .replace(/xiao\s*lang|xiaolang/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const resetWakeWord = () => {
    isWakeWordActiveRef.current = false;
    setIsWakeWordDetected(false);
    if (wakeTimerRef.current) {
      window.clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
  };

  const armWakeTimeout = () => {
    if (wakeTimerRef.current) window.clearTimeout(wakeTimerRef.current);
    wakeTimerRef.current = window.setTimeout(() => {
      resetWakeWord();
      showFeedback('唤醒超时，请再说“小朗小朗”');
    }, 8000);
  };

  const executeCommand = (text: string) => {
    const cmd = normalize(text);
    if (!cmd) {
      showFeedback('未识别到有效指令');
      return;
    }

    const acknowledge = (phrase?: string) => {
      const msg = phrase || '我在，正在执行';
      showFeedback(msg);
      speak(msg);
      setVoiceState('executing');
    };

    if (
      (cmd.includes('分析') || cmd.includes('统计') || cmd.includes('比例') || cmd.includes('学历')) &&
      (cmd.includes('员工') || cmd.includes('工具') || cmd.includes('平台') || cmd.includes('中心'))
    ) {
      acknowledge('好的，正在生成数据分析报告');
      onNavigate('tools', { mode: 'analysis', query: cmd });
      return;
    }

    if (cmd.includes('知识库')) {
      acknowledge('正在打开知识库');
      onNavigate('knowledge');
      return;
    }

    if (cmd.includes('识图') || cmd.includes('视觉')) {
      acknowledge('正在启动视觉分析');
      onNavigate('vision');
      return;
    }

    if (cmd.includes('主页') || cmd.includes('返回')) {
      acknowledge('正在返回主页');
      onNavigate('dashboard');
      return;
    }

    showFeedback('未识别到指令');
  };

  const handleVoiceStream = (transcript: string, isFinal: boolean) => {
    const text = normalize(transcript);
    if (!text) return;

    // 未唤醒：只找唤醒词
    if (!isWakeWordActiveRef.current) {
      if (detectWakeWord(text)) {
        isWakeWordActiveRef.current = true;
        setIsWakeWordDetected(true);
        armWakeTimeout();

        showFeedback('我在，请说指令');
        speak('我在，请说指令');

        const tail = stripWakeWord(text);
        if (tail && isFinal) {
          executeCommand(tail.replace(/确认|执行/g, '').trim());
          resetWakeWord();
        } else if (tail) {
          transcriptRef.current = tail;
          setCapturedSpeech(tail);
        }
      }
      return;
    }

    // 已唤醒：收集命令
    armWakeTimeout();

    if (text.includes('取消') || text.includes('停止')) {
      showFeedback('已取消');
      speak('好的，已取消');
      resetWakeWord();
      return;
    }

    const cleaned = stripWakeWord(text);
    if (!cleaned) return;

    transcriptRef.current = cleaned;
    setCapturedSpeech(cleaned);

    if (isFinal) {
      executeCommand(cleaned.replace(/确认|执行/g, '').trim());
      resetWakeWord();
    }
  };

  const buildRecognizer = () => {
    if (!('webkitSpeechRecognition' in window)) return null;
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      setIsListening(true);
      isListeningRef.current = true;
      shouldResumeRef.current = true;
      setVoiceState('listening');
      showFeedback('监听中');
    };

    recognition.onaudiostart = () => {
      setVoiceState('listening');
      if (!feedback) showFeedback('等待唤醒');
    };

    recognition.onspeechstart = () => {
      setVoiceState('awake');
    };

    recognition.onend = () => {
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);

      if (shouldResumeRef.current) {
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            console.warn('Restart recognition failed', err);
            setIsListening(false);
            isListeningRef.current = false;
            shouldResumeRef.current = false;
          }
        }, 120);
      } else {
        setIsListening(false);
        isListeningRef.current = false;
        resetWakeWord();
      }
    };

    recognition.onresult = (event: any) => {
      const clean = (txt: string) => (txt || '').replace(/\s+/g, ' ').trim();

      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const segment = clean(res?.[0]?.transcript || '');
        if (!segment) continue;
        if (res.isFinal) finalText += (finalText ? ' ' : '') + segment;
        else interim += (interim ? ' ' : '') + segment;
      }

      const preview = clean(`${finalText} ${interim}`).slice(0, 180);
      if (preview) {
        transcriptRef.current = preview;
        setCapturedSpeech(preview);
      }

      if (interim) handleVoiceStream(interim, false);
      if (finalText) handleVoiceStream(finalText, true);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech Error Code:', event?.error);
      setIsListening(false);
      isListeningRef.current = false;
      shouldResumeRef.current = false;
      resetWakeWord();

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (!window.isSecureContext) {
          showFeedback('当前环境不安全：麦克风需 HTTPS 或本地预览');
          speak('请使用 HTTPS 或本地环境');
        } else {
          showFeedback('麦克风权限被拒绝');
        }
        return;
      }

      if (event.error === 'audio-capture') {
        showFeedback('未检测到麦克风设备');
        return;
      }

      if (event.error === 'network') {
        showFeedback('语音识别网络错误');
        return;
      }

      showFeedback('语音识别异常，请重试');
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const stopAliRecorder = async () => {
    if (!aliActiveRef.current) return;
    aliActiveRef.current = false;
    try {
      aliRecorderRef.current?.stop();
    } catch {
      // ignore
    }
  };

  const flushAliTranscript = async () => {
    if (!aliChunksRef.current.length) return;
    const blob = new Blob(aliChunksRef.current, { type: 'audio/webm' });
    aliChunksRef.current = [];

    try {
      const text = await transcribeWithAli(blob);
      if (text) {
        handleVoiceStream(text, true);
      } else {
        showFeedback('未识别到语音');
      }
    } catch (err) {
      console.warn('阿里云识别失败', err);
      showFeedback('阿里云识别失败');
    }
  };

  const startAliRecorder = async () => {
    const apiKey = (import.meta as any).env?.VITE_ALI_API_KEY;
    if (!apiKey) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      aliChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data && aliChunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        flushAliTranscript();
      };
      recorder.start();
      aliRecorderRef.current = recorder;
      aliActiveRef.current = true;
      showFeedback('阿里云极速识别中');
      return true;
    } catch (err) {
      console.warn('启动阿里云录音失败', err);
      return false;
    }
  };

  useEffect(() => {
    synthRef.current = typeof window !== 'undefined' ? window.speechSynthesis : null;
    buildRecognizer();
    const handleWindowResize = () => {
      setIsMobileView(window.innerWidth < 768);
      setPosition((pos) => ({
        x: Math.min(window.innerWidth - 72, Math.max(8, pos.x)),
        y: Math.min(window.innerHeight - 72, Math.max(8, pos.y)),
      }));
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
      if (wakeTimerRef.current) window.clearTimeout(wakeTimerRef.current);
      window.removeEventListener('resize', handleWindowResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showFeedback('当前环境无法访问麦克风');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      transcriptRef.current = '';
      resetWakeWord();
      setCapturedSpeech('');

      if (recognitionRef.current) {
        shouldResumeRef.current = true;
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
        showFeedback('监听中');
      } else if ((import.meta as any).env?.VITE_ALI_API_KEY) {
        const ok = await startAliRecorder();
        if (!ok) showFeedback('阿里云录音启动失败');
        else {
          shouldResumeRef.current = false;
          isListeningRef.current = true;
          setIsListening(true);
          setVoiceState('listening');
        }
      } else {
        showFeedback('浏览器不支持语音（建议使用 Chrome）');
      }
    } catch (err) {
      console.warn('语音启动失败', err);
      showFeedback('语音启动失败，请确认麦克风权限');
    }
  };

  const finalizeCapturedCommand = () => {
    const spoken = transcriptRef.current.trim();
    if (!spoken) {
      showFeedback('未检测到语音');
      return;
    }
    executeCommand(spoken.replace(/确认|执行/g, '').trim());
    transcriptRef.current = '';
    setCapturedSpeech('');
  };

  const stopListening = (options?: { finalize?: boolean }) => {
    const finalize = options?.finalize;
    shouldResumeRef.current = false;
    resetWakeWord();
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    stopAliRecorder();
    setIsListening(false);
    isListeningRef.current = false;
    setVoiceState('idle');
    if (finalize) finalizeCapturedCommand();
    else showFeedback('语音已关闭');
  };

  const FeedbackBubble = () => {
    const statusText =
      feedback ||
      (voiceState === 'executing'
        ? '执行中'
        : voiceState === 'awake'
        ? '待指令'
        : isListening
        ? '监听中'
        : '');

    if (!statusText) return null;

    const indicatorColor =
      voiceState === 'executing'
        ? 'bg-emerald-400'
        : voiceState === 'awake'
        ? 'bg-blue-300'
        : isListening
        ? 'bg-yellow-300'
        : 'bg-slate-500';

    const danger = feedback.includes('不安全') || feedback.includes('HTTPS');

    const bubbleTone = danger
      ? isMobileView
        ? 'bg-red-500/15 border-red-500/30 text-red-100'
        : 'bg-red-500/20 border-red-500/30 text-red-200'
      : isMobileView
      ? 'bg-slate-900/85 border-white/10 text-white'
      : 'bg-white/10 border-white/20 text-white';

    const textSize = isMobileView ? 'text-[12px]' : 'text-sm';

    return (
      <div
        className={`pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          isMobileView ? 'px-1' : 'mr-2'
        }`}
      >
        <div
          className={`flex items-center gap-2 rounded-full shadow-lg backdrop-blur-xl border ${bubbleTone} ${textSize} ${
            isMobileView ? 'px-3 py-2 max-w-[220px]' : 'px-4 py-2 max-w-[240px]'
          } whitespace-nowrap overflow-hidden`}
        >
          <span className={`w-2 h-2 rounded-full ${indicatorColor}`} />
          <span className="truncate">{statusText}</span>
        </div>
      </div>
    );
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = event;
    dragStateRef.current = {
      dragging: true,
      moved: false,
      startX: pointer.clientX,
      startY: pointer.clientY,
      originX: position.x,
      originY: position.y,
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStateRef.current.dragging) return;
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) dragStateRef.current.moved = true;
      setPosition({
        x: Math.min(window.innerWidth - 64, Math.max(8, dragStateRef.current.originX + dx)),
        y: Math.min(window.innerHeight - 72, Math.max(8, dragStateRef.current.originY + dy)),
      });
    };

    const handlePointerUp = () => {
      if (!dragStateRef.current.moved) {
        if (isListeningRef.current || isListening) {
          stopListening();
        } else {
          startListening();
        }
      }

      dragStateRef.current.dragging = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const TriggerOrb = () => {
    return (
      <div
        onPointerDown={handlePointerDown}
        className="pointer-events-auto relative group cursor-pointer touch-none select-none"
      >
        <div
          className={`
            absolute -inset-5 rounded-full transition-all duration-500
            ${isListening ? 'opacity-100 scale-110 bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-indigo-600/40 animate-pulse' : 'opacity-0 group-hover:opacity-70 bg-blue-500/20 blur-xl'}
            ${isWakeWordDetected ? 'bg-emerald-500/50 scale-125 opacity-100' : ''}
            ${voiceState === 'executing' ? 'bg-emerald-400/40 opacity-100' : ''}
          `}
        />
        {isListening && (
          <div className="absolute -inset-2 rounded-full border border-cyan-300/40 animate-[ping_1.4s_ease-in-out_infinite]" />
        )}
        <div
          className={`
            relative w-14 h-14 rounded-full flex items-center justify-center
            bg-gradient-to-br from-slate-800 to-black border border-white/20
            shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md
            transition-transform duration-300 active:scale-95
            ${isListening ? 'scale-90 ring-2 ring-blue-500/50' : 'hover:-translate-y-1'}
          `}
        >
          {isWakeWordDetected ? (
            <Zap size={24} className="text-yellow-400 fill-current animate-bounce" />
          ) : isListening ? (
            <Mic
              size={24}
              className="text-cyan-200 animate-pulse drop-shadow-[0_0_6px_rgba(56,189,248,0.7)]"
            />
          ) : (
            <Bot size={28} className="text-indigo-300" />
          )}
          <div
            className={`absolute top-1 right-1 w-3 h-3 border-2 border-[#0F1629] rounded-full
              ${voiceState === 'executing'
                ? 'bg-emerald-400 animate-pulse'
                : voiceState === 'awake'
                ? 'bg-blue-300'
                : voiceState === 'listening'
                ? 'bg-yellow-300'
                : 'bg-slate-500'}`}
          />
        </div>
      </div>
    );
  };

  useEffect(() => {
    setPosition((pos) => ({
      x: Math.min(window.innerWidth - 72, Math.max(8, pos.x)),
      y: Math.min(window.innerHeight - 72, Math.max(16, pos.y)),
    }));
  }, [isMobileView]);

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className="relative flex flex-col items-end pointer-events-none">
        <div className="absolute bottom-[74px] right-0 flex flex-col items-end gap-2 pointer-events-none">
          <FeedbackBubble />
        </div>
        <div className="pointer-events-auto">
          <TriggerOrb />
        </div>
      </div>
    </div>
  );
};

export default AISprite;
