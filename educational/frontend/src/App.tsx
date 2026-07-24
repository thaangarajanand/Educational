import { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Layout } from './components/Layout';
import Auth from './components/Auth';
import { ChatInterface } from './components/ChatInterface';
import { Dashboard } from './components/Dashboard';
import { QuizInterface } from './components/QuizInterface';
import { ProgressTracking } from './components/ProgressTracking';
import { UserProfile } from './components/UserProfile';
import { DataPage } from './components/DataPage';
import { useLocalStorage } from './hooks/useLocalStorage';
import { 
  mockUser, 
  mockSubjects, 
  mockQuizResults, 
  mockBadges, 
  generateMockQuiz 
} from './data/mockData';
import { Subject, Quiz, User, QuizResult } from './types';

import { supabaseClient } from './lib/supabase';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [user, setUser] = useLocalStorage<User>('studymentor-user', mockUser);
  const [subjects, setSubjects] = useLocalStorage('studymentor-subjects', mockSubjects);
  const [quizResults, setQuizResults] = useLocalStorage('studymentor-quiz-results', mockQuizResults);
  const [badges] = useLocalStorage('studymentor-badges', mockBadges);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isGuest] = useLocalStorage<boolean>('isGuest', false);
  const [loading, setLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: any;
    setLoading(true);
    setSupabaseError(null);
    // If user chose to continue as guest, create a synthetic session and skip Supabase calls
    if (isGuest) {
      setSession({ user: { id: 'guest', email: 'guest@local', user_metadata: { guest: true } }, provider_token: null });
      setLoading(false);
      return;
    }

    if (!supabaseClient) {
      setLoading(false);
      setSession(null);
      return;
    }
    supabaseClient.auth.getSession()
      .then((res: any) => {
        const session = res?.data?.session ?? null;
        setSession(session);
        setLoading(false);
      })
      .catch(() => {
        setSupabaseError('Backend authentication service is unavailable.');
        setLoading(false);
      });
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });
    unsub = listener?.subscription;
    return () => {
      unsub?.unsubscribe();
    };
  }, [isGuest]);

  useEffect(() => {
    if (session?.user) {
      const email = session.user.email || '';
      const isGuestUser = session.user.user_metadata?.guest;
      const isApiKeyUser = session.user.user_metadata?.api_client;
      
      const defaultName = isGuestUser ? 'Guest User' : 
                          isApiKeyUser ? email : 
                          session.user.user_metadata?.name || 
                          session.user.user_metadata?.full_name || 
                          email.split('@')[0] || 
                          'User';

      if (user.email !== email || user.name === 'Alex Johnson') {
        setUser(prev => ({
          ...prev,
          name: prev.name === 'Alex Johnson' ? defaultName : prev.name,
          email: email
        }));
      }
    }
  }, [session, user.email, user.name]);

  const handleSubjectSelect = (subject: Subject) => {
    setSelectedSubject(subject);
    const quiz = generateMockQuiz(subject.id);
    setCurrentQuiz(quiz);
    setCurrentPage('quiz');
    toast.success(`Starting ${subject.name} practice quiz!`);
  };

  const handleStartQuiz = (subjectName: string) => {
    const subject = subjects.find(s => 
      s.name.toLowerCase().includes(subjectName.toLowerCase()) ||
      s.id.toLowerCase().includes(subjectName.toLowerCase())
    ) || subjects[0];
    handleSubjectSelect(subject);
  };

  const handleQuizComplete = (score: number, totalQuestions: number) => {
    if (!selectedSubject) return;
    const newResult: QuizResult = {
      id: crypto.randomUUID(),
      userId: user.id,
      subjectId: selectedSubject.id,
      score,
      totalQuestions,
      timeSpent: 120, // This would come from the actual timer
      completedAt: new Date().toISOString(),
      answers: [], // This would include the actual answers
    };
    setQuizResults(prev => [...prev, newResult]);
    setSubjects(prev => prev.map(subject => {
      if (subject.id === selectedSubject.id) {
        const newTotalQuizzes = subject.totalQuizzesTaken + 1;
        const newAverageScore = Math.round(
          (subject.averageScore * subject.totalQuizzesTaken + (score / totalQuestions) * 100) / newTotalQuizzes
        );
        return {
          ...subject,
          totalQuizzesTaken: newTotalQuizzes,
          averageScore: newAverageScore,
          lastQuizScore: Math.round((score / totalQuestions) * 100),
          weaknessLevel: newAverageScore >= 80 ? 'low' : newAverageScore >= 60 ? 'medium' : 'high',
        };
      }
      return subject;
    }));
    setUser(prev => ({
      ...prev,
      totalPoints: prev.totalPoints + score * 10,
      streak: prev.streak + 1, // Simplified streak logic
    }));
    toast.success('Quiz completed! Your progress has been updated.');
    setCurrentPage('dashboard');
  };

  const handleBackFromQuiz = () => {
    setCurrentQuiz(null);
    setSelectedSubject(null);
    setCurrentPage('dashboard');
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatInterface onStartQuiz={handleStartQuiz} />;
      case 'dashboard':
        return (
          <Dashboard
            user={user}
            subjects={subjects}
            onSubjectSelect={handleSubjectSelect}
          />
        );
      case 'quiz':
        return (
          <QuizInterface
            quiz={currentQuiz}
            onComplete={handleQuizComplete}
            onBack={handleBackFromQuiz}
            subjects={subjects}
            onStartQuiz={handleStartQuiz}
          />
        );
      case 'data':
        return <DataPage />;
      case 'progress':
        return (
          <ProgressTracking
            quizResults={quizResults}
            subjects={subjects}
            badges={badges}
          />
        );
      case 'profile':
        return (
          <UserProfile
            user={user}
            badges={badges}
            onUpdateUser={setUser}
            onBack={() => setCurrentPage('dashboard')}
          />
        );
      default:
        return <Dashboard user={user} subjects={subjects} onSubjectSelect={handleSubjectSelect} />;
    }
  };

  if (loading) {
    return <div style={{padding: 40, fontSize: 24, color: 'blue'}}>Loading authentication...</div>;
  }
  // Show a small banner if there's a Supabase connection error, but don't block the UI.
  const errorBanner = supabaseError ? (
    <div style={{padding: 12, background: '#fee2e2', color: '#991b1b', textAlign: 'center'}}>
      {supabaseError}
    </div>
  ) : null;

  if (!session) {
    return (
      <>
        {errorBanner}
        <Auth />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
        {renderCurrentPage()}
      </Layout>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </div>
  );
}

export default App;