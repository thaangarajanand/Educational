import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Activity, Zap, Play, RotateCcw, Sparkles } from 'lucide-react';
import { getSelectedLanguage, t, Language } from '../lib/i18n';

export function STEMSimulator() {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());
  const [activeTab, setActiveTab] = useState<'drone' | 'pendulum' | 'circuit'>('drone');

  // Drone Sim State
  const [rpm, setRpm] = useState(5000);
  const [mass, setMass] = useState(1.2); // kg
  const [gravity] = useState(9.81); // m/s^2

  // Pendulum Sim State
  const [length, setLength] = useState(1.5); // meters
  const [angle, setAngle] = useState(30); // degrees
  const [pendulumTime, setPendulumTime] = useState(0);

  // Circuit Sim State
  const [voltage, setVoltage] = useState(12); // Volts
  const [resistance, setResistance] = useState(6); // Ohms

  useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  // Drone Calculations
  const thrustForce = Math.round((rpm / 1000) * (rpm / 1000) * 0.6 * 10) / 10; // Newtons
  const weightForce = Math.round(mass * gravity * 10) / 10; // Newtons
  const netForce = Math.round((thrustForce - weightForce) * 10) / 10;
  const isHovering = Math.abs(netForce) < 0.5;
  const isAscending = netForce > 0.5;

  // Pendulum Calculations
  const period = (2 * Math.PI * Math.sqrt(length / gravity)).toFixed(2); // seconds

  // Circuit Calculations
  const current = (voltage / (resistance || 1)).toFixed(2); // Amperes
  const power = (voltage * parseFloat(current)).toFixed(2); // Watts

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> STEM Interactive Physics Lab
          </div>
          <h2 className="text-2xl font-bold text-white font-heading">
            🧪 3D Interactive STEM Simulator & Lab
          </h2>
          <p className="text-xs text-slate-400">
            Manipulate physical parameters in real-time and visualize aerodynamic forces, pendulum dynamics, and electric circuits.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('drone')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'drone' ? 'bg-cyan-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            🚁 Drone Thrust
          </button>
          <button
            onClick={() => setActiveTab('pendulum')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pendulum' ? 'bg-purple-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⏱️ Pendulum Lab
          </button>
          <button
            onClick={() => setActiveTab('circuit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'circuit' ? 'bg-amber-500 text-black shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚡ Ohm's Circuit
          </button>
        </div>
      </div>

      {/* LAB 1: DRONE AERODYNAMICS */}
      {activeTab === 'drone' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Controls */}
          <div className="space-y-5 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" /> Propeller Thrust Controls
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Propeller Speed (RPM)</span>
                <span className="text-cyan-400 font-mono">{rpm} RPM</span>
              </div>
              <input
                type="range"
                min="1000"
                max="8000"
                step="100"
                value={rpm}
                onChange={(e) => setRpm(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Drone Payload Mass (kg)</span>
                <span className="text-purple-400 font-mono">{mass} kg</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={mass}
                onChange={(e) => setMass(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            {/* Calculations Grid */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Lift Force</span>
                <p className="text-base font-bold text-cyan-400 mt-0.5">{thrustForce} N</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Gravity Force</span>
                <p className="text-base font-bold text-rose-400 mt-0.5">{weightForce} N</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Net Acceleration</span>
                <p className={`text-base font-bold mt-0.5 ${netForce > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {(netForce / mass).toFixed(1)} m/s²
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Visual Canvas */}
          <div className="h-72 bg-slate-950 rounded-2xl border border-slate-800 relative flex flex-col items-center justify-center p-6 overflow-hidden">
            <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full bg-slate-900 border border-slate-800">
              Flight Status:{' '}
              <span className={isHovering ? 'text-cyan-400' : isAscending ? 'text-emerald-400' : 'text-rose-400'}>
                {isHovering ? '⚖️ Stable Hover' : isAscending ? '🚀 Ascending Flight' : '⬇️ Descending / Falling'}
              </span>
            </div>

            {/* Animated Drone Graphic */}
            <motion.div
              animate={{
                y: isHovering ? [0, -6, 0] : isAscending ? -50 : 50,
                rotate: isHovering ? [0, 1, -1, 0] : 0,
              }}
              transition={{ repeat: isHovering ? Infinity : 0, duration: 2 }}
              className="relative flex flex-col items-center"
            >
              {/* Propeller Thrust Vectors */}
              <div className="flex items-center gap-16 mb-1">
                <span className="w-8 h-1 bg-cyan-400 animate-ping rounded-full" />
                <span className="w-8 h-1 bg-cyan-400 animate-ping rounded-full" />
              </div>
              <div className="text-5xl">🚁</div>
              <span className="text-[10px] font-mono font-bold text-cyan-400 mt-2">F_net = {netForce} N</span>
            </motion.div>
          </div>
        </div>
      )}

      {/* LAB 2: PENDULUM MOTION */}
      {activeTab === 'pendulum' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-5 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" /> Pendulum Physics Parameters
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>String Length (L)</span>
                <span className="text-purple-400 font-mono">{length} m</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={length}
                onChange={(e) => setLength(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Initial Release Angle (θ)</span>
                <span className="text-amber-400 font-mono">{angle}°</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={angle}
                onChange={(e) => setAngle(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-semibold uppercase">Theoretical Oscillation Period (T)</span>
              <p className="text-2xl font-extrabold text-purple-400 font-mono mt-1">{period} Seconds</p>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">Formula: T = 2π √(L / g)</p>
            </div>
          </div>

          <div className="h-72 bg-slate-950 rounded-2xl border border-slate-800 relative flex flex-col items-center justify-start p-6 overflow-hidden">
            <div className="w-16 h-2 bg-slate-700 rounded-full mb-2" />
            <motion.div
              animate={{ rotate: [-angle, angle, -angle] }}
              transition={{ repeat: Infinity, duration: parseFloat(period), ease: 'easeInOut' }}
              style={{ transformOrigin: 'top center' }}
              className="flex flex-col items-center"
            >
              <div className="w-1 bg-purple-400/80 rounded-full" style={{ height: `${length * 40}px` }} />
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] border-2 border-white" />
            </motion.div>
          </div>
        </div>
      )}

      {/* LAB 3: OHM'S LAW CIRCUIT */}
      {activeTab === 'circuit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-5 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Ohm's Law Circuit Controls
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Source Voltage (V)</span>
                <span className="text-amber-400 font-mono">{voltage} Volts</span>
              </div>
              <input
                type="range"
                min="1"
                max="48"
                step="1"
                value={voltage}
                onChange={(e) => setVoltage(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-300 font-semibold">
                <span>Resistor Resistance (R)</span>
                <span className="text-cyan-400 font-mono">{resistance} Ω</span>
              </div>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={resistance}
                onChange={(e) => setResistance(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Current (I = V/R)</span>
                <p className="text-xl font-bold text-amber-400 font-mono mt-0.5">{current} Amperes</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Power Dissipated (P)</span>
                <p className="text-xl font-bold text-cyan-400 font-mono mt-0.5">{power} Watts</p>
              </div>
            </div>
          </div>

          <div className="h-72 bg-slate-950 rounded-2xl border border-slate-800 relative flex items-center justify-center p-6 overflow-hidden">
            <div className="w-56 h-40 border-4 border-amber-500/60 rounded-2xl relative flex items-center justify-center">
              <div className="absolute top-0 -translate-y-1/2 bg-slate-950 px-3 text-amber-400 text-xs font-bold">
                ⚡ Battery: {voltage}V
              </div>
              <div className="absolute bottom-0 translate-y-1/2 bg-slate-950 px-3 text-cyan-400 text-xs font-bold">
                🔌 Load: {resistance} Ω
              </div>

              {/* Glowing Bulb / Load Indicator */}
              <div className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-full border-2 border-amber-400 transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(251, 191, 36, ${Math.min(1, parseFloat(current) / 5)})`,
                    boxShadow: `0 0 ${Math.min(40, parseFloat(current) * 8)}px rgba(251, 191, 36, 0.8)`,
                  }}
                >
                  <Zap className="w-6 h-6 text-slate-950" />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-300 mt-2">I = {current} A</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
