import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { dataService } from '../services/dataService';
import { Mail, Lock, User, ArrowRight, Loader2, Fingerprint, Sparkles, CheckCircle2, AlertCircle, X, KeyRound, Timer, LogIn, ChevronLeft, ShieldCheck } from 'lucide-react';
import { APP_LOGO } from '../constants';

interface LoginPanelProps {
  onSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot-email' | 'forgot-verify';

interface SavedAccount {
  email: string;
  fullName: string;
  avatarUrl: string | null;
  lastLogin: number;
  password?: string;
}

// --- UI COMPONENTS (Defined outside to prevent re-render focus loss) ---
const InputField = ({ icon: Icon, type, value, onChange, placeholder, required = true, maxLength, rightElement, inputRef }: any) => (
  <div className="group relative transition-all duration-300">
    <div className="absolute inset-0 bg-blue-500/5 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-md"></div>
    <div className="relative flex items-center bg-[#0F1629] border border-white/10 rounded-xl overflow-hidden group-focus-within:border-blue-500/50 group-focus-within:bg-[#1E293B] transition-all shadow-inner">
      <div className="pl-4 pr-3 text-slate-400 group-focus-within:text-blue-400 transition-colors">
        <Icon size={18} />
      </div>
      <input
        ref={inputRef}
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        className="w-full bg-transparent border-none py-3.5 text-sm text-white placeholder-slate-500 focus:ring-0 focus:outline-none tracking-wide"
        placeholder={placeholder}
      />
      {rightElement && <div className="pr-2">{rightElement}</div>}
    </div>
  </div>
);

const LoginPanel: React.FC<LoginPanelProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  
  // Forgot Password
  const [verifyCode, setVerifyCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Saved Accounts
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);

