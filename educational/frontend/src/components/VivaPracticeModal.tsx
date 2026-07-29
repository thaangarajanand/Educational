import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Award, CheckCircle, ArrowRight, X, Sparkles, AlertCircle } from 'lucide-react';
import { getSelectedLanguage, getSpeechLanguageCode, t, Language } from '../lib/i18n';
import toast from 'react-hot-toast';

interface VivaQuestion {
  id: number;
  question: string;
  expectedKeywords: string[];
  sampleAnswer: string;
}

const vivaQuestionsList: Record<Language, VivaQuestion[]> = {
  en: [
    {
      id: 1,
      question: "Explain Newton's Second Law of Motion and give a practical real-world example.",
      expectedKeywords: ['force', 'mass', 'acceleration', 'f=ma', 'proportional'],
      sampleAnswer: "Force equals mass times acceleration (F=ma). An example is pushing a heavy cart vs a light cart; the lighter cart accelerates faster with the same force.",
    },
    {
      id: 2,
      question: "What are the four main aerodynamic forces acting on a drone quadcopter in flight?",
      expectedKeywords: ['lift', 'weight', 'thrust', 'drag', 'gravity'],
      sampleAnswer: "The four forces are Lift (upwards), Weight/Gravity (downwards), Thrust (forward), and Drag (air resistance).",
    },
    {
      id: 3,
      question: "How does a PID controller help stabilize an autonomous robot's movement?",
      expectedKeywords: ['proportional', 'integral', 'derivative', 'error', 'feedback'],
      sampleAnswer: "A PID controller adjusts motor speeds using Proportional, Integral, and Derivative calculations to minimize error between desired position and actual position.",
    },
  ],

  ta: [
    {
      id: 1,
      question: "நியூட்டனின் இரண்டாம் இயக்க விதியையும் அதன் நிஜ உலக உதாரணத்தையும் விளக்குக.",
      expectedKeywords: ['விசை', 'நிறை', 'முடுக்கம்', 'f=ma'],
      sampleAnswer: "விசை என்பது நிறை பெருக்கல் முடுக்கம் (F=ma). ஒரு கனமான வண்டியைத் தள்ளுவதை விட லேசான வண்டியைத் தள்ளும்போது அதிக முடுக்கம் கிடைக்கும்.",
    },
    {
      id: 2,
      question: "ட்ரோன் பறக்கும் போது செயல்படும் நான்கு முக்கிய ஏரோடைனமிக் விசைகள் யாவை?",
      expectedKeywords: ['ஏற்றம்', 'எடை', 'உந்துவிசை', 'இழுவை'],
      sampleAnswer: "நான்கு விசைகள்: மேலே தூக்கும் விசை (Lift), கீழே ஈர்க்கும் எடை (Weight), முன்னோக்கி தள்ளும் உந்துவிசை (Thrust), மற்றும் காற்று தடை (Drag).",
    },
    {
      id: 3,
      question: "PID கட்டுப்படுத்தி ஒரு தன்னாட்சி ரோபோவின் இயக்கத்தை எவ்வாறு நிலைப்படுத்துகிறது?",
      expectedKeywords: ['விகிதாசார', 'தொகை', 'வகைக்கெழு', 'பிழை'],
      sampleAnswer: "PID கட்டுப்படுத்தி விகிதாசார, தொகை மற்றும் வகைக்கெழு கணிப்புகளைப் பயன்படுத்தி ரோபோவின் பிழையைக் குறைத்து அதை நிலைப்படுத்துகிறது.",
    },
  ],

  hi: [
    {
      id: 1,
      question: "न्यूटन के गति के दूसरे नियम को समझाइए और एक व्यावहारिक उदाहरण दीजिए।",
      expectedKeywords: ['बल', 'द्रव्यमान', 'त्वरण', 'f=ma'],
      sampleAnswer: "बल द्रव्यमान और त्वरण के गुणनफल के बराबर होता है (F=ma)। एक भारी गाड़ी की तुलना में हल्की गाड़ी को धकेलने पर वह तेजी से त्वरित होती है।",
    },
    {
      id: 2,
      question: "ड्रोन उड़ान के दौरान काम करने वाले चार मुख्य वायुगतिकीय बल कौन से हैं?",
      expectedKeywords: ['लिफ्ट', 'भार', 'थ्रस्ट', 'ड्रैग'],
      sampleAnswer: "चार बल हैं: लिफ्ट (ऊपर), भार (नीचे), थ्रस्ट (आगे), और ड्रैग (हवा का प्रतिरोध)।",
    },
    {
      id: 3,
      question: "PID कंट्रोलर एक स्वायत्त रोबोट की गति को कैसे स्थिर करता है?",
      expectedKeywords: ['अनुपातिक', 'अविभाज्य', 'व्युत्पन्न', 'त्रुटि'],
      sampleAnswer: "PID कंट्रोलर अनुपातिक, अविभाज्य और व्युत्पन्न गणनाओं का उपयोग करके वांछित स्थिति और वास्तविक स्थिति के बीच त्रुटि को कम करता है।",
    },
  ],
};

