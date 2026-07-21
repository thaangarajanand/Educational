import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle, XCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { useQuizState } from '../hooks/useQuizState';
import { Quiz, Subject } from '../types';
import toast from 'react-hot-toast';

interface QuizInterfaceProps {
  quiz: Quiz | null;
  onComplete: (score: number, totalQuestions: number) => void;
  onBack: () => void;
  subjects?: Subject[];
  onStartQuiz?: (subjectName: string) => void;
}

export function QuizInterface({ quiz, onComplete, onBack, subjects = [], onStartQuiz }: QuizInterfaceProps) {
  const {
    currentQuiz,
    currentQuestion,
    currentQuestionIndex,
  // userAnswers,
    isQuizComplete,
    startQuiz,
    answerQuestion,
    completeQuiz,
    getQuizResult,
    resetQuiz,
    progress,
  } = useQuizState();

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (quiz) {
      startQuiz(quiz);
    }
  }, [quiz, startQuiz]);

  useEffect(() => {
    if (currentQuiz && !isQuizComplete) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentQuiz, isQuizComplete]);

  useEffect(() => {
    if (isQuizComplete) {
      const result = getQuizResult();
      if (result) {
        toast.success(`Quiz completed! Score: ${result.score}/${result.totalQuestions}`);
        onComplete(result.score, result.totalQuestions);
      }
    }
  }, [isQuizComplete, getQuizResult, onComplete]);

  const handleTimeUp = () => {
    toast.error('Time\'s up! Quiz automatically submitted.');
    completeQuiz();
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    setShowExplanation(false);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer !== null) {
      answerQuestion(selectedAnswer);
      setShowExplanation(true);
      
      setTimeout(() => {
        setSelectedAnswer(null);
        setShowExplanation(false);
      }, 2000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!quiz && !currentQuiz) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Start a practice quiz</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Choose a subject to begin a focused quiz and build confidence.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {subjects.length > 0 ? subjects.map(subject => (
            <button
              key={subject.id}
              onClick={() => onStartQuiz?.(subject.name)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left font-medium text-gray-800 hover:bg-blue-50 dark:border-gray-700 dark:bg-black/50 dark:text-white"
            >
              {subject.name}
            </button>
          )) : (
            <button onClick={onBack} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-medium text-gray-800 dark:border-gray-700 dark:bg-black/50 dark:text-white">
              Go to dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentQuiz || !currentQuestion) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isQuizComplete) {
    const result = getQuizResult();
    if (!result) return null;

    const percentage = (result.score / result.totalQuestions) * 100;
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
  className="bg-white rounded-2xl shadow-lg p-8 text-center dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
      >
        <div className="mb-6">
          {percentage >= 80 ? (
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          ) : percentage >= 60 ? (
            <Clock className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          )}
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Quiz Complete!
          </h2>
          
          <p className="text-gray-600">
            You scored {result.score} out of {result.totalQuestions} questions
          </p>
        </div>

  <div className="bg-gray-50 rounded-xl p-6 mb-6 dark:bg-black/80 dark:text-white">
          <div className="text-4xl font-bold text-blue-600 mb-2">
            {percentage.toFixed(0)}%
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-black/60">
            <div
              className={`h-3 rounded-full transition-all duration-1000 ${
                percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-blue-50 rounded-lg p-3 dark:bg-blue-900">
            <p className="text-blue-600 dark:text-blue-200 font-semibold">Time Taken</p>
            <p className="text-gray-900 dark:text-gray-200">{formatTime(result.timeSpent)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 dark:bg-green-900">
            <p className="text-green-600 dark:text-green-200 font-semibold">Accuracy</p>
            <p className="text-gray-900 dark:text-gray-200">{percentage.toFixed(1)}%</p>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onBack}
            className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            Back to Dashboard
          </button>
          
          <button
            onClick={() => {
              resetQuiz();
              if (quiz) startQuiz(quiz);
            }}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-black/60 dark:text-white dark:hover:bg-black/50 transition-colors font-medium"
          >
            Take Quiz Again
          </button>
        </div>
      </motion.div>
    );
  }

  return (
  <div className="bg-white rounded-2xl shadow-lg overflow-hidden dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700">
      {/* Header */}
  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 dark:from-gray-900 dark:to-gray-800">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={onBack}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-2 bg-white/20 rounded-lg px-4 py-2">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Question {currentQuestionIndex + 1}</h2>
          <span className="text-white/80">of {currentQuiz.questions.length}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/20 rounded-full h-2 dark:bg-black/60">
          <div
            className="bg-white h-2 rounded-full transition-all duration-300 dark:bg-gray-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Content */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-6 leading-relaxed">
              {currentQuestion.question}
            </h3>

            <div className="space-y-3 mb-6">
              {currentQuestion.options.map((option, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showExplanation}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    selectedAnswer === index
                      ? showExplanation
                        ? index === currentQuestion.correctAnswer
                          ? 'border-green-500 bg-green-50 text-green-800'
                          : 'border-red-500 bg-red-50 text-red-800'
                        : 'border-blue-500 bg-blue-50 text-blue-800'
                      : showExplanation && index === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  } ${showExplanation ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center">
                    <span className="font-medium mr-3">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <span>{option}</span>
                    {showExplanation && index === currentQuestion.correctAnswer && (
                      <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                    )}
                    {showExplanation && selectedAnswer === index && index !== currentQuestion.correctAnswer && (
                      <XCircle className="w-5 h-5 text-red-500 ml-auto" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            {showExplanation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 rounded-lg p-4 mb-6"
              >
                <h4 className="font-semibold text-gray-900 mb-2">Explanation:</h4>
                <p className="text-gray-700">{currentQuestion.explanation}</p>
              </motion.div>
            )}

            {!showExplanation && (
              <button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Submit Answer
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}