  // 3D Tilt State
  const divRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  // Refs
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const saved = localStorage.getItem('langsu_saved_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.sort((a: SavedAccount, b: SavedAccount) => b.lastLogin - a.lastLogin);
        setSavedAccounts(parsed);
        if (parsed.length > 0) {
          selectAccount(parsed[0]);
        }
      } catch (e) {
        console.error("Failed to parse saved accounts", e);
      }
    }
  }, []);

  useEffect(() => {
    setError(null);
    setSuccessMessage(null);
    if (mode === 'login') {
      setVerifyCode('');
      setNewPassword('');
    }
  }, [mode]);

  const selectAccount = (account: SavedAccount) => {
    setSelectedAccount(account);
    setEmail(account.email);
    setMode('login');
    setError(null);

    if (account.password) {
      try {
        const decodedPwd = atob(account.password);
        setPassword(decodedPwd);
        setRememberMe(true);
      } catch (e) {
        setPassword('');
        setRememberMe(false);
      }
    } else {
      setPassword('');
      setRememberMe(false);
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  };

  const clearSelection = () => {
    setSelectedAccount(null);
    setEmail('');
    setPassword('');
    setRememberMe(false);
    setMode('login');
  };

  const removeAccount = (e: React.MouseEvent, emailToRemove: string) => {
    e.stopPropagation();
    const newAccounts = savedAccounts.filter(acc => acc.email !== emailToRemove);
    setSavedAccounts(newAccounts);
    localStorage.setItem('langsu_saved_accounts', JSON.stringify(newAccounts));
    if (selectedAccount?.email === emailToRemove) {
      clearSelection();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const card = divRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -1; // Reduced tilt for performance
    const rotateY = ((x - centerX) / centerX) * 1;
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.002, 1.002, 1.002)`);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const translateError = (msg: string) => {
    if (msg.includes('Invalid login credentials')) return '账号或密码错误';
    if (msg.includes('Email not confirmed')) return '邮箱未验证';
    if (msg.includes('User already registered')) return '该邮箱已被注册';
    if (msg.includes('Password should be at least')) return '密码太短';
    return msg || '发生未知错误';
  };

  const saveAccountLocally = (profile: any, userEmail: string, pwd?: string) => {
    const newAccount: SavedAccount = {
      email: userEmail,
      fullName: profile?.full_name || userEmail.split('@')[0],
      avatarUrl: profile?.avatar_url || null,
      lastLogin: Date.now(),
      password: pwd ? btoa(pwd) : undefined 
    };
    const otherAccounts = savedAccounts.filter(acc => acc.email !== userEmail);
    const updatedList = [newAccount, ...otherAccounts].slice(0, 5);
    setSavedAccounts(updatedList);
    localStorage.setItem('langsu_saved_accounts', JSON.stringify(updatedList));
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setSuccessMessage('验证码已发送至邮箱');
      setMode('forgot-verify');
      setCountdown(60); 
    } catch (err: any) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email, token: verifyCode, type: 'email',
      });
      if (verifyError) throw verifyError;
      if (!data.user) throw new Error("验证失败");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      
      const profile = await dataService.getUserProfile(data.user.id);
      saveAccountLocally(profile, email); 
      setSuccessMessage("重置成功，正在登录...");
      setTimeout(() => onSuccess(), 1000);
    } catch (err: any) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const profile = await dataService.getUserProfile(data.user.id);
          saveAccountLocally(profile, email, rememberMe ? password : undefined);
          onSuccess();
        }
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) throw new Error('User already registered');
        setSuccessMessage('注册成功！请查收验证邮件。');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      setError(translateError(err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    setSelectedAccount(null);
    setEmail('');
    setPassword('');
    setRememberMe(false);
    setMode('register');
  };

  return (
    <div className="w-full max-w-[400px]" style={{ perspective: '2000px' }}>
      <div 
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
           transform: transform || 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
           transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        // Optimized: Reduced backdrop-blur-2xl to backdrop-blur-xl for performance
        className="relative rounded-[32px] bg-[#020617]/80 backdrop-blur-xl border border-white/10 shadow-[0_40px_80px_-12px_rgba(0,0,0,0.8)] overflow-hidden ring-1 ring-white/10"
      >
        {/* Decorative Top Shine */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent"></div>
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-400/20 to-transparent"></div>

        <div className="relative z-10 p-8 pt-10">

          {/* 1. Header & Logo */}
          <div className={`flex flex-col items-center mb-8 transition-all duration-500 ${selectedAccount && mode === 'login' ? 'opacity-0 h-0 overflow-hidden mb-0 scale-95' : 'opacity-100 scale-100'}`}>
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
               <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse-slow"></div>
               <img src={APP_LOGO} alt="Logo" className="relative w-full h-full object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
              {mode === 'login' ? '欢迎回来' : mode === 'register' ? '创建账户' : '安全中心'}
            </h1>
            <p className="text-xs text-slate-400 mt-2 font-medium tracking-wide uppercase opacity-70">
              Langsu AI Platform
            </p>
          </div>

          {/* 2. Account Selector (QQ Style) */}
          {/* List View */}
          {!selectedAccount && savedAccounts.length > 0 && mode === 'login' && (
             <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {savedAccounts.map((acc) => (
                    <div 
                      key={acc.email} 
                      onClick={() => selectAccount(acc)}
                      className="group relative flex flex-col items-center cursor-pointer transition-all hover:-translate-y-1"
                    >
                       <button 
                         onClick={(e) => removeAccount(e, acc.email)}
                         className="absolute -top-1 -right-1 z-10 w-4 h-4 bg-red-500/80 rounded-full text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 scale-75 hover:scale-100"
                       >
                         <X size={10} />
                       </button>

                       <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-br from-white/10 to-transparent group-hover:from-blue-500 group-hover:to-purple-500 transition-all duration-500">
                          <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border border-black/50">
                             {acc.avatarUrl ? (
                               <img src={acc.avatarUrl} alt={acc.fullName} className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-xs font-bold">
                                 {acc.fullName[0].toUpperCase()}
                               </div>
                             )}
                          </div>
                       </div>
                       <span className="text-[10px] font-medium text-slate-500 mt-2 max-w-[60px] truncate group-hover:text-blue-300 transition-colors">{acc.fullName}</span>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {/* Selected Avatar View */}
          {selectedAccount && mode === 'login' && (
             <div className="flex flex-col items-center mb-6 animate-in zoom-in-95 duration-500">
                <div className="relative w-28 h-28 mb-4 group">
                   {/* Glow Ring */}
                   <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-teal-500/20 blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-1000 animate-spin-slow"></div>
                   
                   <div className="relative w-full h-full rounded-full p-[3px] bg-gradient-to-b from-blue-400 via-purple-400 to-transparent shadow-2xl">
                      <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border-[3px] border-[#0F1629]">
                         {selectedAccount.avatarUrl ? (
                           <img src={selectedAccount.avatarUrl} alt={selectedAccount.fullName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-300 text-3xl font-bold">
                             {selectedAccount.fullName[0].toUpperCase()}
                           </div>
                         )}
                      </div>
                   </div>
                   
                   <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-[#0F1629]" title="在线"></div>
                </div>
                <h3 className="text-xl font-bold text-white drop-shadow-md">{selectedAccount.fullName}</h3>
                <p className="text-xs text-slate-400 mt-1 font-mono tracking-wide">{selectedAccount.email}</p>
                
                <button 
                  onClick={clearSelection}
                  className="mt-4 px-3 py-1 text-xs text-slate-400 hover:text-white border border-white/5 hover:bg-white/5 rounded-full flex items-center gap-1 transition-all"
                >
                   <ChevronLeft size={12} /> 切换账号
                </button>
             </div>
          )}

          {/* 3. Messages */}
          <div className="min-h-[24px] mb-2">
            {successMessage && (
               <div className="text-xs flex items-center justify-center gap-1.5 text-emerald-400 animate-in fade-in slide-in-from-bottom-1">
                 <CheckCircle2 size={14} /> <span>{successMessage}</span>
               </div>
            )}
            {error && (
              <div className="text-xs flex items-center justify-center gap-1.5 text-red-400 animate-in fade-in slide-in-from-bottom-1">
                <AlertCircle size={14} /> <span>{error}</span>
              </div>
            )}
          </div>

          {/* 4. Forms */}
          <div className="space-y-4">
            
            {/* Login / Register */}
            {(mode === 'login' || mode === 'register') && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <InputField 
                    icon={User} 
                    value={fullName} 
                    onChange={(e: any) => setFullName(e.target.value)} 
                    placeholder="您的称呼" 
                  />
                )}
                
                {/* Email (Hidden if selected) */}
                {(!selectedAccount || mode !== 'login') && (
                  <InputField 
                    icon={Mail} 
                    type="email"
                    value={email} 
                    onChange={(e: any) => setEmail(e.target.value)} 
                    placeholder="电子邮箱" 
                  />
                )}

                <InputField 
                  inputRef={passwordInputRef}
                  icon={Lock} 
                  type="password"
                  value={password} 
                  onChange={(e: any) => setPassword(e.target.value)} 
                  placeholder="输入密码" 
                />

                {mode === 'login' && (
                  <div className="flex items-center justify-between text-xs px-1 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-blue-300 transition-colors select-none">
                      <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-[#0F1629]'}`}>
                        {rememberMe && <CheckCircle2 size={10} className="text-white" />}
                      </div>
                      <input type="checkbox" className="hidden" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                      记住密码
                    </label>
                    <button type="button" onClick={() => setMode('forgot-email')} className="text-slate-400 hover:text-white transition-colors">
                      忘记密码?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full mt-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-[1px] shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] active:scale-[0.98]"
                >
                  <div className="relative h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center gap-2 transition-all group-hover:bg-opacity-90">
                     {/* Button Shine Effect */}
                     <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10"></div>
                     
                     {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="font-medium tracking-wide">{mode === 'login' ? '登 录' : '立即注册'}</span>}
                     {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  </div>
                </button>
              </form>
            )}

            {/* Forgot Password Flow */}
            {mode === 'forgot-email' && (
               <form onSubmit={handleSendCode} className="space-y-4">
                 <div className="text-center text-xs text-slate-400 mb-2">请输入您的注册邮箱获取验证码</div>
                 <InputField 
                    icon={Mail} 
                    type="email"
                    value={email} 
                    onChange={(e: any) => setEmail(e.target.value)} 
                    placeholder="电子邮箱" 
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '发送验证码'}
                  </button>
               </form>
            )}

            {mode === 'forgot-verify' && (
               <form onSubmit={handleResetConfirm} className="space-y-4">
                  <div className="text-center text-xs text-slate-400 mb-2">验证码已发送至 {email}</div>
                  <InputField 
                    icon={KeyRound} 
                    value={verifyCode} 
                    onChange={(e: any) => setVerifyCode(e.target.value)} 
                    placeholder="请输入验证码" 
                    maxLength={8}
                    rightElement={
                      <button 
                         type="button"
                         disabled={countdown > 0 || loading}
                         onClick={handleSendCode}
                         className="text-[10px] px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 transition-colors flex items-center gap-1"
                       >
                         {countdown > 0 ? <><Timer size={12}/> {countdown}s</> : '重发'}
                       </button>
                    }
                  />
                  <InputField 
                    icon={Lock} 
                    type="password"
                    value={newPassword} 
                    onChange={(e: any) => setNewPassword(e.target.value)} 
                    placeholder="新密码" 
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium hover:opacity-90 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '重置并登录'}
                  </button>
               </form>
            )}

            {/* Footer Links */}
            <div className="pt-6 border-t border-white/5 flex items-center justify-center text-xs">
              {mode === 'login' ? (
                <span className="text-slate-500">
                  还没有账号？
                  <button onClick={handleRegisterClick} className="ml-1 text-blue-400 hover:text-blue-300 font-medium transition-colors hover:underline">
                    立即注册
                  </button>
                </span>
              ) : (
                <button onClick={() => setMode('login')} className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                  <ChevronLeft size={14} /> 返回登录
                </button>
              )}
            </div>

            {/* Security Footer */}
            <div className="flex justify-center gap-6 opacity-20 pt-2 text-slate-400">
               <Fingerprint size={16} />
               <ShieldCheck size={16} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPanel;