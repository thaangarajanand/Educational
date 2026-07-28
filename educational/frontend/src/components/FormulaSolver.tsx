import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, CheckCircle2, ArrowRight, Sparkles, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface PresetFormula {
  id: string;
  title: string;
  category: string;
  formulaTex: string;
  variables: { name: string; symbol: string; defaultValue: number; unit: string }[];
  calculate: (inputs: Record<string, number>) => { result: number; unit: string; steps: string[] };
}

const presetFormulas: PresetFormula[] = [
  {
    id: 'f1',
    title: 'Kinematic Velocity & Acceleration',
    category: 'Physics',
    formulaTex: 'v = u + a * t',
    variables: [
      { name: 'Initial Velocity (u)', symbol: 'u', defaultValue: 0, unit: 'm/s' },
      { name: 'Acceleration (a)', symbol: 'a', defaultValue: 9.81, unit: 'm/s²' },
      { name: 'Time (t)', symbol: 't', defaultValue: 3, unit: 's' },
    ],
    calculate: (inputs) => {
      const u = inputs.u || 0;
      const a = inputs.a || 0;
      const t = inputs.t || 0;
      const res = u + a * t;
      return {
        result: Math.round(res * 100) / 100,
        unit: 'm/s',
        steps: [
          `Step 1: Identify given variables ➔ u = ${u} m/s, a = ${a} m/s², t = ${t} s`,
          `Step 2: Apply linear kinematics equation ➔ v = u + (a × t)`,
          `Step 3: Substitute values ➔ v = ${u} + (${a} × ${t}) = ${res.toFixed(2)} m/s`,
        ],
      };
    },
  },
  {
    id: 'f2',
    title: 'Kinetic Energy of Moving Mass',
    category: 'Physics & Robotics',
    formulaTex: 'Ek = 1/2 * m * v²',
    variables: [
      { name: 'Mass (m)', symbol: 'm', defaultValue: 2, unit: 'kg' },
      { name: 'Velocity (v)', symbol: 'v', defaultValue: 5, unit: 'm/s' },
    ],
    calculate: (inputs) => {
      const m = inputs.m || 0;
      const v = inputs.v || 0;
      const res = 0.5 * m * v * v;
      return {
        result: Math.round(res * 100) / 100,
        unit: 'Joules (J)',
        steps: [
          `Step 1: Identify given parameters ➔ m = ${m} kg, v = ${v} m/s`,
          `Step 2: Apply kinetic energy formula ➔ Ek = ½ × m × v²`,
          `Step 3: Square velocity ➔ v² = ${v * v}`,
          `Step 4: Calculate final energy ➔ Ek = 0.5 × ${m} × ${v * v} = ${res.toFixed(2)} Joules`,
        ],
      };
    },
  },
  {
    id: 'f3',
    title: 'Quadratic Equation Roots Solver',
    category: 'Mathematics',
    formulaTex: 'x = (-b ± √(b² - 4ac)) / (2a)',
    variables: [
      { name: 'Coefficient a', symbol: 'a', defaultValue: 1, unit: '' },
      { name: 'Coefficient b', symbol: 'b', defaultValue: -5, unit: '' },
      { name: 'Coefficient c', symbol: 'c', defaultValue: 6, unit: '' },
    ],
    calculate: (inputs) => {
      const a = inputs.a || 1;
      const b = inputs.b || 0;
      const c = inputs.c || 0;
      const disc = b * b - 4 * a * c;
      if (disc < 0) {
        return {
          result: 0,
          unit: 'Complex / Imaginary Roots',
          steps: [
            `Step 1: Calculate Discriminant Δ = b² - 4ac ➔ (${b})² - 4(${a})(${c}) = ${disc}`,
            `Step 2: Discriminant Δ < 0, so equation has non-real complex roots.`,
          ],
        };
      }
      const x1 = (-b + Math.sqrt(disc)) / (2 * a);
      const x2 = (-b - Math.sqrt(disc)) / (2 * a);
      return {
        result: Math.round(x1 * 100) / 100,
        unit: `Root x1 = ${x1.toFixed(2)}, Root x2 = ${x2.toFixed(2)}`,
        steps: [
          `Step 1: Calculate Discriminant Δ = b² - 4ac ➔ (${b})² - 4(${a})(${c}) = ${disc}`,
          `Step 2: Apply quadratic formula ➔ x = (-(${b}) ± √${disc}) / (2 × ${a})`,
          `Step 3: First Root x1 = ${x1.toFixed(2)}`,
          `Step 4: Second Root x2 = ${x2.toFixed(2)}`,
        ],
      };
    },
  },
];

export function FormulaSolver() {
  const [selectedFormula, setSelectedFormula] = useState<PresetFormula>(presetFormulas[0]);
  const [inputValues, setInputValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    presetFormulas[0].variables.forEach(v => { init[v.symbol] = v.defaultValue; });
    return init;
  });

  const [solution, setSolution] = useState(() => presetFormulas[0].calculate(inputValues));

  const handleVariableChange = (symbol: string, val: number) => {
    const nextInputs = { ...inputValues, [symbol]: val };
    setInputValues(nextInputs);
    setSolution(selectedFormula.calculate(nextInputs));
  };

  const handleSelectFormula = (f: PresetFormula) => {
    setSelectedFormula(f);
    const init: Record<string, number> = {};
    f.variables.forEach(v => { init[v.symbol] = v.defaultValue; });
    setInputValues(init);
    setSolution(f.calculate(init));
  };

  return (
    <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -left-20 -top-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Step-by-Step AI Formula Solver
          </div>
          <h2 className="text-2xl font-bold text-white font-heading flex items-center gap-2">
            📐 STEM Formula & Equation Step-by-Step Solver
          </h2>
          <p className="text-xs text-slate-400">
            Select a physics or math formula, adjust variable parameters, and view step-by-step mathematical derivations.
          </p>
        </div>
      </div>

      {/* Preset Formulas Catalog Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {presetFormulas.map((f) => (
          <button
            key={f.id}
            onClick={() => handleSelectFormula(f)}
            className={`p-4 rounded-2xl border text-left transition-all ${
              selectedFormula.id === f.id
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80">{f.category}</span>
            <h4 className="text-sm font-bold text-white mt-0.5">{f.title}</h4>
            <p className="text-xs font-mono text-cyan-400 mt-1">{f.formulaTex}</p>
          </button>
        ))}
      </div>

      {/* Variable Inputs & Step Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Controls & Variables */}
        <div className="space-y-4 bg-slate-900/60 p-6 rounded-2xl border border-slate-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Calculator className="w-4 h-4 text-cyan-400" /> Variable Inputs
          </h3>

          <div className="space-y-4">
            {selectedFormula.variables.map((v) => (
              <div key={v.symbol} className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-semibold">
                  <span>{v.name}</span>
                  <span className="text-cyan-400 font-mono">
                    {inputValues[v.symbol] !== undefined ? inputValues[v.symbol] : v.defaultValue} {v.unit}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={inputValues[v.symbol] !== undefined ? inputValues[v.symbol] : v.defaultValue}
                  onChange={(e) => handleVariableChange(v.symbol, parseFloat(e.target.value) || 0)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Step-by-Step Derivation Breakdown */}
        <div className="space-y-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" /> Derivation Breakdown
            </h3>
            <span className="text-xs text-emerald-400 font-bold bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">
              {solution.unit}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {solution.steps.map((step, idx) => (
              <div key={idx} className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
