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
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth Mouse Pointer 3D Perspective Parallax Tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 22; // 3D Tilt Y-axis
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -16; // 3D Tilt X-axis
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Aura Light Colors based on Emotion
  const getAuraColor = () => {
    switch (emotion) {
      case 'love':
        return 'from-pink-500/30 via-rose-500/20 to-transparent shadow-[0_0_80px_rgba(244,63,94,0.4)]';
      case 'dance':
        return 'from-amber-500/40 via-purple-500/30 to-cyan-500/20 shadow-[0_0_90px_rgba(245,158,11,0.5)]';
      case 'sad':
        return 'from-indigo-500/20 via-blue-900/30 to-transparent shadow-[0_0_60px_rgba(99,102,241,0.3)]';
      case 'thinking':
        return 'from-purple-500/35 via-cyan-500/20 to-transparent shadow-[0_0_75px_rgba(168,85,247,0.4)]';
      default:
        return 'from-cyan-500/30 via-purple-500/20 to-transparent shadow-[0_0_80px_rgba(56,189,248,0.4)]';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[320px] max-h-[380px] pt-8 flex flex-col items-center justify-end pb-4 select-none overflow-hidden rounded-3xl"
    >
      {/* 3D Holographic Cyber Grid Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900/90 to-slate-950 border border-slate-800/80 shadow-2xl" />

      {/* 3D Stage Floor Grid Perspective Lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-20 [transform:perspective(500px)_rotateX(60deg)] origin-bottom" />

      {/* Dynamic Stage Aura Lights */}
      <div className={`absolute w-72 h-72 rounded-full bg-gradient-to-t ${getAuraColor()} blur-[60px] pointer-events-none transition-all duration-700`} />

      {/* Floating Energy Particle Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ y: [-10, 10, -10], opacity: [0.3, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          className="absolute top-10 left-12 w-3 h-3 rounded-full bg-cyan-400 blur-[2px] shadow-[0_0_12px_#38bdf8]"
        />
        <motion.div
          animate={{ y: [10, -10, 10], opacity: [0.4, 0.9, 0.4] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-16 right-12 w-2.5 h-2.5 rounded-full bg-purple-400 blur-[2px] shadow-[0_0_12px_#c084fc]"
        />
        <motion.div
          animate={{ x: [-15, 15, -15], opacity: [0.2, 0.7, 0.2] }}
          transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 0.5 }}
          className="absolute top-16 right-20 w-2 h-2 rounded-full bg-pink-400 blur-[1px] shadow-[0_0_10px_#f472b6]"
        />
      </div>

      {/* 3D Glass Pedestal Platform */}
      <div className="absolute bottom-2 w-56 h-10 rounded-[100%] bg-gradient-to-r from-slate-900/90 via-cyan-950/60 to-slate-900/90 border-2 border-cyan-500/40 shadow-[0_0_35px_rgba(56,189,248,0.3)] backdrop-blur-md flex items-center justify-center">
        <div className="w-40 h-5 rounded-[100%] border border-cyan-400/50 animate-pulse" />
      </div>

      {/* MAIN 3D CHARACTER CONTAINER */}
      <motion.div
        animate={
          emotion === 'dance'
            ? {
                x: [-18, 18, -18],
                y: [0, -10, 0],
                rotateZ: [-7, 7, -7],
              }
            : emotion === 'sad'
            ? {
                x: 0,
                y: [0, 4, 0],
                rotateZ: -5,
              }
            : emotion === 'love'
            ? {
                y: [0, -8, 0],
                scale: [1, 1.03, 1],
              }
            : {
                y: [0, -6, 0],
                rotateY: mousePos.x,
                rotateX: mousePos.y,
              }
        }
        transition={
          emotion === 'dance'
            ? { repeat: Infinity, duration: 0.7, ease: 'easeInOut' }
            : { repeat: Infinity, duration: 2.8, ease: 'easeInOut' }
        }
        style={{
          transformStyle: 'preserve-3d',
          perspective: 1000,
        }}
        className="relative z-10 flex items-center justify-center w-52 h-52 sm:w-60 sm:h-60 cursor-grab active:cursor-grabbing mb-2"
      >
        {/* Exact High-Resolution Clean Photorealistic Robot Character Asset */}
        <img
          src="/thambi-robot-exact.png"
          alt="Thambi Robo 3D Model"
          className={`w-full h-full object-contain transition-all duration-300 filter ${
            isSpeaking
              ? 'drop-shadow-[0_20px_40px_rgba(56,189,248,0.6)] scale-100'
              : 'drop-shadow-[0_15px_35px_rgba(56,189,248,0.35)] scale-95'
          }`}
        />

        {/* Dynamic 3D Character Shadow Reflection on Glass Pedestal */}
        <div className="absolute -bottom-4 w-40 h-6 rounded-full bg-cyan-500/20 blur-md transform scale-y-50 pointer-events-none" />

        {/* Floating Heart & Motivation Particles */}
        <AnimatePresence>
          {emotion === 'love' && (
            <>
              <motion.span
                initial={{ opacity: 0, y: 0, x: -20, scale: 0.5 }}
                animate={{ opacity: 1, y: -50, x: -35, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="absolute top-6 text-pink-400 text-2xl font-bold drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]"
              >
                ♥
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 0, x: 20, scale: 0.5 }}
                animate={{ opacity: 1, y: -60, x: 35, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.7, delay: 0.3 }}
                className="absolute top-8 text-pink-500 text-3xl font-bold drop-shadow-[0_0_12px_rgba(244,63,94,0.9)]"
              >
                💖
              </motion.span>
            </>
          )}

          {emotion === 'dance' && (
            <>
              <motion.span
                initial={{ opacity: 0, y: 0, x: -30 }}
                animate={{ opacity: 1, y: -55, x: -45, rotate: [-10, 10] }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="absolute top-4 text-amber-400 text-2xl font-bold drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]"
              >
                🎵
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 0, x: 30 }}
                animate={{ opacity: 1, y: -55, x: 45, rotate: [10, -10] }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 1.3, delay: 0.2 }}
                className="absolute top-4 text-cyan-400 text-2xl font-bold drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]"
              >
                🎶
              </motion.span>
            </>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
