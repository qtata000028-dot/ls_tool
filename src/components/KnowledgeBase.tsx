import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Bot, User, Loader2, Eraser, Paperclip, AlertCircle } from 'lucide-react';
import { aliyunService, ChatMessage } from '../services/aliyunService';
import { APP_LOGO } from '../constants';

interface KnowledgeBaseProps {
  onBack: () => void;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ onBack }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好！我是公司的智能知识库助手。你可以问我关于公司制度、技术文档或项目资料的任何问题。' }
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
    <div className="flex flex-col h-[calc(100vh-140px)] w-full max-w-5xl mx-auto rounded-[24px] overflow-hidden bg-[#0F1629]/80 border border-white/10 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* Header */}
      <div className="h-16 px-6 border-b border-white/5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Bot className="w-5 h-5 text-emerald-400" />
             </div>
             <div>
               <h2 className="text-sm font-bold text-white">公司知识库</h2>
               <div className="flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                 <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider">RAG Online</span>
               </div>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setMessages([messages[0]])}
             className="p-2 text-slate-500 hover:text-white transition-colors text-xs flex items-center gap-1 hover:bg-white/5 rounded-lg"
             title="清空对话"
           >
             <Eraser className="w-4 h-4" />
             <span className="hidden sm:inline">清空</span>
           </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                 {msg.content.startsWith('❌') ? (
                   <AlertCircle className="w-5 h-5 text-red-400" />
                 ) : (
                   <img src={APP_LOGO} className="w-5 h-5 opacity-80" alt="AI" />
                 )}
              </div>
            )}
            
            <div className={`
              max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-[0_0_20px_rgba(37,99,235,0.3)]' 
                : msg.content.startsWith('❌') 
                  ? 'bg-red-500/10 text-red-200 border border-red-500/20 rounded-tl-none'
                  : 'bg-white/5 text-slate-200 border border-white/5 rounded-tl-none'}
            `}>
              {msg.role === 'assistant' && msg.content === '' && loading ? (
                 <div className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-0"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-300"></span>
                 </div>
              ) : (
                msg.content
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-1">
                 <User className="w-4 h-4 text-blue-300" />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0F1629]/95 border-t border-white/5 backdrop-blur-md">
        <div className="relative flex items-end gap-2 p-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-blue-500/50 focus-within:bg-white/10 transition-all shadow-inner">
          
          <button className="p-2 text-slate-400 hover:text-blue-400 transition-colors rounded-lg hover:bg-white/5 self-end mb-0.5">
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入您的问题..."
            className="flex-1 max-h-32 min-h-[44px] bg-transparent text-white placeholder-slate-500 text-sm p-3 focus:outline-none resize-none overflow-y-auto scrollbar-none"
            rows={1}
            style={{ height: 'auto', minHeight: '44px' }} 
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`
              p-2.5 rounded-lg mb-0.5 transition-all duration-300 flex items-center justify-center
              ${!input.trim() || loading 
                ? 'bg-white/5 text-slate-500 cursor-not-allowed' 
                : 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:bg-blue-500 active:scale-90'}
            `}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-slate-600">
            AI 生成内容可能包含错误，请核对重要信息。Powered by Aliyun Bailian.
          </p>
        </div>
      </div>

    </div>
  );
};

export default KnowledgeBase;