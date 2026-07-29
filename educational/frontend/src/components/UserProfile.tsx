import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Edit3, Save, X, Trophy, Calendar, Target, Award, Sun, Moon, LogOut, ArrowLeft, Printer } from 'lucide-react';
import type { User as UserType, Badge } from '../types';
import toast from 'react-hot-toast';
import { supabaseClient } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { getSelectedLanguage, t, Language } from '../lib/i18n';

type UserProfileProps = {
  user: UserType;
  badges: Badge[];
  onUpdateUser: (updatedUser: UserType) => void;
  onBack?: () => void;
};

async function fetchUserProfile(userId: string): Promise<UserType | null> {
  if (!supabaseClient) return null;
  const profile = await supabaseClient.getProfile(userId);
  return profile as UserType | null;
}

async function updateUserProfile(userId: string, updates: Partial<UserType>): Promise<void> {
  if (!supabaseClient) {
    throw new Error('Backend service not configured');
  }
  const payload = { id: userId, ...updates } as Partial<UserType> & { id: string };
  await supabaseClient.saveProfile(payload);
}

export function UserProfile({ user, badges, onUpdateUser, onBack }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState(user);
  const [activeTab, setActiveTab] = useState<'about' | 'profile'>('about');
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // apply theme on mount
  useEffect(() => {
    try {
      if (theme === 'dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch (e) {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const initialiseProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!supabaseClient) {
          if (!cancelled) {
            setEditedUser(user);
            setLoading(false);
          }
          return;
        }
        const profile = await fetchUserProfile(user.id);
        if (!cancelled) {
          setEditedUser(profile || user);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to fetch profile');
          setEditedUser(user);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialiseProfile();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, [user.id]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      // If guest, or Supabase isn't configured, persist locally via onUpdateUser (App uses useLocalStorage)
      const isGuest = (() => { try { return window.localStorage.getItem('isGuest') === 'true'; } catch (e) { return false; } })();
      const supabaseConfigured = !!supabaseClient;
      if (isGuest || !supabaseConfigured) {
        onUpdateUser(editedUser);
        if (!supabaseConfigured && !isGuest) {
          toast('Saved locally because the backend service is not available.', { icon: 'ℹ️' });
        } else {
          toast.success('Profile saved locally for guest users.');
        }
      } else {
        await updateUserProfile(user.id, editedUser);
        onUpdateUser(editedUser);
        toast.success('Profile updated successfully!');
      }
      setIsEditing(false);
      // If a back callback is provided, navigate back after saving
      try {
        onBack?.();
      } catch (e) {
        // ignore navigation errors
      }
    } catch (err: any) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedUser(user);
    setIsEditing(false);
  };

  const unlockedBadges = badges.filter((badge: Badge) => badge.unlockedAt);
  const lockedBadges = badges.filter((badge: Badge) => !badge.unlockedAt);

  const generateParentReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups to print report.');
      return;
    }

    const reportHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Parent & Teacher Progress Report - ${editedUser.name}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
            .header { border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: 800; color: #0284c7; }
            .student-info { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .stat-box { background: #f1f5f9; padding: 15px; border-radius: 10px; text-align: center; }
            .stat-value { font-size: 28px; font-weight: 700; color: #0f172a; margin-top: 5px; }
            .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; text-align: center; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">Sai Elite India Educational</div>
            <div><strong>Official Student Report</strong></div>
          </div>

          <div class="student-info">
            <h2>Student: ${editedUser.name}</h2>
            <p><strong>Email:</strong> ${editedUser.email} | <strong>Grade:</strong> ${editedUser.grade || 'Grade 10'} | <strong>School:</strong> ${editedUser.school || 'Sai Elite India STEM Academy'}</p>
            <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <div class="grid">
            <div class="stat-box">
              <div>Active Study Streak</div>
              <div class="stat-value">${editedUser.streak} Days</div>
            </div>
            <div class="stat-box">
              <div>Total Learning XP</div>
              <div class="stat-value">${editedUser.totalPoints} Points</div>
            </div>
          </div>

          <h3>Academic Performance Summary</h3>
          <p>The student is actively engaged with Thambi Robo AI counselor, completing practice STEM quizzes, and participating in daily learning quests.</p>

          <button onclick="window.print()" style="padding: 12px 24px; background: #0284c7; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 20px;">
            🖨️ Print / Save Report as PDF
          </button>

          <div class="footer">
            Generated by Sai Elite India Educational AI Learning Platform • www.saieliteindia.info
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  const generateScholarCertificate = () => {
    const certWindow = window.open('', '_blank');
    if (!certWindow) {
      toast.error('Pop-up blocked! Please allow pop-ups to view certificate.');
      return;
    }

    const certHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>STEM Excellence Certificate - ${editedUser.name}</title>
          <style>
            body { font-family: 'Georgia', serif; padding: 50px; background: #fafafa; color: #0f172a; text-align: center; }
            .border-box { border: 10px double #0284c7; padding: 40px; border-radius: 20px; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            .title { font-size: 32px; font-weight: bold; color: #0284c7; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
            .subtitle { font-size: 16px; color: #64748b; margin-bottom: 30px; font-style: italic; }
            .student-name { font-size: 36px; font-weight: bold; color: #0f172a; margin: 20px 0; border-bottom: 2px solid #0284c7; display: inline-block; padding-bottom: 5px; }
            .details { font-size: 16px; line-height: 1.8; color: #334155; margin: 20px auto; max-width: 650px; }
            .badge { font-size: 50px; margin: 20px 0; }
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 40px; }
            .sig-line { border-top: 1px solid #94a3b8; width: 200px; padding-top: 5px; font-size: 14px; font-weight: bold; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div class="border-box">
            <div class="title">Sai Elite India Educational</div>
            <div class="subtitle">Official STEM Academic Certificate of Excellence</div>

            <div class="badge">🏆🎓✨</div>

            <p>This is to proudly certify that</p>
            <div class="student-name">${editedUser.name}</div>

            <div class="details">
              has successfully achieved <strong>Level 5 Master Scholar Rank</strong> with <strong>${editedUser.totalPoints} XP Points</strong> and a <strong>${editedUser.streak}-Day Study Streak</strong> in AI-Powered STEM Robotics, Mathematics, and Physical Sciences.
            </div>

            <div class="signatures">
              <div class="sig-line">Thambi Robo AI Counselor<br/><small>AI Lead Academic Mentor</small></div>
              <div class="sig-line">Sai Elite India Educational<br/><small>Academic Certification Board</small></div>
            </div>

            <button onclick="window.print()" style="padding: 12px 30px; background: #0284c7; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 40px; font-family: sans-serif;">
              🖨️ Print / Download Certificate PDF
            </button>
          </div>
        </body>
      </html>
    `;

    certWindow.document.write(certHtml);
    certWindow.document.close();
  };

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/80 border border-slate-800/80 shadow-2xl"
      >
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-[90px] pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-20 h-20 bg-slate-900 rounded-2xl border-2 border-cyan-500/50 shadow-[0_0_20px_rgba(56,189,248,0.3)] flex items-center justify-center text-cyan-400">
                <User className="w-10 h-10" />
              </div>
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedUser.name}
                    onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                    className="text-2xl font-bold bg-white/20 dark:bg-black/20 rounded-lg px-3 py-1 text-white placeholder-white/70"
                    placeholder="Your name"
                  />
                ) : (
                  <h1 className="text-3xl font-bold">{editedUser.name}</h1>
                )}
                {isEditing ? (
                  <input
                    type="email"
                    value={editedUser.email}
                    onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                    className="text-blue-100 bg-white/20 dark:bg-black/20 rounded-lg px-3 py-1 mt-1 text-white placeholder-white/70"
                    placeholder="your.email@example.com"
                  />
                ) : (
                  <p className="text-blue-100">{editedUser.email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Back button (shown when a parent provides an onBack handler) */}
              {onBack && (
                <button
                  onClick={() => onBack?.()}
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors mr-2"
                  title="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}

              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    className="p-2 bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={generateParentReport}
                    className="p-2 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/40 rounded-lg transition-colors mr-2 flex items-center gap-1.5 text-xs font-bold"
                    title="Generate Parent & Teacher PDF Progress Report"
                  >
                    <Printer className="w-4 h-4" /> Report
                  </button>
                  <button
                    onClick={generateScholarCertificate}
                    className="p-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/40 rounded-lg transition-colors mr-2 flex items-center gap-1.5 text-xs font-bold"
                    title="Generate STEM Excellence Academic Certificate"
                  >
                    <Award className="w-4 h-4" /> Certificate
                  </button>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors mr-2"
                    title="Edit profile"
                  >
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors mr-2"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-300" /> : <Moon className="w-5 h-5 text-gray-700" />}
                  </button>
                  <button
                    onClick={async () => {
                      // logout: sign out via supabase if available, clear guest flag and local user, then redirect to login
                      try {
                        if (supabaseClient?.auth?.signOut) {
                          await supabaseClient.auth.signOut();
                        }
                      } catch (e) {
                        // ignore signOut errors
                      }
                      try {
                        window.localStorage.removeItem('isGuest');
                        window.localStorage.removeItem('studymentor-user');
                      } catch (e) {}
                      // Redirect to root which will show the Auth screen when there's no session
                      window.location.href = '/';
                    }}
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Tabs for About / Profile */}
          <div className="mt-6">
            <div className="inline-flex rounded-md bg-white/10 p-1">
              <button
                onClick={() => setActiveTab('about')}
                className={`px-3 py-1 rounded ${activeTab === 'about' ? 'bg-white/20' : 'bg-transparent'}`}
              >About</button>
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-3 py-1 rounded ${activeTab === 'profile' ? 'bg-white/20' : 'bg-transparent'}`}
              >Profile</button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            <div className="text-center">
              <div className="text-2xl font-bold">{editedUser.streak}</div>
              <div className="text-sm text-blue-100">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{editedUser.totalPoints}</div>
              <div className="text-sm text-blue-100">Total Points</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{unlockedBadges.length}</div>
              <div className="text-sm text-blue-100">Badges Earned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {Math.floor((Date.now() - new Date(editedUser.joinedAt).getTime()) / (1000 * 60 * 60 * 24))}
              </div>
              <div className="text-sm text-blue-100">Days Active</div>
            </div>
          </div>
        </div>
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4 w-32 h-32 bg-white dark:bg-black/40 rounded-full"></div>
            <div className="absolute bottom-4 left-4 w-24 h-24 bg-white dark:bg-black/40 rounded-full"></div>
            <div className="absolute bottom-4 left-4 w-24 h-24 bg-white dark:bg-black/20 rounded-full"></div>
        </div>
      </motion.div>
      {/* Stats Grid */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
  className="bg-white rounded-xl p-6 shadow-md dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
          <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="font-semibold text-gray-900">
                {new Date(editedUser.joinedAt).toLocaleDateString()}
              </p>
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
            <div className="p-3 bg-green-100 rounded-lg">
          <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Grade</p>
              <p className="font-semibold text-gray-900">{editedUser.grade}</p>
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
            <div className="p-3 bg-purple-100 rounded-lg">
          <Trophy className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Best Streak</p>
              <p className="font-semibold text-gray-900">{editedUser.streak} days</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
  className="bg-white rounded-xl p-6 shadow-md dark:bg-black dark:text-white"
        >
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
          <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Achievement Rate</p>
              <p className="font-semibold text-gray-900">
                {((unlockedBadges.length / badges.length) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </motion.div>
      </div>
  {/* Badges Section */}
  <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
  className="bg-white rounded-2xl p-6 shadow-lg dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-6">Achievements</h2>
        {/* Unlocked Badges */}
        {unlockedBadges.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Earned Badges</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlockedBadges.map((badge: Badge, index: number) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.1 }}
                  className="bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl p-4 border-2 border-yellow-300"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="text-2xl">{badge.icon}</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{badge.name}</h4>
                      <p className="text-sm text-gray-600">{badge.description}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Earned on {new Date(badge.unlockedAt!).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        {/* Locked Badges */}
        {lockedBadges.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Achievements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedBadges.map((badge: Badge, index: number) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="bg-gray-100 rounded-xl p-4 border-2 border-gray-200 opacity-60 dark:bg-black/90 dark:border-gray-800"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="text-2xl grayscale">{badge.icon}</div>
                    <div>
                      <h4 className="font-semibold text-gray-600">{badge.name}</h4>
                      <p className="text-sm text-gray-500">{badge.description}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    {badge.requirement}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
        {badges.length === 0 && (
          <div className="text-center py-12">
            <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No achievements yet</h3>
            <p className="text-gray-500">Complete quizzes and improve your scores to unlock badges!</p>
          </div>
        )}
      </motion.div>

      {/* Conditional content based on tab */}
      {activeTab === 'about' ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
  className="bg-white rounded-2xl p-6 shadow-lg dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:border dark:border-gray-700 dark:text-white"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">About</h2>
          <p className="text-gray-700 mb-4">{(editedUser as any).bio || 'No bio yet. You can add a short description in Profile.'}</p>
          <div className="text-sm text-gray-600">You are viewing the About section. Statistics and achievements are shown above.</div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl p-6 shadow-lg dark:bg-black dark:text-white"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                value={editedUser.name}
                onChange={(e) => setEditedUser({ ...editedUser, name: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                value={editedUser.email}
                onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Grade</label>
              <input
                type="text"
                value={editedUser.grade}
                onChange={(e) => setEditedUser({ ...editedUser, grade: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Age</label>
              <input
                type="number"
                value={(editedUser as any).age ?? ''}
                onChange={(e) => setEditedUser({ ...(editedUser as any), age: e.target.value ? Number(e.target.value) : undefined })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">School</label>
              <input
                type="text"
                value={(editedUser as any).school ?? ''}
                onChange={(e) => setEditedUser({ ...(editedUser as any), school: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-black dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Section / Class</label>
              <input
                type="text"
                value={(editedUser as any).section ?? ''}
                onChange={(e) => setEditedUser({ ...(editedUser as any), section: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
              <input
                type="tel"
                value={(editedUser as any).phone ?? ''}
                onChange={(e) => setEditedUser({ ...(editedUser as any), phone: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
              <textarea
                value={(editedUser as any).bio || ''}
                onChange={(e) => setEditedUser({ ...(editedUser as any), bio: e.target.value })}
                className="mt-1 block w-full border rounded p-2 bg-white dark:bg-gray-800 dark:text-white"
                rows={4}
              />
            </div>
            <div className="flex space-x-2">
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
              <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 rounded dark:bg-black/60 dark:text-white">Cancel</button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}