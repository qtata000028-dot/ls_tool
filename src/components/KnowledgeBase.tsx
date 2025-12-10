import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Bot, User, Loader2, Eraser, Paperclip, AlertCircle, Clock, Search, BookOpen, MoreVertical } from 'lucide-react';
import { aliyunService, ChatMessage } from '../services/aliyunService';
import { APP_LOGO } from '../constants';

interface KnowledgeBaseProps {
  onBack: () => void;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ onBack }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好！我是公司的智能知识库助手。\n你可以问我关于公司制度、技术文档或项目资料的任何问题。' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Create a placeholder for assistant response
      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMsg]);

      // Stream response
      let fullText = "";
      await aliyunService.chatStream([...messages, userMsg], (chunk) => {
        fullText += chunk;
        setMessages(prev => {
           const newMsgs = [...prev];
           newMsgs[newMsgs.length - 1].content = fullText;
           return newMsgs;
        });
      });
      
    } catch (error: any) {
      // Remove the empty loading placeholder if it exists and is empty
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg.role === 'assistant' && lastMsg.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });

      // Show error message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ 出错了: ${error.message || '连接知识库失败'}` 
      }]);
      console.error(error);
    } finally {
      setLoading(false);
      // Refocus input after sending
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    // Outer Container: Expanded size, almost full screen height
    <div className="flex h-[85vh] w-full max-w-[1600px] mx-auto rounded-[24px] overflow-hidden bg-[#020617] border border-white/10 shadow-2xl backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* SIDEBAR (Visual Placeholder for "Pro" feel) */}
      <div className="hidden md:flex flex-col w-64 border-r border-white/5 bg-[#0F1629]/50">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
           <BookOpen className="w-5 h-5 text-emerald-500" />
           <span className="font-bold text-slate-200">知识库索引</span>
        </div>
        <div className="p-3">
           <div className="relative mb-4">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
             <input type="text" placeholder="搜索历史..." className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50" />
           </div>
           
           <div className="space-y-1">
             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 pl-2">最近对话</div>
             {['公司行政制度查询', 'API 接口文档 v2', 'Q3 季度报销流程'].map((item, i) => (
               <button key={i} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2 truncate">
                 <Clock className="w-3.5 h-3.5 opacity-50" />
                 <span className="truncate">{item}</span>
               </button>
             ))}
           </div>
        </div>
        <div className="mt-auto p-4 border-t border-white/5">
           <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
             <ArrowLeft className="w-4 h-4" /> 返回仪表盘
           </button>
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex-1 flex flex-col relative bg-[#020617]/80">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <div className="md:hidden">
                <button onClick={onBack} className="p-2 -ml-2 text-slate-400"><ArrowLeft size={20}/></button>
             </div>
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Bot className="w-6 h-6 text-emerald-400" />
             </div>
             <div>
               <h2 className="text-base font-bold text-white tracking-tight">企业智能助手</h2>
               <div className="flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider">Online · RAG Enabled</span>
               </div>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
               onClick={() => setMessages([messages[0]])}
               className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
               title="清空对话"
             >
               <Eraser className="w-5 h-5" />
             </button>
             <button className="p-2 text-slate-500 hover:text-white transition-colors hover:bg-white/5 rounded-lg">
                <MoreVertical className="w-5 h-5" />
             </button>
          </div>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
            >
              {msg.role === 'assistant' && (
                <div className="w-10 h-10 rounded-full bg-[#0F1629] border border-white/10 flex items-center justify-center shrink-0 mt-1 shadow-lg">
                   {msg.content.startsWith('❌') ? (
                     <AlertCircle className="w-5 h-5 text-red-400" />
                   ) : (
                     <img src={APP_LOGO} className="w-6 h-6 opacity-90" alt="AI" />
                   )}
                </div>
              )}
              
              <div className={`
                max-w-[85%] md:max-w-[70%] rounded-2xl px-6 py-4 text-[15px] leading-relaxed whitespace-pre-wrap shadow-md
                ${msg.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm' 
                  : msg.content.startsWith('❌') 
                    ? 'bg-red-950/30 text-red-200 border border-red-500/20 rounded-tl-sm'
                    : 'bg-[#1E293B]/60 backdrop-blur-sm text-slate-200 border border-white/5 rounded-tl-sm'}
              `}>
                {msg.role === 'assistant' && msg.content === '' && loading ? (
                   <div className="flex gap-1.5 items-center h-6">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-0"></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-150"></span>
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-300"></span>
                   </div>
                ) : (
                  msg.content
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1">
                   <User className="w-5 h-5 text-blue-300" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Floating Input Area */}
        <div className="p-6 pt-0 bg-transparent">
          <div className="relative max-w-4xl mx-auto">
             {/* Glass Container */}
            <div className="relative flex items-end gap-3 p-2 rounded-2xl bg-[#1E293B]/80 border border-white/10 focus-within:border-emerald-500/40 focus-within:bg-[#1E293B] transition-all shadow-2xl backdrop-blur-xl">
              
              <button className="p-3 text-slate-400 hover:text-emerald-400 transition-colors rounded-xl hover:bg-white/5 mb-0.5">
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="询问关于公司的任何问题 (Enter 发送)"
                className="flex-1 max-h-40 min-h-[50px] bg-transparent text-white placeholder-slate-500 text-sm p-3.5 focus:outline-none resize-none overflow-y-auto scrollbar-none"
                rows={1}
                style={{ height: 'auto', minHeight: '50px' }} 
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className={`
                  p-3 rounded-xl mb-0.5 transition-all duration-300 flex items-center justify-center
                  ${!input.trim() || loading 
                    ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                    : 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 active:scale-95'}
                `}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <div className="text-center mt-3">
              <p className="text-[10px] text-slate-500 font-medium tracking-wide">
                AI 内容由阿里云百炼大模型生成，仅供参考。
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default KnowledgeBase;