import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, ArrowRight, HelpCircle, Lightbulb, Compass, Cpu, Mic, Trophy, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface PainPoint {
  id: string;
  problem: string;
  solution: string;
  icon: any;
  actionText: string;
  gradient: string;
  badge: string;
}

export function PainPointsGuide({ onSelectAction }: { onSelectAction?: (actionId: string) => void }) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const painPoints: PainPoint[] = [
    {
      id: 'formula',
      problem: 'Hard to understand complex math & physics equations step-by-step?',
      solution: 'Use our AI Step-by-Step Formula Solver to derive LaTeX proofs, velocity equations, and kinetic breakdowns instantly!',
      icon: Lightbulb,
      actionText: '⚡ Open AI Formula Solver',
      gradient: 'from-amber-500/20 to-orange-500/20 border-amber-500/40 text-amber-300',
      badge: 'Step-by-Step Math'
    },
    {
      id: 'simulation',
      problem: 'Textbooks are abstract & difficult to visualize in 3D real life?',
      solution: 'Launch our 7 Interactive 3D Real-Time Simulators (Drone Aerodynamics, 3-Joint Robotic Arm, Neural Nets, & LiDAR Autonomous Vehicles)!',
      icon: Cpu,
      actionText: '🧪 Launch 3D Simulators',
      gradient: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/40 text-cyan-300',
      badge: '3D Visual Learning'
    },
    {
      id: 'viva',
      problem: 'Lack confidence or get nervous during oral viva exams & interview questions?',
      solution: 'Practice spoken oral exam questions with Thambi Robo AI Voice Viva Counselor in English, Tamil, or Hindi with real-time scoring out of 10!',
      icon: Mic,
      actionText: '🎙️ Start AI Voice Viva',
      gradient: 'from-purple-500/20 to-indigo-500/20 border-purple-500/40 text-purple-300',
      badge: 'Oral Exam Mastery'
    },
    {
      id: 'quiz_battle',
      problem: 'Studying alone feels tedious, lonely, and unmotivating?',
      solution: 'Enter the 1v1 Multiplayer STEM Speed Quiz Battle arena and match live against AI Challenger Bots in 60-second rapid matches!',
      icon: Trophy,
      actionText: '⚔️ Enter 1v1 Speed Battle',
      gradient: 'from-rose-500/20 to-pink-500/20 border-rose-500/40 text-rose-300',
      badge: '1v1 Gamified Battle'
    },
    {
      id: 'report',
      problem: 'Need official proof of your progress for parents, teachers, or employers?',
      solution: 'Generate printable Parent/Teacher PDF Progress Reports and formal STEM Excellence Academic Certificates with 1-click!',
      icon: ShieldCheck,
      actionText: '🎓 Generate Certificate',
      gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/40 text-emerald-300',
      badge: 'Verified Certification'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-2xl text-black font-bold shadow-lg shadow-cyan-500/30">
            <Compass className="w-6 h-6 animate-spin" style={{ animationDuration: '12s' }} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Student Pain Point & Solution Center
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">How Sai Elite India Solves Your Learning Challenges</h2>
          </div>
        </div>
      </div>

      {/* Interactive Pain Points Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {painPoints.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02, translateY: -4 }}
              className={`p-5 rounded-2xl border bg-slate-950/80 backdrop-blur-xl flex flex-col justify-between space-y-4 shadow-xl ${item.gradient}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-white">
                    {item.badge}
                  </span>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-rose-300 flex items-start gap-1.5 leading-snug">
                    <HelpCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <span>{item.problem}</span>
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline mr-1" />
                    {item.solution}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  toast.success(`Opening ${item.badge}...`);
                  if (onSelectAction) onSelectAction(item.id);
                }}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-between transition-all group shadow-md"
              >
                <span>{item.actionText}</span>
                <ArrowRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
