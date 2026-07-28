import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type RobotEmotion = 'happy' | 'sad' | 'love' | 'dance' | 'thinking';

interface Robot3DCanvasProps {
  isSpeaking: boolean;
  isThinking?: boolean;
  emotion?: RobotEmotion;
}

export const Robot3DCanvas: React.FC<Robot3DCanvasProps> = ({
  isSpeaking,
  isThinking = false,
  emotion = 'happy',
}) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visemeScale, setVisemeScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth Mouse Pointer Head & Body Tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 14;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Real-time Viseme Mouth Animation when speaking
  useEffect(() => {
    if (!isSpeaking) {
      setVisemeScale(1);
      return;
    }
    const interval = setInterval(() => {
      const scale = 0.6 + Math.random() * 0.9;
      setVisemeScale(scale);
    }, 110);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[310px] max-h-[380px] flex items-center justify-center select-none overflow-hidden"
    >
      {/* Studio Stage Ambient Lighting & Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/60 to-slate-950/90 rounded-2xl border border-slate-800/80 shadow-2xl" />

      <motion.div
        animate={
          emotion === 'dance'
            ? {
                x: [-18, 18, -18],
                y: [0, -14, 0],
                rotateZ: [-7, 7, -7],
              }
            : emotion === 'sad'
            ? {
                x: 0,
                y: [0, 5, 0],
                rotateZ: -5,
              }
            : emotion === 'love'
            ? {
                y: [0, -10, 0],
                scale: [1, 1.04, 1],
              }
            : {
                y: [0, -7, 0],
                rotateY: mousePos.x,
                rotateX: mousePos.y,
              }
        }
        transition={
          emotion === 'dance'
            ? { repeat: Infinity, duration: 0.75, ease: 'easeInOut' }
            : { repeat: Infinity, duration: 2.8, ease: 'easeInOut' }
        }
        className="relative z-10 flex items-center justify-center w-80 h-80 cursor-grab active:cursor-grabbing"
      >
        {/* Exact High-Resolution Transparent Robot Model PNG Asset */}
        <img
          src="/thambi-robot-exact.png"
          alt="Thambi Robo"
          className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(56,189,248,0.35)]"
        />

        {/* ORGANIC REAL-TIME LIPS SYNC & EYES VISOR OVERLAY */}
        <div className="absolute top-[18%] right-[22%] w-[34%] h-[20%] flex flex-col items-center justify-center pointer-events-none">
          {/* LED Eyes */}
          <div className="flex items-center justify-between w-full px-3">
            {emotion === 'sad' ? (
              <>
                <span className="text-amber-400 font-extrabold text-xl leading-none transform rotate-180 drop-shadow-[0_0_8px_#f59e0b]">◡</span>
                <span className="text-amber-400 font-extrabold text-xl leading-none transform rotate-180 drop-shadow-[0_0_8px_#f59e0b]">◡</span>
              </>
            ) : emotion === 'love' ? (
              <>
                <span className="text-pink-500 text-xl leading-none animate-pulse drop-shadow-[0_0_10px_#ec4899]">♥</span>
                <span className="text-pink-500 text-xl leading-none animate-pulse drop-shadow-[0_0_10px_#ec4899]">♥</span>
              </>
            ) : emotion === 'dance' ? (
              <>
                <span className="text-cyan-300 font-black text-lg animate-bounce drop-shadow-[0_0_8px_#38bdf8]">&gt;</span>
                <span className="text-cyan-300 font-black text-lg animate-bounce drop-shadow-[0_0_8px_#38bdf8]">&lt;</span>
              </>
            ) : (
              <>
                <span className="text-cyan-300 font-black text-xl leading-none drop-shadow-[0_0_8px_#38bdf8]">^</span>
                <span className="text-cyan-300 font-black text-xl leading-none drop-shadow-[0_0_8px_#38bdf8]">^</span>
              </>
            )}
          </div>

          {/* Dynamic LED Lips & Mouth Viseme */}
          <div className="mt-1 flex items-center justify-center">
            {isSpeaking ? (
              <motion.div
                animate={{ scaleY: visemeScale, scaleX: 1 + (visemeScale - 1) * 0.4 }}
                className="w-6 h-2.5 bg-cyan-300 rounded-full border border-cyan-100 shadow-[0_0_12px_#38bdf8]"
              />
            ) : emotion === 'sad' ? (
              <div className="w-5 h-1.5 bg-amber-400 rounded-full transform rotate-180 shadow-[0_0_8px_#f59e0b]" />
            ) : (
              <div className="w-7 h-2 border-b-2 border-cyan-300 rounded-full shadow-[0_0_10px_#38bdf8]" />
            )}
          </div>
        </div>

        {/* Floating Heart Particles for Loving Best-Friend Emotion */}
        <AnimatePresence>
          {emotion === 'love' && (
            <>
              <motion.span
                initial={{ opacity: 0, y: 0, x: -20 }}
                animate={{ opacity: 1, y: -45, x: -35 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="absolute top-8 text-pink-400 text-2xl font-bold drop-shadow-md"
              >
                ♥
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 0, x: 20 }}
                animate={{ opacity: 1, y: -55, x: 35 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.7, delay: 0.3 }}
                className="absolute top-10 text-pink-500 text-3xl font-bold drop-shadow-md"
              >
                💖
              </motion.span>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
