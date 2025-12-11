import React, { useEffect, useState } from 'react';
import { supabase } from './src/services/supabaseClient';
import { dataService } from './src/services/dataService';
import Background from './src/components/Background';
import Navbar from './src/components/Navbar';
import LoginPanel from './src/components/LoginPanel';
import Dashboard from './src/components/Dashboard';
import KnowledgeBase from './src/components/KnowledgeBase';
import ToolsPlatform from './src/components/ToolsPlatform'; // Import the new component
import { User } from '@supabase/supabase-js';
import { Announcement, Profile } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'knowledge' | 'tools' | 'learning'

  // Function to refresh profile (e.g., after avatar upload)
  const fetchProfile = async (userId: string) => {
    const userProfile = await dataService.getUserProfile(userId);
    setProfile(userProfile);
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setCurrentView('dashboard'); // Reset view on logout
      }
    });

    // 3. Fetch public data
    const fetchData = async () => {
      const activeAnnouncements = await dataService.getActiveAnnouncements();
      setAnnouncements(activeAnnouncements);
    };
    fetchData();

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNavigate = (view: string) => {
    // Simple routing logic.
    if (view === 'knowledge') {
      setCurrentView('knowledge');
    } else if (view === 'tools') {
      setCurrentView('tools'); // Navigate to tools
    } else if (view === 'learning') {
       alert("模块开发中...");
       return; 
    } else {
      setCurrentView('dashboard');
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
        // GUEST VIEW: Centered Login Panel
        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-4">
          <LoginPanel onSuccess={() => {/* Auth state change handles redirect */}} />
        </div>
      ) : (
        // AUTHENTICATED VIEW
        <div className="relative z-10 flex flex-col min-h-screen">
          <Navbar 
            user={user} 
            profile={profile}
            onOpenAuth={() => {}} 
            onLogout={handleLogout} 
          />
          
          <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10 pt-28 flex flex-col">
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
              <ToolsPlatform onBack={() => setCurrentView('dashboard')} />
            )}
          </main>
        </div>
      )}
    </div>
  );
};

export default App;
