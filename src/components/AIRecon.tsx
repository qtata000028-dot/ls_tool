import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, Upload, Mic, ScanLine, X, Loader2, Volume2, StopCircle, Sparkles, Image as ImageIcon } from 'lucide-react';
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voicePrompt, setVoicePrompt] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null); // For Web Speech API
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);

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
        setVoicePrompt(transcript);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setAnalysisText(''); // Clear previous results
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
      setVoicePrompt('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFile) return;

    setIsAnalyzing(true);
    setAnalysisText('');
    
    // Stop any existing TTS
    synthRef.current.cancel();

    try {
      // 1. Upload Image to get Public URL
      const publicUrl = await dataService.uploadAnalysisImage(uploadedFile);
      if (!publicUrl) throw new Error("图片上传失败，请重试");

      // 2. Prepare Messages for Qwen-VL
      const promptText = voicePrompt || "请详细分析这张图片的内容，识别其中的物体、文字以及可能存在的异常情况。";
      
      const messages: VLMessage[] = [
        {
          role: 'user',
          content: [
            { image: publicUrl },
            { text: promptText }
          ]
        }
      ];

      // 3. Stream Call
      let fullResponse = "";
      await aliyunService.chatVLStream(messages, (chunk) => {
        fullResponse += chunk;
        setAnalysisText(prev => prev + chunk);
      });
      
      // 4. Auto-Play TTS when done
      speakText(fullResponse);

    } catch (error: any) {
      setAnalysisText(`Error: ${error.message || '分析失败'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakText = (text: string) => {
    if (!text) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1; // Slightly faster
    
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    
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
    setVoicePrompt('');
    stopAudio();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full h-[85vh] max-w-[1400px] mx-auto bg-black border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-500 relative">
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
        style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />

      {/* LEFT: Viewfinder / Input Area */}
      <div className="flex-1 relative bg-slate-900/50 flex flex-col">
         {/* HUD Corners */}
         <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-cyan-500 z-10 opacity-70"></div>
         <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-cyan-500 z-10 opacity-70"></div>
         <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-cyan-500 z-10 opacity-70"></div>
         <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-cyan-500 z-10 opacity-70"></div>

         {/* Header */}
         <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-20">
            <button onClick={onBack} className="p-2 rounded-full bg-black/40 text-cyan-400 hover:bg-cyan-500/20 backdrop-blur-md transition-all border border-cyan-500/30">
              <ArrowLeft size={20} />
            </button>
            <div className="px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-500/30 text-xs font-mono text-cyan-300 backdrop-blur-md">
              SYSTEM: ONLINE // QWEN-VL-MAX
            </div>
         </div>

         {/* Main Viewport */}
         <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            
            {imagePreview ? (
              <div className="relative w-full h-full flex items-center justify-center group">
                 <img src={imagePreview} className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.2)]" />
                 
                 {/* Scanning Effect */}
                 {isAnalyzing && (
                   <div className="absolute inset-0 z-20 pointer-events-none">
                      <div className="w-full h-1 bg-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
                      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent animate-pulse"></div>
                   </div>
                 )}
                 
                 <button onClick={clearAll} className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                   <X size={16} />
                 </button>
              </div>
            ) : (
              <div className="flex flex-col gap-6 items-center">
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="w-32 h-32 rounded-full border-2 border-dashed border-cyan-500/30 flex items-center justify-center cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-400 hover:scale-105 transition-all duration-300 group"
                 >
                    <Upload className="w-10 h-10 text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
                 </div>
                 <p className="text-cyan-500/50 font-mono text-sm tracking-widest">UPLOAD IMAGE TARGET</p>
              </div>
            )}
         </div>

         {/* Bottom Controls */}
         <div className="h-24 bg-black/60 backdrop-blur-xl border-t border-cyan-500/20 flex items-center justify-center gap-8 z-20">
            {/* Mic Button */}
            <div className="flex flex-col items-center gap-1">
               <button 
                 onMouseDown={toggleRecording}
                 onMouseUp={toggleRecording}
                 onTouchStart={toggleRecording}
                 onTouchEnd={toggleRecording}
                 className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse scale-110' : 'bg-cyan-950/30 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'}`}
               >
                 <Mic size={24} />
               </button>
               <span className="text-[10px] text-cyan-500/50 font-mono">{isRecording ? 'RECORDING...' : 'HOLD TO SPEAK'}</span>
            </div>

            {/* Scan Button */}
            <button 
               onClick={handleAnalyze}
               disabled={!uploadedFile || isAnalyzing}
               className={`
                 h-16 px-8 rounded-2xl flex items-center gap-3 font-bold text-lg transition-all
                 ${!uploadedFile 
                   ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' 
                   : isAnalyzing
                     ? 'bg-cyan-600/50 text-white cursor-wait border border-cyan-400/50'
                     : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_30px_rgba(8,145,178,0.4)] hover:shadow-[0_0_50px_rgba(8,145,178,0.6)] hover:scale-105 border border-cyan-400/50'}
               `}
            >
               {isAnalyzing ? (
                 <><Loader2 className="animate-spin" /> PROCESSING</>
               ) : (
                 <><ScanLine className="w-6 h-6" /> START SCAN</>
               )}
            </button>
            
            {/* Camera Button (Mobile Placeholder) */}
            <div className="flex flex-col items-center gap-1">
               <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-full bg-cyan-950/30 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 flex items-center justify-center transition-all">
                 <Camera size={24} />
               </button>
               <span className="text-[10px] text-cyan-500/50 font-mono">CAMERA</span>
            </div>
         </div>
      </div>

      {/* RIGHT: Analysis Results */}
      <div className="w-full md:w-[400px] bg-slate-950/90 border-l border-white/10 flex flex-col relative z-20">
         <div className="p-4 border-b border-white/10 bg-white/[0.02]">
            <h3 className="text-cyan-400 font-bold flex items-center gap-2">
               <Sparkles className="w-4 h-4" /> 
               ANALYSIS LOG
            </h3>
         </div>
         
         {/* Voice Prompt Display */}
         {voicePrompt && (
           <div className="p-4 border-b border-white/5 bg-cyan-950/20">
              <span className="text-xs text-cyan-500/70 block mb-1 font-mono">User Prompt:</span>
              <p className="text-sm text-cyan-100 italic">"{voicePrompt}"</p>
           </div>
         )}

         {/* Result Text */}
         <div className="flex-1 p-6 overflow-y-auto font-mono text-sm leading-relaxed text-slate-300 custom-scrollbar">
            {analysisText ? (
              <div className="animate-in fade-in slide-in-from-bottom-2">
                {analysisText}
                {isAnalyzing && <span className="inline-block w-2 h-4 ml-1 bg-cyan-500 animate-pulse align-middle"></span>}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                 <ImageIcon className="w-12 h-12" />
                 <p className="text-center text-xs">AWAITING VISUAL DATA INPUT...</p>
              </div>
            )}
         </div>

         {/* TTS Controls */}
         {analysisText && !isAnalyzing && (
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
               <div className="flex items-center gap-2">
                 {isPlayingAudio && (
                   <div className="flex gap-1 h-3 items-end">
                      <div className="w-1 bg-cyan-400 animate-[music_0.5s_ease-in-out_infinite] h-full"></div>
                      <div className="w-1 bg-cyan-400 animate-[music_0.7s_ease-in-out_infinite] h-2/3"></div>
                      <div className="w-1 bg-cyan-400 animate-[music_0.6s_ease-in-out_infinite] h-full"></div>
                   </div>
                 )}
                 <span className="text-xs text-slate-400">{isPlayingAudio ? 'VOICE OUTPUT ACTIVE' : 'VOICE OUTPUT READY'}</span>
               </div>
               
               <button 
                 onClick={isPlayingAudio ? stopAudio : () => speakText(analysisText)}
                 className="p-3 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all border border-cyan-500/20"
               >
                 {isPlayingAudio ? <StopCircle size={20} /> : <Volume2 size={20} />}
               </button>
            </div>
         )}
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes music {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
      `}</style>
    </div>
  );
};

export default AIRecon;