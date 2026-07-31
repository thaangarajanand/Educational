import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Trophy, Zap, Clock, ShieldAlert, Check, X, RotateCcw, Sparkles, HelpCircle, Flame, Volume2, VolumeX } from 'lucide-react';
import { getSelectedLanguage, t, Language } from '../lib/i18n';
import toast from 'react-hot-toast';

interface BattleQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  hint: string;
}

const battleQuestions: Record<Language, BattleQuestion[]> = {
  en: [
    { id: 1, question: 'What is the acceleration due to gravity on Earth?', options: ['9.81 m/s²', '5.4 m/s²', '12.1 m/s²', '3.2 m/s²'], correct: 0, hint: 'Standard Earth gravity constant g ≈ 9.8' },
    { id: 2, question: 'What unit measures electrical resistance?', options: ['Amperes', 'Volts', 'Ohms (Ω)', 'Watts'], correct: 2, hint: 'Named after German physicist Georg Simon Ohm' },
    { id: 3, question: 'Which sensor measures angular velocity in robotics?', options: ['LiDAR', 'Gyroscope', 'Ultrasonic', 'Barometer'], correct: 1, hint: 'Measures rate of rotation (deg/s)' },
    { id: 4, question: 'What is the derivative of x² with respect to x?', options: ['x', '2x', 'x³', '2'], correct: 1, hint: 'Use the power rule d/dx(x^n) = n*x^(n-1)' },
    { id: 5, question: 'Which law states V = I * R in electric circuits?', options: ['Newton Law', 'Ohm Law', 'Kirchhoff Law', 'Faraday Law'], correct: 1, hint: 'Voltage = Current × Resistance' },
  ],
  ta: [
    { id: 1, question: 'பூமியில் புவிஈர்ப்பு முடுக்கம் எவ்வளவு?', options: ['9.81 m/s²', '5.4 m/s²', '12.1 m/s²', '3.2 m/s²'], correct: 0, hint: 'பூமி ஈர்ப்பு மாறிலி g ≈ 9.8' },
    { id: 2, question: 'மின் தடையை அளவிடும் அலகு எது?', options: ['ஆம்பியர்', 'வோல்ட்', 'ஓம் (Ω)', 'வாட்'], correct: 2, hint: 'ஜார்ஜ் சீமன் ஓம் பெயரால் அழைக்கப்படுகிறது' },
    { id: 3, question: 'ரோபாட்டிக்ஸில் கோண திசைவேகத்தை அளவிடும் சென்சார் எது?', options: ['லிடார்', 'கைரோஸ்கோப்', 'அல்ட்ராசோனிக்', 'பாரோமீட்டர்'], correct: 1, hint: 'சுழற்சி வீதத்தை அளவிடும் சாதனம' },
    { id: 4, question: 'x²-ன் வகைக்கெழு என்ன?', options: ['x', '2x', 'x³', '2'], correct: 1, hint: 'அடுக்கு விதியைப் பயன்படுத்துங்கள்' },
    { id: 5, question: 'மின் சுற்றில் V = I * R என்ற விதியைக்கூறுவது எது?', options: ['நியூட்டன் விதி', 'ஓம் விதி', 'கீர்ச்சாஃப் விதி', 'பாரடே விதி'], correct: 1, hint: 'மின்னழுத்தம் = மின்னோட்டம் × மின்தடை' },
  ],
  hi: [
    { id: 1, question: 'पृथ्वी पर गुरुत्वाकर्षण के कारण त्वरण कितना है?', options: ['9.81 m/s²', '5.4 m/s²', '12.1 m/s²', '3.2 m/s²'], correct: 0, hint: 'पृथ्वी गुरुत्वाकर्षण स्थिरांक g ≈ 9.8' },
    { id: 2, question: 'विद्युत प्रतिरोध को किस इकाई में मापा जाता है?', options: ['एम्पीयर', 'वोल्ट', 'ओम (Ω)', 'वाट'], correct: 2, hint: 'भौतिक विज्ञानी जॉर्ज साइमन ओम के नाम पर' },
    { id: 3, question: 'रोबोटिक्स में कोणीय वेग को कौन सा सेंसर मापता है?', options: ['लिडार', 'जाइरोस्कोप', 'अल्ट्रासोनिक', 'बैरोमीटर'], correct: 1, hint: 'घूर्णन की दर को मापता है' },
    { id: 4, question: 'x² का अवकलज क्या है?', options: ['x', '2x', 'x³', '2'], correct: 1, hint: 'घात नियम का उपयोग करें' },
    { id: 5, question: 'विद्युत परिपथ में V = I * R किस नियम का वर्णन करता है?', options: ['न्यूटन नियम', 'ओम नियम', 'किरचॉफ नियम', 'फैराडे नियम'], correct: 1, hint: 'वोल्टेज = धारा × प्रतिरोध' },
  ],
};

