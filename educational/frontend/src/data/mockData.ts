import { User, Subject, QuizResult, Badge, Quiz, Question } from '../types';

export const mockUser: User = {
  id: '1',
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  grade: '10th Grade',
  streak: 7,
  totalPoints: 1250,
  badges: ['first-quiz', 'math-master'],
  joinedAt: '2024-01-15T00:00:00Z',
};

export const mockSubjects: Subject[] = [
  {
    id: 'math',
    name: 'Machine Learning Math',
    icon: '🤖',
    color: 'bg-blue-100',
    weaknessLevel: 'high',
    lastQuizScore: 45,
    totalQuizzesTaken: 8,
    averageScore: 52,
  },
  {
    id: 'physics',
    name: 'Robot Dynamics',
    icon: '⚙️',
    color: 'bg-purple-100',
    weaknessLevel: 'medium',
    lastQuizScore: 75,
    totalQuizzesTaken: 5,
    averageScore: 68,
  },
  {
    id: 'chemistry',
    name: 'Embedded Systems',
    icon: '🔋',
    color: 'bg-green-100',
    weaknessLevel: 'low',
    lastQuizScore: 85,
    totalQuizzesTaken: 6,
    averageScore: 82,
  },
  {
    id: 'biology',
    name: 'Neural Inspiration',
    icon: '🧠',
    color: 'bg-emerald-100',
    weaknessLevel: 'low',
    lastQuizScore: 90,
    totalQuizzesTaken: 7,
    averageScore: 88,
  },
  {
    id: 'english',
    name: 'AI Communication',
    icon: '💬',
    color: 'bg-red-100',
    weaknessLevel: 'medium',
    lastQuizScore: 70,
    totalQuizzesTaken: 4,
    averageScore: 73,
  },
  {
    id: 'history',
    name: 'Robotics Evolution',
    icon: '🦾',
    color: 'bg-yellow-100',
    weaknessLevel: 'none',
    totalQuizzesTaken: 0,
    averageScore: 0,
  },
];

export const mockQuizResults: QuizResult[] = [
  {
    id: '1',
    userId: '1',
    subjectId: 'math',
    score: 3,
    totalQuestions: 5,
    timeSpent: 120,
    completedAt: '2024-01-20T10:00:00Z',
    answers: [],
  },
  {
    id: '2',
    userId: '1',
    subjectId: 'physics',
    score: 4,
    totalQuestions: 5,
    timeSpent: 95,
    completedAt: '2024-01-21T14:30:00Z',
    answers: [],
  },
  {
    id: '3',
    userId: '1',
    subjectId: 'chemistry',
    score: 5,
    totalQuestions: 5,
    timeSpent: 87,
    completedAt: '2024-01-22T16:15:00Z',
    answers: [],
  },
];

export const mockBadges: Badge[] = [
  {
    id: 'first-quiz',
    name: 'First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    requirement: 'Complete 1 quiz',
    unlockedAt: '2024-01-20T10:05:00Z',
  },
  {
    id: 'math-master',
    name: 'Math Explorer',
    description: 'Take 5 math quizzes',
    icon: '🔢',
    requirement: 'Complete 5 math quizzes',
    unlockedAt: '2024-01-22T12:00:00Z',
  },
  {
    id: 'streak-3',
    name: '3-Day Streak',
    description: 'Practice for 3 consecutive days',
    icon: '🔥',
    requirement: 'Maintain a 3-day streak',
  },
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Get 100% on any quiz',
    icon: '🌟',
    requirement: 'Score 100% on a quiz',
  },
  {
    id: 'quick-learner',
    name: 'Quick Learner',
    description: 'Complete a quiz in under 60 seconds',
    icon: '⚡',
    requirement: 'Complete a quiz in under 60 seconds',
  },
  {
    id: 'subject-master',
    name: 'Subject Master',
    description: 'Average 90% or higher in any subject',
    icon: '👑',
    requirement: 'Get 90%+ average in a subject',
  },
];

