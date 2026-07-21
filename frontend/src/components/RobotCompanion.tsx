import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Cpu, Settings, Volume2, VolumeX, Sliders, Play, Smile } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ChatMessage } from '../types';
import toast from 'react-hot-toast';

interface RobotCompanionProps {
  context?: string;
  imageSrc?: string;
  lastMessage?: ChatMessage;
  isTyping?: boolean;
}

const humorLines = [
  "I promise I won't replace your homework... yet.",
  "I have 0% body fat and 100% enthusiasm.",
  "Good news: I never forget. Bad news: I also never sleep.",
  "Let's make study fun — with zero bugs left behind.",
  "If you feel stressed, remember that even robots need to reboot sometimes.",
  "Your brain is a supercomputer, I'm just here to help you optimize the code!",
  "Mistakes are just data points on the path to success.",
];

export function RobotCompanion({ context, imageSrc, lastMessage, isTyping }: RobotCompanionProps) {
  const [speaking, setSpeaking] = useState(false);
  const [humor, setHumor] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  // Speech settings stored in localStorage
  const [selectedVoiceName, setSelectedVoiceName] = useLocalStorage<string>('robot-voice-name', '');
  const [pitch, setPitch] = useLocalStorage<number>('robot-pitch', 1.1);
  const [rate, setRate] = useLocalStorage<number>('robot-rate', 1.0);
  const [autoSpeak, setAutoSpeak] = useLocalStorage<boolean>('robot-auto-speak', true);

  // AI Counselor engine settings
  const [aiProvider, setAiProvider] = useLocalStorage<string>('robot-ai-provider', 'offline');
  const [openRouterKey, setOpenRouterKey] = useLocalStorage<string>('robot-openrouter-key', '');
  const [groqKey, setGroqKey] = useLocalStorage<string>('robot-groq-key', '');

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voiceEnabled = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, []);

  // Fetch available voices
  useEffect(() => {
    if (!voiceEnabled) return;

    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      // Filter primarily for English voices or just show all if none
      const englishOrAll = allVoices.filter(v => v.lang.toLowerCase().includes('en')) || allVoices;
      setVoices(englishOrAll.length > 0 ? englishOrAll : allVoices);

      // Auto-select a default voice if not set
      if (!selectedVoiceName && allVoices.length > 0) {
        // Try to find a nice robot-like google voice or just the first english voice
        const preferred = allVoices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Robot') || v.lang.includes('en'));
        if (preferred) {
          setSelectedVoiceName(preferred.name);
        } else {
          setSelectedVoiceName(allVoices[0].name);
        }
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceEnabled, selectedVoiceName, setSelectedVoiceName]);

  // Handle speaking text
  const speakText = (text: string) => {
    if (!voiceEnabled) return;
    window.speechSynthesis.cancel();

    // Clean markdown styling so it sounds natural
    const cleanedText = text
      .replace(/[*_`#\-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedText) return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);

    if (selectedVoiceName && voices.length > 0) {
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.pitch = pitch;
    utterance.rate = rate;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      setSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Speak incoming messages (both user inputs and AI replies) automatically
  useEffect(() => {
    if (lastMessage && autoSpeak) {
      // Small timeout to let UI settle
      const timer = setTimeout(() => {
        speakText(lastMessage.content);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lastMessage?.id, autoSpeak]);

  // Greet on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      speakText("Hello! I am Thambi Robo, your study counselor. I am ready to help you with your learning goals.");
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleTestVoice = () => {
    speakText("Testing robot counselor voice settings. How do I sound?");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl overflow-y-auto">
      {/* Robot Profile Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-gray-800/30 dark:to-gray-900/30">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-100">Study Companion</h4>
            <span className="text-xs text-green-500 flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-ping"></span>
              Online & Speakable
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2 rounded-lg transition-colors ${
            showSettings 
              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
          title="Robot Voice Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Voice & Pitch Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Speech Config</span>
                <button
                  onClick={handleTestVoice}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Play className="w-3 h-3" /> Test Voice
                </button>
              </div>

              {/* AI Engine Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">AI Counselor Engine</label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value);
                    toast.success(`Switched AI engine to ${e.target.value === 'offline' ? 'Offline Simulation' : e.target.value === 'openrouter' ? 'Claude 3.5 Sonnet' : 'Groq Llama 3'}`);
                  }}
                  className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="offline">Offline Mode (Simulated AI)</option>
                  <option value="openrouter">OpenRouter (Claude 3.5 Sonnet)</option>
                  <option value="groq">Groq (Llama 3)</option>
                </select>
              </div>

              {/* API Key Input based on selection */}
              {aiProvider === 'openrouter' && (
                <div className="space-y-1 bg-blue-50/20 dark:bg-blue-950/10 p-2.5 rounded-lg border border-blue-100/30 dark:border-blue-900/20">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">OpenRouter API Key</label>
                  <input
                    type="password"
                    placeholder="Enter sk-or-v1-... key"
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[9px] text-gray-400">Your key is stored securely in your browser's localStorage.</p>
                </div>
              )}

              {aiProvider === 'groq' && (
                <div className="space-y-1 bg-purple-50/20 dark:bg-purple-950/10 p-2.5 rounded-lg border border-purple-100/30 dark:border-purple-900/20">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Groq API Key</label>
                  <input
                    type="password"
                    placeholder="Enter gsk_... key"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  />
                  <p className="text-[9px] text-gray-400">Your key is stored securely in your browser's localStorage.</p>
                </div>
              )}

              {/* Auto Speak Toggle */}
              <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200/50 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  {autoSpeak ? <Volume2 className="w-4 h-4 text-blue-500" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auto-speak responses</span>
                </div>
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700"
                />
              </div>

              {/* Voice Selector */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Robot Voice</label>
                <select
                  value={selectedVoiceName}
                  onChange={(e) => setSelectedVoiceName(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  disabled={!voiceEnabled}
                >
                  {!voiceEnabled ? (
                    <option>Speech synthesis not supported</option>
                  ) : voices.length === 0 ? (
                    <option>Loading voices...</option>
                  ) : (
                    voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Pitch Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-blue-500" /> Pitch
                  </span>
                  <span className="text-gray-500 font-mono">{pitch.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Speed/Rate Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-blue-500" /> Speaking Speed
                  </span>
                  <span className="text-gray-500 font-mono">{rate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Avatar & Visualizer Section */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="relative group">
          {/* Animated pulsing wave rings when speaking */}
          {speaking && (
            <>
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-30 animate-pulse duration-1000"></div>
              <div className="absolute -inset-1.5 border border-blue-500 rounded-full animate-ping opacity-60"></div>
              <div className="absolute -inset-3 border border-indigo-400 rounded-full animate-ping opacity-40" style={{ animationDelay: '0.3s' }}></div>
            </>
          )}

          {/* Avatar frame */}
          <div
            className={`relative w-48 h-48 rounded-full overflow-hidden border-4 bg-white dark:bg-white shadow-lg flex items-center justify-center transition-all duration-300 ${
              speaking 
                ? 'border-blue-500 scale-105 shadow-blue-500/20' 
                : 'border-slate-200 dark:border-slate-200'
            }`}
          >
            <img
              src={imageSrc || '/robot.png'}
              alt="Robot Study Counselor"
              className={`w-36 h-36 object-contain drop-shadow-md transition-transform duration-300 ${
                speaking ? 'animate-bounce' : ''
              }`}
            />
          </div>
        </div>

        {/* Live Audio Status */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Sparkles className={`w-4 h-4 text-amber-500 ${speaking ? 'animate-spin' : ''}`} />
            <span>
              {isTyping 
                ? 'Robot is processing...' 
                : speaking 
                  ? 'Speaking responses...' 
                  : 'Ready to listen & talk'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {speaking ? 'Hearing robot voice' : 'Speech synthesis active'}
          </p>
        </div>

        {/* Speaking visualizer lines */}
        {speaking && (
          <div className="flex justify-center items-center gap-1.5 h-6">
            <div className="w-1.5 h-4 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1.5 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
            <div className="w-1.5 h-5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            <div className="w-1.5 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }}></div>
          </div>
        )}

        {/* Speech bubble */}
        <div className="w-full max-w-sm rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-4 dark:border-gray-800 dark:from-gray-900/50 dark:to-indigo-950/20 text-left relative">
          <div className="absolute top-[-8px] left-[50%] translate-x-[-50%] w-4 h-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-gray-900/50 border-t border-l border-blue-100 dark:border-gray-800 rotate-45"></div>
          <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <Smile className="w-3.5 h-3.5" />
            <span>Robot Mentorship Quote:</span>
          </div>
          <p className="text-xs text-gray-700 dark:text-gray-300 italic leading-relaxed">
            {isTyping ? 'I am preparing a thoughtful response.' : humor || lastMessage?.content || 'Ask me a question or tell me how you are feeling, and I will explain or guide you step by step!'}
          </p>
        </div>
      </div>
    </div>
  );
}
