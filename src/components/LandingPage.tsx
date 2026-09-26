import React, { useState, useEffect } from 'react';
import {
  Lock,
  Sparkles,
  Clock,
  FileCheck2,
  AlertTriangle,
  Coins,
  Users,
  CheckCircle,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  Search,
  Shield,
  KeyRound,
  Check,
  Ban,
} from 'lucide-react';
import { FILI_JOBS, TOTAL_MIDDLE_SCHOOL_CAPACITY } from '../data/jobs';
import { SlotSettings, StudentProfile, AdminUser } from '../types';

interface LandingPageProps {
  onOpenGoogleSignIn: () => void;
  onOpenAdminSignIn: () => void;
  currentStudent?: StudentProfile | null;
  onStartApplication?: (jobId?: string) => void;
  adminUser?: AdminUser | null;
  onReturnToAdmin?: () => void;
}

interface JobWithSlotStatus {
  id: string;
  title: string;
  category: string;
  description: string;
  payout: string;
  totalQuota: number;
  maxPerClass?: number;
  requirements: string[];
  filledCount?: number;
  isFull?: boolean;
  isClosedByAdmin?: boolean;
  isSlotOpen?: boolean;
  slotStatus?: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenGoogleSignIn,
  onOpenAdminSignIn,
  currentStudent,
  onStartApplication,
  adminUser,
  onReturnToAdmin,
}) => {
  const [searchJob, setSearchJob] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [liveJobs, setLiveJobs] = useState<JobWithSlotStatus[]>(FILI_JOBS);
  const [slotSettings, setSlotSettings] = useState<SlotSettings | null>(null);

  useEffect(() => {
    const fetchLiveJobs = async () => {
      try {
        const res = await fetch('/api/jobs');
        const data = await res.json();
        if (data.jobs) {
          setLiveJobs(data.jobs);
        }
        if (data.slotSettings) {
          setSlotSettings(data.slotSettings);
        }
      } catch (err) {
        console.error('Error fetching job slots:', err);
      }
    };
    fetchLiveJobs();

    // 25-second live refresh interval
    const interval25s = setInterval(fetchLiveJobs, 25000);
    return () => clearInterval(interval25s);
  }, []);

  const categories = React.useMemo(() => {
    const cats = Array.from(new Set(liveJobs.map((j) => j.category).filter(Boolean)));
    return ['All', ...cats];
  }, [liveJobs]);

  const filteredJobs = liveJobs.filter((job) => {
    const matchesCat = selectedCategory === 'All' || job.category === selectedCategory;
    const matchesQuery =
      job.title.toLowerCase().includes(searchJob.toLowerCase()) ||
      job.description.toLowerCase().includes(searchJob.toLowerCase()) ||
      job.requirements.some((r) => r.toLowerCase().includes(searchJob.toLowerCase()));
    return matchesCat && matchesQuery;
  });

  const isGlobalClosed = slotSettings && slotSettings.globalSlotsOpen === false;

  return (
    <div className="space-y-10 pb-16">
      {/* Admin Mode Return Banner */}
      {adminUser && onReturnToAdmin && (
        <div className="bg-indigo-900 text-white rounded-2xl p-4 shadow-md flex items-center justify-between border border-indigo-700 animate-in fade-in">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-300" />
            <div>
              <span className="font-bold text-sm block">Administrator Preview Active</span>
              <span className="text-xs text-indigo-200">
                You are previewing the student portal view as {adminUser.username}.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onReturnToAdmin}
            className="px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 font-bold rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
          >
            Return to Admin Dashboard
          </button>
        </div>
      )}

      {/* Global Slots Closed Banner */}
      {isGlobalClosed && (
        <div className="bg-red-500 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex items-start gap-3.5 border-2 border-red-600 animate-in fade-in">
          <Ban className="w-6 h-6 text-white shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              Application Intake Currently Closed by Administration
            </h3>
            <p className="text-xs sm:text-sm text-red-100">
              Student application slots are currently locked. Administrators can re-open slots at any time from the Admin Portal.
            </p>
          </div>
        </div>
      )}

      {/* Hero Institutional Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-3xl space-y-6">
          {/* Institutional Badge & Slot Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Mandatory Student Program • Fall 2026 Term
            </div>
            {isGlobalClosed ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/30 border border-red-400/50 text-red-200 text-xs font-bold">
                <Ban className="w-3 h-3 text-red-300" /> Slots Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                <CheckCircle className="w-3 h-3 text-emerald-300" /> Intake Slots Open
              </span>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Job Application for <span className="text-indigo-400 underline decoration-indigo-500/50 underline-offset-8">FiLi</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed">
              Official campus work placement portal for all Middle School students. Earn monthly BRAED credits, build leadership certificates, and contribute directly to school operations.
            </p>
          </div>

          {/* Key Rule Callout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-100">Strict FCFS Queue</h4>
                <p className="text-[11px] text-slate-400">Timestamp logged to the millisecond upon submission.</p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-100">Automated AI Pipeline</h4>
                <p className="text-[11px] text-slate-400">Gemini verifies PDF credentials & calculates role match.</p>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-3">
              <Coins className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-100">Monthly BRAED Stipends</h4>
                <p className="text-[11px] text-slate-400">200 to 350 BRAED credited to student campus accounts.</p>
              </div>
            </div>
          </div>

          {/* Prominent Action Bar with Student Application and Admin Portal */}
          <div className="pt-4 flex flex-wrap items-center gap-3.5">
            {currentStudent ? (
              <button
                id="landing-apply-btn"
                onClick={() => {
                  if (onStartApplication) onStartApplication();
                }}
                disabled={isGlobalClosed || !onStartApplication}
                className={`inline-flex items-center gap-3 px-6 py-4 rounded-xl font-bold text-base shadow-lg transition-all transform border ${
                  isGlobalClosed || !onStartApplication
                    ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed opacity-75'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 hover:-translate-y-0.5 cursor-pointer'
                }`}
              >
                <Briefcase className="w-5 h-5" />
                <span>{isGlobalClosed ? 'Intake Paused by Admin' : !onStartApplication ? `Already Applied (${currentStudent.name})` : `Apply for Campus Duty (${currentStudent.name})`}</span>
                <ChevronRight className="w-5 h-5 text-indigo-200" />
              </button>
            ) : (
              <button
                id="landing-google-signin-btn"
                onClick={onOpenGoogleSignIn}
                disabled={isGlobalClosed}
                className={`inline-flex items-center gap-3.5 px-6 py-4 rounded-xl font-bold text-base shadow-lg transition-all transform cursor-pointer border ${
                  isGlobalClosed
                    ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed opacity-75'
                    : 'bg-white hover:bg-slate-100 text-slate-900 border-slate-200 hover:-translate-y-0.5'
                }`}
              >
                {/* Authentic Google G Icon */}
                <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isGlobalClosed ? 'Intake Paused by Admin' : 'Sign in with Google to Apply'}</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </button>
            )}

            {/* Admin Access Button / Return to Admin */}
            {adminUser && onReturnToAdmin ? (
              <button
                id="hero-admin-portal-btn"
                onClick={onReturnToAdmin}
                className="inline-flex items-center gap-2.5 px-5 py-4 rounded-xl bg-indigo-900/80 hover:bg-indigo-900 text-white font-bold text-sm shadow-md transition-all border border-indigo-700 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Return to Admin Dashboard</span>
              </button>
            ) : (
              <button
                id="hero-admin-portal-btn"
                onClick={onOpenAdminSignIn}
                className="inline-flex items-center gap-2.5 px-5 py-4 rounded-xl bg-indigo-900/60 hover:bg-indigo-900 text-indigo-200 hover:text-white font-bold text-sm shadow-md transition-all border border-indigo-700/80 cursor-pointer"
                title="Sign in as an administrator to manage student slots, quotas, and applications"
              >
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Admin Sign In</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Prominent Admin Sign-In & Faculty Access Section */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900/60 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>Faculty & Administration Access Point</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Where can school administrators sign in?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              FiLi school administrators, department chairs, and placement officers sign in here to <strong>open or close application slots</strong>, manage candidate queues, inspect AI evaluation results, and print official student placement receipts.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0">
            <button
              onClick={onOpenAdminSignIn}
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In as Admin</span>
              <ChevronRight className="w-4 h-4 text-indigo-200" />
            </button>
          </div>
        </div>
      </section>

      {/* Mandatory Requirements & Preemption Placement Policy Banner */}
      <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-amber-950">
                Middle School Placement Policy: First-Come Entry & 25% Skilled Reservation
              </h3>
              <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                Admin Controlled Quota
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs text-amber-900">
              <div className="flex items-start gap-1.5 bg-amber-100/50 p-2 rounded-xl">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>No Experience Needed:</strong> First-time middle schoolers fill open slots on a provisional first-come basis.</span>
              </div>
              <div className="flex items-start gap-1.5 bg-amber-100/50 p-2 rounded-xl">
                <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>25% Skilled Reservation:</strong> Up to 25% of slots in technical/skilled roles are reserved for skilled kids with certificates.</span>
              </div>
              <div className="flex items-start gap-1.5 bg-amber-100/50 p-2 rounded-xl">
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>75% Protected Slots:</strong> Once the 25% skilled quota is filled, the remaining 75% of slots are protected for regular students.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 19 Positions Directory & Exploration */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xl font-bold text-slate-900">
                19 Available Positions & Slot Capacities
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Explore positions across Operations, Governance, Media, STEM, and Student Services ({TOTAL_MIDDLE_SCHOOL_CAPACITY} total middle school student capacity).
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchJob}
              onChange={(e) => setSearchJob(e.target.value)}
              placeholder="Search positions or skills..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Jobs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => {
            const isClosed = isGlobalClosed || job.isClosedByAdmin;
            const isFull = Boolean(job.isFull);
            const isUnavailable = isClosed || isFull;

            return (
              <div
                key={job.id}
                className={`bg-white rounded-2xl border p-5 transition-all flex flex-col justify-between group ${
                  isUnavailable
                    ? 'border-slate-300 bg-slate-50/70 opacity-90'
                    : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {job.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {job.isClosedByAdmin ? (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          Slots Closed
                        </span>
                      ) : isGlobalClosed ? (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                          Intake Paused
                        </span>
                      ) : isFull ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                          Quota Full (Closed)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Slots Open
                        </span>
                      )}
                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        {job.payout}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {job.title}
                  </h4>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                    {job.description}
                  </p>

                  <div className="pt-1">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Key Requirements:</p>
                    <div className="flex flex-wrap gap-1">
                      {job.requirements.map((req, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium text-[11px]">
                    {job.maxPerClass ? `Max ${job.maxPerClass}/class` : `Capacity quota: ${job.totalQuota}`}
                    {job.filledCount !== undefined ? ` • ${job.filledCount} filled` : ''}
                  </span>
                  {job.isClosedByAdmin ? (
                    <span className="text-xs font-semibold text-red-600">
                      Slots Closed
                    </span>
                  ) : isFull ? (
                    <span className="text-xs font-semibold text-amber-700">
                      Position Full
                    </span>
                  ) : isGlobalClosed ? (
                    <span className="text-xs font-semibold text-slate-500">
                      Intake Paused
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        if (!currentStudent) onOpenGoogleSignIn();
                        else if (onStartApplication) onStartApplication(job.id);
                      }}
                      disabled={!!currentStudent && !onStartApplication}
                      className={`${currentStudent && !onStartApplication ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-600 hover:underline cursor-pointer'} font-bold flex items-center gap-1`}
                    >
                      <span>{currentStudent ? (onStartApplication ? 'Apply for Role' : 'Already Applied') : 'Apply'}</span>
                      {(!currentStudent || onStartApplication) && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Institutional Callout Footer Card */}
      <section className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <h3 className="text-2xl font-bold">Ready to submit your application?</h3>
          <p className="text-xs sm:text-sm text-slate-300">
            Sign in using your school-issued Google account. Have your 2024–2026 middle school resume ready in PDF format.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {currentStudent ? (
            <button
              onClick={() => {
                if (onStartApplication) onStartApplication();
              }}
              disabled={isGlobalClosed || !onStartApplication}
              className={`shrink-0 px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 ${
                isGlobalClosed || !onStartApplication
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              <span>{isGlobalClosed ? 'Intake Closed' : !onStartApplication ? 'Already Applied' : 'Proceed to Application Form'}</span>
            </button>
          ) : (
            <button
              onClick={onOpenGoogleSignIn}
              disabled={isGlobalClosed}
              className={`shrink-0 px-6 py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
                isGlobalClosed
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span>{isGlobalClosed ? 'Intake Closed' : 'Authenticate & Start Application'}</span>
            </button>
          )}

          {adminUser && onReturnToAdmin ? (
            <button
              onClick={onReturnToAdmin}
              className="shrink-0 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
            >
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Return to Admin Dashboard</span>
            </button>
          ) : (
            <button
              onClick={onOpenAdminSignIn}
              className="shrink-0 px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
            >
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>Admin Portal</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
