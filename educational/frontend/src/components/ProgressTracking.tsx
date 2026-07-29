import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Trophy, TrendingUp, Target, Award, Star } from 'lucide-react';
import { QuizResult, Subject, Badge } from '../types';

interface ProgressTrackingProps {
  quizResults: QuizResult[];
  subjects: Subject[];
  badges: Badge[];
}

export function ProgressTracking({ quizResults, subjects, badges }: ProgressTrackingProps) {
  // Generate progress data
  const progressData = quizResults
    .slice(-7)
    .map((result, index) => ({
      day: `Day ${index + 1}`,
      score: (result.score / result.totalQuestions) * 100,
      date: new Date(result.completedAt).toLocaleDateString(),
    }));

  const subjectData = subjects.map(subject => ({
    name: subject.name,
    score: subject.averageScore,
    quizzes: subject.totalQuizzesTaken,
  }));

  const weaknessData = [
    { name: 'Strong', value: subjects.filter(s => s.weaknessLevel === 'low').length, color: '#10B981' },
    { name: 'Improving', value: subjects.filter(s => s.weaknessLevel === 'medium').length, color: '#F59E0B' },
    { name: 'Needs Practice', value: subjects.filter(s => s.weaknessLevel === 'high').length, color: '#EF4444' },
  ];

  const recentBadges = badges.filter(b => b.unlockedAt).slice(0, 3);
  const totalScore = quizResults.reduce((acc, result) => acc + result.score, 0);
  const totalQuestions = quizResults.reduce((acc, result) => acc + result.totalQuestions, 0);
  const overallAverage = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Progress</h1>
        <p className="text-gray-600">Track your learning journey and achievements</p>
      </motion.div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
  className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white dark:from-gray-900 dark:to-gray-800"
        >
          <div className="flex items-center justify-between mb-4">
            <Trophy className="w-8 h-8" />
            <span className="text-2xl font-bold">{overallAverage.toFixed(1)}%</span>
          </div>
          <h3 className="font-semibold mb-1">Overall Average</h3>
          <p className="text-blue-100 text-sm">Across all subjects</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white dark:from-gray-900 dark:to-gray-800"
        >
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8" />
            <span className="text-2xl font-bold">{quizResults.length}</span>
          </div>
          <h3 className="font-semibold mb-1">Quizzes Completed</h3>
          <p className="text-green-100 text-sm">Keep up the great work!</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white dark:from-gray-900 dark:to-gray-800"
        >
          <div className="flex items-center justify-between mb-4">
            <Award className="w-8 h-8" />
            <span className="text-2xl font-bold">{recentBadges.length}</span>
          </div>
          <h3 className="font-semibold mb-1">Recent Badges</h3>
          <p className="text-purple-100 text-sm">Achievements unlocked</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white dark:from-gray-900 dark:to-gray-800"
        >
          <div className="flex items-center justify-between mb-4">
            <Target className="w-8 h-8" />
            <span className="text-2xl font-bold">
              {subjects.filter(s => s.weaknessLevel === 'low').length}
            </span>
          </div>
          <h3 className="font-semibold mb-1">Subjects Mastered</h3>
          <p className="text-orange-100 text-sm">Strong performance</p>
        </motion.div>
      </div>

      {/* Progress Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
  className="bg-white rounded-2xl p-6 shadow-lg dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Trend</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                formatter={(value) => [`${value}%`, 'Score']}
                labelFormatter={(label, payload) => {
                  const data = payload?.[0]?.payload;
                  return data?.date || label;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#3B82F6" 
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#1D4ED8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Subject Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Subject Performance</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => [`${value}%`, 'Average Score']} />
                <Bar dataKey="score" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Weakness Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-2xl p-6 shadow-lg dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-6">Subject Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weaknessData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {weaknessData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

      </div>

      {/* Recent Achievements */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
  className="bg-white rounded-2xl p-6 shadow-lg dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Achievements</h2>

        {recentBadges.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentBadges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + index * 0.1 }}
                className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl p-4 border border-yellow-300 dark:from-gray-800 dark:to-gray-700"
              >
                <div className="flex items-center space-x-3 mb-2">
                  <div className="text-2xl">{badge.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{badge.name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{badge.description}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Unlocked {new Date(badge.unlockedAt!).toLocaleDateString()}
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Star className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No badges unlocked yet. Keep practicing to earn your first achievement!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}