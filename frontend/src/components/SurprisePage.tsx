import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SurprisePageProps {
  isDarkOverlayActive: boolean;
  setIsDarkOverlayActive: (val: boolean | ((prev: boolean) => boolean)) => void;
}

export function SurprisePage({ isDarkOverlayActive, setIsDarkOverlayActive }: SurprisePageProps) {
  const [boxState, setBoxState] = useState<'closed' | 'opening' | 'open'>('closed');

  const triggerJackInTheBox = () => {
    setBoxState('opening');
    setTimeout(() => {
      setBoxState('open');
      setIsDarkOverlayActive(true);
    }, 1000);
  };

  const resetState = () => {
    setBoxState('closed');
    setIsDarkOverlayActive(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Super Admin Surprise Control Banner */}
      <div className="bg-slate-900/90 border border-purple-500/40 rounded-3xl p-6 shadow-2xl backdrop-blur-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-bold rounded-full border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Super Admin Special Control
              </span>
              <span className="text-xs text-slate-400 font-mono">andrewsharrington@gmail.com</span>
            </div>
            <h2 className="text-2xl font-black text-white mt-2">
              Jack-in-the-Box Surprise Controls
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              Trigger the interactive full-black screen animation with the Joker & Clown popping out of the box saying "SURPRISE!!".
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isDarkOverlayActive ? (
              <button
                onClick={resetState}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg transition-all text-sm flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Reset Normal Mode
              </button>
            ) : (
              <button
                onClick={triggerJackInTheBox}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-500 hover:to-red-500 text-white font-black rounded-2xl shadow-xl hover:shadow-purple-500/25 transition-all text-sm flex items-center gap-2 animate-pulse"
              >
                <Zap className="w-4 h-4" /> Trigger Surprise Popup!
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Control Stage Box */}
      <div className="flex flex-col items-center justify-center p-12 bg-slate-950/80 rounded-3xl border border-slate-800 text-center relative overflow-hidden min-h-[380px]">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-pink-900/10 pointer-events-none" />

        {boxState === 'closed' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
          >
            <div className="relative group cursor-pointer" onClick={triggerJackInTheBox}>
              <div className="absolute -inset-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-80 transition duration-500" />
              <div className="relative w-40 h-40 bg-gradient-to-tr from-purple-900 via-purple-700 to-pink-600 rounded-3xl border-4 border-amber-400/80 shadow-2xl flex items-center justify-center text-6xl">
                🎁
              </div>
            </div>
            <p className="text-slate-300 font-bold mt-6 text-lg">Click the Surprise Box to activate!</p>
            <p className="text-xs text-slate-500 mt-1">Will display dark screen overlay with Clown & Joker animation.</p>
          </motion.div>
        )}

        {boxState === 'opening' && (
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="flex flex-col items-center"
          >
            <div className="w-40 h-40 bg-gradient-to-tr from-amber-600 via-pink-600 to-purple-800 rounded-3xl border-4 border-yellow-400 shadow-2xl flex items-center justify-center text-7xl">
              📦✨
            </div>
            <p className="text-amber-300 font-black text-xl mt-6 animate-bounce">Opening Surprise Box...</p>
          </motion.div>
        )}

        {boxState === 'open' && (
          <div className="flex flex-col items-center">
            <div className="text-8xl animate-bounce">🤡🎭</div>
            <h3 className="text-3xl font-black text-pink-400 mt-4 tracking-wider">SURPRISE!!</h3>
            <p className="text-slate-300 text-sm mt-2">Full dark surprise screen is currently active.</p>
            <button
              onClick={resetState}
              className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700"
            >
              Exit Dark Overlay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function JackInTheBoxDarkOverlay({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden"
        >
          {/* Subtle Ambient Red Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/30 rounded-full blur-[160px] pointer-events-none" />

          {/* Pop-Out Animation */}
          <motion.div
            initial={{ scale: 0, y: 150 }}
            animate={{ scale: [0, 1.25, 1], y: 0 }}
            transition={{ duration: 0.8, type: 'spring', bounce: 0.6 }}
            className="relative z-10 flex flex-col items-center"
          >
            {/* Jack in the Box Visual: Clown & Joker */}
            <div className="flex items-center justify-center gap-6 text-8xl sm:text-9xl mb-4 drop-shadow-[0_0_50px_rgba(236,72,153,0.8)]">
              <motion.span
                animate={{ rotate: [-12, 12, -12], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                🤡
              </motion.span>
              <motion.span
                animate={{ rotate: [12, -12, 12], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
              >
                🎭
              </motion.span>
            </div>

            {/* Surprise Text */}
            <motion.h1
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="text-5xl sm:text-7xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 drop-shadow-[0_0_30px_rgba(236,72,153,0.8)] uppercase"
            >
              SURPRISE!!
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-slate-300 text-lg sm:text-xl font-bold mt-4 max-w-md"
            >
              The Jack-in-the-Box Joker & Clown have arrived! 🎁✨
            </motion.p>

            {/* Close / Return Button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              onClick={onClose}
              className="mt-8 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-sm rounded-2xl shadow-2xl border border-pink-400/40 hover:scale-105 transition-all"
            >
              Dismiss Surprise & Return
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
