import React, { useState, useEffect } from 'react';
import {
  Lock,
  CheckCircle2,
  FileText,
  Upload,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileCheck,
  AlertCircle,
  FileX,
  HelpCircle,
  Ban,
  Clock,
} from 'lucide-react';
import { FILI_JOBS, isJobSkilledRole } from '../data/jobs';
import { Application, StudentProfile, SlotSettings } from '../types';
import { saveApplicationToFirestore, subscribeToSlotSettings } from '../lib/firebase';

interface ApplicationFormProps {
  currentStudent: StudentProfile;
  initialJobId?: string;
  onSubmitted: (application: Application) => void;
  onCancel: () => void;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  currentStudent,
  initialJobId,
  onSubmitted,
  onCancel,
}) => {
  const [studentClass, setStudentClass] = useState('Grade 8');
  const [section, setSection] = useState('Section A');
  const [selectedJobId, setSelectedJobId] = useState(initialJobId || 'tea-mgmt');
  const [accountOwner, setAccountOwner] = useState<'student' | 'parent'>('student');
  const [actualStudentName, setActualStudentName] = useState('');

  // Slot settings state
  const [jobsList, setJobsList] = useState<typeof FILI_JOBS>(FILI_JOBS);
  const [slotSettings, setSlotSettings] = useState<SlotSettings>({
    globalSlotsOpen: true,
    closedJobIds: [],
    noticeMessage: '',
  });

  // 25-second auto-update state & countdown
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(25);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Resume state
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfFileSize, setPdfFileSize] = useState<number>(0);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  // Submission & loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screeningStep, setScreeningStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Real-time ticker for deadline countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live jobs and slot settings from server (called initially and every 25 seconds)
  const fetchLiveJobData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (data.jobs && Array.isArray(data.jobs)) {
        setJobsList(data.jobs);
      }
      if (data.slotSettings) {
        setSlotSettings(data.slotSettings);
      }
      setSecondsUntilRefresh(25);
    } catch (err) {
      console.error('Error fetching jobs in form:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchLiveJobData();

    // 25-second recurring interval for live capacity and slot status
    const interval25s = setInterval(() => {
      fetchLiveJobData();
    }, 25000);

    // 1-second countdown ticker
    const intervalCountdown = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev <= 1 ? 25 : prev - 1));
    }, 1000);

    // Live subscription to Firestore slotSettings/global for immediate updates
    const unsubscribe = subscribeToSlotSettings((liveSettings) => {
      setSlotSettings(liveSettings);
    });

    return () => {
      clearInterval(interval25s);
      clearInterval(intervalCountdown);
      unsubscribe();
    };
  }, []);

  // Helper functions for dynamic job titles, quotas, and salaries
  const getJobEffectiveTitle = (job: (typeof FILI_JOBS)[0] | any) =>
    slotSettings.jobCustomDetails?.[job.id]?.title?.trim() || job.title;
  const getJobEffectiveCategory = (job: (typeof FILI_JOBS)[0] | any) =>
    slotSettings.jobCustomDetails?.[job.id]?.category?.trim() || job.category;
  const getJobEffectiveDescription = (job: (typeof FILI_JOBS)[0] | any) =>
    slotSettings.jobCustomDetails?.[job.id]?.description?.trim() || job.description;
  const getJobEffectiveQuota = (job: (typeof FILI_JOBS)[0] | any) =>
    slotSettings.jobCustomQuotas?.[job.id] ?? job.totalQuota;
  const getJobEffectiveSalary = (job: (typeof FILI_JOBS)[0] | any) =>
    slotSettings.jobCustomSalaries?.[job.id]?.payout ?? job.payout;

  // Single job closure check
  const isJobClosed = (job: (typeof FILI_JOBS)[0] | any) =>
    Boolean(slotSettings.closedJobIds?.includes(job.id) || job.isClosedByAdmin);

  // Full job check (quota reached or full flag)
  const isJobFull = (job: (typeof FILI_JOBS)[0] | any) => {
    const quota = getJobEffectiveQuota(job);
    return Boolean(job.isFull || (job.filledCount !== undefined && job.filledCount >= quota));
  };

  // Only open, non-full positions appear in the application form
  const availableJobs = jobsList.filter((j) => !isJobClosed(j) && !isJobFull(j));

  // Track if student targeted a specific job (via initialJobId or clicking a role)
  const [targetedJobId, setTargetedJobId] = useState<string | undefined>(initialJobId);

  // Check if the targeted job that the student is applying for is full or closed
  const targetedJob = targetedJobId ? jobsList.find((j) => j.id === targetedJobId) : null;
  const isTargetedJobClosed = targetedJob ? isJobClosed(targetedJob) : false;
  const isTargetedJobFull = targetedJob ? isJobFull(targetedJob) : false;
  const isTargetedJobUnavailable = Boolean(targetedJob && (isTargetedJobClosed || isTargetedJobFull));

  // Determine currently selected job
  const selectedJob =
    jobsList.find((j) => j.id === selectedJobId) || availableJobs[0] || jobsList[0] || FILI_JOBS[0];
  const isSelectedJobClosed = isJobClosed(selectedJob);
  const isSelectedJobFull = isJobFull(selectedJob);
  const isSelectedJobUnavailable = isSelectedJobClosed || isSelectedJobFull;

  // Auto-switch to available job if the currently selected one becomes closed or full and not in targeted block
  useEffect(() => {
    if (!targetedJobId && availableJobs.length > 0 && !availableJobs.some((j) => j.id === selectedJobId)) {
      setSelectedJobId(availableJobs[0].id);
    }
  }, [availableJobs, selectedJobId, targetedJobId]);

  const deadlineMs = slotSettings.submissionDeadline
    ? new Date(slotSettings.submissionDeadline).getTime()
    : null;
  const isDeadlinePassed = Boolean(deadlineMs && !isNaN(deadlineMs) && currentTime > deadlineMs);

  const getDeadlineCountdown = () => {
    if (!deadlineMs || isNaN(deadlineMs)) return null;
    const diff = deadlineMs - currentTime;
    if (diff <= 0) return 'Deadline passed';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s left`;
    return `${minutes}m ${seconds}s left`;
  };

  // Handle manual file upload (Restricted to PDF format only)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate PDF MIME type and extension
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setErrorMessage('Invalid file type. The application strictly accepts PDF documents only (.pdf).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setPdfBase64(base64);
      setPdfFileName(file.name);
      setPdfFileSize(file.size);
    };
    reader.onerror = () => {
      setErrorMessage('Error reading uploaded PDF file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleClearResume = () => {
    setPdfBase64(null);
    setPdfFileName(null);
    setPdfFileSize(0);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!slotSettings.globalSlotsOpen) {
      setErrorMessage('Application slots are currently closed by administration. Please check back later.');
      return;
    }

    if (isDeadlinePassed && deadlineMs) {
      const formatted = new Date(deadlineMs).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      setErrorMessage(`Application intake has officially closed. The submission deadline was ${formatted}. Applications are no longer accepted.`);
      return;
    }

    if (isJobClosed(selectedJob)) {
      setErrorMessage(`Application slots for "${getJobEffectiveTitle(selectedJob)}" are currently closed. Please select an open position.`);
      return;
    }

    if (isJobFull(selectedJob)) {
      setErrorMessage(`"${getJobEffectiveTitle(selectedJob)}" is at full quota capacity. Applications cannot be accepted for full positions.`);
      return;
    }

    if (!studentClass.trim() || !section.trim()) {
      setErrorMessage('Please enter both Class and Section.');
      return;
    }

    if (accountOwner === 'parent') {
      if (!actualStudentName.trim() || actualStudentName.trim().length < 3) {
        setErrorMessage("Please enter the student's full legitimate name. Fake accounts without a valid student name are not permitted.");
        return;
      }
    }

    setIsSubmitting(true);
    setScreeningStep('Fast-tracking application & verifying credentials...');

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: currentStudent.name,
          accountOwner,
          actualStudentName: accountOwner === 'parent' ? actualStudentName.trim() : undefined,
          studentEmail: currentStudent.email,
          studentAvatar: currentStudent.avatarUrl,
          studentClass: studentClass.trim(),
          section: section.trim(),
          jobId: selectedJobId,
          resumeFileName: pdfFileName,
          resumeFileSize: pdfFileSize,
          resumeBase64: pdfBase64,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        let serverErrorMsg = data?.error;
        if (!serverErrorMsg) {
          if (response.status === 403) {
            serverErrorMsg = 'Application submission is restricted under portal policy: A student can only be in one job, and re-submissions are only permitted for students who have been terminated/fired by administration.';
          } else if (response.status === 413) {
            serverErrorMsg = 'The uploaded resume file exceeds the file size limit. Please upload a smaller or compressed PDF file.';
          } else if (response.status >= 500) {
            serverErrorMsg = 'The screening service is currently processing high campus volume or encountered a temporary issue. Please wait a few seconds and try submitting again.';
          } else {
            serverErrorMsg = 'Failed to submit application. Please verify your information and try again.';
          }
        }
        throw new Error(serverErrorMsg);
      }

      if (!data || !data.application) {
        throw new Error('The portal received an incomplete response from the server. Please refresh and try again.');
      }

      // Persist directly to Firebase Firestore database
      try {
        await saveApplicationToFirestore(data.application);
      } catch (fbErr) {
        console.warn('[Firebase] Application stored via backend API; direct client Firestore sync note:', fbErr);
      }

      onSubmitted(data.application);
    } catch (err: any) {
      let friendlyMessage = err?.message || 'An unexpected error occurred during submission.';
      // Intercept and sanitize any raw technical JavaScript syntax errors
      if (
        friendlyMessage.includes('Unexpected token') ||
        friendlyMessage.includes('is not valid JSON') ||
        friendlyMessage.includes('JSON.parse') ||
        friendlyMessage.includes('<html') ||
        friendlyMessage.includes('<!DOCTYPE')
      ) {
        friendlyMessage =
          'Server communication error: The portal received an unexpected response format from the server. Please verify your connection or try submitting again.';
      }
      setErrorMessage(friendlyMessage);
      setIsSubmitting(false);
    }
  };

  // If the student specifically targeted a position that is full or closed, do not show the application form to them
  if (targetedJob && isTargetedJobUnavailable) {
    const effectiveTitle = getJobEffectiveTitle(targetedJob);
    const effectiveQuota = getJobEffectiveQuota(targetedJob);
    const filledCount = targetedJob.filledCount || 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="bg-white rounded-3xl border border-amber-200 shadow-xl p-8 sm:p-10 text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-600 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              {isTargetedJobFull ? 'Position Full • Intake Closed' : 'Position Closed by Administration'}
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900 pt-1">
              Application Form Unavailable for {effectiveTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              {isTargetedJobFull
                ? `All ${effectiveQuota} student participant slots for "${effectiveTitle}" are currently full (${filledCount} / ${effectiveQuota} positions assigned). The application form is not shown to students who apply for positions that are at full capacity.`
                : `Applications for "${effectiveTitle}" have been closed by school administration. The application form is not accessible for this position.`}
            </p>
          </div>

          {/* Live 25-Second sync ticker card */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <RefreshCw className={`w-4 h-4 text-indigo-600 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
              <div>
                <span className="font-bold block">Live 25-Second Sync Active</span>
                <span className="text-[11px] text-indigo-700">
                  Checking server continuously every 25 seconds. If a slot opens up or capacity is increased, the application form will automatically load.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <span className="font-mono font-bold bg-white text-indigo-700 px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                {secondsUntilRefresh}s
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {availableJobs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTargetedJobId(undefined);
                  setSelectedJobId(availableJobs[0].id);
                }}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Browse {availableJobs.length} Available Open Position{availableJobs.length === 1 ? '' : 's'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={fetchLiveJobData}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-100/80 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Now</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Back to Catalog
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If all jobs are either closed or full, do not show the application form to students
  if (availableJobs.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        <div className="bg-white rounded-3xl border border-amber-200 shadow-xl p-8 sm:p-10 text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-600 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900">
              Application Intake Currently Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              All student campus jobs are currently at full capacity or closed by school administration. The application form is temporarily hidden until new slots become available.
            </p>
          </div>

          {/* 25s Live sync ticker */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-950 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5">
              <RefreshCw className={`w-4 h-4 text-indigo-600 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
              <div>
                <span className="font-bold block">Live 25-Second Sync Active</span>
                <span className="text-[11px] text-indigo-700">Checking server continuously for any newly opened or vacated slots.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="font-mono font-bold bg-white text-indigo-700 px-3 py-1 rounded-lg border border-indigo-200 shadow-2xs">
                {secondsUntilRefresh}s
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={fetchLiveJobData}
              disabled={isRefreshing}
              className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-100/80 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh Now</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Return to Campus Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Portal Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Authenticated & Verified
            </span>
            <span className="text-xs text-slate-400">• Step 2 of 2</span>
            {/* 25-second Live Sync indicator */}
            <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full">
              <RefreshCw className={`w-3 h-3 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Updates every 25s ({secondsUntilRefresh}s)</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Middle School Candidate Placement Form
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Submit your job selection and PDF credentials. FCFS queue will record your submission immediately.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl self-start md:self-auto">
          {currentStudent.avatarUrl && (
            <img
              src={currentStudent.avatarUrl}
              alt={currentStudent.name}
              className="w-10 h-10 rounded-full border border-slate-300"
            />
          )}
          <div className="text-xs">
            <div className="flex items-center gap-1 font-bold text-slate-900">
              <span>{currentStudent.name}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-slate-500 font-mono text-[11px]">{currentStudent.email}</span>
          </div>
        </div>
      </div>

      {/* Deadline Expired Banner */}
      {isDeadlinePassed && deadlineMs && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-start gap-3 text-rose-900 shadow-xs">
          <Clock className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-bold text-sm text-rose-950">
              Application Intake Window Closed
            </div>
            <p className="leading-relaxed">
              The official administration submission deadline was{' '}
              <strong>
                {new Date(deadlineMs).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </strong>
              . The application window is now closed, and new student submissions can no longer be accepted.
            </p>
          </div>
        </div>
      )}

      {/* Active Deadline Countdown Banner */}
      {!isDeadlinePassed && deadlineMs && slotSettings.globalSlotsOpen && (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-indigo-950 text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <span className="font-bold">Submission Window Deadline: </span>
              <span>
                Closes {new Date(deadlineMs).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold text-[11px] whitespace-nowrap shadow-xs self-start sm:self-auto">
            {getDeadlineCountdown()}
          </span>
        </div>
      )}

      {/* Global Slots Closed Banner */}
      {!slotSettings.globalSlotsOpen && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3 text-amber-900 shadow-xs">
          <Ban className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-bold text-sm text-amber-950">
              Student Application Intake is Paused
            </div>
            <p>
              The administration has temporarily closed all position slots. Submissions are paused.
              You may review position details and prepare your PDF credentials in the meantime.
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-3 text-red-800 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold">
              {errorMessage.includes('policy') ||
              errorMessage.includes('forbidden') ||
              errorMessage.includes('closed') ||
              errorMessage.includes('placed') ||
              errorMessage.includes('terminated')
                ? 'Submission Restricted by Policy'
                : 'Unable to Submit Application'}
            </h4>
            <p className="text-xs leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Read-Only Authenticated Google Credentials */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                1. Verified Student Identity (Read-Only)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Locked to Google SSO
            </span>
          </div>

          <p className="text-xs text-slate-500">
            These fields are locked to your verified Google account. Students cannot modify these credentials to apply under another identity.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name (Read-Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Google SSO Full Name</span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Read-only
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={currentStudent.name}
                  id="student-full-name-input"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-100/90 text-slate-700 font-semibold border border-slate-300 rounded-xl cursor-not-allowed select-none focus:outline-hidden"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Email Address (Read-Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>Email Address</span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> Read-only
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={currentStudent.email}
                  id="student-email-input"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-100/90 text-slate-700 font-mono border border-slate-300 rounded-xl cursor-not-allowed select-none focus:outline-hidden"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            {/* Account Owner Selection */}
            <div className="col-span-1 sm:col-span-2 mt-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Who owns this Google account? <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className={`flex-1 flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${accountOwner === 'student' ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="accountOwner"
                    value="student"
                    checked={accountOwner === 'student'}
                    onChange={() => setAccountOwner('student')}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Student Account</span>
                    <span className="text-[11px] opacity-80">This account belongs directly to the applicant.</span>
                  </div>
                </label>
                <label className={`flex-1 flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${accountOwner === 'parent' ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="accountOwner"
                    value="parent"
                    checked={accountOwner === 'parent'}
                    onChange={() => setAccountOwner('parent')}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">Parent/Guardian Account</span>
                    <span className="text-[11px] opacity-80">I am applying on behalf of my child.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Actual Student Name (If Parent) */}
            {accountOwner === 'parent' && (
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Child's Full Name (Applicant) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={actualStudentName}
                  onChange={(e) => setActualStudentName(e.target.value)}
                  placeholder="Enter the legitimate first and last name of the student"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-medium"
                  required
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Fake or anonymous names will result in immediate disqualification.</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Classroom & Section Info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              2. Classroom Assignment & Cohort
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify your current middle school grade level and section.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Class <span className="text-red-500">*</span>
              </label>
              <select
                id="student-class-input"
                value={studentClass}
                onChange={(e) => setStudentClass(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-medium"
                required
              >
                <option value="Grade 5">Grade 5</option>
                <option value="Grade 6">Grade 6</option>
                <option value="Grade 7">Grade 7</option>
                <option value="Grade 8">Grade 8</option>
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">Middle School Grade</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Section <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="student-section-input"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Section A, Room 204, or 8-B"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden font-medium"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Your assigned home-room section</span>
            </div>
          </div>
        </div>

        {/* Section 3: Job Selection (Only Available Open Positions) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  3. Job Selection ({availableJobs.length} Open Position{availableJobs.length === 1 ? '' : 's'}) <span className="text-red-500">*</span>
                </h3>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Unfilled & Open Only
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Select your preferred campus duty. Closed and full positions do not appear. Updates live every 25s.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                {getJobEffectiveSalary(selectedJob)}
              </span>
            </div>
          </div>

          {/* Notice if user was looking for a role that is closed or full */}
          {isSelectedJobUnavailable && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-xs block text-amber-950">
                  {isSelectedJobFull ? 'Position Quota Full' : 'Position Slot Closed'}: {getJobEffectiveTitle(selectedJob)}
                </span>
                <p className="mt-0.5 text-amber-800 text-[11px] leading-relaxed">
                  {isSelectedJobFull
                    ? `This role has reached full capacity (${getJobEffectiveQuota(selectedJob)}/${getJobEffectiveQuota(selectedJob)} students placed). It is not open for applications. Please choose from the active positions below.`
                    : `Applications for this single role are closed by school administration. Please choose from the active positions below.`}
                </p>
              </div>
            </div>
          )}

          {/* Radio Grid of ONLY Open Positions (Closed and full positions do not appear) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1 border border-slate-200 p-3 rounded-xl bg-slate-50/50">
            {availableJobs.map((job) => {
              const isSelected = selectedJobId === job.id;
              const effectiveTitle = getJobEffectiveTitle(job);
              const effectiveSalary = getJobEffectiveSalary(job);
              const effectiveQuota = getJobEffectiveQuota(job);
              const effectiveDesc = getJobEffectiveDescription(job);
              const filled = job.filledCount || 0;
              const remaining = Math.max(0, effectiveQuota - filled);

              return (
                <label
                  key={job.id}
                  id={`job-option-${job.id}`}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 text-left ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-400/40 shadow-xs cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1">
                    <input
                      type="radio"
                      name="jobSelection"
                      value={job.id}
                      checked={isSelected}
                      onChange={() => setSelectedJobId(job.id)}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {effectiveTitle}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                          {getJobEffectiveCategory(job)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {effectiveSalary}
                        </span>
                        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {remaining} of {effectiveQuota} slots open
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                        {effectiveDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {job.maxPerClass && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Max {job.maxPerClass}/class
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Selected Job Focus Card */}
          <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">
                Selected Role: {getJobEffectiveTitle(selectedJob)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {getJobEffectiveSalary(selectedJob)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              {getJobEffectiveDescription(selectedJob)}
            </p>
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-slate-600">Expected Operational Competencies: </span>
              <span className="text-[11px] text-slate-800 font-medium">
                {(slotSettings.jobCustomDetails?.[selectedJob.id]?.requirements ?? selectedJob.requirements).join(' • ')}
              </span>
            </div>

            {/* Quota reservation policy for candidate guidance */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-indigo-900 font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                <span>
                  {isJobSkilledRole(selectedJob.id) || slotSettings.skilledReservationScope === 'all-jobs'
                    ? `Skilled Track: ${slotSettings.skilledReservationPercent ?? 25}% reserved for certified candidates • ${100 - (slotSettings.skilledReservationPercent ?? 25)}% protected for general students.`
                    : 'Standard Track: Open to all middle school students on first-come, first-served basis.'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                Total Capacity: {getJobEffectiveQuota(selectedJob)} students
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Resume Upload (Restricted to PDF format only) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              4. Resume Upload (PDF Format Only) <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Middle school credentials, activities, and achievements from the last 2 years.
            </p>
          </div>

          {/* Placement & Document Verification Notice */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wider">
                Resume & Certificate Verification
              </h4>
              <p className="text-xs text-indigo-900 leading-relaxed">
                Upload your PDF resume or certificates to qualify for the 25% skilled priority quota. If you do not have a resume, or your file is corrupt or unverified, you are never disqualified — your application is automatically placed directly into the <strong>general First-Come, First-Served (FCFS) slot</strong>.
              </p>
            </div>
          </div>

          {/* File Upload Box */}
          {!pdfBase64 ? (
            <div className="space-y-3">
              <label
                htmlFor="resume-file-input"
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  Click to select or drag and drop your PDF resume
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Strictly PDF files (.pdf) only • Up to 25 MB
                </span>
                <input
                  id="resume-file-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Student Resume Upload Guide */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Resume Requirements for Middle School Applicants:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Ensure your PDF includes your school attendance, classroom tasks, school clubs, or any official awards/certificates earned over the past 2 years. Resumes are screened automatically for position alignment.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {pdfFileName}
                      </span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded">
                        PDF Document Attached
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      {(pdfFileSize / 1024).toFixed(1)} KB • application/pdf
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClearResume}
                    className="px-2.5 py-1 text-xs text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                  >
                    Remove File
                  </button>
                </div>
              </div>

              {/* Ready status */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <span>PDF payload verified and ready for student application submission.</span>
              </div>
            </div>
          )}
        </div>

        {/* Submit Actions & FCFS Warning */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold">First-Come, First-Served Queue Commitment</h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Clicking submit logs your timestamp with millisecond precision and immediately enters the AI screening node.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="submit-application-btn"
                disabled={isSubmitting || !slotSettings.globalSlotsOpen || isSelectedJobClosed || isDeadlinePassed}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : isDeadlinePassed ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Submissions Closed (Deadline Passed)</span>
                  </>
                ) : !slotSettings.globalSlotsOpen ? (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Intake Paused by Admin</span>
                  </>
                ) : isSelectedJobClosed ? (
                  <>
                    <Ban className="w-4 h-4" />
                    <span>Role Slot Closed</span>
                  </>
                ) : (
                  <>
                    <span>Submit & Log FCFS Timestamp</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Submission Pipeline Steps Tracker */}
          {isSubmitting && (
            <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{screeningStep}</span>
              </div>
              <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-3/4 animate-pulse"></div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
