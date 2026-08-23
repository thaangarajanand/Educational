import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, UserPlus, Trash2, UserCheck, ShieldAlert, Sparkles, RefreshCw, Mail, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../lib/supabase';

interface NormalAdmin {
  email: string;
  name?: string;
  addedBy?: string;
  addedAt?: string;
}

interface SuperAdminInfo {
  email: string;
  name?: string;
  claimedAt?: string;
}

interface ManageAdminsPageProps {
  session?: any;
}

export function ManageAdminsPage({ session }: ManageAdminsPageProps) {
  const currentUserEmail = session?.user?.email || '';
  const currentUserName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name || currentUserEmail.split('@')[0];

  const [superAdmin, setSuperAdmin] = useState<SuperAdminInfo | null>(null);
  const [normalAdmins, setNormalAdmins] = useState<NormalAdmin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State
  const [emailInput, setEmailInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/roles?email=${encodeURIComponent(currentUserEmail)}`);
      const data = await res.json();
      if (data) {
        setSuperAdmin(data.superAdmin || null);
        setNormalAdmins(data.normalAdmins || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin roles:', err);
      toast.error('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [currentUserEmail]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail) {
      toast.error('Please enter a valid Google email address.');
      return;
    }

    if (superAdmin && targetEmail === superAdmin.email.toLowerCase()) {
      toast.error('This email is already the Super Admin.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/add-normal-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: currentUserEmail,
          email: targetEmail,
          name: nameInput.trim() || targetEmail.split('@')[0]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to grant admin access.');
      }

      toast.success(data.message || `Granted Administrator access to ${targetEmail}`);
      setNormalAdmins(data.normalAdmins || []);
      setEmailInput('');
      setNameInput('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    setDeletingEmail(emailToRemove);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/remove-normal-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterEmail: currentUserEmail,
          email: emailToRemove
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove admin.');
      }

      toast.success(data.message || `Removed Administrator access from ${emailToRemove}`);
      setNormalAdmins(data.normalAdmins || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove admin.');
    } finally {
      setDeletingEmail(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Hero Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-cyan-500/30 p-6 sm:p-8 text-white shadow-2xl"
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-400 shadow-lg flex-shrink-0">
              <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Manage Administrators
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-slate-950 shadow-md uppercase tracking-wider flex items-center gap-1">
                  👑 Super Admin Control
                </span>
              </div>
              <p className="text-xs sm:text-sm text-cyan-200/80 mt-1 max-w-2xl">
                As the single system Super Admin, you can grant normal admin privileges with minimal powers or remove existing administrators anytime.
              </p>
            </div>
          </div>

          <button
            onClick={fetchAdminData}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            Refresh List
          </button>
        </div>
      </motion.div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <span className="text-2xl">👑</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Super Admin Account</p>
            <p className="text-xs sm:text-sm font-bold text-amber-300 truncate max-w-[180px] xs:max-w-[220px]">
              {superAdmin?.email || currentUserEmail}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Normal Administrators</p>
            <p className="text-xl font-black text-cyan-300">
              {normalAdmins.length} <span className="text-xs font-normal text-slate-400">Users</span>
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Role Security</p>
            <p className="text-xs font-bold text-purple-300">
              Exclusive Super Admin Access
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Create Admin Form & Admin List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        
        {/* Left Column: Create New Normal Admin Form (5 cols) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-5">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Create Normal Admin</h2>
                <p className="text-xs text-slate-400">Grant admin rights with minimal access powers</p>
              </div>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Google Email Address <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. administrator@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Name / Role Label <span className="text-slate-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Department Lead"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none transition-all"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-cyan-300">
                  <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" /> Minimal Power Scope:
                </div>
                <ul className="list-disc list-inside text-[11px] space-y-1 text-slate-400">
                  <li>Can access Data Hub files and educational tools</li>
                  <li>Can view student telemetry and course reports</li>
                  <li className="text-amber-400/90 font-medium">CANNOT create, view, or remove other administrators</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={submitting || !emailInput.trim()}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-black font-extrabold text-sm transition-all shadow-lg shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Granting Admin Access...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" /> Grant Normal Admin Privileges
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Right Column: Existing Administrators Table & List (7 cols) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Active Normal Administrators</h2>
                  <p className="text-xs text-slate-400">Manage and revoke existing normal admin accounts</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                {normalAdmins.length} Registered
              </span>
            </div>

            {normalAdmins.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-300">No Normal Administrators Added</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Currently, you are the only administrator on the system. Use the form to grant Normal Admin access to a Google email address.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {normalAdmins.map((admin) => (
                  <div
                    key={admin.email}
                    className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-sm flex-shrink-0">
                        {(admin.name || admin.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">
                            {admin.name || admin.email.split('@')[0]}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Normal Admin
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{admin.email}</p>
                        {admin.addedAt && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Added on: {new Date(admin.addedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveAdmin(admin.email)}
                      disabled={deletingEmail === admin.email}
                      className="self-end sm:self-center px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500/60 text-red-300 hover:text-red-100 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 flex-shrink-0"
                      title="Revoke Admin Access"
                    >
                      {deletingEmail === admin.email ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      )}
                      <span>Remove Admin</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
