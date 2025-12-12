import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, Mic, ScanLine, X, Loader2, Play, Pause, AlertTriangle, Sparkles, ChevronUp, ChevronDown, StopCircle, Send } from 'lucide-react';
import { aliyunService, VLMessage } from '../services/aliyunService';
import { dataService } from '../services/dataService';

interface AIReconProps {
  onBack: () => void;
}

// --- Sub-Components Defined Outside to Prevent Re-render Focus Loss ---

const ActionBar = ({ 
  className = "", 
  promptInput, 
  setPromptInput, 
  handleAnalyze, 
  isRecording, 
  toggleRecording, 
  isAnalyzing, 
  uploadedFile 
}: any) => (
  <div className={`flex flex-col gap-3 ${className}`}>
      {/* Row 1: Input + Mic */}
      <div className="flex items-center gap-3 w-full">
          <div className={`flex-1 flex items-center bg-black/40 rounded-xl border px-3 py-2.5 transition-all duration-300 ${isRecording ? 'border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.4)] bg-red-950/20' : 'border-white/10 focus-within:border-indigo-500/50'}`}>
              <input 
              type="text" 
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder={isRecording ? "正在听..." : "输入指令..."}
              className="flex-1 bg-transparent border-none text-sm text-white placeholder-slate-500 focus:ring-0 px-0 min-w-0"
              disabled={isAnalyzing}
              autoFocus
              />
              <button 
                  onClick={toggleRecording}
                  className={`p-2 rounded-lg transition-all ml-2 shrink-0 flex items-center justify-center ${
                      isRecording 
                      ? 'text-white bg-red-500 animate-pulse' 
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
              >
                  {isRecording ? <StopCircle size={18} className="fill-current"/> : <Mic size={18} />}
              </button>
          </div>
      </div>

      {/* Row 2: Action Button */}
      <button 
          onClick={handleAnalyze}
          disabled={!uploadedFile || isAnalyzing}
          className={`flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              !uploadedFile 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
              : isAnalyzing 
                  ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] active:scale-[0.98]'
          }`}
      >
          {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          <span>{isAnalyzing ? 'AI 深度分析中...' : '开始识别'}</span>
      </button>
  </div>
);

const AnalysisResultContent = ({ 
  promptInput, 
  isDesktop, 
  isAnalyzing, 
  analysisText, 
  statusText, 
  errorMsg, 
  handleAnalyze,
  resultEndRef 
}: any) => (
  <div className="space-y-4">
      {promptInput && isDesktop && (
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

      {errorMsg ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-4 animate-in zoom-in-95">
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
          <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap text-base md:text-sm">{analysisText}</p>
              {isAnalyzing && analysisText && (
                  <div className="flex gap-1.5 pt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-150"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse delay-300"></span>
                  </div>
              )}
          </div>
      )}
      <div ref={resultEndRef} />
  </div>
);

const AIRecon: React.FC<AIReconProps> = ({ onBack }) => {
  // --- Device Detection ---
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- State ---
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  
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
  
  // Track uploaded image path for cleanup
  const uploadedImagePathRef = useRef<string | null>(null);

  // --- Cleanup on Unmount ---
  useEffect(() => {
    // Setup Speech Recognition
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
        if (transcript) setPromptInput(transcript);
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
      if (recognitionRef.current) recognitionRef.current.stop();
      
      // CRITICAL: Delete the image from DB when component unmounts
      if (uploadedImagePathRef.current) {
          dataService.deleteAnalysisImage(uploadedImagePathRef.current);
      }
    };
  }, []);

  // Auto-expand result panel on mobile when data arrives
  useEffect(() => {
    if ((analysisText || errorMsg) && !isDesktop) {
      setIsResultExpanded(true);
      setTimeout(() => {
        if (resultEndRef.current) {
          resultEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
  }, [analysisText, errorMsg, isDesktop]);

  // --- Cleanup Helper ---
  const cleanupOldImage = async () => {
      if (uploadedImagePathRef.current) {
          await dataService.deleteAnalysisImage(uploadedImagePathRef.current);
          uploadedImagePathRef.current = null;
      }
  };

  // --- Handlers ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Clean up previous image if exists
      await cleanupOldImage();

      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
      
      // Reset States
      setAnalysisText(''); 
      setErrorMsg(null);
      stopAudio();
      setIsResultExpanded(false);
    }
  };

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert("您的浏览器不支持语音识别功能 (建议使用 Chrome)");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
        setPromptInput('');
      } catch (e) {
        console.error("Start recording failed", e);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisText('');
    setErrorMsg(null);
    stopAudio();
    if (!isDesktop) setIsResultExpanded(true);
    
    if (isRecording) {
       recognitionRef.current?.stop();
       setIsRecording(false);
    }
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      // 1. Clean up old image if any (just in case)
      await cleanupOldImage();

      // 2. Upload New Image
      setStatusText("正在压缩并上传图片...");
      const result = await dataService.uploadAnalysisImage(uploadedFile);

      if (!result || !result.publicUrl) throw new Error("图片上传失败，请检查网络连接。");

      // Track the new path for cleanup later
      uploadedImagePathRef.current = result.path;

      // 3. Start Analysis
      const finalPrompt = promptInput.trim() || "请详细分析这张图片的内容。识别其中的物体、文字、场景以及任何值得注意的细节。";

      const messages: VLMessage[] = [
        {
          role: 'user',
          content: [
            { image: result.publicUrl },
            { text: finalPrompt }
          ]
        }
      ];

      const runStreamWithRetry = async () => {
        let attempt = 0;
        let hasReceivedFirstToken = false;
        let fullResponse = "";

        const startTimeoutGuard = () => setTimeout(() => {
          if (!hasReceivedFirstToken) {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            setErrorMsg("请求超时：AI 响应时间过长，请检查网络或重试。");
            setIsAnalyzing(false);
            setStatusText("");
          }
        }, 60000);

        while (attempt < 2) {
          const timeoutId = startTimeoutGuard();
          try {
            setStatusText(attempt === 0 ? "AI 正在深度分析 (Qwen-VL-Max)..." : "稳定通道重试中...");
            fullResponse = "";
            hasReceivedFirstToken = false;
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

            return fullResponse;
          } catch (innerErr) {
            clearTimeout(timeoutId);
            console.error(`Stream attempt ${attempt + 1} failed`, innerErr);
            if (attempt === 0) {
              setStatusText("检测到不稳定，正在更换通道重试...");
              setAnalysisText('');
              await new Promise((r) => setTimeout(r, 800));
            } else {
              throw innerErr;
            }
          }
          attempt += 1;
        }
        return fullResponse;
      };

      const finalText = await runStreamWithRetry();
      setStatusText("");
      speakText(finalText);

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

  const clearAll = async () => {
    // Explicit cleanup when user clicks Close
    await cleanupOldImage();
    
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
  
  const handleBack = async () => {
      await cleanupOldImage();
      onBack();
  };

  // --- Main Render ---
  return (
    <div className="w-full h-[calc(100dvh-110px)] max-w-[1600px] mx-auto bg-[#020617] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500 relative">
      
      {/* =======================
          LEFT PANEL: Image
         ======================= */}
      <div className={`flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden group transition-all ${isDesktop ? 'md:w-auto' : 'w-full'}`}>
         {/* Grid BG */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
         
         <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

         {/* Image Display */}
         {imagePreview ? (
           <div className="relative w-full h-full flex items-center justify-center p-4">
              <img src={imagePreview} className="max-w-full max-h-full object-contain z-10 shadow-[0_0_50px_rgba(0,0,0,0.8)]" alt="Preview" />
              
              {/* Scan Effect Overlay */}
              {isAnalyzing && (
                 <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent animate-[scan_2s_linear_infinite]"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] border border-indigo-500/30 rounded-lg">
                         <div className="absolute top-4 left-4 text-xs font-mono text-indigo-300 animate-pulse bg-black/50 px-2 py-1 rounded">
                            {statusText || "PROCESSING..."}
                         </div>
                    </div>
                 </div>
              )}

              {/* Close Button */}
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
         
         {/* Desktop Back Button (Floating on Image) */}
         {isDesktop && (
            <button onClick={handleBack} className="absolute top-6 left-6 p-2 text-slate-400 hover:text-white bg-black/30 rounded-lg backdrop-blur-md">
                <ArrowLeft size={20} />
            </button>
         )}

         {/* MOBILE ONLY: Floating Action Bar at Bottom of Image Panel */}
         {!isDesktop && (
            <div className={`absolute left-0 right-0 z-50 px-4 transition-all duration-300 ${isResultExpanded ? 'bottom-4 opacity-0 pointer-events-none' : 'bottom-6 opacity-100'}`}>
                <div className="bg-[#0F1629]/90 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3 mb-3">
                        <button onClick={handleBack} className="p-2 text-slate-400"><ArrowLeft size={20}/></button>
                        <div className="h-4 w-[1px] bg-white/10"></div>
                        <span className="text-sm font-bold text-white">AI 视觉分析</span>
                    </div>
                    <ActionBar 
                        promptInput={promptInput}
                        setPromptInput={setPromptInput}
                        handleAnalyze={handleAnalyze}
                        isRecording={isRecording}
                        toggleRecording={toggleRecording}
                        isAnalyzing={isAnalyzing}
                        uploadedFile={uploadedFile}
                    />
                </div>
            </div>
         )}
      </div>

      {/* =======================
          RIGHT PANEL: Results & Controls (Desktop) OR Bottom Sheet (Mobile)
         ======================= */}
      {isDesktop ? (
          // DESKTOP: Sidebar Layout (Always Visible)
          <div className="w-[450px] bg-[#0F1629]/90 border-l border-white/10 flex flex-col relative backdrop-blur-xl">
             {/* Header */}
             <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-white/[0.02]">
                <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase text-sm tracking-wider">
                    <ScanLine size={16} /> 分析报告
                </div>
                {analysisText && (
                   <button 
                      onClick={isPlayingAudio ? stopAudio : () => speakText(analysisText)}
                      className={`p-2 rounded-lg transition-all ${isPlayingAudio ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white'}`}
                   >
                      {isPlayingAudio ? <Pause size={18} /> : <Play size={18} />}
                   </button>
                )}
             </div>

             {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                {!analysisText && !errorMsg ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                        <Sparkles size={48} strokeWidth={1} />
                        <p className="text-sm">上传图片并输入指令以开始</p>
                    </div>
                ) : (
                    <AnalysisResultContent 
                        promptInput={promptInput}
                        isDesktop={isDesktop}
                        isAnalyzing={isAnalyzing}
                        analysisText={analysisText}
                        statusText={statusText}
                        errorMsg={errorMsg}
                        handleAnalyze={handleAnalyze}
                        resultEndRef={resultEndRef}
                    />
                )}
             </div>

             {/* Footer: Fixed Control Bar */}
             <div className="p-4 border-t border-white/5 bg-[#0a0f1e]">
                <ActionBar 
                    className="w-full" 
                    promptInput={promptInput}
                    setPromptInput={setPromptInput}
                    handleAnalyze={handleAnalyze}
                    isRecording={isRecording}
                    toggleRecording={toggleRecording}
                    isAnalyzing={isAnalyzing}
                    uploadedFile={uploadedFile}
                />
             </div>
          </div>
      ) : (
          // MOBILE: Bottom Sheet
          <div className={`
             absolute z-50 bottom-0 inset-x-0 
             bg-[#0F1629]/95 backdrop-blur-2xl 
             border-t border-white/10 rounded-t-[32px]
             shadow-[0_-10px_40px_rgba(0,0,0,0.5)]
             transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)
             flex flex-col
             ${isResultExpanded ? 'h-[85%]' : 'h-[0px] overflow-hidden border-none'}
          `}>
             <div 
                onClick={() => setIsResultExpanded(!isResultExpanded)}
                className="w-full h-[60px] flex items-center justify-between px-6 border-b border-white/5 cursor-pointer active:bg-white/5 shrink-0"
             >
                 <div className="flex items-center gap-3">
                     <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full"></div>
                     <ScanLine size={18} className="text-indigo-400"/>
                     <span className="font-bold text-white text-lg">分析报告</span>
                 </div>
                 <ChevronDown size={24} className="text-slate-400"/>
             </div>

             <div className="flex-1 overflow-y-auto p-6 pb-24">
                <AnalysisResultContent 
                    promptInput={promptInput}
                    isDesktop={isDesktop}
                    isAnalyzing={isAnalyzing}
                    analysisText={analysisText}
                    statusText={statusText}
                    errorMsg={errorMsg}
                    handleAnalyze={handleAnalyze}
                    resultEndRef={resultEndRef}
                />
             </div>
             
             {/* Mobile Sheet Footer (Optional, mostly empty as controls are behind sheet) */}
             {analysisText && (
                <div className="absolute bottom-6 right-6">
                   <button 
                      onClick={isPlayingAudio ? stopAudio : () => speakText(analysisText)}
                      className="p-3 bg-indigo-600 rounded-full shadow-lg text-white"
                   >
                      {isPlayingAudio ? <Pause size={20} /> : <Play size={20} />}
                   </button>
                </div>
             )}
          </div>
      )}
      
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