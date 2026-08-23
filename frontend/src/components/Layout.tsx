import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, BookOpen, TrendingUp, User, MessageCircle, Database, Sparkles, Globe, Atom, GraduationCap, Menu, X, ChevronRight } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
  const isSuperAdmin = session?.user?.email === 'andrewsharrington@gmail.com' || session?.user?.user_metadata?.superAdmin;
  const isApiKey = session?.user?.user_metadata?.api_client;
  const showData = Boolean(isAdmin || isSuperAdmin || isApiKey);

  const navigationItems = [
    { id: 'chat', nameKey: 'nav_chat', defaultName: 'Thambi Robo AI', icon: MessageCircle },
    { id: 'lms', nameKey: 'nav_lms', defaultName: 'LMS Portal', icon: GraduationCap },
    { id: 'dashboard', nameKey: 'nav_dashboard', defaultName: 'Dashboard', icon: BookOpen },
    { id: 'simulator', nameKey: 'nav_simulator', defaultName: 'Simulator & Lab', icon: Atom },
    { id: 'quiz', nameKey: 'nav_quiz', defaultName: 'Practice', icon: Brain },
    { id: 'data', nameKey: 'nav_data', defaultName: 'Data Hub', icon: Database },
    { id: 'surprise', nameKey: 'nav_surprise', defaultName: 'Surprise', icon: Sparkles },
    { id: 'progress', nameKey: 'nav_progress', defaultName: 'Progress', icon: TrendingUp },
    { id: 'profile', nameKey: 'nav_profile', defaultName: 'Profile', icon: User },
  ];

  const visibleNavigation = navigationItems.filter((item) => {
    if (item.id === 'data') {
      return showData;
    }
    if (item.id === 'surprise') {
      return isSuperAdmin;
    }
    return true;
  });

  const handleNavClick = (id: string) => {
    onPageChange(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-x-hidden font-sans selection:bg-cyan-500 selection:text-white">
      {/* 2050 Ambient Background Lighting Orbs */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-1/3 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed -bottom-40 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Cyber Glass Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo Brand */}
            <div 
              onClick={() => handleNavClick('chat')}
              className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group py-1 flex-shrink-0"
            >
              <div className="relative flex-shrink-0">
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-sm opacity-40 group-hover:opacity-100 transition duration-300" />
                <img
                  src="/sai-elite-india-logo.png"
                  alt="Sai Elite India Educational Logo"
                  className="relative h-9 w-9 sm:h-11 sm:w-11 rounded-2xl bg-slate-900 object-contain p-1 border border-cyan-500/30 shadow-lg group-hover:scale-105 transition-transform"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight text-white whitespace-nowrap leading-none">
                  Sai Elite India <span className="gradient-text-cyan font-heading font-black ml-0.5">Educational</span>
                </h1>
                <p className="text-[9px] sm:text-[11px] font-bold text-cyan-400/90 tracking-widest uppercase flex items-center gap-1 mt-1 whitespace-nowrap">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-400 flex-shrink-0" /> {t('nav_subtitle', currentLang, 'AI Learning Platform')}
                </p>
              </div>
            </div>

            {/* Language Switcher & Navigation Bar */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Multilingual Selector Pill (English, Tamil, Hindi) */}
              <div className="flex items-center space-x-0.5 sm:space-x-1 bg-slate-900/80 p-0.5 sm:p-1 rounded-xl border border-slate-800 backdrop-blur-md">
                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 ml-1 mr-0.5 hidden xs:inline-block" />
                <button
                  onClick={() => setSelectedLanguage('en')}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors ${
                    currentLang === 'en' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setSelectedLanguage('ta')}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors ${
                    currentLang === 'ta' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  தமிழ்
                </button>
                <button
                  onClick={() => setSelectedLanguage('hi')}
                  className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition-colors ${
                    currentLang === 'hi' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  हिंदी
                </button>
              </div>

              {/* Log Out Button */}
              {session && (
                <button
                  onClick={async () => {
                    try {
                      const { supabaseClient } = await import('../lib/supabase');
                      await supabaseClient.auth.signOut();
                    } catch (e) {
                      // ignore
                    }
                    try {
                      window.localStorage.removeItem('isGuest');
                      window.sessionStorage.removeItem('isGuest');
                      window.localStorage.removeItem('studymentor-user');
                      window.localStorage.removeItem('studymentor_backend_token');
                      window.sessionStorage.removeItem('studymentor_backend_token');
                    } catch (e) {}
                    window.location.reload();
                  }}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
                  title="Sign Out"
                >
                  <span className="hidden sm:inline">Sign Out</span>
                  <span className="sm:hidden">Exit</span>
                </button>
              )}

              {/* Mobile Hamburger Drawer Toggle Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white focus:outline-none"
                aria-label="Toggle Navigation Menu"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5 text-cyan-400" />}
              </button>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800/90 backdrop-blur-xl shadow-xl">
                {visibleNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  const translatedName = t(item.nameKey, currentLang, item.defaultName);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`relative px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 ${
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

      {/* Mobile Navigation Drawer Sheet (Slides down when hamburger is tapped) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden sticky top-16 z-40 bg-slate-950/95 border-b border-slate-800/90 backdrop-blur-2xl px-4 py-4 shadow-2xl overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                const translatedName = t(item.nameKey, currentLang, item.defaultName);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-lg'
                        : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span>{translatedName}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest Mode Indicator */}
      {isGuest && (
        <div className="bg-gradient-to-r from-amber-950/90 via-amber-900/80 to-amber-950/90 border-b border-amber-500/30 text-amber-200 text-xs py-2 px-3 sm:px-4 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col xs:flex-row justify-between items-center gap-2">
            <div className="flex items-center gap-2 font-medium text-[11px] sm:text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping flex-shrink-0" />
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
              className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-200 hover:text-black font-semibold rounded-lg border border-amber-500/40 transition-colors text-[11px] sm:text-xs flex-shrink-0"
            >
              {t('sign_in', currentLang, 'Sign In')}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20 md:pb-6 relative z-10">
        <motion.div
          key={`${currentPage}-${currentLang}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </main>

      {/* Horizontal Touch Dock for Mobile Devices (< 768px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-2xl py-1.5 px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-1 py-0.5">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            const translatedName = t(item.nameKey, currentLang, item.defaultName);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex-shrink-0 flex flex-col items-center py-1 px-3 rounded-xl text-[10px] font-medium transition-all ${
                  isActive ? 'bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-cyan-400 scale-110' : 'text-slate-400'}`} />
                <span className="whitespace-nowrap">{translatedName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

