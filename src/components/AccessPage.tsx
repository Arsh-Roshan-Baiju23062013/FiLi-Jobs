import React, { useState } from 'react';
import {
  School,
  ShieldCheck,
  Lock,
  Sparkles,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Eye,
  EyeOff,
  Users,
  Coins,
  Clock,
  Shield,
  Briefcase,
  Layers,
} from 'lucide-react';
import { StudentProfile, AdminUser } from '../types';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';

interface AccessPageProps {
  onStudentLoginSuccess: (profile: StudentProfile) => void;
  onAdminLoginSuccess: (admin: AdminUser) => void;
}

export function isUserAdminEmail(email?: string): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized === 'baijuqs@gmail.com' ||
    normalized === 'admin@fili.edu' ||
    normalized === 'admin_fili@gmail.com' ||
    normalized.startsWith('admin.') ||
    normalized.startsWith('admin_') ||
    normalized.includes('admin')
  );
}

export const AccessPage: React.FC<AccessPageProps> = ({
  onStudentLoginSuccess,
  onAdminLoginSuccess,
}) => {
  // Tab: 'google' (default for both students and staff) or 'admin_credentials'
  const [accessTab, setAccessTab] = useState<'google' | 'admin_credentials'>('google');

  // Google Sign-In state
  const [isFirebaseSigningIn, setIsFirebaseSigningIn] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Admin Credentials form state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Real Firebase Google Auth Popup Handler
  const handleFirebaseGoogleSignIn = async () => {
    setGoogleError(null);
    setIsFirebaseSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user && user.email) {
        const email = user.email.toLowerCase();
        const name = user.displayName || email.split('@')[0];
        const avatarUrl =
          user.photoURL ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;

        const profile: StudentProfile = {
          name,
          email,
          avatarUrl,
          isGoogleVerified: true,
        };

        // Check if user is administrator
        if (isUserAdminEmail(email)) {
          // Grant admin clearance via server
          try {
            const adminRes = await fetch('/api/admin/google-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, name }),
            });
            const adminData = await adminRes.json();
            if (adminData.success) {
              onAdminLoginSuccess({
                username: adminData.user.username,
                email: adminData.user.email,
                token: adminData.token,
                role: 'admin',
                isGoogleAdmin: true,
              });
              return;
            }
          } catch (e) {
            console.warn('Admin Google login endpoint note:', e);
          }
          // Fallback admin login
          onAdminLoginSuccess({
            username: name,
            email,
            token: `token_google_${Date.now()}`,
            role: 'admin',
            isGoogleAdmin: true,
          });
        } else {
          onStudentLoginSuccess(profile);
        }
      }
    } catch (err: any) {
      console.warn('[Firebase Auth] Google popup sign-in note:', err);
      if (err.code === 'auth/popup-blocked') {
        setGoogleError(
          'Popup was blocked by your browser/iframe. Please select one of the verified accounts below or use the manual login option.'
        );
      } else if (
        err.code === 'auth/cancelled-popup-request' ||
        err.code === 'auth/popup-closed-by-user'
      ) {
        // Dismissed by user
      } else {
        setGoogleError(err.message || 'Unable to complete Google Sign-In with Firebase.');
      }
    } finally {
      setIsFirebaseSigningIn(false);
    }
  };

  // Admin Credentials form submit (for Institutional key)
  const handleAdminCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setAdminError(data.error || 'Invalid Credentials. Access denied.');
        setAdminLoading(false);
        return;
      }

      onAdminLoginSuccess({
        username: data.user.username,
        token: data.token,
        role: 'admin',
      });
    } catch (err) {
      setAdminError('Network error authenticating administrator.');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="py-6 sm:py-10 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Institutional Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold tracking-wide">
          <School className="w-4 h-4 text-indigo-600" />
          <span>FiLi Middle School • Campus Work Placement Portal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Portal Access & Authentication
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Middle School students must sign in with Google to view open jobs, track quota allocations, and submit applications. School administrators authenticate through this unified access page.
        </p>
      </div>

      {/* Main Authentication Card */}
      <div 
        id="portal-access-card"
        className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
      >
        {/* Unified Tab Selector */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50/80">
          <button
            type="button"
            id="tab-google-access"
            onClick={() => setAccessTab('google')}
            className={`py-4 px-4 sm:px-6 text-sm font-bold flex items-center justify-center gap-2.5 transition-all border-b-2 cursor-pointer ${
              accessTab === 'google'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            {/* Google Icon */}
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google</span>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-extrabold">
              Students & Staff
            </span>
          </button>

          <button
            type="button"
            id="tab-admin-credentials"
            onClick={() => setAccessTab('admin_credentials')}
            className={`py-4 px-4 sm:px-6 text-sm font-bold flex items-center justify-center gap-2.5 transition-all border-b-2 cursor-pointer ${
              accessTab === 'admin_credentials'
                ? 'bg-white text-slate-900 border-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Lock className="w-4 h-4 text-slate-600" />
            <span>Admin Key Sign-In</span>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-extrabold">
              Institutional
            </span>
          </button>
        </div>

        {/* Tab 1: Google Sign-In for Students & Administrators */}
        {accessTab === 'google' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  Verified Identity & Access Protocol
                </h4>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Signing in with Google unlocks the <strong>FiLi Job Directory</strong>, your active work placement application, and real-time FCFS slot tracking. Your Google name and email are permanently locked to your submission.
                </p>
              </div>
            </div>

            {/* Live Google Firebase Popup Button */}
            <div>
              <button
                type="button"
                id="btn-access-google-live"
                onClick={handleFirebaseGoogleSignIn}
                disabled={isFirebaseSigningIn}
                className="w-full py-4 px-6 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-300 hover:border-slate-400 rounded-2xl font-bold text-base flex items-center justify-center gap-3.5 transition-all shadow-sm hover:shadow cursor-pointer disabled:opacity-60"
              >
                {isFirebaseSigningIn ? (
                  <>
                    <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>Connecting to Google Identity Services...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Sign in with Google Account (Live Popup)</span>
                  </>
                )}
              </button>
            </div>

            {googleError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{googleError}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Admin Key Institutional Login (Same Access Page) */}
        {accessTab === 'admin_credentials' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-start gap-3">
              <KeyRound className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-300">
                  Institutional Administrator Clearance
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Campus administrators, placement supervisors, and faculty chairs sign in with institutional credentials to manage application slots, inspect Gemini AI screening, and allocate cohorts.
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminCredentialsSubmit} className="space-y-4">
              {adminError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Administrator Username
                </label>
                <input
                  type="text"
                  id="access-admin-username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="w-full text-sm px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Security Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="access-admin-password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full text-sm px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-hidden font-medium pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-access-admin-submit"
                disabled={adminLoading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{adminLoading ? 'Verifying Clearance...' : 'Sign In as Administrator'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Card Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <span>Official FiLi Work Experience & Campus Contribution System</span>
          <span className="font-mono">FCFS Queue • 1,180 Capacity Pipeline</span>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <Briefcase className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">19 Job Positions</h4>
            <p className="text-[11px] text-slate-500">
              Campus banking, STEM assistants, media team, library, and maintenance.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <Coins className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">Monthly BRAED Stipends</h4>
            <p className="text-[11px] text-slate-500">
              200 to 350 BRAED credits credited monthly upon duty attendance.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">Automated AI Pipeline</h4>
            <p className="text-[11px] text-slate-500">
              Gemini verifies resume alignment and evaluates leadership credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