// Web Audio API Retro Sound Effects Synth
const playArcadeSound = (type: 'correct' | 'wrong' | 'victory' | 'combo' | 'powerup') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'combo') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'powerup') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.setValueAtTime(130, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'victory') {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch {}
};

export function QuizBattle() {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());
  const [isBattleStarted, setIsBattleStarted] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [playerScore, setPlayerScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [battleComplete, setBattleComplete] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(12);

  // Gamification & Interactive Lifelines
  const [streakCount, setStreakCount] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState(false);
  const [timeFreezeUsed, setTimeFreezeUsed] = useState(false);
  const [activeDisabledOpts, setActiveDisabledOpts] = useState<number[]>([]);
  const [activeHint, setActiveHint] = useState<string | null>(null);

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
    setStreakCount(0);
    setBattleComplete(false);
    setSelectedOpt(null);
    setTimerSeconds(12);
    setFiftyFiftyUsed(false);
    setTimeFreezeUsed(false);
    setActiveDisabledOpts([]);
    setActiveHint(null);
    if (!soundMuted) playArcadeSound('powerup');
    toast.success('⚔️ STEM Speed Arena Match Started! Fast answers trigger combo multipliers!');
  };

  // Interactive Lifeline: 50:50
  const handleFiftyFifty = () => {
    if (fiftyFiftyUsed || selectedOpt !== null) return;
    setFiftyFiftyUsed(true);
    const incorrects = currentQ.options.map((_, i) => i).filter(i => i !== currentQ.correct);
    const removed = incorrects.sort(() => 0.5 - Math.random()).slice(0, 2);
    setActiveDisabledOpts(removed);
    if (!soundMuted) playArcadeSound('powerup');
    toast.success('⚡ 50:50 Lifeline Activated! 2 incorrect options removed.');
  };

  // Interactive Lifeline: Time Freeze (+5s)
  const handleTimeFreeze = () => {
    if (timeFreezeUsed || selectedOpt !== null) return;
    setTimeFreezeUsed(true);
    setTimerSeconds(prev => prev + 5);
    if (!soundMuted) playArcadeSound('powerup');
    toast.success('⏳ Time Freeze Activated! +5 Seconds Added to Timer!');
  };

  // Interactive Lifeline: AI Robo Hint
  const handleShowHint = () => {
    setActiveHint(currentQ.hint);
    if (!soundMuted) playArcadeSound('powerup');
    toast('🤖 Thambi Robo Hint: ' + currentQ.hint, { icon: '💡' });
  };

  const handleAnswerSelect = (optIndex: number) => {
    if (selectedOpt !== null || battleComplete) return;
    setSelectedOpt(optIndex);

    const isCorrect = optIndex === currentQ.correct;
    
    // Combo multiplier logic
    let newStreak = streakCount;
    let multiplier = 1;
    if (isCorrect) {
      newStreak += 1;
      multiplier = newStreak >= 3 ? 2 : newStreak >= 2 ? 1.5 : 1;
      if (!soundMuted) {
        if (newStreak >= 2) playArcadeSound('combo');
        else playArcadeSound('correct');
      }
    } else {
      newStreak = 0;
      if (!soundMuted) playArcadeSound('wrong');
    }
    setStreakCount(newStreak);

    const timeBonus = isCorrect ? timerSeconds * 10 : 0;
    const addedPlayerPts = isCorrect ? Math.round((100 + timeBonus) * multiplier) : 0;
    const botCorrect = Math.random() > 0.35;
    const addedBotPts = botCorrect ? 120 : 0;

    const newPlayerScore = playerScore + addedPlayerPts;
    const newBotScore = botScore + addedBotPts;

    setPlayerScore(newPlayerScore);
    setBotScore(newBotScore);

    setTimeout(() => {
      if (qIndex < questions.length - 1) {
        setQIndex(prev => prev + 1);
        setSelectedOpt(null);
        setActiveDisabledOpts([]);
        setActiveHint(null);
        setTimerSeconds(12);
      } else {
        setBattleComplete(true);
        if (newPlayerScore >= newBotScore) {
          if (!soundMuted) playArcadeSound('victory');
          toast.success('🏆 Victory! You won the STEM Speed Battle (+250 XP)!');
        } else {
          toast('⚔️ Battle Ended! Great attempt - try again for a higher score.', { icon: '⚔️' });
        }
      }
    }, 1200);
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Swords className="w-3.5 h-3.5" /> 1v1 Interactive STEM Speed Arena
          </div>
          <h2 className="text-2xl font-bold text-white font-heading flex items-center gap-2">
            ⚔️ Interactive STEM Quiz Arena
          </h2>
          <p className="text-xs text-slate-400">
            Real-time speed battle with lifelines, audio arcade sounds, and combo multipliers!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={soundMuted ? 'Unmute Game Sounds' : 'Mute Game Sounds'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {!isBattleStarted && (
            <button
              onClick={startBattle}
              className="px-6 py-3 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-black font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all hover:scale-105"
            >
              <Swords className="w-4 h-4" /> Start Battle Match
            </button>
          )}
        </div>
      </div>

      {isBattleStarted && (
        <div className="space-y-6">
          {/* Match Score & Streak Board */}
          <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 relative">
            {/* Combo Badge Overlay */}
            {streakCount >= 2 && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-[10px] font-black uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1 animate-bounce">
                <Flame className="w-3 h-3 fill-slate-950" /> {streakCount}x Combo Multiplier!
              </div>
            )}

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

            {/* Challenger Bot Score */}
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
            <div className="space-y-5 bg-slate-900/60 p-5 sm:p-6 rounded-2xl border border-slate-800">
              {/* Question Navigation & Timer */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold">Question {qIndex + 1} of {questions.length}</span>
                
                {/* Interactive Power-Up Lifeline Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFiftyFifty}
                    disabled={fiftyFiftyUsed || selectedOpt !== null}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                      fiftyFiftyUsed ? 'bg-slate-900 text-slate-600 border-slate-800 opacity-50' : 'bg-purple-950/80 text-purple-300 border-purple-500/40 hover:bg-purple-900'
                    }`}
                    title="Remove 2 incorrect options"
                  >
                    ⚡ 50:50
                  </button>

                  <button
                    onClick={handleTimeFreeze}
                    disabled={timeFreezeUsed || selectedOpt !== null}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                      timeFreezeUsed ? 'bg-slate-900 text-slate-600 border-slate-800 opacity-50' : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40 hover:bg-cyan-900'
                    }`}
                    title="Add +5 seconds to timer"
                  >
                    ⏳ +5s
                  </button>

                  <button
                    onClick={handleShowHint}
                    disabled={selectedOpt !== null}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 hover:bg-amber-900 transition-all"
                    title="Show Robo Hint"
                  >
                    💡 Hint
                  </button>

                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 font-mono text-xs font-bold ml-2">
                    <Clock className="w-3.5 h-3.5 animate-spin" /> {timerSeconds}s
                  </div>
                </div>
              </div>

              {/* Question Text */}
              <h3 className="text-base sm:text-lg font-bold text-white">{currentQ.question}</h3>

              {/* Hint Box if triggered */}
              {activeHint && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200">
                  🤖 <strong>AI Hint:</strong> {activeHint}
                </div>
              )}

              {/* Interactive Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQ.options.map((opt, idx) => {
                  const isDisabled = activeDisabledOpts.includes(idx);
                  let btnStyle = 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700';

                  if (isDisabled) {
                    btnStyle = 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-30 cursor-not-allowed';
                  } else if (selectedOpt !== null) {
                    if (idx === currentQ.correct) {
                      btnStyle = 'bg-emerald-950 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/20';
                    } else if (idx === selectedOpt) {
                      btnStyle = 'bg-rose-950 border-rose-500 text-rose-200';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswerSelect(idx)}
                      disabled={selectedOpt !== null || isDisabled}
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
            /* Interactive Match Victory Screen */
            <div className="p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-4 shadow-2xl">
              <div className="text-6xl animate-bounce">{playerScore >= botScore ? '🏆' : '⚔️'}</div>
              <h3 className="text-2xl font-extrabold text-white">
                {playerScore >= botScore ? 'Victory! Battle Arena Won!' : 'Battle Match Complete'}
              </h3>
              <p className="text-xs text-slate-400">
                Final Score: Student ({playerScore} pts) vs Challenger Bot ({botScore} pts)
              </p>

              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={startBattle}
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-extrabold text-xs rounded-xl inline-flex items-center gap-2 shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" /> Rematch Arena
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
