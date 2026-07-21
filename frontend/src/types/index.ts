export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  school?: string;
  section?: string;
  phone?: string;
  grade: string;
  streak: number;
  totalPoints: number;
  badges: string[];
  joinedAt: string;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  weaknessLevel: 'high' | 'medium' | 'low' | 'none';
  lastQuizScore?: number;
  totalQuizzesTaken: number;
  averageScore: number;
}

export interface Quiz {
  id: string;
  subjectId: string;
  questions: Question[];
  createdAt: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizResult {
  id: string;
  userId: string;
  subjectId: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  completedAt: string;
  answers: UserAnswer[];
}

export interface UserAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  suggestions?: string[];
  topic?: string; // optional topic tag (e.g., math, physics)
  mood?: string; // optional mood tag (e.g., stressed, calm)
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  unlockedAt?: string;
}