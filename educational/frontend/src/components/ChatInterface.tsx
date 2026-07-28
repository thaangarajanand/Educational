import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, BookOpen, Mic, MicOff, Settings, X, Check, Cpu } from 'lucide-react';
import { ChatMessage } from '../types';
import { grokAPI } from '../lib/grok';
import { openRouterAPI } from '../lib/openrouter';
import { useLocalStorage } from '../hooks/useLocalStorage';
import toast from 'react-hot-toast';
import { Robot3DCanvas } from './Robot3DCanvas';
import { getSelectedLanguage, getSpeechLanguageCode, t, Language } from '../lib/i18n';

interface ChatInterfaceProps {
  onStartQuiz: (subject: string) => void;
}

// Helpers
function detectIntent(text: string) {
  const t = (text || '').toLowerCase();
  if (/quiz|practice|question|test|exercise/.test(t)) return 'request_quiz';
  if (/sad|depress|anx|stress|stressed|angry|upset|nervous/.test(t)) return 'emotion';
  if (/how|what|why|explain|example|solve/.test(t)) return 'question';
  return 'other';
}

function postProcessResponse(response: string): string {
  let out = String(response || '').trim();
  if (!out) return "I am Thambi Robo, your study counselor! Let's explore your learning goals step-by-step.";
  if (out.length > 1200) out = out.slice(0, 1200) + '...';
  return out;
}

function generateFallbackResponse(userInput: string): string {
  const text = (userInput || '').toLowerCase();
  if (text.includes('math') || text.includes('solve')) {
    return "I am Thambi Robo! Let's break down your math query. When solving equations:\n\n1. Move all variable terms to one side and constants to the other.\n2. Apply inverse operations step-by-step.\n3. Verify your result by plugging it back into the original equation.\n\nWould you like to start a mathematics practice quiz?";
  }
  if (text.includes('physics') || text.includes('force')) {
    return "Thambi Robo here! For physics:\n\n1. Identify what variables you have (e.g., mass, acceleration).\n2. Choose the correct formula (like F = m * a).\n3. Keep your units consistent (e.g., kg, m/s²).\n\nLet's start a physics practice quiz to test this out!";
  }
  if (text.includes('stress') || text.includes('anxious') || text.includes('fail')) {
    return "I hear you, and it is completely natural to feel overwhelmed. As Thambi Robo, I suggest taking a short 5-minute breathing break. Break your study topics into tiny, manageable portions. Consistent effort is what matters. I believe in you!";
  }
  return "Hi, I am Thambi Robo, your learning companion. I am here to help you review study topics, manage exam stress, or run a practice quiz. What would you like to practice today?";
}

function generateSuggestions(userInput: string, aiResponse: string): string[] {
  const intent = detectIntent(userInput || aiResponse);
  const combined = (userInput + ' ' + aiResponse).toLowerCase();

  if (intent === 'request_quiz' || combined.includes('quiz') || combined.includes('math')) {
    return ['Start math practice quiz', 'Show me a brief study plan', 'Explain this concept simply', 'I need motivation to study'];
  }
  if (intent === 'emotion' || combined.includes('stress')) {
    return ["I'm feeling anxious, help me relax", 'How to manage exam stress', 'I need motivation to study', 'Show me study techniques'];
  }
  return ['I want to practice physics', 'How to manage exam stress', 'I need motivation to study', 'Tell me about robotics'];
}

