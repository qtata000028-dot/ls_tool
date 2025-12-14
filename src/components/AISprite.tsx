import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, Bot, Mic, MicOff, Send, Sparkles, X, Zap } from 'lucide-react';

interface AISpriteProps {
  onNavigate: (view: string, params?: any) => void;
}

const AISprite: React.FC<AISpriteProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [capturedSpeech, setCapturedSpeech] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'awake' | 'executing'>('idle');
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
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
    if (text.includes('请说出指令')) setVoiceState('awake');
    else if (text.includes('正在')) setVoiceState('executing');
    else if (text.toLowerCase().includes('监听')) setVoiceState('listening');
    if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 3500);
  };

  const normalize = (s: string) =>
    (s || '').replace(/[，。！？、,.!?]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  // 双唤醒：小朗小朗（兼容小浪/小狼/小郎/小廊），以及拼音 xiaolang xiaolang
  const doubleWakeTest = /小[朗浪狼郎廊]\s*小[朗浪狼郎廊]/;
  const pinyinDoubleWakeTest = /xiao\s*lang\s*xiao\s*lang|xiaolang\s*xiaolang/i;

  const detectWakeWord = (text: string) => {
    const t = (text || '').replace(/\s+/g, '');
    const maybeSingleWake = /小[朗浪狼郎廊]/.test(t) || /xiao\s*lang/i.test(text);
    return doubleWakeTest.test(t) || pinyinDoubleWakeTest.test(t) || (isMobileView && maybeSingleWake);
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

    showFeedback('未识别到指令，请再试一次');
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

        showFeedback('我在：请说出指令');
        speak('我在，请说出指令');

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
      showFeedback('监听中：请说“小朗小朗”');
    };

    recognition.onaudiostart = () => {
      setVoiceState('listening');
      if (!feedback) showFeedback('已开启麦克风，等待唤醒');
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

  useEffect(() => {
    synthRef.current = typeof window !== 'undefined' ? window.speechSynthesis : null;
    buildRecognizer();
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
      if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
      if (wakeTimerRef.current) window.clearTimeout(wakeTimerRef.current);
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showFeedback('当前环境无法访问麦克风');
      return;
    }

    if (!recognitionRef.current) {
      showFeedback('浏览器不支持语音（建议使用 Chrome）');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      shouldResumeRef.current = true;
      transcriptRef.current = '';
      resetWakeWord();
      setCapturedSpeech('');
      recognitionRef.current.start();
      setIsListening(true);
      isListeningRef.current = true;
      showFeedback('监听中：请说“小朗小朗”');
    } catch (err) {
      console.warn('语音启动失败', err);
      showFeedback('语音启动失败，请确认麦克风权限');
    }
  };

  const stopListening = () => {
    shouldResumeRef.current = false;
    resetWakeWord();
    transcriptRef.current = '';
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    setIsListening(false);
    isListeningRef.current = false;
    setVoiceState('idle');
    showFeedback('语音已关闭');
  };

  // ✅ 这里是你之前缺失的 “}” 的地方（现在已正确闭合）
  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isListening) stopListening();
    else startListening();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    executeCommand(inputText);
    setInputText('');
  };

  const FeedbackBubble = () => {
    if (!feedback && !(isListening && !isOpen)) return null;
    const danger = feedback.includes('不安全') || feedback.includes('HTTPS');

    const baseBubble = (
      <div className="pointer-events-auto mr-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div
          className={`backdrop-blur-xl border text-sm px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[260px] ${
            danger ? 'bg-red-500/20 border-red-500/30 text-red-200' : 'bg-white/10 border-white/20 text-white'
          }`}
        >
          {feedback || (isListening ? 'Listening...' : '')}
        </div>
      </div>
    );

    if (!isMobileView) return baseBubble;

    return (
      <div className="pointer-events-none w-full px-4 animate-in slide-in-from-bottom-2 fade-in duration-300">
        <div
          className={`w-full rounded-2xl border shadow-lg px-4 py-3 backdrop-blur-xl ${
            danger
              ? 'bg-red-500/10 border-red-500/30 text-red-100'
              : 'bg-slate-900/80 border-white/15 text-white'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {feedback || (isListening ? '麦克风监听中...' : '待命中')}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                voiceState === 'executing'
                  ? 'bg-emerald-400 animate-ping'
                  : voiceState === 'awake'
                  ? 'bg-blue-300 animate-pulse'
                  : 'bg-yellow-300'
              }`}
            />
          </div>
          {capturedSpeech && (
            <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">
              <span className="text-slate-500">识别：</span>
              {capturedSpeech}
            </p>
          )}
        </div>
      </div>
    );
  };

  const OpenPanel = () => {
    if (!isOpen) return null;

    return (
      <div className="pointer-events-auto mb-2 mr-0 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 origin-bottom-right">
        <div className="w-[280px] bg-[#0F1629]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-blue-400" />
              <span className="text-xs font-bold text-white">AI 助手指令</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X size={14} />
            </button>
          </div>

          <div className="p-3 space-y-3">
            <form onSubmit={handleManualSubmit} className="relative">
              <input
                autoFocus
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="输入指令 (如: 分析本科生占比)..."
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-3 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300">
                <Send size={14} />
              </button>
            </form>

            <div className="flex flex-col gap-1 text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="font-medium text-white/70">
                    {isListening
                      ? '监听中：说“小朗小朗”（可识别成“小浪小浪”）'
                      : '点击麦克风开启监听（需要权限）'}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-200">
                  <AlertTriangle size={10} /> 浏览器识别
                </span>
              </div>

              {capturedSpeech && (
                <div className="text-[10px] text-slate-300/80 break-words">
                  <span className="text-slate-500">识别：</span>
                  {capturedSpeech}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onNavigate('tools', { mode: 'analysis', query: '分析一下现在的学历分布情况' });
                  speak('正在为您分析学历数据');
                }}
                className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg py-2 text-indigo-200 transition-colors flex items-center justify-center gap-1"
              >
                <BarChart3 size={12} /> 分析学历分布
              </button>
              <button
                onClick={() => onNavigate('vision')}
                className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors"
              >
                打开识图
              </button>
              <button
                onClick={() => onNavigate('knowledge')}
                className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors"
              >
                知识库
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors"
              >
                回主页
              </button>
            </div>
          </div>

          <div
            onClick={toggleListening}
            className={`p-2 border-t border-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
              isListening ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'
            }`}
          >
            {isListening ? <Mic size={14} className="animate-pulse" /> : <MicOff size={14} />}
            <span className="text-[10px] font-medium">{isListening ? '点击停止 / 识别' : '点击开始监听'}</span>
          </div>
        </div>
      </div>
    );
  };

  const TriggerOrb = () => (
    <div onClick={() => setIsOpen(!isOpen)} className="pointer-events-auto relative group cursor-pointer">
      <div
        className={`
          absolute -inset-4 rounded-full blur-xl transition-all duration-500
          ${isListening ? 'opacity-100 animate-pulse bg-blue-500/30' : 'opacity-0 group-hover:opacity-60 bg-blue-500/30'}
          ${isWakeWordDetected ? 'bg-emerald-500/50 scale-125 opacity-100' : ''}
        `}
      />
      <div
        className={`
          relative w-14 h-14 rounded-full flex items-center justify-center
          bg-gradient-to-br from-slate-800 to-black border border-white/20
          shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md
          transition-transform duration-300 active:scale-95
          ${isOpen ? 'scale-90 ring-2 ring-blue-500/50' : 'hover:-translate-y-1'}
        `}
      >
        {isWakeWordDetected ? (
          <Zap size={24} className="text-yellow-400 fill-current animate-bounce" />
        ) : isListening ? (
          <Mic size={24} className="text-blue-400 animate-pulse" />
        ) : (
          <Bot size={28} className="text-indigo-300" />
        )}
        <div className="absolute top-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0F1629] rounded-full" />
      </div>
    </div>
  );

  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
      <FeedbackBubble />
      <OpenPanel />
      <TriggerOrb />
    </div>
  );
};

export default AISprite;
