import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, BookOpen, TrendingUp, User, MessageCircle, Database, Sparkles } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
  session?: any;
}

const navigation = [
  { id: 'chat', name: 'Thambi Robo AI', icon: MessageCircle },
  { id: 'dashboard', name: 'Dashboard', icon: BookOpen },
  { id: 'quiz', name: 'Practice', icon: Brain },
  { id: 'data', name: 'Data Hub', icon: Database },
  { id: 'progress', name: 'Progress', icon: TrendingUp },
  { id: 'profile', name: 'Profile', icon: User },
];

export function Layout({ children, currentPage, onPageChange, session }: LayoutProps) {
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    try {
      const g = window.localStorage.getItem('isGuest');
      setIsGuest(g === 'true');
    } catch (e) {
      setIsGuest(false);
    }
  }, []);

  const isAdmin = session?.user?.email === 'thangaraj@gmail.com' || session?.user?.user_metadata?.admin;
  const isApiKey = session?.user?.user_metadata?.api_client;
  const showData = Boolean(isAdmin || isApiKey);

  const visibleNavigation = navigation.filter((item) => {
    if (item.id === 'data') {
      return showData;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* 2050 Ambient Background Lighting Orbs */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/3 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-40 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Cyber Glass Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo Brand */}
            <div 
              onClick={() => onPageChange('chat')}
              className="flex items-center space-x-3 cursor-pointer group"
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-300" />
                <img
                  src="/sai-elite-india-logo.png"
                  alt="Sai Elite India Educational Logo"
                  className="relative h-10 w-10 rounded-xl bg-slate-900 object-contain p-1 border border-slate-700/80 shadow-inner"
                />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  Sai Elite India <span className="gradient-text-cyan font-heading">Educational</span>
                </h1>
                <p className="text-[11px] font-medium text-cyan-400/80 tracking-wider uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" /> AI Learning Platform
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1.5 bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onPageChange(item.id)}
                    className={`relative px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${
                      isActive
                        ? 'text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Guest Mode Indicator */}
      {isGuest && (
        <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/30 text-amber-200 text-xs py-2 px-4 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Browsing in Guest Mode — Create an account to sync progress to cloud database.
            </div>
            <button
              onClick={() => {
                try {
                  window.localStorage.removeItem('isGuest');
                  window.localStorage.removeItem('studymentor-user');
                } catch (e) {}
                window.location.href = '/';
              }}
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-black font-semibold rounded-lg border border-amber-500/40 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-xl px-2 py-1.5 z-50">
        <div className="flex justify-around items-center">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-all ${
                  isActive ? 'text-cyan-400 font-bold' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-500'}`} />
                {item.name}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
