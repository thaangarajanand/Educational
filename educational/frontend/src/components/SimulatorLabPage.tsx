import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Activity, Zap, Play, RotateCcw, Sparkles, Cpu, Compass, Flame, Box, Move, Eye, Layers } from 'lucide-react';
import { getSelectedLanguage, t, Language } from '../lib/i18n';

export function SimulatorLabPage() {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());
  const [activeSim, setActiveSim] = useState<'drone' | 'arm' | 'atom' | 'gravity'>('drone');

  // DRONE SIMULATION STATE
  const [droneRpm, setDroneRpm] = useState(5500);
  const [droneMass, setDroneMass] = useState(1.4); // kg
  const [pitchAngle, setPitchAngle] = useState(0); // degrees
  const [rollAngle, setRollAngle] = useState(0); // degrees
  const [windSpeed, setWindSpeed] = useState(2); // m/s

  // ROBOTIC ARM STATE
  const [baseRotation, setBaseRotation] = useState(45); // deg
  const [shoulderPitch, setShoulderPitch] = useState(30); // deg
  const [elbowBend, setElbowBend] = useState(60); // deg
  const [gripperOpen, setGripperOpen] = useState(true);

  // ATOM STATE
  const [atomicNumber, setAtomicNumber] = useState(6); // Carbon (6 Protons/Electrons)
  const [electronSpeed, setElectronSpeed] = useState(1.5);

  // GRAVITY STATE
  const [orbitDistance, setOrbitDistance] = useState(150); // M km
  const [planetMass, setPlanetMass] = useState(1.0); // Earth masses

  useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  // Drone Calculations
  const thrustN = Math.round((droneRpm / 1000) * (droneRpm / 1000) * 0.58 * 10) / 10;
  const gravityN = Math.round(droneMass * 9.81 * 10) / 10;
  const verticalAcc = Math.round(((thrustN - gravityN) / droneMass) * 10) / 10;
  const flightState = verticalAcc > 0.5 ? 'Ascending 🚀' : Math.abs(verticalAcc) <= 0.5 ? 'Hovering ⚖️' : 'Descending ⬇️';

  return (
    <div className="space-y-8">
      {/* 2050 Cyber Welcome Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/80 border border-slate-800 shadow-2xl"
      >
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-purple-500/20 rounded-full blur-[90px] pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles className="w-3.5 h-3.5" /> 3D Interactive STEM Simulator & Lab
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white font-heading tracking-tight">
              Interactive 3D <span className="gradient-text-cyan">Simulator & Lab</span> 🧪
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Explore realistic 3D flight physics, robotic arm kinematics, atomic orbital quantum mechanics, and planetary gravitational orbits.
            </p>
          </div>

          {/* Navigation Simulator Mode Pills */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
            <button
              onClick={() => setActiveSim('drone')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSim === 'drone' ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              🚁 3D Drone Flight
            </button>
            <button
              onClick={() => setActiveSim('arm')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSim === 'arm' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              🤖 3D Robotic Arm
            </button>
            <button
              onClick={() => setActiveSim('atom')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSim === 'atom' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚛️ 3D Atomic Orbitals
            </button>
            <button
              onClick={() => setActiveSim('gravity')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeSim === 'gravity' ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20' : 'text-slate-400 hover:text-white'
              }`}
            >
              🪐 3D Solar Orbits
            </button>
          </div>
        </div>
      </motion.div>

      {/* SIMULATOR 1: 3D DRONE FLIGHT & AERODYNAMICS */}
      {activeSim === 'drone' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Telemetry & Controls (1 Col) */}
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" /> Flight Parameters Controls
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Rotor Motor Speed (RPM)</span>
                  <span className="text-cyan-400 font-mono font-bold">{droneRpm} RPM</span>
                </div>
                <input
                  type="range"
                  min="2000"
                  max="8500"
                  step="100"
                  value={droneRpm}
                  onChange={(e) => setDroneRpm(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Drone Pitch Angle (Forward/Back)</span>
                  <span className="text-purple-400 font-mono font-bold">{pitchAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={pitchAngle}
                  onChange={(e) => setPitchAngle(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Drone Roll Angle (Left/Right)</span>
                  <span className="text-amber-400 font-mono font-bold">{rollAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="30"
                  step="1"
                  value={rollAngle}
                  onChange={(e) => setRollAngle(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Cross Wind Velocity</span>
                  <span className="text-pink-400 font-mono font-bold">{windSpeed} m/s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
              </div>
            </div>

            {/* Live Telemetry Display */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Total Lift Force</span>
                <p className="text-lg font-extrabold text-cyan-400 font-mono mt-0.5">{thrustN} N</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Vertical Accel</span>
                <p className={`text-lg font-extrabold font-mono mt-0.5 ${verticalAcc > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {verticalAcc} m/s²
                </p>
              </div>
            </div>
          </div>

          {/* 3D Realistic Stage & Drone Visualizer (2 Cols) */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 h-[480px] relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between z-10">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800">
                <Compass className="w-4 h-4 text-cyan-400" /> Flight State: <span className="text-cyan-300">{flightState}</span>
              </span>
              <span className="text-xs text-slate-400 font-mono bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800">
                Altitude: {Math.max(0, Math.round(verticalAcc * 12 + 10))} m
              </span>
            </div>

            {/* 3D Grid Stage */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-25 [transform:perspective(600px)_rotateX(65deg)] origin-bottom" />

            {/* Realistic 3D Drone Model Quadcopter */}
            <div className="relative z-10 flex-1 flex items-center justify-center">
              <motion.div
                animate={{
                  y: verticalAcc > 0 ? [-10, -40, -10] : [10, 40, 10],
                  rotateX: pitchAngle,
                  rotateZ: rollAngle,
                  rotateY: [0, 2, -2, 0],
                }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
                className="relative flex flex-col items-center cursor-grab active:cursor-grabbing"
              >
                {/* 4 Spinning Propellers */}
                <div className="relative w-64 h-32 border-4 border-cyan-500/40 rounded-3xl bg-slate-900/60 shadow-[0_0_50px_rgba(56,189,248,0.3)] flex items-center justify-center backdrop-blur-md">
                  <div className="absolute -top-6 -left-6 w-14 h-2 bg-cyan-400 animate-spin rounded-full shadow-[0_0_10px_#38bdf8]" />
                  <div className="absolute -top-6 -right-6 w-14 h-2 bg-cyan-400 animate-spin rounded-full shadow-[0_0_10px_#38bdf8]" />
                  <div className="absolute -bottom-6 -left-6 w-14 h-2 bg-cyan-400 animate-spin rounded-full shadow-[0_0_10px_#38bdf8]" />
                  <div className="absolute -bottom-6 -right-6 w-14 h-2 bg-cyan-400 animate-spin rounded-full shadow-[0_0_10px_#38bdf8]" />

                  {/* Camera Gimbal Body */}
                  <div className="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-cyan-400 flex flex-col items-center justify-center text-cyan-400 shadow-inner">
                    <Eye className="w-8 h-8 animate-pulse" />
                    <span className="text-[9px] font-mono font-bold mt-1">4K GIMBAL</span>
                  </div>
                </div>

                <div className="mt-4 text-xs font-mono font-bold text-cyan-300 bg-slate-950/90 px-3 py-1 rounded-full border border-cyan-500/40">
                  Thrust: {thrustN} N | Wind: {windSpeed} m/s
                </div>
              </motion.div>
            </div>

            <div className="z-10 text-[11px] text-slate-400 font-mono bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              💡 Aerodynamics Tip: Lift is generated by air pressure differential created by fast spinning rotor blades.
            </div>
          </div>
        </motion.div>
      )}

      {/* SIMULATOR 2: 3D ROBOTIC ARM KINEMATICS */}
      {activeSim === 'arm' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" /> Articulated Joint Controls
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Base Rotation (Yaw)</span>
                  <span className="text-purple-400 font-mono font-bold">{baseRotation}°</span>
                </div>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="5"
                  value={baseRotation}
                  onChange={(e) => setBaseRotation(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Shoulder Joint (Pitch)</span>
                  <span className="text-cyan-400 font-mono font-bold">{shoulderPitch}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="5"
                  value={shoulderPitch}
                  onChange={(e) => setShoulderPitch(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Elbow Bend Joint</span>
                  <span className="text-amber-400 font-mono font-bold">{elbowBend}°</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="110"
                  step="5"
                  value={elbowBend}
                  onChange={(e) => setElbowBend(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <button
                onClick={() => setGripperOpen(!gripperOpen)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  gripperOpen
                    ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                }`}
              >
                {gripperOpen ? '🖐️ Open Gripper Claw' : '✊ Close Gripper Claw (Grip Payload)'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 h-[480px] relative overflow-hidden flex flex-col justify-between">
            <span className="text-xs text-slate-300 font-bold flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 w-fit">
              <Box className="w-4 h-4 text-purple-400" /> Kinematics Status: <span className="text-purple-300">Inverse Kinematics Active</span>
            </span>

            {/* 3D Robotic Arm Visual Stage */}
            <div className="relative flex-1 flex items-center justify-center">
              <motion.div
                animate={{ rotateY: baseRotation }}
                style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
                className="relative flex flex-col items-center"
              >
                {/* Arm Base */}
                <div className="w-32 h-8 bg-slate-900 border-2 border-purple-500/60 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center text-[10px] font-mono font-bold text-purple-300">
                  BASE ROTOR
                </div>

                {/* Shoulder Link */}
                <motion.div
                  animate={{ rotateZ: -shoulderPitch }}
                  style={{ transformOrigin: 'bottom center', height: '110px' }}
                  className="w-4 bg-purple-500 rounded-full my-1 shadow-[0_0_10px_#a855f7]"
                >
                  {/* Elbow Joint */}
                  <motion.div
                    animate={{ rotateZ: elbowBend }}
                    style={{ transformOrigin: 'top center', height: '90px' }}
                    className="w-4 bg-cyan-400 rounded-full mt-24 shadow-[0_0_10px_#38bdf8]"
                  >
                    {/* Gripper Claw */}
                    <div className="w-12 h-8 border-2 border-amber-400 rounded-lg mt-20 flex items-center justify-between px-1">
                      <span className={`w-2 h-6 bg-amber-400 transition-all ${gripperOpen ? '-translate-x-1' : 'translate-x-1'}`} />
                      <span className={`w-2 h-6 bg-amber-400 transition-all ${gripperOpen ? 'translate-x-1' : '-translate-x-1'}`} />
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* SIMULATOR 3: 3D ATOMIC STRUCTURE */}
      {activeSim === 'atom' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Quantum Atomic Controls
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Atomic Number (Protons Z)</span>
                  <span className="text-amber-400 font-mono font-bold">Z = {atomicNumber}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={atomicNumber}
                  onChange={(e) => setAtomicNumber(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Electron Orbital Speed</span>
                  <span className="text-cyan-400 font-mono font-bold">{electronSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={electronSpeed}
                  onChange={(e) => setElectronSpeed(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase">Element Config</span>
              <p className="text-xl font-bold text-amber-400 font-mono">
                {atomicNumber === 1 ? 'Hydrogen (H)' : atomicNumber === 2 ? 'Helium (He)' : atomicNumber === 6 ? 'Carbon (C)' : atomicNumber === 8 ? 'Oxygen (O)' : `Element Z=${atomicNumber}`}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 h-[480px] relative overflow-hidden flex flex-col justify-between">
            <span className="text-xs text-slate-300 font-bold flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 w-fit">
              <Layers className="w-4 h-4 text-amber-400" /> Quantum Shells: <span className="text-amber-300">K & L Shells Active</span>
            </span>

            {/* 3D Atomic Orbit Visualizer */}
            <div className="relative flex-1 flex items-center justify-center">
              {/* Nucleus */}
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-rose-500 via-amber-500 to-red-500 shadow-[0_0_35px_rgba(244,63,94,0.8)] border-2 border-white flex items-center justify-center text-white font-extrabold text-xs">
                {atomicNumber}p⁺
              </div>

              {/* Electron Orbit Ring 1 */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4 / electronSpeed, ease: 'linear' }}
                className="absolute w-48 h-48 rounded-full border-2 border-cyan-400/40 flex items-center justify-start"
              >
                <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_12px_#38bdf8] border border-white" />
              </motion.div>

              {/* Electron Orbit Ring 2 */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 6 / electronSpeed, ease: 'linear' }}
                className="absolute w-72 h-72 rounded-full border-2 border-purple-400/40 flex items-center justify-end"
              >
                <div className="w-4 h-4 rounded-full bg-purple-400 shadow-[0_0_12px_#c084fc] border border-white" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* SIMULATOR 4: 3D SOLAR SYSTEM GRAVITY */}
      {activeSim === 'gravity' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
              <Move className="w-5 h-5 text-pink-400" /> Orbital Gravitational Parameters
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>Orbit Semi-Major Axis (Radius)</span>
                  <span className="text-pink-400 font-mono font-bold">{orbitDistance} M km</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="280"
                  step="10"
                  value={orbitDistance}
                  onChange={(e) => setOrbitDistance(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-400"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl border border-slate-800 h-[480px] relative overflow-hidden flex flex-col justify-between">
            <span className="text-xs text-slate-300 font-bold flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-800 w-fit">
              <Sparkles className="w-4 h-4 text-pink-400" /> Kepler's 3rd Law Active: <span className="text-pink-300">T² ∝ r³</span>
            </span>

            <div className="relative flex-1 flex items-center justify-center">
              {/* Sun */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-300 shadow-[0_0_60px_rgba(245,158,11,0.9)] border-2 border-white flex items-center justify-center text-black font-extrabold text-xs">
                ☀️ SUN
              </div>

              {/* Orbiting Earth */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: orbitDistance / 20, ease: 'linear' }}
                style={{ width: `${orbitDistance * 2}px`, height: `${orbitDistance * 2}px` }}
                className="absolute rounded-full border border-pink-400/30 flex items-center justify-start"
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 border border-white shadow-[0_0_15px_#3b82f6] flex items-center justify-center text-[10px]">
                  🌍
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