interface VivaPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VivaPracticeModal({ isOpen, onClose }: VivaPracticeModalProps) {
  const [currentLang, setCurrentLang] = useState<Language>(getSelectedLanguage());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [evaluation, setEvaluation] = useState<{ score: number; feedback: string; matchedKeywords: string[] } | null>(null);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleLangChange = () => {
      setCurrentLang(getSelectedLanguage());
    };
    window.addEventListener('language-change', handleLangChange);
    return () => window.removeEventListener('language-change', handleLangChange);
  }, []);

  const questions = vivaQuestionsList[currentLang] || vivaQuestionsList['en'];
  const currentQ = questions[questionIndex] || questions[0];

  const speakQuestion = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLanguageCode(currentLang);
    utterance.onstart = () => setIsSpeakingQuestion(true);
    utterance.onend = () => setIsSpeakingQuestion(false);
    utterance.onerror = () => setIsSpeakingQuestion(false);
    window.speechSynthesis.speak(utterance);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser. Try Chrome or Edge!');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = getSpeechLanguageCode(currentLang);

    recognition.onstart = () => {
      setIsRecording(true);
      setSpokenTranscript('');
      setEvaluation(null);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        finalTranscript += event.results[i][0].transcript;
      }
      setSpokenTranscript(finalTranscript);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const evaluateAnswer = () => {
    if (!spokenTranscript.trim()) {
      toast.error('Please record your spoken answer first!');
      return;
    }

    const transcriptLower = spokenTranscript.toLowerCase();
    const matched = currentQ.expectedKeywords.filter(kw => transcriptLower.includes(kw.toLowerCase()));
    const ratio = matched.length / (currentQ.expectedKeywords.length || 1);
    let calculatedScore = Math.round(ratio * 10);
    if (calculatedScore < 4 && spokenTranscript.length > 20) calculatedScore = 5;
    if (calculatedScore > 10) calculatedScore = 10;

    let fb = 'Good attempt! Try including more core scientific terminology next time.';
    if (calculatedScore >= 8) {
      fb = 'Outstanding response! Excellent usage of key concept terms and clear articulation.';
    } else if (calculatedScore >= 6) {
      fb = 'Solid answer! You captured the main ideas accurately.';
    }

    setEvaluation({
      score: calculatedScore,
      feedback: fb,
      matchedKeywords: matched,
    });
  };

  const nextQuestion = () => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex(prev => prev + 1);
      setSpokenTranscript('');
      setEvaluation(null);
    } else {
      toast.success('🎉 AI Viva Practice Session Completed!');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
      >
        <div className="absolute -right-20 -top-20 w-60 h-60 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
              <Mic className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading flex items-center gap-2">
                🎙️ AI Voice Viva / Oral Exam Mode
              </h3>
              <p className="text-xs text-slate-400">Practice oral examination questions with Thambi Robo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Counter & Controls */}
        <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-cyan-400 font-bold uppercase tracking-wider">
            <span>Viva Question {questionIndex + 1} of {questions.length}</span>
            <button
              onClick={() => speakQuestion(currentQ.question)}
              className="flex items-center gap-1.5 px-3 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 rounded-full text-cyan-300 transition-colors"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isSpeakingQuestion ? 'animate-bounce' : ''}`} />
              {isSpeakingQuestion ? 'Speaking Question...' : 'Listen Question'}
            </button>
          </div>
          <h4 className="text-base font-bold text-white leading-relaxed">{currentQ.question}</h4>
        </div>

        {/* Spoken Answer Recording Box */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" /> Your Spoken Answer (Speak into Mic)
            </label>
            {spokenTranscript && !evaluation && (
              <button
                onClick={evaluateAnswer}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors shadow-md"
              >
                Evaluate Answer
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={spokenTranscript}
              onChange={(e) => setSpokenTranscript(e.target.value)}
              placeholder="Click microphone below to start speaking your viva answer..."
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
            />
            <button
              onClick={toggleRecording}
              className={`absolute right-3 bottom-3 p-3 rounded-full transition-all shadow-lg ${
                isRecording ? 'bg-red-500 text-white animate-ping ring-4 ring-red-500/30' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Recording Voice'}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Evaluation Output */}
        {evaluation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-slate-950 rounded-2xl border border-slate-800 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Award className="w-5 h-5" /> Viva Score: {evaluation.score} / 10
              </div>
              <span className="text-xs text-slate-400">Matched Keywords: {evaluation.matchedKeywords.join(', ') || 'None'}</span>
            </div>
            <p className="text-xs text-slate-300">{evaluation.feedback}</p>

            <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-400">
              <span className="font-bold text-slate-300">Model Answer: </span>
              {currentQ.sampleAnswer}
            </div>
          </motion.div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            Close Session
          </button>

          <button
            onClick={nextQuestion}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            {questionIndex < questions.length - 1 ? 'Next Question' : 'Complete Session'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
