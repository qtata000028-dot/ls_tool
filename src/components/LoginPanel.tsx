import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { dataService } from '../services/dataService';
import { Mail, Lock, User, ArrowRight, Loader2, Fingerprint, Sparkles, CheckCircle2, AlertCircle, X, Plus, KeyRound, Timer, LogIn, ChevronLeft } from 'lucide-react';
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
  password?: string; // Simple base64 encoded password for UX convenience
}

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
  
  // Forgot Password Specific State
  const [verifyCode, setVerifyCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Saved Accounts State
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);

  // 3D State
  const divRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  // Refs for focus management
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Timer Effect for Countdown
  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Load saved accounts on mount
  useEffect(() => {
    const saved = localStorage.getItem('langsu_saved_accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Sort by last login (newest first)
        parsed.sort((a: SavedAccount, b: SavedAccount) => b.lastLogin - a.lastLogin);
        setSavedAccounts(parsed);
        
        // Auto-select latest account if exists
        if (parsed.length > 0) {
          selectAccount(parsed[0]);
        }
      } catch (e) {
        console.error("Failed to parse saved accounts", e);
      }
    }
  }, []);

  // Reset messages when switching modes
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

    // Auto-fill password if remembered
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
      // Auto focus password input
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
    
    const rotateX = ((y - centerY) / centerY) * -3; 
    const rotateY = ((x - centerX) / centerX) * 3;
    
    setTransform(`perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.005, 1.005, 1.005)`);
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
  };

  const translateError = (msg: string) => {
    if (msg.includes('Invalid login credentials')) return '账号或密码错误';
    if (msg.includes('Email not confirmed')) return '邮箱未验证，请检查收件箱';
    if (msg.includes('User already registered')) return '该邮箱已被注册';
    if (msg.includes('Password should be at least')) return '密码长度至少为 6 位';
    if (msg.includes('Rate limit exceeded')) return '操作太频繁，请稍后再试';
    if (msg.includes('Token has expired')) return '验证码已过期，请重新获取';
    return msg || '发生未知错误';
  };

  const saveAccountLocally = (profile: any, userEmail: string, pwd?: string) => {
    const newAccount: SavedAccount = {
      email: userEmail,
      fullName: profile?.full_name || userEmail.split('@')[0],
      avatarUrl: profile?.avatar_url || null,
      lastLogin: Date.now(),
      password: pwd ? btoa(pwd) : undefined // Simple obfuscation if "Remember Me" is checked
    };

    // Remove existing entry for this email then add new one to top
    const otherAccounts = savedAccounts.filter(acc => acc.email !== userEmail);
    const updatedList = [newAccount, ...otherAccounts].slice(0, 5); // Keep max 5

    setSavedAccounts(updatedList);
    localStorage.setItem('langsu_saved_accounts', JSON.stringify(updatedList));
  };

  // Step 1: Send OTP for Password Reset
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
      });

      if (error) throw error;

      setSuccessMessage('验证码已发送至您的邮箱');
      setMode('forgot-verify');
      setCountdown(60); 
    } catch (err: any) {
      setError(translateError(err.message));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify Code and Set New Password
  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: verifyCode,
        type: 'email',
      });

      if (verifyError) throw verifyError;
      if (!data.user) throw new Error("验证失败，未获取到用户信息");

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      const profile = await dataService.getUserProfile(data.user.id);
      saveAccountLocally(profile, email); // Don't save new password by default on reset
      
      setSuccessMessage("密码修改成功！正在登录...");
      setTimeout(() => {
        onSuccess();
      }, 1000);

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
    setSuccessMessage(null);

    try {
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const profile = await dataService.getUserProfile(data.user.id);
          // Save with password if Remember Me is checked
          saveAccountLocally(profile, email, rememberMe ? password : undefined);
          onSuccess();
        }
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        if (data.user && data.user.identities && data.user.identities.length === 0) {
           throw new Error('User already registered');
        }

        setSuccessMessage('注册成功！验证邮件已发送，请验证后登录。');
        setMode('login');
        setPassword('');
      }
    } catch (err: any) {
      console.error(err);
      setError(translateError(err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterClick = () => {
    // Clear selection AND switch to register, without resetting to login
    setSelectedAccount(null);
    setEmail('');
    setPassword('');
    setRememberMe(false);
    setMode('register');
  };

  return (
    <div className="w-full max-w-[420px]" style={{ perspective: '2000px' }}>
      <div 
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
           transform: transform || 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
           transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        // Updated transparency for better background visibility
        className="relative rounded-[32px] bg-[#0F1629]/50 backdrop-blur-2xl border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden"
      >
        {/* Decorative Gradients - Subtle internal glow */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-indigo-500/50 opacity-80" />

        {/* --- MAIN CONTENT AREA --- */}
        <div className="relative z-10 p-8 pt-10">

          {/* 1. Header Logo & Title (Always Visible except when avatar is huge) */}
          <div className={`flex flex-col items-center mb-8 transition-all duration-500 ${selectedAccount && mode === 'login' ? 'opacity-0 h-0 overflow-hidden mb-0' : 'opacity-100'}`}>
            <img 
              src={APP_LOGO} 
              alt="Logo" 
              className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.4)] mb-4"
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {mode === 'login' ? '欢迎登录' : 
               mode === 'register' ? '加入我们' : 
               mode === 'forgot-email' ? '找回密码' : '重置密码'}
            </h1>
          </div>

          {/* 2. Account Selector (QQ Style) */}
          {/* Mode A: Horizontal List (When no account selected) */}
          {!selectedAccount && savedAccounts.length > 0 && mode === 'login' && (
             <div className="mb-8 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs text-slate-400 text-center mb-4">选择历史账号登录</p>
                <div className="flex items-center justify-center gap-4 flex-wrap">
                  {savedAccounts.map((acc) => (
                    <div 
                      key={acc.email} 
                      onClick={() => selectAccount(acc)}
                      className="group relative flex flex-col items-center cursor-pointer transition-all duration-300 hover:-translate-y-1"
                    >
                       <button 
                         onClick={(e) => removeAccount(e, acc.email)}
                         className="absolute -top-1 -right-1 z-10 w-4 h-4 bg-slate-700/80 rounded-full text-slate-400 hover:text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                       >
                         <X size={10} />
                       </button>

                       <div className="w-14 h-14 rounded-full p-0.5 bg-white/10 group-hover:bg-blue-500/50 transition-colors">
                          <div className="w-full h-full rounded-full overflow-hidden bg-slate-900">
                             {acc.avatarUrl ? (
                               <img src={acc.avatarUrl} alt={acc.fullName} className="w-full h-full object-cover" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400 text-sm font-bold">
                                 {acc.fullName[0].toUpperCase()}
                               </div>
                             )}
                          </div>
                       </div>
                       <span className="text-[10px] font-medium text-slate-400 mt-2 max-w-[60px] truncate group-hover:text-white transition-colors">{acc.fullName}</span>
                    </div>
                  ))}
                </div>
             </div>
          )}

          {/* Mode B: Large Selected Avatar (QQ Style) */}
          {selectedAccount && mode === 'login' && (
             <div className="flex flex-col items-center mb-6 animate-in zoom-in-95 duration-500">
                <div className="relative w-24 h-24 mb-4">
                   <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-[20px] animate-pulse"></div>
                   <div className="relative w-full h-full rounded-full p-1 bg-gradient-to-b from-blue-400 to-purple-500 shadow-2xl">
                      <div className="w-full h-full rounded-full overflow-hidden bg-slate-900 border-2 border-[#0F1629]">
                         {selectedAccount.avatarUrl ? (
                           <img src={selectedAccount.avatarUrl} alt={selectedAccount.fullName} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-300 text-2xl font-bold">
                             {selectedAccount.fullName[0].toUpperCase()}
                           </div>
                         )}
                      </div>
                   </div>
                </div>
                <h3 className="text-xl font-bold text-white">{selectedAccount.fullName}</h3>
                <p className="text-sm text-slate-400 mt-1">{selectedAccount.email}</p>
                
                <button 
                  onClick={clearSelection}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                >
                   <ChevronLeft size={12} /> 切换账号
                </button>
             </div>
          )}

          {/* 3. Status Messages */}
          <div className="space-y-4 mb-4 min-h-[20px]">
            {successMessage && (
               <div className="p-3 text-xs flex items-center gap-2 text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in zoom-in-95">
                 <CheckCircle2 className="w-4 h-4 shrink-0" />
                 <span>{successMessage}</span>
               </div>
            )}

            {error && (
              <div className="p-3 text-xs flex items-center gap-2 text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg animate-in zoom-in-95">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* 4. Forms */}
          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {mode === 'register' && (
                <div className="group relative animate-in fade-in slide-in-from-left-2">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#1A2235] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                    placeholder="您的称呼"
                  />
                </div>
              )}

              {/* Email Input (Hidden if account selected) */}
              {(!selectedAccount || mode !== 'login') && (
                <div className="group relative animate-in fade-in slide-in-from-left-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1A2235] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                    placeholder="电子邮箱"
                  />
                </div>
              )}

              <div className="group relative animate-in fade-in slide-in-from-left-2 delay-75">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                <input
                  ref={passwordInputRef}
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1A2235] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                  placeholder="请输入密码"
                />
              </div>

              {/* Remember Me & Forgot Password Links */}
              {mode === 'login' && (
                <div className="flex items-center justify-between text-xs px-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-slate-600 bg-transparent'}`}>
                      {rememberMe && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                    />
                    记住密码
                  </label>
                  <button type="button" onClick={() => setMode('forgot-email')} className="text-slate-400 hover:text-blue-400 transition-colors">
                    忘记密码?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all duration-300 active:scale-[0.98]"
              >
                <div className="flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-base">{mode === 'login' ? '登 录' : '立即注册'}</span>}
                  {!loading && mode === 'login' && <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                  {!loading && mode !== 'login' && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </div>
              </button>
            </form>
          )}

          {/* === FORGOT PASSWORD STEP 1: SEND CODE === */}
          {mode === 'forgot-email' && (
             <form onSubmit={handleSendCode} className="space-y-5">
               <div className="group relative animate-in fade-in slide-in-from-left-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1A2235] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                    placeholder="请输入您的账号邮箱"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '发送验证码'}
                </button>
             </form>
          )}

          {/* === FORGOT PASSWORD STEP 2: VERIFY & RESET === */}
          {mode === 'forgot-verify' && (
             <form onSubmit={handleResetConfirm} className="space-y-5">
                <div className="text-center text-xs text-slate-500 mb-2">
                   已发送至 {email}
                </div>
                
                <div className="group relative animate-in fade-in slide-in-from-left-2">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    type="text"
                    required
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    className="w-full bg-[#1A2235] border border-white/10 rounded-xl py-3 pl-10 pr-24 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all tracking-widest"
                    placeholder="请输入验证码"
                    maxLength={8}
                  />
                   <button 
                     type="button"
                     disabled={countdown > 0 || loading}
                     onClick={handleSendCode}
                     className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-50 text-slate-300 transition-colors flex items-center gap-1"
                   >
                     {countdown > 0 ? (
                       <>
                         <Timer className="w-3 h-3" />
                         {countdown}s
                       </>
                     ) : (
                       '重新发送'
                     )}
                   </button>
                </div>

                <div className="group relative animate-in fade-in slide-in-from-left-2 delay-75">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#1A2235] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="设置新密码"
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '重置并登录'}
                </button>
             </form>
          )}

          {/* Bottom Switch Links */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center text-xs text-slate-400">
            {mode === 'login' ? (
              <p>
                还没有账号？
                <button onClick={handleRegisterClick} className="ml-1 text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  立即注册
                </button>
              </p>
            ) : (
              <button onClick={() => setMode('login')} className="flex items-center gap-1 hover:text-white transition-colors">
                <ChevronLeft size={14} /> 返回登录
              </button>
            )}
          </div>

          {/* Footer Security Badge */}
          <div className="mt-8 flex justify-center gap-4 opacity-30">
             <Fingerprint className="w-4 h-4" />
             <div className="h-4 w-[1px] bg-white"></div>
             <Sparkles className="w-4 h-4" />
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPanel;