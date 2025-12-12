import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Send, X, Sparkles, MicOff, Zap, BarChart3 } from 'lucide-react';

interface AISpriteProps {
  onNavigate: (view: string, params?: any) => void;
}

const AISprite: React.FC<AISpriteProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Debug/visual
  const [capturedSpeech, setCapturedSpeech] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // Wake word runtime state (avoid stale closures)
  const isWakeWordActiveRef = useRef(false);
  const wakeWordTimerRef = useRef<number | null>(null);
  const commandBufferRef = useRef<string>('');
  const lastResultAtRef = useRef<number>(0);

  // ===== Helpers =====
  const speak = (text: string) => {
    try {
      if (!synthRef.current) return;
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.15;
      synthRef.current.speak(utterance);
    } catch {
      // ignore
    }
  };

  const showFeedback = (text: string) => {
    setFeedback(text);
    if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => setFeedback(''), 4000);
  };

  const normalize = (s: string) =>
    (s || '')
      .replace(/[，。！？、,.!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  // 只想“双唤醒”就留 ['小朗小朗']，不要 '小朗'
  const wakeWordPatterns = ['小朗小朗', '小朗'];

  const detectWakeWord = (text: string) => {
    const t = normalize(text);
    if (!t) return false;
    return wakeWordPatterns.some((p) => t.includes(p));
  };

  const stripWakeWord = (text: string) => {
    let t = normalize(text);
    wakeWordPatterns.forEach((p) => {
      // replaceAll 在现代浏览器可用；如果要兼容更老，可改用 split/join
      t = t.replaceAll(p, ' ');
    });
    return t.replace(/\s+/g, ' ').trim();
  };

  const resetWakeWordState = () => {
    isWakeWordActiveRef.current = false;
    setIsWakeWordDetected(false);
    commandBufferRef.current = '';
    if (wakeWordTimerRef.current) {
      window.clearTimeout(wakeWordTimerRef.current);
      wakeWordTimerRef.current = null;
    }
  };

  const armWakeWordTimeout = () => {
    if (wakeWordTimerRef.current) window.clearTimeout(wakeWordTimerRef.current);
    wakeWordTimerRef.current = window.setTimeout(() => {
      resetWakeWordState();
      showFeedback('唤醒超时，请再说“小朗小朗”');
    }, 8000);
  };

  const executeCommand = (raw: string) => {
    const text = normalize(raw);
    if (!text) {
      showFeedback('未识别到有效指令');
      return;
    }

    let commandExecuted = false;

    if (
      (text.includes('开发平台') || text.includes('工具') || text.includes('员工')) &&
      (text.includes('分析') ||
        text.includes('比例') ||
        text.includes('多少人') ||
        text.includes('统计') ||
        text.includes('学历') ||
        text.includes('学位'))
    ) {
      commandExecuted = true;
      speak('好的，正在生成数据分析报告');
      showFeedback('正在生成报告...');
      onNavigate('tools', { mode: 'analysis', query: text });
    } else if (text.includes('知识库')) {
      commandExecuted = true;
      speak('正在打开知识库');
      showFeedback('正在打开知识库...');
      onNavigate('knowledge');
    } else if (text.includes('识图') || text.includes('视觉')) {
      commandExecuted = true;
      speak('正在启动视觉分析');
      showFeedback('正在打开 AI 识图...');
      onNavigate('vision');
    } else if (text.includes('主页') || text.includes('返回')) {
      commandExecuted = true;
      speak('正在返回主页');
      onNavigate('dashboard');
    }

    if (!commandExecuted) {
      showFeedback('未识别到指令，请再试一次');
    }
  };

  /**
   * 语音入口：实时处理
   * - 未唤醒：只找唤醒词
   * - 已唤醒：收集命令，final 时执行
   */
  const handleVoiceStream = (transcript: string, isFinal: boolean) => {
    const now = Date.now();
    if (now - lastResultAtRef.current < 40) return; // 简单去抖
    lastResultAtRef.current = now;

    const raw = transcript || '';
    const normalized = normalize(raw);
    if (!normalized) return;

    // 1) 未唤醒：检测唤醒词（interim最快）
    if (!isWakeWordActiveRef.current) {
      if (detectWakeWord(normalized)) {
        isWakeWordActiveRef.current = true;
        setIsWakeWordDetected(true);
        showFeedback('已唤醒：请说出指令（如：分析学历分布）');
        speak('我在，请说出指令');
        armWakeWordTimeout();

        // 如果唤醒词后面已经跟了内容，直接当作命令缓冲
        const tail = stripWakeWord(normalized);
        if (tail) {
          commandBufferRef.current = tail;
          setCapturedSpeech(tail);
        }
      }
      return;
    }

    // 2) 已唤醒：收集命令
    armWakeWordTimeout();

    // 允许说“取消/停止”
    if (normalized.includes('取消') || normalized.includes('停止')) {
      resetWakeWordState();
      showFeedback('已取消');
      speak('好的，已取消');
      return;
    }

    // 如果用户又重复说了唤醒词，去掉
    const cleaned = stripWakeWord(normalized);
    if (!cleaned) return;

    // interim：只是更新缓冲与UI
    if (!isFinal) {
      commandBufferRef.current = cleaned;
      setCapturedSpeech(cleaned);
      return;
    }

    // final：执行
    commandBufferRef.current = cleaned;
    setCapturedSpeech(cleaned);

    // 允许末尾“确认/执行”
    const cmd = cleaned.replace(/确认|执行/g, '').trim();
    executeCommand(cmd);

    resetWakeWordState();
  };

  // ===== Init Speech Recognition =====
  useEffect(() => {
    if (typeof window === 'undefined') return;

    synthRef.current = window.speechSynthesis || null;

    if (!('webkitSpeechRecognition' in window)) {
      showFeedback('浏览器不支持语音（请用 Chrome）');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res?.[0]?.transcript || '';
        if (res.isFinal) finalTranscript += txt;
        else interimTranscript += txt;
      }

      // 仅用于界面可视化（避免无限增长）
      const preview = normalize(`${finalTranscript} ${interimTranscript}`).slice(0, 180);
      if (preview) setCapturedSpeech(preview);

      if (interimTranscript) handleVoiceStream(interimTranscript, false);
      if (finalTranscript) handleVoiceStream(finalTranscript, true);
    };

    recognition.onend = () => {
      // Chrome 会莫名停，保持监听状态就自动重启
      if (isListeningRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore "already started"
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech Error Code:', event.error);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setIsListening(false);
        isListeningRef.current = false;
        resetWakeWordState();

        if (!window.isSecureContext) {
          showFeedback('当前环境不安全：麦克风需 HTTPS 或本地预览');
          speak('请使用 HTTPS 或本地环境');
        } else {
          showFeedback('麦克风权限被拒绝');
          speak('麦克风权限被拒绝');
        }
        return;
      }

      if (event.error === 'no-speech') return; // 避免刷屏
      if (event.error === 'audio-capture') {
        showFeedback('未检测到麦克风设备');
        return;
      }
      if (event.error === 'network') {
        showFeedback('语音识别网络错误');
        return;
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // ===== UI actions =====
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    executeCommand(inputText);
    setInputText('');
  };

  const toggleListening = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!recognitionRef.current) {
      showFeedback('浏览器不支持语音（请使用 Chrome）');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showFeedback('当前环境无法访问麦克风');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      isListeningRef.current = false;

      // 如果唤醒态里有缓冲命令，停止时也执行一次（可选）
      const buffered = commandBufferRef.current?.trim();
      if (buffered) executeCommand(buffered);

      resetWakeWordState();
      showFeedback('语音已关闭');
      return;
    }

    // 开启监听：先请求权限（必须用户手势）
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      resetWakeWordState();
      setCapturedSpeech('');
      try {
        recognitionRef.current.start();
      } catch {
        // ignore already started
      }
      setIsListening(true);
      isListeningRef.current = true;

      showFeedback('监听中：请说“小朗小朗”唤醒');
      speak('我在，请说小朗小朗唤醒我');
    } catch (err) {
      console.warn('语音启动失败', err);
      showFeedback('语音启动失败，请确认麦克风权限');
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
      {/* Feedback Bubble */}
      {(feedback || (isListening && !isOpen)) && (
        <div className="pointer-events-auto mr-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div
            className={`
              backdrop-blur-xl border text-sm px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[240px]
              ${
                feedback.includes('不安全') || feedback.includes('HTTPS')
                  ? 'bg-red-500/20 border-red-500/30 text-red-200'
                  : 'bg-white/10 border-white/20 text-white'
              }
           `}
          >
            {feedback || (isListening ? 'Listening...' : '')}
          </div>
        </div>
      )}

      {/* Expanded Interface */}
      {isOpen && (
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
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="font-medium text-white/70">
                    {isListening ? '监听中：说“小朗小朗”唤醒' : '点击麦克风开启监听（需要权限）'}
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
              <span className="text-[10px] font-medium">{isListening ? '点击关闭监听' : '点击开启监听'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Orb */}
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
    </div>
  );
};

export default AISprite;
