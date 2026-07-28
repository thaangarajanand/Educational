import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, Zap, Clock, ShieldAlert, Check, X, RotateCcw } from 'lucide-react';
import { getSelectedLanguage, t, Language } from '../lib/i18n';
import toast from 'react-hot-toast';

interface BattleQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
}

const battleQuestions: Record<Language, BattleQuestion[]> = {
  en: [
    { id: 1, question: 'What is the acceleration due to gravity on Earth?', options: ['9.81 m/s²', '5.4 m/s²', '12.1 m/s²', '3.2 m/s²'], correct: 0 },
    { id: 2, question: 'What unit measures electrical resistance?', options: ['Amperes', 'Volts', 'Ohms (Ω)', 'Watts'], correct: 2 },
    { id: 3, question: 'Which force pulls objects toward Earth center?', options: ['Friction', 'Gravity', 'Magnetism', 'Thrust'], correct: 1 },
    { id: 4, question: 'What is the derivative of x² with respect to x?', options: ['x', '2x', 'x³', '2'], correct: 1 },
  ],
  ta: [
    { id: 1, question: 'பூமியில் புவிஈர்ப்பு முடுக்கம் எவ்வளவு?', options: ['9.81 m/s²', '5.4 m/s²', '12.1 m/s²', '3.2 m/s²'], correct: 0 },
    { id: 2, question: 'மின் தடையை அளவிடும் அலகு எது?', options: ['ஆம்பியர்', 'வோல்ட்', 'ஓம் (Ω)', 'வாட்'], correct: 2 },
    { id: 3, question: 'பொருள்களை பூமி மையத்தை நோக்கி இழுக்கும் விசை எது?', options: ['உராய்வு', 'புவிஈர்ப்பு', 'காந்தவியல்', 'உந்துவிசை'], correct: 1 },
    { id: 4, question: 'x²-ன் வகைக்கெழு என்ன?', options: ['x', '2x', 'x³', '2'], correct: 1 },
  ],
  hi: [
    { id: 1, question: 'पृथ्वी पर गुरुत्वाकर्षण के कारण त्वरण कितना है?', options: ['9.81 m/s²', '5.4 m/s²', '12.1 m/s²', '3.2 m/s²'], correct: 0 },
    { id: 2, question: 'विद्युत प्रतिरोध को किस इकाई में मापा जाता है?', options: ['एम्पीयर', 'वोल्ट', 'ओम (Ω)', 'वाट'], correct: 2 },
    { id: 3, question: 'कौन सा बल वस्तुओं को पृथ्वी के केंद्र की ओर खींचता है?', options: ['घर्षण', 'गुरुत्वाकर्षण', 'चुंबकत्व', 'थ्रस्ट'], correct: 1 },
    { id: 4, question: 'x² का अवकलज क्या है?', options: ['x', '2x', 'x³', '2'], correct: 1 },
  ],
};

export function QuizBattle() {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());
  const [isBattleStarted, setIsBattleStarted] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [battleComplete, setBattleComplete] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(10);

  useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  const questions = battleQuestions[currentLang] || battleQuestions['en'];
  const currentQ = questions[qIndex] || questions[0];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBattleStarted && !battleComplete && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isBattleStarted && !battleComplete) {
      handleAnswerSelect(-1); // Timeout penalty
    }
    return () => clearInterval(interval);
  }, [isBattleStarted, battleComplete, timerSeconds]);

  const startBattle = () => {
    setIsBattleStarted(true);
    setQIndex(0);
    setPlayerScore(0);
    setBotScore(0);
    setBattleComplete(false);
    setSelectedOpt(null);
    setTimerSeconds(10);
    toast.success('⚔️ STEM Speed Battle Started! Fast responses earn bonus points!');
  };

  const handleAnswerSelect = (optIndex: number) => {
    if (selectedOpt !== null || battleComplete) return;
    setSelectedOpt(optIndex);

    const isCorrect = optIndex === currentQ.correct;
    if (isCorrect) {
      const bonus = timerSeconds * 10;
      setPlayerScore(prev => prev + 100 + bonus);
    }

    // Bot AI simulation (70% accuracy)
    const botCorrect = Math.random() > 0.3;
    if (botCorrect) {
      setBotScore(prev => prev + 120);
    }

    setTimeout(() => {
      if (qIndex < questions.length - 1) {
        setQIndex(prev => prev + 1);
        setSelectedOpt(null);
        setTimerSeconds(10);
      } else {
        setBattleComplete(true);
        if (playerScore >= botScore) {
          toast.success('🏆 Victory! You won the STEM Speed Battle (+200 XP)!');
        } else {
          toast('⚡ Battle Ended! Keep practicing to beat the challenger.', { icon: '⚔️' });
        }
      }
    }, 1200);
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Swords className="w-3.5 h-3.5" /> 1v1 Real-Time Speed Arena
          </div>
          <h2 className="text-2xl font-bold text-white font-heading flex items-center gap-2">
            ⚔️ Multiplayer STEM Speed Quiz Battle
          </h2>
          <p className="text-xs text-slate-400">
            Challenge the AI Speed Bot in a 60-second real-time STEM quiz showdown!
          </p>
        </div>

        {!isBattleStarted && (
          <button
            onClick={startBattle}
            className="px-6 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all hover:scale-105"
          >
            <Swords className="w-4 h-4" /> Start Battle Match
          </button>
        )}
      </div>

      {isBattleStarted && (
        <div className="space-y-6">
          {/* Real-time Match Score Board */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950 p-5 rounded-2xl border border-slate-800">
            {/* Player Score */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">You (Student)</span>
                <p className="text-2xl font-extrabold text-white font-mono">{playerScore} pts</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                🎓
              </div>
            </div>

            {/* Opponent Bot Score */}
            <div className="flex items-center justify-between border-l border-slate-800 pl-4">
              <div>
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Challenger Bot</span>
                <p className="text-2xl font-extrabold text-white font-mono">{botScore} pts</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-lg">
                🤖
              </div>
            </div>
          </div>

          {!battleComplete ? (
            <div className="space-y-5 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
              {/* Question & Timer */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">Question {qIndex + 1} of {questions.length}</span>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 font-mono text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> {timerSeconds}s
                </div>
              </div>

              <h3 className="text-base font-bold text-white">{currentQ.question}</h3>

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt, idx) => {
                  let btnStyle = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700';
                  if (selectedOpt !== null) {
                    if (idx === currentQ.correct) {
                      btnStyle = 'bg-emerald-950 border-emerald-500 text-emerald-200';
                    } else if (idx === selectedOpt) {
                      btnStyle = 'bg-rose-950 border-rose-500 text-rose-200';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswerSelect(idx)}
                      disabled={selectedOpt !== null}
                      className={`p-4 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {selectedOpt !== null && idx === currentQ.correct && <Check className="w-4 h-4 text-emerald-400" />}
                      {selectedOpt !== null && idx === selectedOpt && idx !== currentQ.correct && <X className="w-4 h-4 text-rose-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-4">
              <div className="text-5xl">{playerScore >= botScore ? '🏆' : '⚔️'}</div>
              <h3 className="text-2xl font-bold text-white">
                {playerScore >= botScore ? 'Victory! Battle Won!' : 'Battle Complete'}
              </h3>
              <p className="text-xs text-slate-400">
                Final Match Score: You ({playerScore} pts) vs Bot ({botScore} pts)
              </p>

              <button
                onClick={startBattle}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Rematch Battle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
