import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Send, X, Sparkles, MicOff, Zap, BarChart3, AlertTriangle, Gauge } from 'lucide-react';
import { aliyunService } from '../services/aliyunService';

interface AISpriteProps {
  onNavigate: (view: string, params?: any) => void;
}

const AISprite: React.FC<AISpriteProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [capturedSpeech, setCapturedSpeech] = useState('');
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);

  // cloud asr
  const [isCloudBusy, setIsCloudBusy] = useState(false);
  const [recorderReady, setRecorderReady] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const modeRef = useRef<'cloud' | 'browser' | null>(null);

  const isListeningRef = useRef(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // wake-word runtime state
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

  // ✅ 唤醒词：双唤醒（小朗小朗）兼容误识别：小浪小浪/小狼小狼/小郎小郎/小廊小廊
  // 只双唤醒：默认启用 double
  const doubleWakeTest = /小[朗浪狼郎廊]\s*小[朗浪狼郎廊]/;
  const doubleWakeStrip = /小[朗浪狼郎廊]\s*小[朗浪狼郎廊]/g;

  // 可选：如果你也想支持英文/拼音（可按需打开）
  const pinyinDoubleWakeTest = /xiao\s*lang\s*xiao\s*lang|xiaolang\s*xiaolang/i;
  const pinyinDoubleWakeStrip = /xiao\s*lang\s*xiao\s*lang|xiaolang\s*xiaolang/gi;

  const detectWakeWord = (text: string) => {
    const t = (text || '').replace(/\s+/g, '');
    return doubleWakeTest.test(t) || pinyinDoubleWakeTest.test(t);
  };

  const stripWakeWord = (text: string) => {
    let t = normalize(text);
    t = t.replace(doubleWakeStrip, ' ');
    t = t.replace(pinyinDoubleWakeStrip, ' ');
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
   * - 未唤醒：只找唤醒词（partial/interim 越快越好）
   * - 已唤醒：收集命令，final 时执行
   * - 支持“一口气说完”：小朗小朗 打开知识库
   */
  const handleVoiceStream = (transcript: string, isFinal: boolean) => {
    const now = Date.now();
    if (now - lastResultAtRef.current < 40) return;
    lastResultAtRef.current = now;

    const raw = transcript || '';
    const normalized = normalize(raw);
    if (!normalized) return;

    // 1) 未唤醒：检测唤醒词
    if (!isWakeWordActiveRef.current) {
      if (detectWakeWord(normalized)) {
        isWakeWordActiveRef.current = true;
        setIsWakeWordDetected(true);

        // ✅ 你要的“我在”
        showFeedback('我在：请说出指令（如：打开知识库 / 分析学历分布）');
        speak('我在，请说出指令');

        armWakeWordTimeout();

        // 唤醒词后面跟了内容，作为命令 tail
        const tail = stripWakeWord(normalized);
        if (tail) {
          commandBufferRef.current = tail;
          setCapturedSpeech(tail);

          // final 直接执行（一口气说完）
          if (isFinal) {
            const cmd = tail.replace(/确认|执行/g, '').trim();
            executeCommand(cmd);
            resetWakeWordState();
          }
        }
      }
      return;
    }

    // 2) 已唤醒：收集命令
    armWakeWordTimeout();

    if (normalized.includes('取消') || normalized.includes('停止')) {
      resetWakeWordState();
      showFeedback('已取消');
      speak('好的，已取消');
      return;
    }

    const cleaned = stripWakeWord(normalized);
    if (!cleaned) return;

    if (!isFinal) {
      commandBufferRef.current = cleaned;
      setCapturedSpeech(cleaned);
      return;
    }

    commandBufferRef.current = cleaned;
    setCapturedSpeech(cleaned);

    const cmd = cleaned.replace(/确认|执行/g, '').trim();
    executeCommand(cmd);
    resetWakeWordState();
  };

  // ===== Cloud ASR (Aliyun) =====
  const transcribeWithAliyun = async (audioBlob: Blob) => {
    setIsCloudBusy(true);
    showFeedback('云端极速识别中...');

    try {
      let finalText = '';

      await aliyunService.fastSpeechToText(
        audioBlob,
        (partial: string) => {
          const clean = (partial || '').replace(/\s+/g, ' ').trim();
          if (clean) {
            // 预览
            setCapturedSpeech(clean.slice(0, 180));
            // partial 也喂给唤醒检测，尽量做到“实时我在”
            handleVoiceStream(clean, false);
          }
        },
        (finalResult: string) => {
          finalText = (finalResult || '').trim();
        }
      );

      const text = finalText.trim();
      if (text) {
        setCapturedSpeech(text.slice(0, 180));
        handleVoiceStream(text, true);
      } else {
        showFeedback('未捕获到语音内容');
      }
    } catch (err) {
      console.error(err);
      showFeedback('云端识别失败，已回退浏览器识别');
      speak('云端识别失败，我将使用浏览器识别');

      // fallback to browser recognition
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop?.();
        }
      } catch {
        // ignore
      }
    } finally {
      setIsCloudBusy(false);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    try {
      recorder.stop();
    } catch (err) {
      console.warn('Recorder stop error', err);
    }

    setIsListening(false);
    isListeningRef.current = false;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !(window as any).MediaRecorder) {
      setRecorderReady(false);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 一些浏览器对 mimeType 支持不同，这里做个兜底
      const preferMime = 'audio/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType: preferMime,
        audioBitsPerSecond: 128000,
      });

      audioChunksRef.current = [];

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) audioChunksRef.current.push(evt.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: preferMime });
        if (blob.size > 0) transcribeWithAliyun(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsListening(true);
      isListeningRef.current = true;
      resetWakeWordState();

      showFeedback('录音中：说“小朗小朗”我会回应“我在”');
      // 这里也可以不播报，避免打断用户；你想播就留着
      // speak('开始录音，请说小朗小朗唤醒我');

      return true;
    } catch (err) {
      console.error(err);
      showFeedback('麦克风不可用，请检查权限');
      setRecorderReady(false);
      return false;
    }
  };

  // ===== Browser SpeechRecognition =====
  const initBrowserRecognition = () => {
    if (typeof window === 'undefined') return null;
    if (!('webkitSpeechRecognition' in window)) return null;

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

      const preview = normalize(`${finalTranscript} ${interimTranscript}`).slice(0, 180);
      if (preview) setCapturedSpeech(preview);

      if (interimTranscript) handleVoiceStream(interimTranscript, false);
      if (finalTranscript) handleVoiceStream(finalTranscript, true);
    };

    recognition.onend = () => {
      if (isListeningRef.current && modeRef.current === 'browser') {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech Error Code:', event?.error);

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

      if (event.error === 'no-speech') return;
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

    return recognition;
  };

  // ===== Init =====
  useEffect(() => {
    if (typeof window === 'undefined') return;

    synthRef.current = window.speechSynthesis || null;
    setRecorderReady(!!(window as any).MediaRecorder);

    const rec = initBrowserRecognition();
    if (rec) recognitionRef.current = rec;

    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }

      try {
        mediaRecorderRef.current?.stop?.();
      } catch {
        // ignore
      }

      if (feedbackTimeoutRef.current) window.clearTimeout(feedbackTimeoutRef.current);
      if (wakeWordTimerRef.current) window.clearTimeout(wakeWordTimerRef.current);
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

    // ===== Stop =====
    if (isListening) {
      if (modeRef.current === 'cloud' && mediaRecorderRef.current) {
        stopRecording();
        showFeedback('已停止录音，正在识别...');
        return;
      }

      if (modeRef.current === 'browser' && recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        setIsListening(false);
        isListeningRef.current = false;
        resetWakeWordState();
        showFeedback('语音已关闭');
        return;
      }

      // unknown mode fallback
      setIsListening(false);
      isListeningRef.current = false;
      resetWakeWordState();
      showFeedback('语音已关闭');
      return;
    }

    // ===== Start =====
    if (!navigator.mediaDevices?.getUserMedia) {
      showFeedback('当前环境无法访问麦克风');
      return;
    }

    // 优先：云端极速（有 MediaRecorder）
    if (recorderReady && !isCloudBusy) {
      modeRef.current = 'cloud';
      const ok = await startRecording();
      if (ok) return;
      // 若失败继续 fallback
    }

    // fallback：浏览器识别（webkitSpeechRecognition）
    if (!recognitionRef.current) {
      showFeedback('浏览器不支持语音（请使用 Chrome）');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      modeRef.current = 'browser';
      resetWakeWordState();
      setCapturedSpeech('');

      try {
        recognitionRef.current.start();
      } catch {
        // ignore already started
      }

      setIsListening(true);
      isListeningRef.current = true;

      showFeedback('监听中：请说“小朗小朗”（可误识别为“小浪小浪”）');
      // speak('我在听，请说小朗小朗唤醒我'); // 可选：开播报
    } catch (err) {
      console.warn('语音启动失败', err);
      showFeedback('语音启动失败，请确认麦克风权限');
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
      {/* Feedback Bubble */}
      {(feedback || (isListening && !isOpen) || isCloudBusy) && (
        <div className="pointer-events-auto mr-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div
            className={`
              backdrop-blur-xl border text-sm px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[260px]
              ${
                feedback.includes('不安全') || feedback.includes('HTTPS')
                  ? 'bg-red-500/20 border-red-500/30 text-red-200'
                  : 'bg-white/10 border-white/20 text-white'
              }
           `}
          >
            {isCloudBusy ? (
              <span className="inline-flex items-center gap-2">
                <Gauge size={14} className="animate-pulse" />
                云端极速识别中...
              </span>
            ) : (
              feedback || (isListening ? 'Listening...' : '')
            )}
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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="font-medium text-white/70">
                      {isListening ? '监听中：说“小朗小朗”（可识别成“小浪小浪”）' : '点击麦克风开启监听（需要权限）'}
                    </span>
                  </div>

                  {recorderReady ? (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
                      <Gauge size={10} /> 极速ASR
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-200">
                      <AlertTriangle size={10} /> 无录音器
                    </span>
                  )}
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
