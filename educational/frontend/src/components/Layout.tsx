import React, { useEffect, useState } from 'react';
// ...existing imports...
import { motion } from 'framer-motion';
import { Brain, BookOpen, TrendingUp, User, MessageCircle, Database } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
  session?: any;
}

const navigation = [
  { id: 'chat', name: 'Thambi Robo', icon: MessageCircle },
  { id: 'dashboard', name: 'Dashboard', icon: BookOpen },
  { id: 'quiz', name: 'Practice', icon: Brain },
  { id: 'data', name: 'Data', icon: Database },
  { id: 'progress', name: 'Progress', icon: TrendingUp },
  { id: 'profile', name: 'Profile', icon: User },
];

export function Layout({ children, currentPage, onPageChange, session }: LayoutProps) {
  const [isGuest, setIsGuest] = useState(false);
  // theme toggle removed from header

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

  const visibleNavigation = navigation.filter(item => {
    if (item.id === 'data') {
      return showData;
    }
    return true;
  });
  return (
  <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
  <header className="bg-white/60 dark:bg-black/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img
                src="/sai-elite-india-logo.png"
                alt="Sai Elite India Educational logo"
                className="h-11 w-11 rounded-lg bg-black object-contain p-1"
              />
              <div>
                <h1 className="text-xl font-bold text-black dark:text-white">Sai Elite India Educational</h1>
                <p className="text-xs text-gray-600 dark:text-gray-300">Learning Platform</p>
              </div>
            </div>
            {/* removed theme toggle per request */}
            <div className="flex items-center space-x-3">
              {/* keep space for potential header actions */}
            </div>
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-1">
              {visibleNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onPageChange(item.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            currentPage === item.id
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
              : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-300 dark:hover:bg-black/20'
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-2" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Guest banner */}
      {isGuest && (
        <div className="bg-yellow-50 border-b border-yellow-200 text-yellow-800 py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div>
              You are browsing as a Guest. Progress won't be saved to the cloud. Create an account to sync your progress.
            </div>
            <div className="flex items-center space-x-3">
               <button
                 onClick={() => {
                   try { window.localStorage.removeItem('isGuest'); window.localStorage.removeItem('studymentor-user'); } catch (e) {}
                   window.location.href = '/';
                 }}
                 className="px-3 py-1 bg-black text-yellow-300 rounded border border-yellow-700"
               >Sign out</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 px-4 py-2">
        <div className="flex justify-around">
          {visibleNavigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex flex-col items-center py-2 px-3 text-xs ${
                  currentPage === item.id
                    ? 'text-blue-600'
                    : 'text-gray-500'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${
                  currentPage === item.id ? 'text-blue-600' : 'text-gray-400'
                }`} />
                {item.name}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
