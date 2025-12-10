import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { 
  Database, 
  Cpu, 
  GraduationCap, 
  Activity, 
  Zap, 
  ArrowUpRight,
  Server,
  Camera,
  User as UserIcon,
  Sparkles,
  BarChart3,
  CalendarDays,
  ShieldCheck,
  Megaphone,
  BellRing
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { Module, DashboardStats, Profile, Announcement } from '../../types';

interface DashboardProps {
  user: User;
  profile: Profile | null;
  announcements: Announcement[];
  onProfileUpdate: () => void;
  onNavigate: (view: string) => void;
}

// Icon mapping helper
const getIcon = (iconName: string | null) => {
  switch (iconName) {
    case 'Database': return <Database className="w-6 h-6" />;
    case 'Cpu': return <Cpu className="w-6 h-6" />;
    case 'GraduationCap': return <GraduationCap className="w-6 h-6" />;
    case 'Server': return <Server className="w-6 h-6" />;
    default: return <Activity className="w-6 h-6" />;
  }
};

const Dashboard: React.FC<DashboardProps> = ({ user, profile, announcements, onProfileUpdate, onNavigate }) => {
  const [modules, setModules] = useState<Module[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ aiCalls: 0, moduleClicks: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDashboardData();
  }, [user.id]);

  const loadDashboardData = async () => {
    try {
      const [fetchedModules, fetchedStats] = await Promise.all([
        dataService.getModules(),
        dataService.getDashboardStats(user.id)
      ]);
      setModules(fetchedModules);
      setStats(fetchedStats);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleClick = async (module: Module) => {
    // 1. Log Activity
    await dataService.logActivity(
      user.id, 
      'module_access', 
      module.key, 
      { path: module.path, title: module.title }
    );
    setStats(prev => ({ ...prev, moduleClicks: prev.moduleClicks + 1 }));

    // 2. Navigate
    // Note: In a real app with React Router, we would use navigate(module.path)
    // Here we use simple state-based navigation
    onNavigate(module.key);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const newUrl = await dataService.uploadAvatar(user.id, file);
      if (newUrl) {
        onProfileUpdate();
      }
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '上午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  };

  return (
    <div className="w-full max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* 1. Header Section */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            {getGreeting()}，
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-white">
              {profile?.full_name || '新用户'}
            </span>
          </h1>
          <p className="text-slate-400 text-sm">
            准备好开始今天的工作了吗？
          </p>
        </div>
      </div>

      {/* 2. Announcement Banner (Top Placement) */}
      {announcements.length > 0 && (
        <div className="mb-8 relative group overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 to-[#0F1629]/60 border border-blue-500/20 backdrop-blur-md">
           <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
           <div className="p-4 flex items-start sm:items-center gap-4">
              <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse-slow">
                <Megaphone className="w-5 h-5 text-blue-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-blue-100 mb-0.5 flex items-center gap-2">
                  重要公告
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-blue-200/80 truncate">
                  {announcements[0].content}
                </p>
              </div>
              <button className="hidden sm:flex text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-colors">
                查看详情
              </button>
           </div>
        </div>
      )}

      {/* 3. Main Grid Layout (2 Columns: 2/3 Main, 1/3 Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main Modules (Scalable Grid) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-1">
             <div className="flex items-center gap-2">
               <Sparkles className="w-4 h-4 text-blue-400" />
               <h2 className="text-sm font-bold text-white uppercase tracking-wider">功能工作台</h2>
             </div>
          </div>

          {/* Module Grid: Changed to grid-cols-2 for smaller, card-like items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {loading ? (
              <>
                <div className="h-48 rounded-3xl bg-white/5 animate-pulse border border-white/5" />
                <div className="h-48 rounded-3xl bg-white/5 animate-pulse border border-white/5" />
              </>
            ) : (
              modules.map((module) => (
                <div 
                  key={module.id}
                  onClick={() => handleModuleClick(module)}
                  className="group relative overflow-hidden rounded-[24px] bg-[#0F1629]/60 border border-white/5 hover:bg-[#1E293B]/80 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:border-white/10 hover:-translate-y-1"
                >
                  {/* Subtle Top Light */}
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative p-6 flex flex-col h-full">
                    
                    {/* Header: Icon + Arrow */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`
                        w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg border border-white/5 group-hover:scale-110 transition-transform duration-300
                        ${module.key === 'knowledge' ? 'bg-emerald-500/10 text-emerald-400' : 
                          module.key === 'tools' ? 'bg-blue-500/10 text-blue-400' : 
                          'bg-purple-500/10 text-purple-400'}
                      `}>
                        {getIcon(module.icon)}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                         <ArrowUpRight className="w-5 h-5 text-white/30 group-hover:text-white" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="mt-auto">
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-blue-100 transition-colors">
                        {module.title}
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-2">
                        {module.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            
            {/* Add 'Coming Soon' placeholder if few modules */}
            {!loading && modules.length < 4 && (
               <div className="rounded-[24px] border border-dashed border-white/10 bg-transparent p-6 flex flex-col items-center justify-center text-center group hover:border-white/20 transition-colors min-h-[180px]">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <span className="text-xl text-slate-500 group-hover:text-white">+</span>
                  </div>
                  <p className="text-xs font-medium text-slate-500">更多功能敬请期待</p>
               </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Profile & Stats */}
        <div className="space-y-6">
          
          {/* Profile Card */}
          <div className="relative overflow-hidden rounded-[24px] bg-[#0F1629]/80 border border-white/5 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
              
              {/* Avatar */}
              <div 
                onClick={handleAvatarClick}
                className="relative w-24 h-24 mb-4 rounded-full p-1 bg-gradient-to-b from-white/20 to-transparent cursor-pointer group"
              >
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border-4 border-[#0F1629] relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <UserIcon className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  {/* Upload Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-blue-500 rounded-full border-2 border-[#0F1629] flex items-center justify-center">
                  <span className="text-[10px] font-bold">+</span>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white">{profile?.full_name || '未命名'}</h3>
              <p className="text-sm text-slate-400 mt-1">{profile?.department || '产品研发部'} · {profile?.role === 'admin' ? '管理员' : '成员'}</p>

              <div className="mt-6 w-full pt-6 border-t border-white/5 flex justify-between items-center text-xs text-slate-500">
                 <span className="flex items-center gap-1.5">
                   <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> 
                   账号安全
                 </span>
                 <span className="font-mono">ID: {user.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          {/* Combined Stats Card */}
          <div className="rounded-[24px] bg-[#0F1629]/60 border border-white/5 p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                数据洞察
              </h4>
              <BellRing className="w-4 h-4 text-slate-600 hover:text-white cursor-pointer transition-colors" />
            </div>

            {/* AI Stat */}
            <div className="group">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm text-slate-400 group-hover:text-blue-300 transition-colors">AI 调用量</span>
                <Zap className="w-4 h-4 text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-bold text-white font-sans tabular-nums">
                {stats.aiCalls.toLocaleString()}
              </div>
              <div className="mt-2 h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"></div>
              </div>
            </div>

            {/* Clicks Stat */}
            <div className="group">
              <div className="flex justify-between items-end mb-2">
                <span className="text-sm text-slate-400 group-hover:text-purple-300 transition-colors">模块活跃度</span>
                <Activity className="w-4 h-4 text-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-3xl font-bold text-white font-sans tabular-nums">
                {stats.moduleClicks.toLocaleString()}
              </div>
              <div className="mt-2 h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.3)]"></div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
               <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  本月统计
               </span>
               <span className="text-emerald-400"> +12.5% 增长</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
