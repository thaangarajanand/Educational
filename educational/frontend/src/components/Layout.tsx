import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, BookOpen, TrendingUp, User, MessageCircle, Database, Sparkles, Globe, Atom } from 'lucide-react';
import { getSelectedLanguage, setSelectedLanguage, t, Language } from '../lib/i18n';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
  session?: any;
}

export function Layout({ children, currentPage, onPageChange, session }: LayoutProps) {
  const [isGuest, setIsGuest] = useState(false);
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());

  useEffect(() => {
    try {
      const g = window.localStorage.getItem('isGuest');
      setIsGuest(g === 'true');
    } catch (e) {
      setIsGuest(false);
    }

    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };

    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  const isAdmin = session?.user?.email === 'thangaraj@gmail.com' || session?.user?.user_metadata?.admin;
  const isApiKey = session?.user?.user_metadata?.api_client;
  const showData = Boolean(isAdmin || isApiKey);

  const navigationItems = [
    { id: 'chat', nameKey: 'nav_chat', defaultName: 'Thambi Robo AI', icon: MessageCircle },
    { id: 'dashboard', nameKey: 'nav_dashboard', defaultName: 'Dashboard', icon: BookOpen },
    { id: 'simulator', nameKey: 'nav_simulator', defaultName: 'Simulator & Lab', icon: Atom },
    { id: 'quiz', nameKey: 'nav_quiz', defaultName: 'Practice', icon: Brain },
    { id: 'data', nameKey: 'nav_data', defaultName: 'Data Hub', icon: Database },
    { id: 'progress', nameKey: 'nav_progress', defaultName: 'Progress', icon: TrendingUp },
    { id: 'profile', nameKey: 'nav_profile', defaultName: 'Profile', icon: User },
  ];

  const visibleNavigation = navigationItems.filter((item) => {
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
              className="flex items-center space-x-3.5 cursor-pointer group py-1"
            >
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-sm opacity-40 group-hover:opacity-100 transition duration-300" />
                <img
                  src="/sai-elite-india-logo.png"
                  alt="Sai Elite India Educational Logo"
                  className="relative h-11 w-11 rounded-2xl bg-slate-900 object-contain p-1 border border-cyan-500/30 shadow-lg group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-tight">
                  Sai Elite India <span className="gradient-text-cyan font-heading font-black">Educational</span>
                </h1>
                <p className="text-[10px] sm:text-[11px] font-bold text-cyan-400/90 tracking-widest uppercase flex items-center gap-1 mt-0.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" /> {t('nav_subtitle', currentLang, 'AI Learning Platform')}
                </p>
              </div>
            </div>

            {/* Language Switcher & Navigation Bar */}
            <div className="flex items-center space-x-3">
              {/* Multilingual Selector Pill (English, Tamil, Hindi) */}
              <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 backdrop-blur-md">
                <Globe className="w-3.5 h-3.5 text-cyan-400 ml-1.5 mr-0.5" />
                <button
                  onClick={() => setSelectedLanguage('en')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    currentLang === 'en' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setSelectedLanguage('ta')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    currentLang === 'ta' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  தமிழ்
                </button>
                <button
                  onClick={() => setSelectedLanguage('hi')}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    currentLang === 'hi' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  हिंदी
                </button>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800/90 backdrop-blur-xl shadow-xl">
                {visibleNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  const translatedName = t(item.nameKey, currentLang, item.defaultName);
                  return (
                    <button
                      key={item.id}
                      onClick={() => onPageChange(item.id)}
                      className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
                        isActive
                          ? 'text-cyan-300 bg-gradient-to-r from-cyan-950 to-slate-900 border border-cyan-500/50 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
                      {translatedName}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Guest Mode Indicator */}
      {isGuest && (
        <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/30 text-amber-200 text-xs py-2 px-4 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              {t('guest_banner', currentLang, 'Browsing in Guest Mode — Create an account to sync progress to cloud database.')}
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
              {t('sign_in', currentLang, 'Sign In')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <motion.div
          key={`${currentPage}-${currentLang}`}
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
            const translatedName = t(item.nameKey, currentLang, item.defaultName);
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-all ${
                  isActive ? 'text-cyan-400 font-bold' : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-500'}`} />
                {translatedName}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
