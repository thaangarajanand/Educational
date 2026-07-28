import { motion } from 'framer-motion';
import { TrendingUp, Award, Target, BookOpen, Brain, Zap, Sparkles, Flame } from 'lucide-react';
import { Subject, User } from '../types';
import { SubjectCard } from './SubjectCard';

interface DashboardProps {
  user: User;
  subjects: Subject[];
  onSubjectSelect: (subject: Subject) => void;
}

export function Dashboard({ user, subjects, onSubjectSelect }: DashboardProps) {
  const weakSubjects = subjects.filter(s => s.weaknessLevel === 'high' || s.weaknessLevel === 'medium');
  const strongSubjects = subjects.filter(s => s.weaknessLevel === 'low');
  const totalQuizzes = subjects.reduce((total, subject) => total + subject.totalQuizzesTaken, 0);
  const avgScore = Math.round(subjects.reduce((total, subject) => total + subject.averageScore, 0) / (subjects.length || 1));

  return (
    <div className="space-y-8">
      {/* 2050 Cyber Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/80 border border-slate-800 shadow-2xl"
      >
        {/* Glow Ambient Lights */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-500/20 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> AI Student Command Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight">
              Welcome back, <span className="gradient-text-cyan">{user.name}</span>! 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Track real-time learning metrics, practice priority weak areas, and consult Thambi Robo for instant step-by-step guidance.
            </p>
          </div>

          {/* Gamification Stats Badge */}
          <div className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
            <div className="flex items-center gap-3 px-3 py-1">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{user.streak} Days</div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Streak</div>
              </div>
            </div>

            <div className="w-px h-10 bg-slate-800" />

            <div className="flex items-center gap-3 px-3 py-1">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white">{user.totalPoints} pts</div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total XP</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

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