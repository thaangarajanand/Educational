import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BookOpen, ArrowRight } from 'lucide-react';
import { Subject } from '../types';
import { getSelectedLanguage, t, Language } from '../lib/i18n';

interface SubjectCardProps {
  subject: Subject;
  onClick: () => void;
  className?: string;
}

export function SubjectCard({ subject, onClick, className = '' }: SubjectCardProps) {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());

  useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  const getWeaknessBadge = () => {
    switch (subject.weaknessLevel) {
      case 'high':
        return {
          text: t('priority_focus_areas', currentLang, 'Priority Focus'),
          icon: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        };
      case 'medium':
        return {
          text: 'Improving',
          icon: <Minus className="w-3.5 h-3.5 text-amber-400" />,
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        };
      case 'low':
        return {
          text: t('strong_mastery', currentLang, 'Strong Mastery'),
          icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        };
      default:
        return {
          text: 'Not Assessed',
          icon: <BookOpen className="w-3.5 h-3.5 text-slate-400" />,
          badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
        };
    }
  };

  const badge = getWeaknessBadge();

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-card p-6 rounded-2xl border border-slate-800/80 cursor-pointer relative overflow-hidden group shadow-xl hover:shadow-cyan-500/10 ${className}`}
    >
      {/* Top Accent Gradient Border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3.5 rounded-xl bg-slate-800/90 border border-slate-700 text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
            {subject.icon}
          </div>
          <div>
            <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors font-heading">
              {subject.name}
            </h3>
            <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.badgeClass}`}>
              {badge.icon}
              <span>{badge.text}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs pt-2">
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
          <p className="text-slate-400 font-medium">{t('quizzes_taken', currentLang, 'Quizzes Taken')}</p>
          <p className="text-lg font-bold text-white mt-0.5">{subject.totalQuizzesTaken}</p>
        </div>
        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
          <p className="text-slate-400 font-medium">{t('avg_accuracy', currentLang, 'Avg Accuracy')}</p>
          <p className="text-lg font-bold text-cyan-400 mt-0.5">{subject.averageScore}%</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          {subject.lastQuizScore !== undefined ? `Last: ${subject.lastQuizScore}%` : 'Ready'}
        </span>
        <button className="text-cyan-400 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          {t('start_quiz', currentLang, 'Start Quiz')} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}