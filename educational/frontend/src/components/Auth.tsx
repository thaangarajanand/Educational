import React, { useState } from 'react';
import { supabaseClient } from '../lib/supabase';
import { useLocalStorage } from '../hooks/useLocalStorage';

const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(false);

  const resetProgressState = () => {
    const keysToClear = [
      'isGuest',
      'studymentor-user',
      'studymentor-subjects',
      'studymentor-quiz-results',
      'studymentor-badges',
      'chat-messages',
    ];

    keysToClear.forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
    });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isLogin) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
      }
      resetProgressState();
      setTimeout(() => window.location.reload(), 50);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  };

  const [, setIsGuest] = useLocalStorage<boolean>('isGuest', false);

  const continueAsGuest = () => {
    // Mark the session as guest in localStorage and reload so app can pick up guest state
    setIsGuest(true);
    // small delay to ensure storage is written
    setTimeout(() => window.location.reload(), 150);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-black">
  <form onSubmit={handleAuth} className="bg-white p-6 rounded shadow-md w-80 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white">
        <h2 className="text-2xl font-bold mb-4">{isLogin ? 'Login' : 'Sign Up'}</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-2 mb-2 border rounded"
          required
        />
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
        </button>
        <div className="mt-4 text-center">
          <button
            type="button"
            className="text-blue-500 underline"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Create an account' : 'Already have an account? Login'}
          </button>
        </div>
        <div className="mt-3 text-center">
          <button
            type="button"
            className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            Continue with Google
          </button>
        </div>
        <div className="mt-3 text-center">
          <button
            type="button"
            className="w-full bg-gray-200 text-gray-800 py-2 rounded hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            onClick={continueAsGuest}
          >
            Continue as guest
          </button>
        </div>
      </form>
    </div>
  );
};

export default Auth;
