import React, { useState } from 'react';
import { supabaseClient } from '../lib/supabase';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Shield, Sparkles, Key, UserCheck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [showAlternativeOptions, setShowAlternativeOptions] = useState(true);
  const [altMode, setAltMode] = useState<'none' | 'apikey' | 'email'>('email');

  const [, setIsGuest] = useLocalStorage<boolean>('isGuest', false);

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

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Please enter your official email address and password.');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabaseClient.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) {
          throw new Error('Please log in with your official email address and password.');
        }
      } else {
        const { error } = await supabaseClient.auth.signUp({ email: cleanEmail, password });
        if (error) throw error;
      }
      resetProgressState();
      setTimeout(() => window.location.reload(), 50);
    } catch (err: any) {
      setError(err.message || 'Please log in with your official email address and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabaseClient.auth.signInWithApiKey(apiKey);
      if (error) throw error;
      resetProgressState();
      setTimeout(() => window.location.reload(), 50);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  const continueAsGuest = () => {
    try {
      window.sessionStorage.setItem('isGuest', 'true');
    } catch { /* ignore */ }
    setIsGuest(true);
    setTimeout(() => window.location.reload(), 150);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 text-white">
      {/* Decorative backdrop glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl p-8 rounded-2xl shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-2">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            StudyMentor AI
          </h1>
          <p className="text-sm text-slate-400">
            Official Portal for Students & Administrators
          </p>
        </div>

        {/* Info Banner for Official Authentication */}
        <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl p-4 text-xs text-indigo-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-indigo-300">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>Official Login Portal</span>
          </div>
          <p>
            Please log in using your <strong className="text-white">official email address and password</strong>, or directly click <strong className="text-white">Continue with Google</strong>.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-950/60 border border-red-800/80 rounded-xl p-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="space-y-3 pt-2">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3.5 px-4 rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Google SVG Logo */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.32 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.68 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Official Email & Password Form */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
            <span>Or Login with Official Email & Password</span>
          </div>

          <form onSubmit={handleAuth} className="space-y-2.5">
            <input
              type="email"
              placeholder="Official Email Address (e.g. name@domain.com)"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-colors shadow-md text-xs"
            >
              {loading ? 'Processing...' : isLogin ? 'Login with Official Email' : 'Sign Up with Official Email'}
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                className="text-slate-400 hover:text-slate-200 underline text-[11px]"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? 'Need an account? Sign Up' : 'Have an account? Login'}
              </button>
            </div>
          </form>

          {/* Alternative options toggle for API Key or Guest */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAlternativeOptions(!showAlternativeOptions)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
            >
              <span>Other access options (API Key / Guest)</span>
              {showAlternativeOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAlternativeOptions && (
              <div className="mt-2 space-y-2 text-xs">
                {/* API Key Form */}
                <form onSubmit={handleApiKeyLogin} className="space-y-2 pt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter API Key"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      className="flex-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg transition-colors text-xs"
                    >
                      Use Key
                    </button>
                  </div>
                </form>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={continueAsGuest}
                    className="w-full bg-slate-800/60 hover:bg-slate-800 text-slate-400 py-2 rounded-lg transition-colors text-xs"
                  >
                    Continue as Guest
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

