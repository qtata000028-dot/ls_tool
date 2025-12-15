import React, { useEffect, useState } from 'react';
import { supabase } from './src/services/supabaseClient';
import { dataService } from './src/services/dataService';
import Background from './src/components/Background';
import Navbar from './src/components/Navbar';
import LoginPanel from './src/components/LoginPanel';
import Dashboard from './src/components/Dashboard';
import KnowledgeBase from './src/components/KnowledgeBase';
import ToolsPlatform from './src/components/ToolsPlatform';
import AIRecon from './src/components/AIRecon'; 
import AISprite from './src/components/AISprite'; 
import { User } from '@supabase/supabase-js';
import { Announcement, Profile } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [aiParams, setAiParams] = useState<any>(null); // NEW: Store params from AI Sprite

  const fetchProfile = async (userId: string) => {
    const userProfile = await dataService.getUserProfile(userId);
    setProfile(userProfile);
  };

  const forceLogout = async () => {
    try {
      localStorage.removeItem('supabase.auth.token');
      for (const key in localStorage) {
        if (key.startsWith('sb-')) localStorage.removeItem(key);
      }
      await supabase.auth.signOut();
    } catch (e) {
    } finally {
      setUser(null);
      setProfile(null);
      setCurrentView('dashboard');
    }
  };

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || JSON.stringify(event.reason) || "";
      if (typeof msg === 'string' && (msg.includes("Refresh Token") || msg.includes("refresh_token_not_found") || msg.includes("JWT expired"))) {
        event.preventDefault(); 
        forceLogout();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
           if (error.message.includes("Refresh Token") || error.message.includes("refresh_token_not_found")) {
             await forceLogout();
           }
        } else {
          setUser(session?.user ?? null);
          if (session?.user) fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error("Auth init failed:", err);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        setCurrentView('dashboard');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
      }
    });

    const fetchData = async () => {
      const activeAnnouncements = await dataService.getActiveAnnouncements();
      setAnnouncements(activeAnnouncements);
    };
    fetchData();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCurrentView('dashboard');
  };

  // Updated Navigation Handler to accept params
  const handleNavigate = (view: string, params?: any) => {
    setCurrentView(view);
    if (params) {
       setAiParams(params);
    } else {
       setAiParams(null); // Clear params if simple navigation
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative z-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <Background />
      
      {!user ? (
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <LoginPanel onSuccess={() => {}} />
        </div>
      ) : (
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar
            user={user} 
            profile={profile}
            onOpenAuth={() => {}} 
            onLogout={handleLogout}
          />

          <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pt-24 sm:pt-28 flex flex-col gap-6 max-w-6xl mx-auto w-full">
            {currentView === 'dashboard' && (
              <Dashboard
                user={user}
                profile={profile} 
                announcements={announcements}
                onProfileUpdate={() => user && fetchProfile(user.id)} 
                onNavigate={handleNavigate}
              />
            )}
            
            {currentView === 'knowledge' && (
              <KnowledgeBase onBack={() => setCurrentView('dashboard')} />
            )}

            {currentView === 'tools' && (
              <ToolsPlatform 
                 onBack={() => setCurrentView('dashboard')} 
                 aiParams={aiParams} // Pass params to tools
              />
            )}

            {currentView === 'vision' && (
              <AIRecon onBack={() => setCurrentView('dashboard')} />
            )}
          </main>

          <AISprite onNavigate={handleNavigate} />
        </div>
      )}
    </div>
  );
};

export default App;