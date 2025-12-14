import React from 'react';
import { LogOut, Bell, Settings } from 'lucide-react';
import { APP_NAME, APP_LOGO } from '../constants';
import { User } from '@supabase/supabase-js';
import { Profile } from '../../types';

interface NavbarProps {
  user: User | null;
  profile?: Profile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, profile, onLogout }) => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020617]/60 backdrop-blur-md border-b border-white/5">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Left: Brand */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-transform group-hover:rotate-12">
               <img src={APP_LOGO} alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            </div>
            <span className="text-base sm:text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">
              {APP_NAME}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {user && (
              <>
                <button className="hidden sm:inline-flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all relative group">
                  <Bell size={18} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#020617]"></span>
                </button>

                <button className="hidden sm:inline-flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all">
                  <Settings size={18} />
                </button>

                <div className="hidden sm:block h-4 w-[1px] bg-white/10 mx-1"></div>

                <div className="flex items-center gap-3">
                   {/* Minimal Avatar just for context */}
                   <div className="h-8 w-8 rounded-full border border-white/10 overflow-hidden bg-slate-800 ring-2 ring-transparent hover:ring-blue-500/50 transition-all">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                          {profile?.full_name?.[0] || 'U'}
                        </div>
                      )}
                   </div>
                </div>

                <button 
                  onClick={onLogout}
                  className="ml-2 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
                  title="退出登录"
                >
                  <LogOut size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;