import { motion } from 'framer-motion';
import { TrendingUp, Award, Target, BookOpen, Brain, Zap } from 'lucide-react';
import { Subject, User } from '../types';
import { SubjectCard } from './SubjectCard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardProps {
  user: User;
  subjects: Subject[];
  onSubjectSelect: (subject: Subject) => void;
}

export function Dashboard({ user, subjects, onSubjectSelect }: DashboardProps) {
  const weakSubjects = subjects.filter(s => s.weaknessLevel === 'high' || s.weaknessLevel === 'medium');
  const strongSubjects = subjects.filter(s => s.weaknessLevel === 'low');

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
  className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-2xl p-8 text-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-700"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name}! 👋</h1>
            <p className="text-blue-100 mb-4 md:mb-0">Ready to continue your learning journey?</p>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-2xl font-bold">{user.streak}</div>
              <div className="text-sm text-blue-100">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{user.totalPoints}</div>
              <div className="text-sm text-blue-100">Total Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{user.badges.length}</div>
              <div className="text-sm text-blue-100">Badges</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Subjects Improving</p>
              <p className="text-2xl font-bold text-gray-900">{strongSubjects.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <Target className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Need Practice</p>
              <p className="text-2xl font-bold text-gray-900">{weakSubjects.length}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Brain className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Quizzes Taken</p>
              <p className="text-2xl font-bold text-gray-900">
                {subjects.reduce((total, subject) => total + subject.totalQuizzesTaken, 0)}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(subjects.reduce((total, subject) => total + subject.averageScore, 0) / subjects.length)}%
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Priority Subjects */}
      {weakSubjects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center space-x-3 mb-6">
            <Zap className="w-6 h-6 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900">Priority Practice Areas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weakSubjects.map((subject, index) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <SubjectCard
                  subject={subject}
                  onClick={() => onSubjectSelect(subject)}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* All Subjects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div className="flex items-center space-x-3 mb-6">
          <BookOpen className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">All Subjects</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + index * 0.05 }}
            >
              <SubjectCard subject={subject} onClick={() => onSubjectSelect(subject)} />
            </motion.div>
          ))}
        </div>

      </motion.div>

      {/* Analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <div className="flex items-center space-x-3 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white">
            <h3 className="font-semibold mb-4">Average Scores by Subject</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={subjects.map(s => ({ name: s.name, avg: s.averageScore }))}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg" stroke="#8884d8" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white">
            <h3 className="font-semibold mb-4">Quiz Distribution</h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={subjects.map(s => ({ name: s.name, value: s.totalQuizzesTaken }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    fill="#82ca9d"
                    label
                  >
                    {subjects.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={["#8884d8", "#82ca9d", "#ffc658", "#ff7f7f", "#a4de6c"][index % 5]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}