export function ChatInterface({ onStartQuiz }: ChatInterfaceProps) {
  const initialSystemMessage: ChatMessage = {
    id: 'welcome',
    type: 'ai',
    content: "Hi there! I'm Thambi Robo, your study counselor and robotics mentor. I can help explain concepts simply, generate practice quizzes, and manage exam stress. What would you like to explore today?",
    timestamp: new Date().toISOString(),
    suggestions: [
      "I'm stressed about exams",
      "I need motivation to study",
      "I want to practice physics"
    ]
  };

  const [messages, setMessages] = useState<ChatMessage[]>([initialSystemMessage]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [robotEmotion, setRobotEmotion] = useState<'happy' | 'sad' | 'love' | 'dance' | 'thinking'>('happy');

  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());

  useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  // Settings
  const [selectedVoiceName, setSelectedVoiceName] = useLocalStorage<string>('robot-voice-name', '');
  const [pitch, setPitch] = useLocalStorage<number>('robot-pitch', 1.1);
  const [rate, setRate] = useLocalStorage<number>('robot-rate', 1.0);
  const [autoSpeak, setAutoSpeak] = useLocalStorage<boolean>('robot-auto-speak', true);
  const [aiProvider, setAiProvider] = useLocalStorage<string>('robot-ai-provider', 'grok');

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voiceEnabled = useMemo(() => typeof window !== 'undefined' && 'speechSynthesis' in window, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Detect emotion from user input / AI output
  const updateEmotion = (text: string) => {
    const lower = text.toLowerCase();
    if (/dance|groove|music|party|dance for me|moves/i.test(lower)) {
      setRobotEmotion('dance');
    } else if (/sad|depressed|fail|upset|cry|anxious|lonely|down|stressed/i.test(lower)) {
      setRobotEmotion('sad');
    } else if (/love|friend|best friend|hug|heart|care|thank/i.test(lower)) {
      setRobotEmotion('love');
    } else {
      setRobotEmotion('happy');
    }
  };

  // Voice Synthesis Setup
  useEffect(() => {
    if (!voiceEnabled) return;
    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const englishOrAll = allVoices.filter(v => v.lang.toLowerCase().includes('en')) || allVoices;
      setVoices(englishOrAll.length > 0 ? englishOrAll : allVoices);
      if (!selectedVoiceName && allVoices.length > 0) {
        const preferred = allVoices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang.includes('en'));
        if (preferred) setSelectedVoiceName(preferred.name);
        else setSelectedVoiceName(allVoices[0].name);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [voiceEnabled, selectedVoiceName, setSelectedVoiceName]);

  const speakText = (text: string) => {
    if (!voiceEnabled || showSettings) return;
    window.speechSynthesis.cancel();
    const cleanedText = text.replace(/[*_`#\-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanedText) return;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = getSpeechLanguageCode(currentLang);
    if (selectedVoiceName && voices.length > 0) {
      const voice = voices.find(v => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }
    utterance.pitch = pitch;
    utterance.rate = rate;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      speakText(initialSystemMessage.content);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Web Speech Recognition setup (WhatsApp Voice Recording)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = getSpeechLanguageCode(currentLang);

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          setInputMessage(transcript);
        };
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = () => setIsRecording(false);
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast.error('Voice recording is not supported in this browser. Try Chrome or Edge!');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      setInputMessage('');
      try {
        recognitionRef.current.lang = getSpeechLanguageCode(currentLang);
        recognitionRef.current.start();
        toast.success(t('mic_listen', currentLang, 'Listening... Speak your message now!'));
      } catch (err) {
        console.error('Speech recognition start error:', err);
      }
    }
  };

  const toggleSettings = () => {
    if (voiceEnabled) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setShowSettings(prev => !prev);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);
    updateEmotion(content);

    const context = messages.slice(-6).map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');

    try {
      let response = aiProvider === 'openrouter' 
        ? await openRouterAPI.getCounselingResponse(content, context)
        : await grokAPI.getAssistantReply(content, context);

      const processed = postProcessResponse(response);
      updateEmotion(processed);

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'ai',
        content: processed,
        timestamp: new Date().toISOString(),
        suggestions: generateSuggestions(content, processed),
      };

      setMessages(prev => [...prev, aiMessage]);
      if (autoSpeak) speakText(processed);
    } catch (error) {
      console.error('Chat error:', error);
      const fallback = generateFallbackResponse(content);
      updateEmotion(fallback);

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'ai',
        content: fallback,
        timestamp: new Date().toISOString(),
        suggestions: generateSuggestions(content, fallback),
      };
      setMessages(prev => [...prev, aiMessage]);
      if (autoSpeak) speakText(fallback);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion.toLowerCase().includes('quiz') || suggestion.toLowerCase().includes('start')) {
      onStartQuiz('mathematics');
      toast.success('Starting practice quiz!');
    } else {
      sendMessage(suggestion);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 my-2">
      {/* Top Header Bar */}
      <div className="px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
            <Cpu className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              {t('robo_counselor', currentLang, 'Thambi Robo Counselor')} <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">xAI Grok</span>
            </h3>
            <p className="text-xs text-slate-400">{t('robo_subtitle', currentLang, 'Interactive 3D Study Mentor & Loving Robot Friend')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleSettings}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            title="AI & Voice Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" /> AI Engine & Voice Settings
                </h3>
                <button onClick={toggleSettings} className="p-1 rounded-lg text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* AI Engine Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select AI Counselor Engine
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value);
                    toast.success(`Switched AI engine to ${e.target.value === 'openrouter' ? 'Claude 3.5 Sonnet' : 'xAI Grok'}`);
                  }}
                  className="w-full text-sm p-3 rounded-xl border border-slate-700 bg-slate-800 text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="grok">⚡ xAI Grok (Render Server Environment Key — Recommended)</option>
                  <option value="openrouter">🧠 OpenRouter (Claude 3.5 Sonnet)</option>
                </select>
              </div>

              {/* Voice Speed & Pitch */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Voice Speech Settings
                </label>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>Speech Rate / Speed</span>
                    <span>{rate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={toggleSettings}
                className="w-full py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-500 transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" /> Done & Save Settings
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CENTER STAGE: Exact Match 3D Robot Model */}
      <div className="relative py-3 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800/80 flex flex-col items-center justify-center flex-shrink-0">
        <div className="w-full max-w-sm h-72 flex items-center justify-center relative overflow-hidden">
          <Robot3DCanvas isSpeaking={isSpeaking} isThinking={isTyping} emotion={robotEmotion} />
        </div>

        {/* Action & Emotion Trigger Bar */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 px-4">
          <button
            onClick={() => sendMessage("Dance for me, Thambi Robo!")}
            className="text-xs px-3 py-1.5 rounded-full bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 border border-indigo-500/40 transition-colors font-medium flex items-center gap-1.5"
          >
            {t('btn_dance', currentLang, '🕺 Dance for me!')}
          </button>
          <button
            onClick={() => sendMessage("You are my best friend and mentor!")}
            className="text-xs px-3 py-1.5 rounded-full bg-pink-600/30 hover:bg-pink-600 text-pink-200 border border-pink-500/40 transition-colors font-medium flex items-center gap-1.5"
          >
            {t('btn_hug', currentLang, '💖 Best Friend Hug')}
          </button>
          <button
            onClick={() => sendMessage("I'm feeling sad and overwhelmed with exams...")}
            className="text-xs px-3 py-1.5 rounded-full bg-amber-600/30 hover:bg-amber-600 text-amber-200 border border-amber-500/40 transition-colors font-medium flex items-center gap-1.5"
          >
            {t('btn_sad', currentLang, "😢 I'm feeling down...")}
          </button>
          <button
            onClick={() => sendMessage("Give me strong study motivation!")}
            className="text-xs px-3 py-1.5 rounded-full bg-blue-600/30 hover:bg-blue-600 text-blue-200 border border-blue-500/40 transition-colors font-medium flex items-center gap-1.5"
          >
            {t('btn_motivation', currentLang, '💡 Study Motivation')}
          </button>
        </div>

        {/* Live Speaking & Emotion Status */}
        <div className="mt-2 flex items-center gap-2.5 text-xs font-semibold px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-200 shadow-xl backdrop-blur-md">
          {isSpeaking ? (
            <div className="flex items-center gap-1 h-3 px-1">
              <span className="w-1 bg-cyan-400 rounded-full animate-[bounce_0.6s_infinite_100ms]" style={{ height: '100%' }} />
              <span className="w-1 bg-cyan-300 rounded-full animate-[bounce_0.6s_infinite_200ms]" style={{ height: '70%' }} />
              <span className="w-1 bg-purple-400 rounded-full animate-[bounce_0.6s_infinite_300ms]" style={{ height: '90%' }} />
              <span className="w-1 bg-cyan-400 rounded-full animate-[bounce_0.6s_infinite_150ms]" style={{ height: '60%' }} />
              <span className="w-1 bg-pink-400 rounded-full animate-[bounce_0.6s_infinite_250ms]" style={{ height: '85%' }} />
            </div>
          ) : (
            <span className={`w-2 h-2 rounded-full ${isTyping ? 'bg-purple-400 animate-pulse' : 'bg-cyan-400'}`}></span>
          )}
          <span>
            {robotEmotion === 'dance'
              ? t('status_dancing', currentLang, '🕺 Thambi Robo is dancing to cheer you up!')
              : robotEmotion === 'sad'
              ? t('status_comforting', currentLang, '💖 Thambi Robo is comforting you with care...')
              : robotEmotion === 'love'
              ? t('status_love', currentLang, '♥ Thambi Robo sends best-friend love!')
              : isSpeaking
              ? t('status_speaking', currentLang, '🗣️ Voice Synthesis Active...')
              : isTyping
              ? t('status_thinking', currentLang, '🧠 Thambi Robo is thinking...')
              : t('status_ready', currentLang, '🟢 Ready to listen & talk')}
          </span>
        </div>
      </div>

      {/* Middle Scrollable Chat Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/60">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-4 shadow-md text-sm leading-relaxed ${
                msg.type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-none'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5 opacity-80 text-[11px] font-semibold">
                {msg.type === 'user' ? (
                  <><span>You</span><User className="w-3 h-3" /></>
                ) : (
                  <><Bot className="w-3.5 h-3.5 text-blue-400" /><span>Thambi Robo</span></>
                )}
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Suggestions Pills */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-2">
                  {msg.suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(s)}
                      className="text-xs px-3 py-1.5 rounded-full bg-slate-700/70 hover:bg-blue-500 hover:text-white text-slate-200 transition-colors border border-slate-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-slate-400 text-xs pl-2">
            <Bot className="w-4 h-4 text-blue-400 animate-spin" />
            <span>Thambi Robo is crafting a response...</span>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* WHATSAPP-STYLE BOTTOM INPUT BAR */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex-shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (inputMessage.trim()) sendMessage(inputMessage);
          }}
          className="flex items-center gap-2"
        >
          {/* WhatsApp Voice Message Microphone Button */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`p-3 rounded-full transition-all duration-300 flex items-center justify-center ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40 ring-4 ring-red-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
            title={isRecording ? 'Stop Recording' : 'Click to Record Voice Message'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-blue-400" />}
          </button>

          {/* WhatsApp Input Field */}
          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={isRecording ? t('mic_listen', currentLang, '🔴 Listening to your voice message...') : t('placeholder_type_message', currentLang, 'Type a message...')}
              className={`w-full py-3 pl-4 pr-10 rounded-full bg-slate-900 border text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner ${
                isRecording ? 'border-red-500/60 bg-red-950/20' : 'border-slate-700'
              }`}
              disabled={isTyping}
            />

            {/* Quick Practice Quiz Pill */}
            <button
              type="button"
              onClick={() => onStartQuiz('Robotics & Math')}
              className="absolute right-3 p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
              title="Start Practice Quiz"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          </div>

          {/* WhatsApp Send Button */}
          <button
            type="submit"
            disabled={!inputMessage.trim() || isTyping}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}