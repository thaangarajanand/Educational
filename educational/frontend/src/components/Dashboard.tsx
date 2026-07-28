import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, Target, BookOpen, Brain, Zap, Sparkles, Flame, CheckCircle, ShieldCheck, Play, Pause, RotateCcw } from 'lucide-react';
import { Subject, User, DailyQuest } from '../types';
import { SubjectCard } from './SubjectCard';
import { STEMSimulator } from './STEMSimulator';
import toast from 'react-hot-toast';
import { getSelectedLanguage, t, Language } from '../lib/i18n';

interface DashboardProps {
  user: User;
  subjects: Subject[];
  onSubjectSelect: (subject: Subject) => void;
}

export function Dashboard({ user, subjects, onSubjectSelect }: DashboardProps) {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());

  React.useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  const weakSubjects = subjects.filter(s => s.weaknessLevel === 'high' || s.weaknessLevel === 'medium');
  const strongSubjects = subjects.filter(s => s.weaknessLevel === 'low');
  const totalQuizzes = subjects.reduce((total, subject) => total + subject.totalQuizzesTaken, 0);
  const avgScore = Math.round(subjects.reduce((total, subject) => total + subject.averageScore, 0) / (subjects.length || 1));

  // Rank Calculation
  const getRankInfo = (pts: number) => {
    if (pts < 300) return { level: 1, title: 'Junior Cadet', nextXp: 300, color: 'text-cyan-400', badgeBg: 'bg-cyan-500/20' };
    if (pts < 800) return { level: 2, title: 'AI Explorer', nextXp: 800, color: 'text-purple-400', badgeBg: 'bg-purple-500/20' };
    if (pts < 1500) return { level: 3, title: 'STEM Prodigy', nextXp: 1500, color: 'text-amber-400', badgeBg: 'bg-amber-500/20' };
    if (pts < 3000) return { level: 4, title: 'Robotics Specialist', nextXp: 3000, color: 'text-emerald-400', badgeBg: 'bg-emerald-500/20' };
    return { level: 5, title: 'Master Scholar', nextXp: 5000, color: 'text-pink-400', badgeBg: 'bg-pink-500/20' };
  };

  const rank = getRankInfo(user.totalPoints);
  const progressToNextRank = Math.min(100, Math.round((user.totalPoints / rank.nextXp) * 100));

  // Daily Quests State
  const [quests, setQuests] = useState<DailyQuest[]>([
    {
      id: 'q1',
      title: 'Practice Challenge',
      description: 'Complete 1 STEM practice test today',
      xpReward: 100,
      progress: totalQuizzes > 0 ? 1 : 0,
      target: 1,
      completed: totalQuizzes > 0,
      icon: '🎯',
    },
    {
      id: 'q2',
      title: 'Robo Mentor Consult',
      description: 'Ask Thambi Robo 2 study questions',
      xpReward: 50,
      progress: 2,
      target: 2,
      completed: true,
      icon: '🤖',
    },
    {
      id: 'q3',
      title: 'Streak Master',
      description: 'Maintain 3+ consecutive active streak days',
      xpReward: 150,
      progress: user.streak,
      target: 3,
      completed: user.streak >= 3,
      icon: '🔥',
    },
  ]);

  // Pomodoro Study Timer State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
      toast.success('🎉 25-Minute Study Session Completed! Take a 5-minute break.');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(25 * 60);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const claimQuestXp = (questId: string) => {
    setQuests(prev => prev.map(q => q.id === questId ? { ...q, completed: true } : q));
    toast.success('🎉 XP Claimed! Keep up the great work!');
  };

  return (
    <div className="space-y-8">
      {/* 2050 Cyber Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/80 border border-slate-800 shadow-2xl"
      >
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-500/20 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> {t('command_center', currentLang, 'AI Student Command Center')}
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight">
              {t('welcome_back', currentLang, 'Welcome back')}, <span className="gradient-text-cyan">{user.name}</span>! 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              {t('welcome_sub', currentLang, 'Track real-time learning metrics, practice priority weak areas, and consult Thambi Robo for instant step-by-step guidance.')}
            </p>

            {/* Student Level & Title Progress */}
            <div className="mt-4 flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-bold border border-cyan-500/30 ${rank.badgeBg} ${rank.color}`}>
                {t(`rank_level_${rank.level}`, currentLang, `Level ${rank.level} • ${rank.title}`)}
              </div>
              <div className="w-48 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                <div className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressToNextRank}%` }} />
              </div>
              <span className="text-xs text-slate-400 font-medium">{user.totalPoints} / {rank.nextXp} XP</span>
            </div>
          </div>

          {/* Gamification Stats Badge */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{user.streak} Days</div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t('active_streak', currentLang, 'Active Streak')}</div>
              </div>
            </div>

            <div className="w-px h-10 bg-slate-800" />

            <div className="flex items-center gap-3 px-3 py-1">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{user.totalPoints} pts</div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t('total_xp', currentLang, 'Total XP')}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Daily Quests & Pomodoro Study Timer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Quests Panel (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" /> {t('daily_quests_title', currentLang, 'Daily Quests & XP Rewards')}
            </h2>
            <span className="text-xs text-cyan-400 font-semibold bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-500/30">
              {t('resets_daily', currentLang, 'Resets Daily')}
            </span>
          </div>

          <div className="space-y-3">
            {quests.map((q) => (
              <div key={q.id} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl p-2 bg-slate-800 rounded-xl">{q.icon}</div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{q.title}</h4>
                    <p className="text-xs text-slate-400">{q.description}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }} />
                      </div>
                      <span className="text-[11px] text-slate-400 font-semibold">{q.progress}/{q.target}</span>
                    </div>
                  </div>
                </div>

                <div>
                  {q.completed ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-xl border border-emerald-500/30">
                      <CheckCircle className="w-4 h-4" /> +{q.xpReward} XP
                    </div>
                  ) : (
                    <button
                      onClick={() => claimQuestXp(q.id)}
                      className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-colors shadow-md"
                    >
                      {t('claim_xp', currentLang, 'Claim XP')} +{q.xpReward} XP
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pomodoro Focus Timer Panel (1 Col) */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white font-heading flex items-center gap-2">
                {t('pomodoro_title', currentLang, '⏱️ Pomodoro Study Focus')}
              </h2>
            </div>
            <p className="text-xs text-slate-400">{t('pomodoro_sub', currentLang, 'Boost focus with timed 25-minute learning sessions.')}</p>
          </div>

          <div className="text-center py-4 bg-slate-900/80 rounded-2xl border border-slate-800">
            <div className="text-4xl font-extrabold text-cyan-400 font-mono tracking-wider">
              {formatTimer(timerSeconds)}
            </div>
            <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">
              {isTimerRunning ? t('timer_active', currentLang, '⚡ Focus Session Active') : t('timer_paused', currentLang, 'Paused / Ready')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTimer}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors ${
                isTimerRunning
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
              }`}
            >
              {isTimerRunning ? <><Pause className="w-4 h-4" /> {t('btn_pause_focus', currentLang, 'Pause Session')}</> : <><Play className="w-4 h-4" /> {t('btn_start_focus', currentLang, 'Start Focus')}</>}
            </button>

            <button
              onClick={resetTimer}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center space-x-4"
        >
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Strong Mastery</p>
            <p className="text-2xl font-bold text-white mt-0.5">{strongSubjects.length} Subjects</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center space-x-4"
        >
          <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Priority Practice</p>
            <p className="text-2xl font-bold text-white mt-0.5">{weakSubjects.length} Subjects</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center space-x-4"
        >
          <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quizzes Completed</p>
            <p className="text-2xl font-bold text-white mt-0.5">{totalQuizzes} Tests</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center space-x-4"
        >
          <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overall Accuracy</p>
            <p className="text-2xl font-bold text-white mt-0.5">{avgScore}%</p>
          </div>
        </motion.div>
      </div>

      {/* 3D Interactive STEM Simulator Lab */}
      <STEMSimulator />

      {/* Priority Practice Areas */}
      {weakSubjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <div className="flex items-center space-x-2 text-rose-400 font-heading">
            <Zap className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl font-bold text-white">Priority Focus Areas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weakSubjects.map((subject, index) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <SubjectCard
                  subject={subject}
                  onClick={() => onSubjectSelect(subject)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* All Subjects Command Catalog */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="space-y-4"
      >
        <div className="flex items-center space-x-2 font-heading">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <h2 className="text-xl font-bold text-white">Curriculum Subjects</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.05 }}
            >
              <SubjectCard subject={subject} onClick={() => onSubjectSelect(subject)} />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}