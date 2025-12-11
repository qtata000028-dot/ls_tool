
import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, Mic, ScanLine, X, Loader2, Play, Pause, AlertTriangle, Sparkles, ChevronUp, ChevronDown } from 'lucide-react';
import { aliyunService, VLMessage } from '../services/aliyunService';
import { dataService } from '../services/dataService';

interface AIReconProps {
  onBack: () => void;
}

const AIRecon: React.FC<AIReconProps> = ({ onBack }) => {
  // State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  
  // 状态管理
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState(''); 
  
  const [isRecording, setIsRecording] = useState(false);
  const [promptInput, setPromptInput] = useState(''); 
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mobile Bottom Sheet State
  const [isResultExpanded, setIsResultExpanded] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null); 
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Effects ---
  useEffect(() => {
    // Setup Speech Recognition
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setPromptInput(transcript); 
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (synthRef.current) synthRef.current.cancel();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Auto-expand result panel on mobile when data arrives
  useEffect(() => {
    if (analysisText || errorMsg) {
      setIsResultExpanded(true);
      // Scroll to bottom
      setTimeout(() => {
        if (resultEndRef.current) {
          resultEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  }, [analysisText, errorMsg]);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setAnalysisText(''); 
      setErrorMsg(null);
      stopAudio();
      setIsResultExpanded(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) {
        alert("您的浏览器不支持语音识别功能 (建议使用 Chrome)");
        return;
      }
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisText('');
    setErrorMsg(null);
    stopAudio();
    setIsResultExpanded(true); // Open panel to show loading status
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      setStatusText("正在压缩并上传图片...");
      const publicUrl = await dataService.uploadAnalysisImage(uploadedFile);
      if (!publicUrl) throw new Error("图片上传失败，请检查网络连接。");

      setStatusText("AI 正在阅读图片 (大图可能需要几秒)...");
      const finalPrompt = promptInput.trim() || "请详细分析这张图片的内容。识别其中的物体、文字、场景以及任何值得注意的细节。";
      
      const messages: VLMessage[] = [
        {
          role: 'user',
          content: [
            { image: publicUrl },
            { text: finalPrompt }
          ]
        }
      ];

      let hasReceivedFirstToken = false;
      let fullResponse = "";

      const timeoutId = setTimeout(() => {
        if (!hasReceivedFirstToken) {
           if (abortControllerRef.current) abortControllerRef.current.abort();
           setErrorMsg("请求超时：AI 响应时间过长，请检查网络或重试。");
           setIsAnalyzing(false);
           setStatusText("");
        }
      }, 45000); 

      await aliyunService.chatVLStream(messages, (chunk) => {
        if (!hasReceivedFirstToken) {
           hasReceivedFirstToken = true;
           clearTimeout(timeoutId);
           setStatusText("正在生成分析报告...");
        }
        fullResponse += chunk;
        setAnalysisText(prev => prev + chunk);
      });
      
      clearTimeout(timeoutId);

      if (!fullResponse && !errorMsg) {
         if (analysisText) fullResponse = analysisText; 
         else throw new Error("API 返回内容为空，请重试。");
      }

      setStatusText("");
      speakText(fullResponse);

    } catch (error: any) {
      if (error.name === 'AbortError') return; 
      console.error("Analysis Error:", error);
      
      let msg = error.message;
      if (msg.includes('Failed to fetch') || msg.includes('Load failed')) {
        msg = "网络请求失败，可能是服务器繁忙或网络不通。";
      }
      setErrorMsg(msg);
      setStatusText("");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakText = (text: string) => {
    if (!text) return;
    synthRef.current.cancel();
    const cleanText = text.replace(/[#*`\-]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1; 
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    synthRef.current.speak(utterance);
  };

  const stopAudio = () => {
    synthRef.current.cancel();
    setIsPlayingAudio(false);
  };

  const clearAll = () => {
    setImagePreview(null);
    setUploadedFile(null);
    setAnalysisText('');
    setPromptInput('');
    setStatusText('');
    setErrorMsg(null);
    stopAudio();
    setIsResultExpanded(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  // 结果面板是否显示 (是否有内容或报错)
  const hasResult = !!(analysisText || errorMsg);

  return (
    <div className="w-full h-[85vh] max-w-[1600px] mx-auto bg-[#020617] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500 relative">
      
      {/* 1. LEFT: Immersive Image Area */}
      <div className="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden group">
         {/* Background Grid */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
         
         <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

         {imagePreview ? (
           <div className="relative w-full h-full flex items-center justify-center p-4 pb-32 md:pb-24">
              <img src={imagePreview} className="max-w-full max-h-full object-contain z-10 shadow-[0_0_50px_rgba(0,0,0,0.8)]" alt="Preview" />
              
              <div 
                 className="absolute inset-0 bg-center bg-cover blur-3xl opacity-30 pointer-events-none"
                 style={{ backgroundImage: `url(${imagePreview})` }}
              ></div>

              {isAnalyzing && (
                 <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent animate-[scan_2s_linear_infinite]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] border border-indigo-500/30 rounded-lg">
                         <div className="absolute top-4 left-4 text-xs font-mono text-indigo-300 animate-pulse">
                            {statusText || "PROCESSING..."}
                         </div>
                    </div>
                 </div>
              )}

              <button 
                 onClick={clearAll}
                 className="absolute top-6 left-6 z-30 p-2 bg-black/50 text-white/70 hover:text-white hover:bg-red-500/80 rounded-full backdrop-blur-md transition-all"
              >
                 <X size={20} />
              </button>
           </div>
         ) : (
           <div className="relative z-10 text-center space-y-6 px-4">
              <div 
                 onClick={() => fileInputRef.current?.click()}
                 className="w-24 h-24 mx-auto rounded-full border border-dashed border-white/20 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 cursor-pointer transition-all duration-300 group/btn"
              >
                 <Upload size={32} className="group-hover/btn:scale-110 transition-transform" />
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-white tracking-tight">上传图像以分析</h2>
                 <p className="text-slate-500 mt-2 text-sm">支持 JPG / PNG / WEBP</p>
              </div>
           </div>
         )}
      </div>

      {/* 2. FLOATING ACTION BAR (Global) */}
      <div 
        className={`
          absolute z-50 transition-all duration-500 ease-in-out
          
          /* Mobile: Fixed at bottom, floating above everything */
          bottom-6 left-4 right-4 

          /* Desktop: Smart positioning based on sidebar state */
          /* If sidebar is open (hasResult), center in the LEFT area. If closed, center in screen. */
          md:bottom-8 md:w-[600px] 
          ${hasResult 
             ? 'md:left-[calc(50%-200px)] md:-translate-x-1/2' // Center in the left remaining space (approx)
             : 'md:left-1/2 md:-translate-x-1/2' // Center of screen
          }
        `}
      >
         <div className="w-full max-w-2xl mx-auto px-4 py-3 rounded-2xl bg-[#0F1629]/90 border border-white/10 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center gap-3">
             <button onClick={onBack} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors shrink-0">
                <ArrowLeft size={20} />
             </button>
             
             <div className="h-6 w-[1px] bg-white/10 mx-1 shrink-0"></div>

             {/* Input Area */}
             <div className="flex-1 flex items-center bg-black/40 rounded-xl border border-white/10 px-3 py-2 focus-within:border-indigo-500/50 transition-colors">
                <input 
                  type="text" 
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder={isRecording ? "正在聆听..." : "输入指令..."}
                  className="flex-1 bg-transparent border-none text-base md:text-sm text-white placeholder-slate-500 focus:ring-0 px-0"
                  disabled={isAnalyzing}
                />
                <button 
                   onMouseDown={toggleRecording}
                   onMouseUp={toggleRecording}
                   onTouchStart={toggleRecording}
                   onTouchEnd={toggleRecording}
                   className={`p-1.5 rounded-lg transition-all ml-2 ${isRecording ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                   title="长按语音输入"
                >
                   <Mic size={18} />
                </button>
             </div>

             <button 
                onClick={handleAnalyze}
                disabled={!uploadedFile || isAnalyzing}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shrink-0 ${
                   !uploadedFile 
                     ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                     : isAnalyzing 
                        ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]'
                }`}
             >
                {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                <span className="hidden sm:inline">{isAnalyzing ? '分析中' : '开始识别'}</span>
             </button>
         </div>
      </div>

      {/* 3. RIGHT/BOTTOM: Analysis Result (Bottom Sheet on Mobile, Side Panel on Desktop) */}
      <div className={`
         absolute md:relative z-40 
         
         /* Mobile: Bottom Sheet Styles */
         bottom-0 inset-x-0 
         bg-[#0F1629]/95 backdrop-blur-2xl 
         border-t border-white/10 rounded-t-[32px] md:rounded-t-none
         shadow-[0_-10px_40px_rgba(0,0,0,0.5)] md:shadow-none
         transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)
         
         /* Mobile Heights */
         ${isResultExpanded ? 'h-[75%]' : 'h-[70px]'}

         /* Desktop: Side Panel Styles */
         md:h-auto md:w-[400px] md:bg-[#0F1629]/60 md:border-t-0 md:border-l 
         
         /* Desktop Visibility Animation */
         ${!hasResult ? 'md:w-0 md:opacity-0 md:overflow-hidden' : 'md:w-[400px] md:opacity-100'}
      `}>
         
         {/* Mobile Header (Draggable/Clickable) */}
         <div 
            onClick={() => setIsResultExpanded(!isResultExpanded)}
            className="md:hidden w-full h-[70px] flex items-center justify-between px-6 border-b border-white/5 cursor-pointer active:bg-white/5"
         >
             <div className="flex items-center gap-3">
                 {/* Drag Handle */}
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full"></div>
                 <ScanLine size={18} className="text-indigo-400"/>
                 <span className="font-bold text-white text-lg">分析报告</span>
             </div>
             {isResultExpanded ? <ChevronDown size={24} className="text-slate-400"/> : <ChevronUp size={24} className="text-slate-400"/>}
         </div>

         {/* Desktop Header */}
         <div className="hidden md:flex p-5 border-b border-white/5 items-center justify-between bg-white/[0.02]">
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
               <ScanLine size={16} /> 分析报告
            </h3>
            {analysisText && (
               <button 
                  onClick={isPlayingAudio ? stopAudio : () => speakText(analysisText)}
                  className={`p-2 rounded-lg transition-all ${isPlayingAudio ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'}`}
               >
                  {isPlayingAudio ? <Pause size={18} /> : <Play size={18} />}
               </button>
            )}
         </div>

         {/* Content Area */}
         <div className="flex-1 h-[calc(100%-70px)] md:h-[calc(100%-65px)] overflow-y-auto p-6 md:p-6 pb-32 md:pb-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {errorMsg ? (
               <div className="flex flex-col items-center justify-center h-full text-center gap-4 animate-in zoom-in-95 py-10">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                     <AlertTriangle size={24} />
                  </div>
                  <div className="space-y-1">
                     <p className="text-white font-medium">任务中断</p>
                     <p className="text-xs text-red-400 px-4 leading-relaxed">{errorMsg}</p>
                     <button onClick={handleAnalyze} className="mt-4 px-4 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                        重试
                     </button>
                  </div>
               </div>
            ) : (
               <div className="space-y-4">
                  {promptInput && (
                     <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                        <p className="text-xs text-slate-500 mb-1">您的指令</p>
                        <p className="text-sm text-slate-300">"{promptInput}"</p>
                     </div>
                  )}
                  
                  {isAnalyzing && !analysisText && (
                     <div className="flex items-center gap-3 text-sm text-indigo-300 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{statusText || "AI 正在思考..."}</span>
                     </div>
                  )}

                  <div className="prose prose-invert prose-sm max-w-none">
                     <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-base md:text-sm">{analysisText}</p>
                  </div>
                  
                  {isAnalyzing && analysisText && (
                     <div className="flex gap-1.5 pt-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-150"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-300"></span>
                     </div>
                  )}
                  <div ref={resultEndRef} />
               </div>
            )}
         </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default AIRecon;
