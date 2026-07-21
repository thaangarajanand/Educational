// React import removed (not needed in newer JSX setups)
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BookOpen } from 'lucide-react';
import { Subject } from '../types';

interface SubjectCardProps {
  subject: Subject;
  onClick: () => void;
  className?: string;
}

export function SubjectCard({ subject, onClick, className = '' }: SubjectCardProps) {
  const getWeaknessIcon = () => {
    switch (subject.weaknessLevel) {
      case 'high':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <Minus className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <BookOpen className="w-4 h-4 text-gray-400" />;
    }
  };

  const getWeaknessColor = () => {
    switch (subject.weaknessLevel) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-green-200 bg-green-50';
      default:
        // Not assessed: in light mode keep white; in dark mode use a soft light-gray panel with black text
        return 'border-gray-200 bg-white dark:bg-gray-200 dark:border-gray-600';
    }
  };

  const getWeaknessText = () => {
    switch (subject.weaknessLevel) {
      case 'high':
        return 'Needs Practice';
      case 'medium':
        return 'Improving';
      case 'low':
        return 'Good Progress';
      default:
        return 'Not Assessed';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${getWeaknessColor()} ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-lg ${subject.color} dark:bg-transparent`}>
            <span className="text-2xl dark:text-black">{subject.icon}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-black">{subject.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              {getWeaknessIcon()}
              <span className="text-sm text-gray-600 dark:text-black">{getWeaknessText()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Quizzes Taken</p>
          <p className="font-semibold text-gray-900">{subject.totalQuizzesTaken}</p>
        </div>
        <div>
          <p className="text-gray-500">Avg Score</p>
          <p className="font-semibold text-gray-900">{subject.averageScore}%</p>
        </div>
      </div>

      {subject.lastQuizScore !== undefined && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">Last Quiz Score</p>
          <div className="flex items-center justify-between mt-1">
            <span className="font-semibold text-gray-900">{subject.lastQuizScore}%</span>
            <button className="text-blue-600 text-xs font-medium hover:text-blue-700">
              Practice Now →
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}