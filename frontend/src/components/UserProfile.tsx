import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Edit3, Save, X, Trophy, Calendar, Target, Award, Sun, Moon, LogOut, ArrowLeft } from 'lucide-react';
import type { User as UserType, Badge } from '../types';
import toast from 'react-hot-toast';
import { supabaseClient } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

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

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading profile...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Profile Header */}
  <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
  className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-2xl p-8 text-white relative overflow-hidden dark:from-gray-900 dark:via-gray-800 dark:to-gray-700"
      >
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="w-20 h-20 bg-white/20 dark:bg-black/20 rounded-full flex items-center justify-center">
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