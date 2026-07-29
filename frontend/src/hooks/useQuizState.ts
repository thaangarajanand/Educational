import { useState, useCallback } from 'react';
import { Quiz, QuizResult, UserAnswer, Question } from '../types';

export function useQuizState() {
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  const startQuiz = useCallback((quiz: Quiz) => {
    setCurrentQuiz(quiz);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setIsQuizComplete(false);
    setStartTime(new Date());
  }, []);

  const answerQuestion = useCallback((selectedAnswer: number) => {
    if (!currentQuiz || isQuizComplete) return;

    const currentQuestion = currentQuiz.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;

    const answer: UserAnswer = {
      questionId: currentQuestion.id,
      selectedAnswer,
      isCorrect,
    };

    setUserAnswers(prev => [...prev, answer]);

    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setIsQuizComplete(true);
    }
  }, [currentQuiz, currentQuestionIndex, isQuizComplete]);

  const completeQuiz = useCallback(() => {
    if (!currentQuiz || isQuizComplete) return;
    setIsQuizComplete(true);
  }, [currentQuiz, isQuizComplete]);

  const getQuizResult = useCallback((): QuizResult | null => {
    if (!currentQuiz || !startTime || !isQuizComplete) return null;

    const score = userAnswers.filter(answer => answer.isCorrect).length;
    const timeSpent = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);

    return {
      id: crypto.randomUUID(),
      userId: 'current-user', // This would come from auth
      subjectId: currentQuiz.id,
      score,
      totalQuestions: currentQuiz.questions.length,
      timeSpent,
      completedAt: new Date().toISOString(),
      answers: userAnswers,
    };
  }, [currentQuiz, startTime, userAnswers, isQuizComplete]);

  const resetQuiz = useCallback(() => {
    setCurrentQuiz(null);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setIsQuizComplete(false);
    setStartTime(null);
  }, []);

  return {
    currentQuiz,
    currentQuestion: currentQuiz?.questions[currentQuestionIndex] || null,
    currentQuestionIndex,
    userAnswers,
    isQuizComplete,
    startQuiz,
    answerQuestion,
    completeQuiz,
    getQuizResult,
    resetQuiz,
    progress: currentQuiz ? ((currentQuestionIndex + (isQuizComplete ? 1 : 0)) / currentQuiz.questions.length) * 100 : 0,
  };
}