import React from 'react';
import { ArrowRight, PlayCircle, Cpu, Zap, Lock } from 'lucide-react';
import { Announcement } from '../../types';

interface HeroProps {
  onStart: () => void;
  announcements: Announcement[];
}

const Hero: React.FC<HeroProps> = ({ onStart, announcements }) => {
  return (
    <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Announcement Badge */}
        {announcements.length > 0 && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md text-blue-300 text-sm font-medium animate-fadeIn">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              {announcements[0].title}
              <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </div>
        )}

        {/* Text Content */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-8 drop-shadow-lg">
            释放 <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">无限创意</span> <br />
            重塑你的工作流
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            集成 Gemini 2.5 与 DeepSeek 能力的新一代 AI 效能平台。
            从数据分析到自动化办公，朗速AI 为您提供企业级智能解决方案。
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onStart}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 group"
            >
              立即开始免费使用
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl backdrop-blur-md transition-all flex items-center justify-center gap-2">
              <PlayCircle className="w-5 h-5 text-slate-300" />
              观看演示
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <Cpu className="w-6 h-6 text-purple-400" />, title: "多模态 AI 模型", desc: "支持 Gemini 2.5 Flash 与通义千问 Qwen-Max 双引擎驱动。" },
            { icon: <Zap className="w-6 h-6 text-blue-400" />, title: "极速响应流", desc: "采用 SSE 实时流式传输技术，思考过程可视化。" },
            { icon: <Lock className="w-6 h-6 text-emerald-400" />, title: "企业级安全", desc: "基于 Supabase RLS 策略，确保数据与隐私绝对安全。" }
          ].map((feature, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all hover:bg-white/10 backdrop-blur-sm group">
              <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Hero;