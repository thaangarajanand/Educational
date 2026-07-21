import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, BookOpen } from 'lucide-react';
import { ChatMessage } from '../types';
import { groqAPI } from '../lib/groq';
import { openRouterAPI, getLocalResources } from '../lib/openrouter';
import { useLocalStorage } from '../hooks/useLocalStorage';
import toast from 'react-hot-toast';
import { RobotCompanion } from './RobotCompanion';

interface ChatInterfaceProps {
  onStartQuiz: (subject: string) => void;
}

export function ChatInterface({ onStartQuiz }: ChatInterfaceProps) {
  const initialSystemMessage: ChatMessage = {
    id: 'welcome',
    type: 'ai',
    content: "Hi there! I'm Thambi Robo, your study counselor and robotics mentor. I can help explain concepts simply, generate practice quizzes, and manage exam stress. What would you like to explore today?",
    timestamp: new Date().toISOString(),
    suggestions: [
      "I'm stressed about exams",
      "I failed my math test",
      "I need motivation to study",
      "I want to practice physics"
    ]
  };

  const [messages, setMessages] = useLocalStorage<ChatMessage[]>('chat-messages', [initialSystemMessage]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [resources, setResources] = useState<{ title: string; summary: string; link?: string }[]>([]);
  const robotImageSrc = '/robot.png';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Build a lightweight context (last few messages) to send to the model
    const context = messages.slice(-6).map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');

    try {
      const provider = typeof window !== 'undefined' 
        ? (window.localStorage.getItem('robot-ai-provider')?.replace(/"/g, '') || 'offline') 
        : 'offline';

      let response = '';
      if (provider === 'openrouter') {
        response = await openRouterAPI.getCounselingResponse(content, context);
      } else if (provider === 'groq') {
        response = await groqAPI.getAssistantReply(content, context);
      } else {
        // Force offline mode for Thambi Robo local intelligence
        throw new Error('OFFLINE_MODE');
      }

      // Small post-processing to ensure helpfulness
      const processed = postProcessResponse(response);

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'ai',
        content: processed,
        timestamp: new Date().toISOString(),
        suggestions: generateSuggestions(content, processed),
        topic: detectTopic(content + ' ' + processed),
        mood: detectMood(content + ' ' + processed),
      };

      setMessages(prev => [...prev, aiMessage]);
      // fetch local resources when topic detected
      const topic = detectTopic(content + ' ' + processed);
      if (topic) {
        const res = await getLocalResources(topic);
        setResources(res);
      } else {
        setResources([]);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const fallback = generateFallbackResponse(content);
      if (error?.message !== 'OFFLINE_MODE') {
        toast.error('Connection failed: showing helpful fallback');
      }
      const fallbackMessage: ChatMessage = {
        id: crypto.randomUUID(),
        type: 'ai',
        content: fallback,
        timestamp: new Date().toISOString(),
        suggestions: generateSuggestions(content, fallback),
        topic: detectTopic(content + ' ' + fallback),
        mood: detectMood(content + ' ' + fallback),
      };
      setMessages(prev => [...prev, fallbackMessage]);
      const topic = detectTopic(content + ' ' + fallback);
      if (topic) {
        const res = await getLocalResources(topic);
        setResources(res);
      } else {
        setResources([]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const generateSuggestions = (userInput: string, aiResponse: string): string[] => {
    // Intent-aware suggestions
    const intent = detectIntent(userInput || aiResponse);
    const subjects = ['math', 'physics', 'chemistry', 'biology', 'english', 'history'];
    const foundSubject = subjects.find(s => (userInput + ' ' + aiResponse).toLowerCase().includes(s));

    const suggestions: string[] = [];
    if (intent === 'request_quiz' && foundSubject) {
      suggestions.push(`Start ${foundSubject} practice quiz`);
      suggestions.push('Show me a brief study plan');
      suggestions.push('Explain this concept simply');
      suggestions.push('Show my progress');
    } else if (intent === 'emotion') {
      suggestions.push("I'm feeling anxious, help me relax");
      suggestions.push('How to manage exam stress');
      suggestions.push('I need motivation to study');
      suggestions.push('Show me study techniques');
    } else if (intent === 'question') {
      suggestions.push('Explain step-by-step');
      suggestions.push('Give an example problem');
      suggestions.push('Create practice questions');
      suggestions.push('Show related resources');
    } else {
      suggestions.push('I want to practice a subject');
      suggestions.push('Tell me about study techniques');
      suggestions.push("I'm feeling better now");
      suggestions.push('Show me my dashboard');
    }

    return suggestions.slice(0, 4);
  };

  const detectIntent = (text: string) => {
    const t = (text || '').toLowerCase();
    if (/quiz|practice|question|test|exercise/.test(t)) return 'request_quiz';
    if (/sad|depress|anx|stress|stressed|angry|upset|nervous/.test(t)) return 'emotion';
    if (/how|what|why|explain|example|solve/.test(t)) return 'question';
    return 'other';
  };

  const detectTopic = (text: string) => {
    const t = (text || '').toLowerCase();
    const topics = ['math', 'physics', 'chemistry', 'biology', 'english', 'history', 'study_skills'];
    const found = topics.find(topic => t.includes(topic));
    return found || '';
  };

  const detectMood = (text: string) => {
    const t = (text || '').toLowerCase();
    if (/sad|depress|anx|nervous|stressed|upset/.test(t)) return 'distressed';
    if (/happy|good|great|confident/.test(t)) return 'positive';
    return 'neutral';
  };

  const postProcessResponse = (response: string) => {
    // Ensure the response is concise and, if it mentions a subject, add a quick CTA
    let out = String(response || '').trim();
    if (out.length > 1000) out = out.slice(0, 1000) + '...';
    return out;
  };

  const generateFallbackResponse = (userInput: string) => {
    const text = (userInput || '').toLowerCase();
    
    if (text.includes('math') || text.includes('equation') || text.includes('solve')) {
      return "I am Thambi Robo! Let's break down your math query. When solving equations:\n\n1. Move all variable terms to one side and constants to the other.\n2. Apply inverse operations step-by-step.\n3. Verify your result by plugging it back into the original equation.\n\nWould you like to start a mathematics practice quiz to build confidence?";
    }
    if (text.includes('physics') || text.includes('gravity') || text.includes('force')) {
      return "Thambi Robo here! For physics:\n\n1. Identify what variables you have (e.g., mass, acceleration).\n2. Choose the correct formula (like F = m * a).\n3. Keep your units consistent (e.g., kg, m/s²).\n\nLet's start a physics practice quiz to test this out!";
    }
    if (text.includes('robot') || text.includes('sensor') || text.includes('arduino') || text.includes('code')) {
      return "I am Thambi Robo, your robotics specialist!\n\n1. Design: Pick sensors (ultrasonic, IR) based on what the robot needs to detect.\n2. Coding: Write clean loops in C++/Python to poll sensor inputs and write to actuator outputs.\n3. Testing: Debug subsystems individually before assembling.\n\nLet's keep coding!";
    }
    if (text.includes('stress') || text.includes('fail') || text.includes('anxious') || text.includes('sad')) {
      return "I hear you, and it is completely natural to feel overwhelmed. As Thambi Robo, I suggest taking a short 5-minute breathing break. Break your study topics into tiny, manageable portions. Consistent effort is what matters. I believe in you!";
    }

    const intent = detectIntent(userInput);
    if (intent === 'request_quiz') {
      const subjectMatch = (userInput || '').match(/(math|physics|chemistry|biology|english|history)/i);
      const subject = subjectMatch ? subjectMatch[1] : 'math';
      return `I can't connect to the AI assistant right now, but I can help you start a ${subject} practice quiz locally. Would you like that?`;
    }
    if (intent === 'emotion') {
      return "I’m sorry you’re feeling this way. Try taking a few deep breaths (4-4-4 breathing: inhale 4s, hold 4s, exhale 4s). I can also provide study tips or a short practice quiz to help you regain confidence!";
    }
    
    return "Hi, I am Thambi Robo, your learning companion. I am having trouble connecting right now, but I can help you review study topics, manage stress, or run a practice quiz. Try checking the dashboard for resources!";
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion.includes('practice quiz') || suggestion.includes('Start')) {
      const parts = suggestion.split(' ');
      const subject = parts[1] || parts[2] || 'mathematics';
      onStartQuiz(subject.toLowerCase());
      toast.success(`Starting ${subject} practice quiz!`);
    } else {
      sendMessage(suggestion);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-[85vh] bg-white rounded-2xl shadow-lg overflow-hidden dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700">
      
      {/* Left side: Fully Chat */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Chat Header */}
        <div className="bg-gradient-to-r from-blue-500 to-green-500 text-white p-4 dark:from-gray-900 dark:to-gray-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 dark:bg-black/20 rounded-full">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Thambi Robo Counselor</h3>
              <p className="text-sm text-blue-100">Your intelligent AI counselor & robotics mentor</p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-gray-950/20">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'bg-white text-gray-800 border border-gray-150 dark:border-gray-800 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:text-white shadow-sm'
                }`}>
                  <div className="flex items-start space-x-2">
                    {message.type === 'ai' && <Bot className="w-4 h-4 mt-1 flex-shrink-0 text-blue-500" />}
                    {message.type === 'user' && <User className="w-4 h-4 mt-1 flex-shrink-0 text-indigo-400" />}
                    <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                  </div>
                  
                  {message.suggestions && (
                    <div className="mt-3 space-y-2">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="block w-full text-left text-xs bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/30 rounded-lg px-3 py-2 border border-gray-200/50 dark:border-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                        >
                          {suggestion.includes('practice quiz') && (
                            <BookOpen className="w-3 h-3 inline mr-1 text-blue-500" />
                          )}
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white border border-gray-150 rounded-2xl px-4 py-3 max-w-xs dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-2">
                  <Bot className="w-4 h-4 text-blue-500" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {resources.length > 0 && (
            <div className="p-4 bg-blue-50/30 border border-blue-100 dark:bg-gray-800/40 dark:border-gray-800 rounded-2xl mt-4">
              <h4 className="font-semibold mb-2 text-sm text-blue-800 dark:text-blue-300">Suggested resources</h4>
              <div className="space-y-2">
                {resources.map((r, i) => (
                  <div key={i} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border-gray-800">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-xs text-gray-800 dark:text-gray-200">{r.title}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{r.summary}</div>
                      </div>
                      {r.link && (
                        <a href={r.link} target="_blank" rel="noreferrer" className="ml-4 text-xs font-semibold text-blue-600 hover:underline">Open</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (inputMessage.trim()) sendMessage(inputMessage.trim());
            }}
            className="flex space-x-3"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white"
              disabled={isTyping}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isTyping}
              className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Right side: Speakable Robot Panel */}
      <div className="w-full md:w-96 flex-shrink-0 flex flex-col h-full bg-gray-50 dark:bg-gray-900">
        <RobotCompanion 
          context={messages.slice(-6).map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')} 
          imageSrc={robotImageSrc}
          lastMessage={messages[messages.length - 1]}
          isTyping={isTyping}
        />
      </div>

    </div>
  );
}