import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Send, X, Sparkles, MicOff, Zap, BarChart3, AlertTriangle } from 'lucide-react';

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

  const recognitionRef = useRef<any>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const isListeningRef = useRef(false);

  // Initialize Speech Recognition
  useEffect(() => {
    // Check for browser support
    if (!('webkitSpeechRecognition' in window)) {
        return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let buffer = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
          buffer += event.results[i][0].transcript;
      }

      setCapturedSpeech(buffer);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech Error Code:", event.error);

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          if (!window.isSecureContext) {
              showFeedback("当前环境不安全：麦克风需 HTTPS 或本地预览");
              speak("请使用 HTTPS 或本地环境");
          } else {
              showFeedback("麦克风权限被拒绝");
          }
      } else if (event.error === 'network') {
          showFeedback("语音识别网络错误");
      }
    };

    recognitionRef.current = recognition;

    return () => {
       if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // No auto-start; manual press-to-talk is now the only entry point

  // --- TTS Helper ---
  const speak = (text: string) => {
    synthRef.current.cancel(); // Stop previous
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.2; 
    synthRef.current.speak(utterance);
  };

  const showFeedback = (text: string) => {
    setFeedback(text);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback('');
    }, 4000);
  };

  const handleVoiceCommand = (text: string) => {
    const lowerText = text.toLowerCase();

    let commandExecuted = false;

    if ((lowerText.includes('开发平台') || lowerText.includes('工具') || lowerText.includes('员工')) &&
        (lowerText.includes('分析') || lowerText.includes('比例') || lowerText.includes('多少人') || lowerText.includes('统计') || lowerText.includes('学历') || lowerText.includes('学位'))) {
        commandExecuted = true;
        speak("好的，正在生成数据分析报告");
        showFeedback("正在生成报告...");
        onNavigate('tools', { mode: 'analysis', query: lowerText });
    }
    else if (lowerText.includes('知识库')) {
        commandExecuted = true;
        speak("正在打开知识库");
        showFeedback("正在打开知识库...");
        onNavigate('knowledge');
    } else if (lowerText.includes('识图') || lowerText.includes('视觉')) {
        commandExecuted = true;
        speak("正在启动视觉分析");
        showFeedback("正在打开 AI 识图...");
        onNavigate('vision');
    } else if (lowerText.includes('主页') || lowerText.includes('返回')) {
        commandExecuted = true;
        speak("正在返回主页");
        onNavigate('dashboard');
    }

    if (!commandExecuted) {
        showFeedback('未识别到指令，请再试一次');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleVoiceCommand(inputText);
    setInputText('');
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check 1: Browser Support
    if (!recognitionRef.current) {
        showFeedback("浏览器不支持语音 (请使用 Chrome)");
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
        isListeningRef.current = false;

        const finalText = capturedSpeech.trim();
        setCapturedSpeech('');
        setIsWakeWordDetected(false);

        if (finalText) {
            handleVoiceCommand(finalText);
        } else {
            showFeedback('未捕获到语音内容');
        }
    } else {
        try {
            setCapturedSpeech('');
            setIsWakeWordDetected(true);
            recognitionRef.current.start();
            setIsListening(true);
            isListeningRef.current = true;
            showFeedback("按下即可说，再按执行");
            speak("开始录音，请说出指令，完成后再次点击执行");
        } catch (e) {
            console.error(e);
            showFeedback("语音启动失败，请确认麦克风权限");
        }
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
      
      {/* Feedback Bubble */}
      {(feedback || (isListening && !isOpen)) && (
        <div className="pointer-events-auto mr-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
           <div className={`
              backdrop-blur-xl border text-sm px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[220px]
              ${feedback.includes('不安全') || feedback.includes('HTTPS') 
                 ? 'bg-red-500/20 border-red-500/30 text-red-200' 
                 : 'bg-white/10 border-white/20 text-white'}
           `}>
              {feedback || (isListening ? "Listening..." : "")}
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
                 <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
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

                 <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-white/5 border border-white/5 rounded-xl px-3 py-2">
                    <div className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
                    <span className="font-medium text-white/70">按下开始录音，再按执行指令</span>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { onNavigate('tools', { mode: 'analysis', query: '分析一下现在的学历分布情况' }); speak("正在为您分析学历数据"); }} className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg py-2 text-indigo-200 transition-colors flex items-center justify-center gap-1">
                        <BarChart3 size={12} /> 分析学历分布
                    </button>
                    <button onClick={() => onNavigate('vision')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">打开识图</button>
                    <button onClick={() => onNavigate('knowledge')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">知识库</button>
                    <button onClick={() => onNavigate('dashboard')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">回主页</button>
                 </div>
              </div>

                 <div
                    onClick={toggleListening}
                    className={`p-2 border-t border-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${isListening ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'}`}
                 >
                    {isListening ? <Mic size={14} className="animate-pulse" /> : <MicOff size={14} />}
                    <span className="text-[10px] font-medium">
                    {isListening ? "正在录音，完成后再按一次" : "按下录音 / 再按执行"}
                    </span>
                 </div>
           </div>
        </div>
      )}

      {/* Trigger Orb */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto relative group cursor-pointer"
      >
         <div className={`
            absolute -inset-4 bg-blue-500/30 rounded-full blur-xl transition-all duration-500
            ${isListening ? 'opacity-100 animate-pulse' : 'opacity-0 group-hover:opacity-60'}
            ${isWakeWordDetected ? 'bg-emerald-500/50 scale-125' : ''}
         `}></div>

         <div className={`
            relative w-14 h-14 rounded-full flex items-center justify-center
            bg-gradient-to-br from-slate-800 to-black border border-white/20
            shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md
            transition-transform duration-300 active:scale-95
            ${isOpen ? 'scale-90 ring-2 ring-blue-500/50' : 'hover:-translate-y-1'}
         `}>
            {isWakeWordDetected ? (
                <Zap size={24} className="text-yellow-400 fill-current animate-bounce" />
            ) : isListening ? (
                <Mic size={24} className="text-blue-400 animate-pulse" />
            ) : (
                <Bot size={28} className="text-indigo-300" />
            )}
            <div className="absolute top-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0F1629] rounded-full"></div>
         </div>
      </div>
    </div>
  );
};

export default AISprite;