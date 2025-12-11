import React, { useState, useEffect, useRef } from 'react';
import { Bot, Mic, Send, X, Sparkles, Command, MicOff, Zap } from 'lucide-react';

interface AISpriteProps {
  onNavigate: (view: string) => void;
}

const AISprite: React.FC<AISpriteProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [feedback, setFeedback] = useState(''); // Feedback text bubble
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        
        // Process live transcript
        if (transcript) {
           handleVoiceCommand(transcript);
        }
      };

      recognition.onend = () => {
        // If meant to be listening, restart it (browser often stops it automatically)
        if (isListening) {
           try {
             recognition.start();
           } catch (e) {
             // ignore
           }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("AI Sprite Speech Error:", event.error);
        if (event.error === 'not-allowed') {
           setIsListening(false);
           showFeedback("无法访问麦克风");
        }
      };

      recognitionRef.current = recognition;
    }
    
    return () => {
       if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isListening]); // Re-bind if listening state fundamentally changes logic

  const showFeedback = (text: string) => {
    setFeedback(text);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback('');
      setIsWakeWordDetected(false);
    }, 3000);
  };

  const handleVoiceCommand = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // 1. Detect Wake Word "小朗"
    // Note: We check if it *contains* the wake word, or if we are already in "woken" state (optional logic)
    // For simplicity, we just look for the phrase in the current sentence or if usage is direct.
    
    const isWakeWord = lowerText.includes('小朗') || lowerText.includes('小狼'); // Phonetic fallback

    if (isWakeWord) {
       setIsWakeWordDetected(true);
    }

    // 2. Execute Commands (Requires wake word OR direct input mode)
    // If using voice, we generally expect "Xiao Lang open knowledge base"
    
    if (isWakeWord || isOpen) {
        if (lowerText.includes('知识库')) {
            showFeedback("正在打开知识库...");
            onNavigate('knowledge');
        } else if (lowerText.includes('识图') || lowerText.includes('视觉') || lowerText.includes('分析图片')) {
            showFeedback("正在打开 AI 识图...");
            onNavigate('vision');
        } else if (lowerText.includes('工具') || lowerText.includes('员工')) {
            showFeedback("正在打开工具平台...");
            onNavigate('tools');
        } else if (lowerText.includes('主页') || lowerText.includes('仪表盘') || lowerText.includes('返回')) {
            showFeedback("正在返回主页...");
            onNavigate('dashboard');
        } else if (isWakeWord) {
            // Heard name but no command
            showFeedback("我在，请吩咐...");
        }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    // Manual input doesn't require "Xiao Lang"
    const text = "小朗 " + inputText; // Prefix to trigger command logic easily
    handleVoiceCommand(text);
    setInputText('');
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recognitionRef.current) {
        showFeedback("浏览器不支持语音");
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
        showFeedback("语音监听已关闭");
    } else {
        try {
            recognitionRef.current.start();
            setIsListening(true);
            showFeedback("我在听，请说“小朗小朗...”");
        } catch (e) {
            console.error(e);
        }
    }
  };

  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end gap-4 pointer-events-none">
      
      {/* 1. Feedback Bubble (Speech Bubble) */}
      {(feedback || (isListening && !isOpen)) && (
        <div className="pointer-events-auto mr-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
           <div className="bg-white/10 backdrop-blur-xl border border-white/20 text-white text-sm px-4 py-2 rounded-2xl rounded-tr-none shadow-lg max-w-[200px]">
              {feedback || (isListening ? "Listening..." : "")}
           </div>
        </div>
      )}

      {/* 2. Expanded Command Interface */}
      {isOpen && (
        <div className="pointer-events-auto mb-2 mr-0 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 origin-bottom-right">
           <div className="w-[280px] bg-[#0F1629]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Header */}
              <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-blue-400" />
                    <span className="text-xs font-bold text-white">AI 助手指令</span>
                 </div>
                 <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white"><X size={14} /></button>
              </div>
              
              {/* Body */}
              <div className="p-3 space-y-3">
                 <form onSubmit={handleManualSubmit} className="relative">
                    <input 
                       autoFocus
                       type="text" 
                       value={inputText}
                       onChange={(e) => setInputText(e.target.value)}
                       placeholder="输入指令 (如: 打开识图)..."
                       className="w-full bg-black/40 border border-white/10 rounded-xl pl-3 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                    />
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300">
                       <Send size={14} />
                    </button>
                 </form>

                 <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => onNavigate('vision')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">打开识图</button>
                    <button onClick={() => onNavigate('knowledge')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">知识库</button>
                    <button onClick={() => onNavigate('tools')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">工具平台</button>
                    <button onClick={() => onNavigate('dashboard')} className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-2 text-slate-300 transition-colors">回主页</button>
                 </div>
              </div>

              {/* Footer Mic Toggle */}
              <div 
                 onClick={toggleListening}
                 className={`p-2 border-t border-white/5 flex items-center justify-center gap-2 cursor-pointer transition-colors ${isListening ? 'bg-blue-500/20 text-blue-300' : 'hover:bg-white/5 text-slate-400'}`}
              >
                 {isListening ? <Mic size={14} className="animate-pulse" /> : <MicOff size={14} />}
                 <span className="text-[10px] font-medium">
                    {isListening ? "正在监听 (说: 小朗小朗...)" : "点击开启语音唤醒"}
                 </span>
              </div>
           </div>
        </div>
      )}

      {/* 3. The Sprite Orb (Main Trigger) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto relative group cursor-pointer"
      >
         {/* Glow Effect */}
         <div className={`
            absolute -inset-4 bg-blue-500/30 rounded-full blur-xl transition-all duration-500
            ${isListening ? 'opacity-100 animate-pulse' : 'opacity-0 group-hover:opacity-60'}
            ${isWakeWordDetected ? 'bg-emerald-500/50 scale-125' : ''}
         `}></div>

         {/* Orb Body */}
         <div className={`
            relative w-14 h-14 rounded-full flex items-center justify-center
            bg-gradient-to-br from-slate-800 to-black border border-white/20
            shadow-[0_0_20px_rgba(0,0,0,0.5)] backdrop-blur-md
            transition-transform duration-300 active:scale-95
            ${isOpen ? 'scale-90 ring-2 ring-blue-500/50' : 'hover:-translate-y-1'}
         `}>
            {/* Inner Icon */}
            {isWakeWordDetected ? (
                <Zap size={24} className="text-yellow-400 fill-current animate-bounce" />
            ) : isListening ? (
                <Mic size={24} className="text-blue-400 animate-pulse" />
            ) : (
                <Bot size={28} className="text-indigo-300" />
            )}
            
            {/* Online Dot */}
            <div className="absolute top-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0F1629] rounded-full"></div>
         </div>
      </div>

    </div>
  );
};

export default AISprite;