export const generateMockQuiz = (subjectId: string): Quiz => {
  const questions: Record<string, Question[]> = {
    math: [
      {
        id: '1',
        question: 'In a neural network, what does the activation function help determine?',
        options: ['The robot\'s battery level', 'Whether a neuron fires', 'The color of the sensor', 'The wheel speed'],
        correctAnswer: 1,
        explanation: 'Activation functions decide whether a neuron should pass information forward in the model.',
      },
      {
        id: '2',
        question: 'If a robot vision model has 4 inputs and 2 outputs, which math concept is central to mapping them?',
        options: ['Probability', 'Linear algebra', 'History', 'Grammar'],
        correctAnswer: 1,
        explanation: 'Linear algebra is used to represent and transform data in machine learning models.',
      },
      {
        id: '3',
        question: 'What does a loss function measure in AI training?',
        options: ['How much the robot weighs', 'How far the prediction is from the target', 'How many sensors are connected', 'How fast the motor spins'],
        correctAnswer: 1,
        explanation: 'A loss function quantifies prediction error during model training.',
      },
    ],
    physics: [
      {
        id: '1',
        question: 'Which force is most directly related to a robot\'s movement across a surface?',
        options: ['Friction', 'Gravity', 'Magnetism', 'Sound'],
        correctAnswer: 0,
        explanation: 'Friction affects how easily a robot can move and how much force its motors need.',
      },
      {
        id: '2',
        question: 'What does torque help explain in a robotic arm?',
        options: ['How much rotational force is applied', 'How the camera records video', 'How the AI plans routes', 'How data is stored'],
        correctAnswer: 0,
        explanation: 'Torque is the rotational force that determines how strongly a robotic arm can turn or lift.',
      },
      {
        id: '3',
        question: 'Why is balance important for a humanoid robot?',
        options: ['To reduce battery use', 'To maintain stability while moving', 'To improve Wi-Fi signal', 'To generate text output'],
        correctAnswer: 1,
        explanation: 'Balance is crucial for stable motion and safe movement in humanoid robots.',
      },
    ],
    chemistry: [
      {
        id: '1',
        question: 'Which component is most important for an embedded system to process instructions?',
        options: ['Microcontroller', 'Water', 'Air', 'Ink'],
        correctAnswer: 0,
        explanation: 'A microcontroller is the core processing unit in many embedded systems.',
      },
      {
        id: '2',
        question: 'Why do robotics devices need reliable power management?',
        options: ['To prevent overheating and support stable operation', 'To print documents', 'To create music', 'To increase screen brightness'],
        correctAnswer: 0,
        explanation: 'Reliable power management keeps sensors, processors, and motors operating safely and consistently.',
      },
      {
        id: '3',
        question: 'What does a sensor in a robot usually detect?',
        options: ['Only text messages', 'Physical or environmental changes', 'Cloud storage', 'Software updates'],
        correctAnswer: 1,
        explanation: 'Sensors help robots detect light, distance, temperature, motion, and other environmental changes.',
      },
    ],
    biology: [
      {
        id: '1',
        question: 'What is the main inspiration behind biologically inspired robotics?',
        options: ['Animal movement and sensing', 'Office paperwork', 'Weather reports', 'Music playlists'],
        correctAnswer: 0,
        explanation: 'Biologically inspired robotics often mimics the movement and sensing of living organisms.',
      },
      {
        id: '2',
        question: 'Why are neural networks compared to the brain?',
        options: ['They both process information using connected units', 'They both store sunlight', 'They both produce electricity', 'They both move wheels'],
        correctAnswer: 0,
        explanation: 'Neural networks are inspired by the brain’s interconnected neurons that process information.',
      },
      {
        id: '3',
        question: 'What is a common goal of bio-inspired robots?',
        options: ['To imitate natural behavior', 'To write novels', 'To replace all batteries', 'To skip sensors'],
        correctAnswer: 0,
        explanation: 'Bio-inspired robots are designed to mimic efficient, adaptive behavior found in nature.',
      },
    ],
    english: [
      {
        id: '1',
        question: 'Which sentence best describes an AI system clearly?',
        options: ['The robot loudly sings.', 'The AI system analyzes sensor data to make decisions.', 'The device is red.', 'The battery is full.'],
        correctAnswer: 1,
        explanation: 'A clear explanation of an AI system should mention its purpose and behavior.',
      },
      {
        id: '2',
        question: 'What is the best way to explain a robotics concept to a beginner?',
        options: ['Use simple language and include an example', 'Use technical jargon only', 'Avoid examples', 'Use long poems only'],
        correctAnswer: 0,
        explanation: 'Simple explanations with examples make robotics concepts easier to understand.',
      },
      {
        id: '3',
        question: 'Which statement is most effective for describing AI communication?',
        options: ['The model speaks to the robot.', 'The AI explains its decision in clear language.', 'The robot sleeps.', 'The code is hidden.'],
        correctAnswer: 1,
        explanation: 'Good AI communication means explaining decisions and actions clearly.',
      },
    ],
    history: [
      {
        id: '1',
        question: 'Which invention helped accelerate modern robotics development?',
        options: ['The printing press', 'The microprocessor', 'The telescope', 'The steam engine'],
        correctAnswer: 1,
        explanation: 'The microprocessor enabled compact and programmable control systems in robots.',
      },
      {
        id: '2',
        question: 'Why is the evolution of robotics important in AI?',
        options: ['It shows how hardware and software advanced together', 'It changed the weather', 'It eliminated sensors', 'It replaced all humans'],
        correctAnswer: 0,
        explanation: 'Robotics evolution highlights the growth of both mechanical systems and intelligent control.',
      },
      {
        id: '3',
        question: 'What is a major milestone in robotics history?',
        options: ['The first autonomous robot', 'The first handwritten letter', 'The first radio broadcast', 'The first map'],
        correctAnswer: 0,
        explanation: 'Autonomous robots marked a major step in combining intelligence with mechanical movement.',
      },
    ],
  };
  const selected = questions[subjectId] || questions.math;
  // Return a quiz with up to 10 questions by slicing/duplicating if necessary
  let quizQuestions: Question[] = selected.slice(0, 10);
  // If fewer than 5, duplicate with minor variations
  if (quizQuestions.length < 5) {
    const copies: Question[] = [];
    while (copies.length + quizQuestions.length < 5) {
      const base = quizQuestions[copies.length % quizQuestions.length];
      copies.push({ ...base, id: crypto.randomUUID() });
    }
    quizQuestions = [...quizQuestions, ...copies];
  }

  return {
    id: crypto.randomUUID(),
    subjectId,
    questions: quizQuestions,
    createdAt: new Date().toISOString(),
    difficulty: 'medium',
  };
};