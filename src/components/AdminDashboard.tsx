import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Search,
  Filter,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  FileX,
  Sparkles,
  Users,
  Coins,
  ChevronDown,
  Download,
  Eye,
  SlidersHorizontal,
  RotateCcw,
  Check,
  AlertCircle,
  X,
  School,
  ExternalLink,
  AlertTriangle,
  Printer,
  Ban,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Power,
  Briefcase,
  Percent,
  Settings2,
  Award,
  Target,
  BookOpen,
  UserX,
  Flame,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';
import { Application, ApplicationStatus, JobQuotaBreakdown, QuotaStats, SlotSettings } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FILI_JOBS, TOTAL_MIDDLE_SCHOOL_CAPACITY, isJobSkilledRole } from '../data/jobs';
import { printAndDownloadPlacementReceipt } from '../utils/receiptPdf';
import {
  updateSlotSettingsInFirestore,
  updateApplicationStatusInFirestore,
  fireAllStudentsInFirestore,
  subscribeToSlotSettings,
  subscribeToApplications,
  syncLocalApplicationsToFirestore,
  testFirestoreConnection,
} from '../lib/firebase';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean>(true);
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState<boolean>(false);
  const [stats, setStats] = useState<QuotaStats>({
    totalCapacity: TOTAL_MIDDLE_SCHOOL_CAPACITY,
    totalSubmitted: 0,
    totalApproved: 0,
    totalWaitlisted: 0,
    totalDisqualified: 0,
  });
  const [loading, setLoading] = useState(true);

  // Tab switcher
  const [activeTab, setActiveTab] = useState<'roster' | 'slots'>('roster');

  // Slot Management State
  const [slotSettings, setSlotSettings] = useState<SlotSettings>({
    globalSlotsOpen: true,
    closedJobIds: [],
    noticeMessage: '',
    skilledReservationPercent: 25,
    jobSkilledReservationPercents: {},
    skilledReservationScope: 'skilled-roles-only',
  });
  const [breakdowns, setBreakdowns] = useState<JobQuotaBreakdown[]>([]);
  const [customReservationPercent, setCustomReservationPercent] = useState<number>(25);
  const [reservationScope, setReservationScope] = useState<'skilled-roles-only' | 'all-jobs'>('skilled-roles-only');
  const [isUpdatingReservation, setIsUpdatingReservation] = useState(false);
  const [editingJobReservation, setEditingJobReservation] = useState<{ jobId: string; percent: number } | null>(null);
  const [roleModalToEdit, setRoleModalToEdit] = useState<{
    jobId: string;
    percent: number;
    minSkillScore: number;
    skilledRequirement: string;
    quota?: number;
    salaryPayout?: string;
    salaryAmount?: number;
    reservedSeats?: number;
    title?: string;
    category?: string;
    description?: string;
    requirementsText?: string;
  } | null>(null);
  const [selectedRolePickerId, setSelectedRolePickerId] = useState<string>('tech-support');

  const [isTogglingSlot, setIsTogglingSlot] = useState(false);
  const [slotSearchQuery, setSlotSearchQuery] = useState('');
  const [slotCategoryFilter, setSlotCategoryFilter] = useState<string>('All');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [jobFilter, setJobFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected application for detail modal
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dedicated non-blocking Fire confirmation modal state
  const [appToFire, setAppToFire] = useState<Application | null>(null);
  const [fireCustomReason, setFireCustomReason] = useState<string>('Administrative decision - placement terminated');
  const [showFireAllModal, setShowFireAllModal] = useState<boolean>(false);
  const [fireAllReason, setFireAllReason] = useState<string>('Administrative decision - placement terminated for all students');
  const [isFiringAll, setIsFiringAll] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  // Deadline & Total Capacity Management State
  const [deadlineInput, setDeadlineInput] = useState<string>('');
  const [isSettingDeadline, setIsSettingDeadline] = useState<boolean>(false);
  const [capacityInput, setCapacityInput] = useState<number>(1180);
  const [isSettingCapacity, setIsSettingCapacity] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());

  // Second-by-second ticker for live intake deadline countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimestamp(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch slot settings and quota breakdowns
  const fetchSlotSettings = async () => {
    try {
      const res = await fetch('/api/slot-settings');
      const data = await res.json();
      if (data.slotSettings) {
        setSlotSettings(data.slotSettings);
        setCustomReservationPercent(data.slotSettings.skilledReservationPercent ?? 25);
        setReservationScope(data.slotSettings.skilledReservationScope ?? 'skilled-roles-only');
      }
      if (data.breakdowns) {
        setBreakdowns(data.breakdowns);
      }
    } catch (err) {
      console.error('Error fetching slot settings:', err);
    }
  };

  // Memoized approved count per job
  const jobApprovedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach((app) => {
      if (app.status === 'Approved') {
        counts[app.jobId] = (counts[app.jobId] || 0) + 1;
      }
    });
    return counts;
  }, [applications]);

  // Fast lookup map for job quota breakdowns
  const breakdownMap = useMemo(() => {
    const map: Record<string, JobQuotaBreakdown> = {};
    breakdowns.forEach((b) => {
      map[b.jobId] = b;
    });
    return map;
  }, [breakdowns]);

  // Fetch applications from backend
  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (jobFilter !== 'all') params.append('jobId', jobFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const response = await fetch(`/api/admin/applications?${params.toString()}`);
      const data = await response.json();

      const incomingApps = data.applications || [];
      setApplications(incomingApps);
      if (data.stats) {
        setStats(data.stats);
      }
      await fetchSlotSettings();
      // Silently ensure all records are mirrored to Firestore Cloud DB
      syncLocalApplicationsToFirestore(incomingApps).catch(() => {});
    } catch (err) {
      console.error('Error fetching applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [statusFilter, jobFilter, searchQuery]);

  // Real-time synchronization with Firebase Firestore
  useEffect(() => {
    testFirestoreConnection().then((isLive) => {
      setFirebaseConnected(isLive);
    });

    const unsubSettings = subscribeToSlotSettings((liveSettings) => {
      if (liveSettings) {
        setSlotSettings(liveSettings);
      }
    });

    const unsubApps = subscribeToApplications((liveApps) => {
      if (liveApps && liveApps.length > 0 && statusFilter === 'All' && jobFilter === 'all' && !searchQuery.trim()) {
        setApplications(liveApps);
      }
    });

    return () => {
      unsubSettings();
      unsubApps();
    };
  }, []);

  const handleManualFirebaseSync = async () => {
    setIsFirebaseSyncing(true);
    try {
      const isLive = await testFirestoreConnection();
      setFirebaseConnected(isLive);
      const syncedCount = await syncLocalApplicationsToFirestore(applications);
      await updateSlotSettingsInFirestore(slotSettings);
      setToastMessage(`🔥 Firebase Firestore Synced! ${syncedCount} records verified in cloud.`);
    } catch (err: any) {
      setToastMessage('Firebase sync error: ' + (err?.message || 'Check network'));
    } finally {
      setIsFirebaseSyncing(false);
    }
  };

  // Slot management handlers
  const handleToggleGlobalSlots = async (targetOpen: boolean) => {
    setIsTogglingSlot(true);
    try {
      const res = await fetch('/api/admin/slots/toggle-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: targetOpen }),
      });
      const data = await res.json();
      if (data.success) {
        setSlotSettings(data.slotSettings);
        setToastMessage(data.message);
        // Persist to Firestore
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      }
    } catch (err) {
      console.error('Error toggling global intake slots:', err);
    } finally {
      setIsTogglingSlot(false);
    }
  };

  const handleToggleJobSlot = async (jobId: string, targetOpen: boolean) => {
    setIsTogglingSlot(true);
    try {
      const res = await fetch('/api/admin/slots/toggle-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, open: targetOpen }),
      });
      const data = await res.json();
      if (data.success) {
        setSlotSettings(data.slotSettings);
        setToastMessage(data.message);
        // Persist to Firestore
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      }
    } catch (err) {
      console.error('Error toggling position slot:', err);
    } finally {
      setIsTogglingSlot(false);
    }
  };

  const handleOpenAllSlots = async () => {
    setIsTogglingSlot(true);
    try {
      const res = await fetch('/api/admin/slots/open-all-jobs', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSlotSettings(data.slotSettings);
        setToastMessage(data.message);
        // Persist to Firestore
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      }
    } catch (err) {
      console.error('Error opening all slots:', err);
    } finally {
      setIsTogglingSlot(false);
    }
  };

  const handleCloseAllSlots = async () => {
    if (!window.confirm(`Close individual application slots for all ${FILI_JOBS.length} positions?`)) return;
    setIsTogglingSlot(true);
    try {
      const res = await fetch('/api/admin/slots/close-all-jobs', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSlotSettings(data.slotSettings);
        setToastMessage(data.message);
        // Persist to Firestore
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      }
    } catch (err) {
      console.error('Error closing all slots:', err);
    } finally {
      setIsTogglingSlot(false);
    }
  };

  // Set submission cutoff deadline handler
  const handleSetDeadline = async (deadline: string | null) => {
    setIsSettingDeadline(true);
    try {
      const res = await fetch('/api/admin/slots/set-deadline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionDeadline: deadline }),
      });
      const data = await res.json();
      if (data.success) {
        setSlotSettings(data.slotSettings);
        setToastMessage(data.message);
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      } else {
        setToastMessage(data.error || 'Failed to update submission deadline');
      }
    } catch (err) {
      console.error('Error setting submission deadline:', err);
      setToastMessage('Network error updating submission deadline');
    } finally {
      setIsSettingDeadline(false);
    }
  };

  // Set total middle school student capacity handler
  const handleSetTotalCapacity = async (capacity: number) => {
    if (!capacity || capacity < 1) {
      setToastMessage('Please specify a valid positive capacity number');
      return;
    }
    setIsSettingCapacity(true);
    try {
      const res = await fetch('/api/admin/slots/set-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalMaxCapacity: capacity }),
      });
      const data = await res.json();
      if (data.success) {
        setSlotSettings(data.slotSettings);
        if (data.stats) {
          setStats(data.stats);
        }
        setToastMessage(data.message);
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      } else {
        setToastMessage(data.error || 'Failed to update total capacity');
      }
    } catch (err) {
      console.error('Error setting total capacity:', err);
      setToastMessage('Network error updating total capacity');
    } finally {
      setIsSettingCapacity(false);
    }
  };

  const applyDeadlinePreset = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    const localIso = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDeadlineInput(localIso);
  };

  const applySalaryPreset = (amount: number) => {
    if (!roleModalToEdit) return;
    setRoleModalToEdit({
      ...roleModalToEdit,
      salaryAmount: amount,
      salaryPayout: `${amount} BRAED/Month`,
    });
  };

  const applyQuotaPreset = (quota: number) => {
    if (!roleModalToEdit) return;
    setRoleModalToEdit({
      ...roleModalToEdit,
      quota,
    });
  };

  // Helper for deadline status formatting in admin views
  const adminDeadlineMs = slotSettings.submissionDeadline
    ? new Date(slotSettings.submissionDeadline).getTime()
    : null;
  const isSubmissionDeadlineExpired = Boolean(
    adminDeadlineMs && !isNaN(adminDeadlineMs) && currentTimestamp > adminDeadlineMs
  );

  const getAdminDeadlineDisplay = () => {
    if (!adminDeadlineMs || isNaN(adminDeadlineMs)) {
      return {
        status: 'none',
        label: 'No Cutoff Scheduled',
        subtext: 'Intake window remains continuously open until manual closure or slots fill.',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }
    const diff = adminDeadlineMs - currentTimestamp;
    if (diff <= 0) {
      return {
        status: 'expired',
        label: 'Intake Closed (Deadline Passed)',
        subtext: `Cutoff passed on ${new Date(adminDeadlineMs).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}`,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 font-bold animate-pulse',
      };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    let remainingStr = '';
    if (days > 0) remainingStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    else if (hours > 0) remainingStr = `${hours}h ${minutes}m ${seconds}s`;
    else remainingStr = `${minutes}m ${seconds}s`;

    return {
      status: 'active',
      label: `Intake Closes in ${remainingStr}`,
      subtext: `Cutoff scheduled for ${new Date(adminDeadlineMs).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`,
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',
    };
  };

  // Update skilled candidate reservation quota and role details
  const handleUpdateSkilledReservation = async (params: {
    percent?: number;
    scope?: 'skilled-roles-only' | 'all-jobs';
    jobId?: string;
    minSkillScore?: number;
    skilledRequirement?: string;
    resetJobOverride?: boolean;
    applyToAllJobs?: boolean;
    quota?: number;
    salaryPayout?: string;
    salaryAmount?: number;
    reservedSeats?: number;
    resetQuota?: boolean;
    resetSalary?: boolean;
    resetReservedSeats?: boolean;
    title?: string;
    category?: string;
    description?: string;
    requirements?: string[];
    resetDetails?: boolean;
  }) => {
    setIsUpdatingReservation(true);
    try {
      const res = await fetch('/api/admin/slots/skilled-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      let data = await res.json();
      
      if (data.success && params.jobId && !params.applyToAllJobs) {
        // Also update custom settings, quotas, and role definition
        const customRes = await fetch('/api/admin/slots/job-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             jobId: params.jobId,
             quota: params.quota,
             salaryPayout: params.salaryPayout,
             salaryAmount: params.salaryAmount,
             reservedSeats: params.reservedSeats,
             resetQuota: params.resetQuota || params.resetJobOverride,
             resetSalary: params.resetSalary || params.resetJobOverride,
             resetReservedSeats: params.resetReservedSeats || params.resetJobOverride,
             title: params.title,
             category: params.category,
             description: params.description,
             requirements: params.requirements,
             resetDetails: params.resetDetails || params.resetJobOverride,
          }),
        });
        data = await customRes.json();
      }

      if (data.success) {
        setSlotSettings(data.slotSettings);
        if (data.breakdowns) {
          setBreakdowns(data.breakdowns);
        }
        setToastMessage(data.message);
        setEditingJobReservation(null);
        setRoleModalToEdit(null);
        // Persist to Firestore
        updateSlotSettingsInFirestore(data.slotSettings).catch((err) =>
          console.warn('[Firebase] Slot settings sync note:', err)
        );
      }
    } catch (err) {
      console.error('Error updating skilled reservation quota:', err);
    } finally {
      setIsUpdatingReservation(false);
    }
  };

  const openRoleSkilledModal = (jobId: string) => {
    const job = FILI_JOBS.find((j) => j.id === jobId);
    if (!job) return;
    const isSkilled = isJobSkilledRole(jobId);
    const existingPercent =
      slotSettings.jobSkilledReservationPercents?.[jobId] !== undefined
        ? slotSettings.jobSkilledReservationPercents[jobId]
        : slotSettings.skilledReservationScope === 'all-jobs' || isSkilled
        ? slotSettings.skilledReservationPercent ?? 25
        : 0;
    const existingScore = slotSettings.jobMinSkillScores?.[jobId] ?? 80;
    const existingReq = slotSettings.jobSkilledRequirements?.[jobId] ?? '';
    const customDetail = slotSettings.jobCustomDetails?.[jobId];

    setRoleModalToEdit({
      jobId,
      percent: existingPercent,
      minSkillScore: existingScore,
      skilledRequirement: existingReq,
      quota: slotSettings.jobCustomQuotas?.[jobId] ?? job.totalQuota,
      salaryPayout: slotSettings.jobCustomSalaries?.[jobId]?.payout ?? job.payout,
      salaryAmount: slotSettings.jobCustomSalaries?.[jobId]?.payoutAmount ?? job.payoutAmount,
      reservedSeats: slotSettings.jobCustomReservedSeats?.[jobId] ?? undefined,
      title: customDetail?.title ?? job.title,
      category: customDetail?.category ?? job.category,
      description: customDetail?.description ?? job.description,
      requirementsText: (customDetail?.requirements ?? job.requirements).join('\n'),
    });
  };

  // Handle manual status override
  const handleUpdateStatus = async (newStatus: ApplicationStatus) => {
    if (!selectedApp) return;
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/applications/${selectedApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, adminNotes: adminNote }),
      });
      const data = await response.json();
      if (data.success) {
        setSelectedApp(data.application);
        setToastMessage(`Status updated to "${newStatus}" for ${selectedApp.studentName}.`);
        // Persist to Firestore
        updateApplicationStatusInFirestore(selectedApp.id, newStatus, adminNote).catch((err) =>
          console.warn('[Firebase] Application status sync note:', err)
        );
        fetchApplications();
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Trigger Gemini Re-Screening
  const handleRescreen = async () => {
    if (!selectedApp) return;
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/applications/${selectedApp.id}/rescreen`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setSelectedApp(data.application);
        setToastMessage(`Gemini AI re-screening completed successfully.`);
        fetchApplications();
      }
    } catch (err) {
      console.error('Error re-screening:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const executeFireStudent = async (targetApp: Application, reason: string) => {
    setIsUpdatingStatus(true);
    try {
      const response = await fetch(`/api/admin/applications/${targetApp.id}/fire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Administrative decision' }),
      });
      const data = await response.json();
      if (data.success) {
        if (selectedApp && selectedApp.id === targetApp.id) {
          setSelectedApp(data.application);
        }
        setToastMessage(`Fired ${targetApp.studentName}. Job quota slot released. Student is now authorized to submit a new application.`);
        // Persist to Firestore
        updateApplicationStatusInFirestore(targetApp.id, 'Terminated (Fired by Admin)', reason).catch((err) =>
          console.warn('[Firebase] Application status sync note:', err)
        );
        fetchApplications();
        setAppToFire(null);
      }
    } catch (err) {
      console.error('Error firing student:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleFireStudent = () => {
    if (!selectedApp) return;
    setAppToFire(selectedApp);
    setFireCustomReason(adminNote || 'Administrative termination - placement terminated');
  };

  const executeFireAllStudents = async () => {
    setIsFiringAll(true);
    try {
      const response = await fetch('/api/admin/applications/fire-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: fireAllReason || 'Administrative decision - placement terminated for all students' }),
      });
      const data = await response.json();
      if (data.success) {
        setToastMessage(data.message || `Fired all students from their jobs. All quota slots have been released.`);
        if (data.firedAppIds && data.firedAppIds.length > 0) {
          fireAllStudentsInFirestore(data.firedAppIds, fireAllReason).catch((err) =>
            console.warn('[Firebase] Fire all status sync note:', err)
          );
        }
        setShowFireAllModal(false);
        if (selectedApp && selectedApp.status === 'Approved') {
          setSelectedApp(null);
        }
        await fetchApplications();
      } else {
        setToastMessage(`Error: ${data.error || 'Failed to fire students.'}`);
      }
    } catch (err) {
      console.error('Error firing all students:', err);
      setToastMessage('An error occurred while attempting to fire all students.');
    } finally {
      setIsFiringAll(false);
    }
  };

  // Reset to seed cohort without blocking window.confirm
  const handleResetDemo = () => {
    setShowResetConfirmModal(true);
  };

  const executeResetDemo = async () => {
    try {
      setLoading(true);
      await fetch('/api/admin/reset-demo', { method: 'POST' });
      fetchApplications();
      setToastMessage('Cohort database restored to default seed state.');
      setShowResetConfirmModal(false);
    } catch (err) {
      console.error('Error resetting demo:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Rank', 'Timestamp', 'Student Name', 'Email', 'Class', 'Section', 'Job Title', 'Payout', 'Resume Validity', 'Skill Score', 'Status', 'AI Reasoning'];
    const rows = applications.map((a) => [
      a.rank || '',
      `"${a.submissionTimestamp}"`,
      `"${a.studentName}"`,
      `"${a.studentEmail}"`,
      `"${a.studentClass}"`,
      `"${a.section}"`,
      `"${a.jobTitle}"`,
      `"${a.payout}"`,
      `"${a.resumeValidity}"`,
      a.skillScore,
      `"${a.status}"`,
      `"${(a.aiReasoning || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FiLi_Job_Applications_FCFS_Roster_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Capacity calculation
  const capacityPercent = Math.min(100, Math.round((stats.totalApproved / stats.totalCapacity) * 100));

  return (
    <div className="space-y-6 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Admin Top Dashboard Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Operations Control Center
            </span>
            <span className="text-xs text-slate-400">• Strict FCFS Pipeline Active</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Admin Placement & AI Screening System
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Managing the 1,200 student capacity cohort. Applications sorted automatically by AI Screening rules.
          </p>
        </div>

        {/* Global Controls & Log Out */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Master Slot Intake Toggle Button */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                <Power className="w-3 h-3 text-slate-400" /> Intake Slots
              </span>
              <span className={`text-xs font-black ${slotSettings.globalSlotsOpen ? 'text-emerald-600' : 'text-red-600'}`}>
                {slotSettings.globalSlotsOpen ? 'ACCEPTING' : 'CLOSED'}
              </span>
            </div>
            <button
              id="admin-master-slot-toggle-btn"
              type="button"
              onClick={() => handleToggleGlobalSlots(!slotSettings.globalSlotsOpen)}
              disabled={isTogglingSlot}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                slotSettings.globalSlotsOpen
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
              title={slotSettings.globalSlotsOpen ? 'Click to close application intake for all students' : 'Click to open application intake'}
            >
              {slotSettings.globalSlotsOpen ? (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Close Slots</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Open Slots</span>
                </>
              )}
            </button>
          </div>

          {/* Firebase Connection & Sync Status Indicator */}
          <div className="flex items-center gap-2.5 bg-indigo-50/70 border border-indigo-200/80 px-3 py-1.5 rounded-xl">
            <div className="flex flex-col text-left">
              <span className="text-[10px] uppercase font-bold text-indigo-900 flex items-center gap-1">
                🔥 Firebase Firestore
              </span>
              <span className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected • Live
              </span>
            </div>
            <button
              id="admin-firebase-sync-btn"
              type="button"
              onClick={handleManualFirebaseSync}
              disabled={isFirebaseSyncing}
              className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-800 font-bold rounded-lg text-xs border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Sync current roster and slot settings to Firebase Firestore Cloud DB"
            >
              <RefreshCw className={`w-3 h-3 ${isFirebaseSyncing ? 'animate-spin text-indigo-600' : 'text-indigo-500'}`} />
              <span>{isFirebaseSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>
          </div>

          <button
            onClick={fetchApplications}
            title="Refresh application queue"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            title="Export CSV Roster"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleResetDemo}
            title="Reset to fresh demo middle school applications"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>

          {/* Fire All Students Button */}
          <button
            id="btn-fire-all-students"
            onClick={() => {
              setFireAllReason('Administrative decision - placement terminated for all students');
              setShowFireAllModal(true);
            }}
            title="Fire all students currently placed in jobs"
            className="px-3.5 py-2 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <UserX className="w-3.5 h-3.5 text-red-600" />
            <span>Fire All Students</span>
          </button>

          {/* Prominent Log Out Button */}
          <button
            id="admin-logout-btn"
            onClick={onLogout}
            className="px-5 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm cursor-pointer ml-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out Admin</span>
          </button>
        </div>
      </div>

      {/* 1,200 Capacity Progress & Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Capacity Meter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2.5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Middle School Capacity
            </span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900">{stats.totalApproved}</span>
            <span className="text-xs font-bold text-slate-400">/ {stats.totalCapacity}</span>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(2, capacityPercent)}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span>{stats.totalCapacity - stats.totalApproved} left</span>
              <span>{capacityPercent}% filled</span>
            </div>
          </div>
        </div>

        {/* Approved Filter Card */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'Approved' ? 'All' : 'Approved')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Approved'
              ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400/30'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Approved
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.totalApproved}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">FCFS or Certified hold slot</p>
        </button>

        {/* Waitlisted Filter Card */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'Waitlisted' ? 'All' : 'Waitlisted')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Waitlisted'
              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/30'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Waitlisted
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{stats.totalWaitlisted}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Queued by capacity limit</p>
        </button>

        {/* Kicked Out / Displaced Card */}
        <button
          onClick={() =>
            setStatusFilter(
              statusFilter === 'Kicked Out (Displaced by Certified Candidate)'
                ? 'All'
                : 'Kicked Out (Displaced by Certified Candidate)'
            )
          }
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Kicked Out (Displaced by Certified Candidate)'
              ? 'bg-orange-50 border-orange-500 ring-2 ring-orange-400/30'
              : 'bg-white border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Kicked Out
            </span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-700">{stats.totalDisplaced || 0}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Preempted by certified candidates</p>
        </button>

        {/* Disqualified Filter Card */}
        <button
          onClick={() =>
            setStatusFilter(
              statusFilter === 'Disqualified (No Resume/Unqualified)'
                ? 'All'
                : 'Disqualified (No Resume/Unqualified)'
            )
          }
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'Disqualified (No Resume/Unqualified)'
              ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-400/30'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Disqualified
            </span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700">{stats.totalDisqualified}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Administrative override</p>
        </button>
      </div>

      {/* Overview Chart Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">Intake Overview</h2>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={[{
                name: 'Current Period',
                'Applications Received': stats.totalSubmitted,
                'Remaining Open Slots': Math.max(0, stats.totalCapacity - stats.totalApproved)
              }]} 
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              <Bar dataKey="Applications Received" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={120} />
              <Bar dataKey="Remaining Open Slots" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={120} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Primary Navigation Switcher: Roster vs Slot Management */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="tab-btn-roster"
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Candidate Applications Roster</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
              activeTab === 'roster' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {applications.length}
            </span>
          </button>

          <button
            id="tab-btn-slots"
            type="button"
            onClick={() => setActiveTab('slots')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'slots'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Position Slots & Capacity Controls</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono ${
              activeTab === 'slots' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {FILI_JOBS.length - slotSettings.closedJobIds.length}/{FILI_JOBS.length} Open
            </span>
          </button>
        </div>

        {/* Global intake status indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Middle School Intake:</span>
          {slotSettings.globalSlotsOpen ? (
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Open & Accepting
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full text-[11px]">
              <Ban className="w-3 h-3 text-red-600" />
              Intake Closed
            </span>
          )}
        </div>
      </div>

      {/* Global Slots Closed Banner */}
      {!slotSettings.globalSlotsOpen && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-950">
          <div className="flex items-center gap-2.5">
            <Ban className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <span className="font-extrabold text-sm block sm:inline mr-2">Intake Currently Closed by Administration:</span>
              <span className="text-red-900 font-medium">Middle school students cannot submit new applications. You can open intake globally using the top bar toggle or reopen individual positions below.</span>
            </div>
          </div>
          <button
            onClick={() => handleToggleGlobalSlots(true)}
            disabled={isTogglingSlot}
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            Re-Open All Intake
          </button>
        </div>
      )}

      {/* VIEW 1: Applications Roster Queue */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Priority Rules Explainer Banner */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-bold text-white">FiLi Placement Policy:</span>
              <span className="text-slate-300">
                Middle schoolers with no experience are taken in first. If a candidate with verified certificates applies, they take the slot and displace uncertified candidates.
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono bg-slate-800 px-2.5 py-1 rounded shrink-0">
              {applications.length} Records Loaded
            </span>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Quick Filter Tags */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </span>

              {[
                { id: 'All', label: 'All' },
                { id: 'Approved', label: 'Approved' },
                { id: 'Waitlisted', label: 'Waitlisted' },
                { id: 'Terminated (Fired by Admin)', label: 'Fired by Admin' },
                { id: 'Kicked Out (Displaced by Certified Candidate)', label: 'Kicked Out (Displaced)' },
                { id: 'Disqualified (No Resume/Unqualified)', label: 'Disqualified' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStatusFilter(item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === item.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Position Select & Search */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <select
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden font-medium"
              >
                <option value="all">All Positions ({FILI_JOBS.length})</option>
                {FILI_JOBS.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 md:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search candidate, class, email..."
                  className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
              </div>
            </div>
          </div>

      {/* Datatable Listing Sorted by AI Priority Rules */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-3 text-center w-12">Rank</th>
                <th className="py-3.5 px-3 w-40">FCFS Timestamp</th>
                <th className="py-3.5 px-4">Candidate & Google Account</th>
                <th className="py-3.5 px-3">Class & Section</th>
                <th className="py-3.5 px-4">Selected Job & Stipend</th>
                <th className="py-3.5 px-3">Resume Status</th>
                <th className="py-3.5 px-3 text-center">AI Score</th>
                <th className="py-3.5 px-3">Official Status</th>
                <th className="py-3.5 px-4 min-w-[220px]">AI Reasoning</th>
                <th className="py-3.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    No applications found matching the current filter criteria.
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const dateObj = new Date(app.submissionTimestamp);
                  const timeFormatted = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    fractionalSecondDigits: 3,
                  });
                  const dateFormatted = dateObj.toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                  });

                  return (
                    <tr
                      key={app.id}
                      onClick={() => {
                        setSelectedApp(app);
                        setAdminNote(app.adminNotes || '');
                      }}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-3 text-center font-bold font-mono text-slate-700">
                        #{app.rank}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-3 font-mono text-slate-600">
                        <div className="font-semibold text-slate-900 text-[11px]">{timeFormatted}</div>
                        <div className="text-[10px] text-slate-400">{dateFormatted}</div>
                      </td>

                      {/* Student */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {app.studentAvatar ? (
                            <img
                              src={app.studentAvatar}
                              alt={app.accountOwner === 'parent' && app.actualStudentName ? app.actualStudentName : app.studentName}
                              className="w-7 h-7 rounded-full border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                              {app.accountOwner === 'parent' && app.actualStudentName ? app.actualStudentName.charAt(0) : app.studentName.charAt(0)}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {app.accountOwner === 'parent' && app.actualStudentName ? app.actualStudentName : app.studentName}
                              </span>
                              {app.accountOwner === 'parent' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded border border-slate-200">
                                  via Parent
                                </span>
                              )}
                              {app.hasCertificates && (
                                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                  ★ Certified
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-[160px]">
                              {app.studentEmail}
                            </div>
                            {app.displacedByCandidateName && (
                              <div className="text-[10px] text-orange-700 font-semibold flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-orange-600" />
                                <span>Kicked out by {app.displacedByCandidateName}</span>
                              </div>
                            )}
                            {app.displacedCandidateName && (
                              <div className="text-[10px] text-purple-700 font-semibold">
                                Preempted {app.displacedCandidateName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-800">{app.studentClass}</span>
                        <span className="text-slate-400 block text-[11px]">{app.section}</span>
                      </td>

                      {/* Job & Stipend */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{app.jobTitle}</span>
                          {slotSettings.closedJobIds.includes(app.jobId) && (
                            <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                              Slot Closed
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                          {app.payout}
                        </span>
                      </td>

                      {/* Resume Validity */}
                      <td className="py-3.5 px-3">
                        {app.resumeValidity === 'valid' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <FileCheck className="w-3 h-3" /> Valid PDF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <FileX className="w-3 h-3" /> Missing/Blank
                          </span>
                        )}
                      </td>

                      {/* AI Score */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`font-black font-mono text-sm px-2 py-0.5 rounded ${
                            app.skillScore >= 80
                              ? 'text-emerald-700 bg-emerald-50'
                              : app.skillScore >= 40
                              ? 'text-amber-700 bg-amber-50'
                              : 'text-rose-700 bg-rose-50'
                          }`}
                        >
                          {app.skillScore}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3">
                        {app.status === 'Approved' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : app.status === 'Terminated (Fired by Admin)' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-900 bg-red-100 border border-red-300 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                            <XCircle className="w-3 h-3 text-red-600" /> Fired (Terminated)
                          </span>
                        ) : app.status === 'Resigned' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full">
                            <LogOut className="w-3 h-3 text-slate-500" /> Resigned
                          </span>
                        ) : app.status === 'Kicked Out (Displaced by Certified Candidate)' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-orange-900 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 text-orange-600" /> Kicked Out (Displaced)
                          </span>
                        ) : app.status === 'Waitlisted' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Waitlisted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Disqualified
                          </span>
                        )}
                      </td>

                      {/* AI Reasoning Column (Prompt requirement) */}
                      <td className="py-3.5 px-4 text-slate-700 text-[11px] leading-relaxed max-w-xs">
                        <span className="line-clamp-2" title={app.aiReasoning}>
                          {app.aiReasoning}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {app.status === 'Approved' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAppToFire(app);
                                setFireCustomReason(app.adminNotes || 'Administrative termination - slot released');
                              }}
                              className="px-2.5 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                              title="Fire student and release job quota slot"
                            >
                              Fire
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedApp(app);
                              setAdminNote(app.adminNotes || '');
                            }}
                            className="px-2.5 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

  {/* VIEW 2: 19 Positions Slot Management */}
  {activeTab === 'slots' && (
    <div className="space-y-6">
      {/* Slot Overview Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Global Intake Status
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-black ${
                slotSettings.globalSlotsOpen ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {slotSettings.globalSlotsOpen ? 'Open & Accepting' : 'Intake Closed'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {slotSettings.globalSlotsOpen
              ? 'Students can apply to any open positions'
              : 'All applications are currently blocked'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Open Positions
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600">
              {FILI_JOBS.length - slotSettings.closedJobIds.length}
            </span>
            <span className="text-xs font-bold text-slate-400">/ {FILI_JOBS.length} positions</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Available for student selection</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Closed Positions
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-red-600">
              {slotSettings.closedJobIds.length}
            </span>
            <span className="text-xs font-bold text-slate-400">/ {FILI_JOBS.length} positions</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Intake locked by administrator</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
            Total Cohort Filled
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-700">{stats.totalApproved}</span>
            <span className="text-xs font-bold text-slate-400">
              / {(slotSettings.totalMaxCapacity ?? stats.totalCapacity ?? 1180).toLocaleString()} total capacity
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Across all {FILI_JOBS.length} middle school roles</p>
        </div>

        <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block mb-1 flex items-center justify-between">
            <span>Skilled Quota</span>
            <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.2 rounded">
              Active
            </span>
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-indigo-700">
              {slotSettings.skilledReservationPercent ?? 25}%
            </span>
            <span className="text-xs font-bold text-indigo-500">Reserved</span>
          </div>
          <p className="text-[11px] text-indigo-900/80 mt-1">
            {slotSettings.skilledReservationScope === 'all-jobs'
              ? `Enforced across all ${FILI_JOBS.length} positions`
              : 'Applies to tech & skilled teams'}
          </p>
        </div>
      </div>

      {/* SECTION: Global Intake Schedule, Submission Cutoff & Capacity Control */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">
                Intake Schedule & Global Capacity Authority
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs border ${getAdminDeadlineDisplay().badgeClass}`}>
                {getAdminDeadlineDisplay().label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed">
              Set an exact automated closure time when student application slots freeze permanently. Once the deadline passes, students can no longer submit applications. You can also adjust total cohort participant capacity (default: 1,180 students).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-700 font-mono bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
              Middle School Capacity: <strong>{slotSettings.totalMaxCapacity ?? 1180}</strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Submission Deadline Timer Control (7 cols) */}
          <div className="lg:col-span-7 space-y-4 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Submission Slot Cutoff Time</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {getAdminDeadlineDisplay().subtext}
                </p>
              </div>
              {slotSettings.submissionDeadline && (
                <button
                  type="button"
                  onClick={() => handleSetDeadline(null)}
                  disabled={isSettingDeadline}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Clear Cutoff</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleSetDeadline(deadlineInput ? new Date(deadlineInput).toISOString() : null)}
                  disabled={isSettingDeadline || !deadlineInput}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {isSettingDeadline ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Set Cutoff Deadline</span>
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Time Presets
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '+1 Hour', hours: 1 },
                    { label: '+12 Hours', hours: 12 },
                    { label: '+24 Hours (Tomorrow)', hours: 24 },
                    { label: '+3 Days', hours: 72 },
                    { label: '+7 Days (1 Week)', hours: 168 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyDeadlinePreset(preset.hours)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: Total Cohort Capacity (5 cols) */}
          <div className="lg:col-span-5 space-y-4 bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Total Participant Capacity (Max 1,180)</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Global ceiling for all middle school students eligible to apply.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(Number(e.target.value) || 1)}
                  className="w-36 text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleSetTotalCapacity(capacityInput)}
                  disabled={isSettingCapacity}
                  className="flex-1 py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSettingCapacity ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Capacity</span>
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCapacityInput(1180);
                    handleSetTotalCapacity(1180);
                  }}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Reset to 1,180 Middle School Default
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION: Skilled Candidate Quota Reservation Console */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-indigo-800/60 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-indigo-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
                <Percent className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black tracking-tight text-white">
                Skilled Candidates Quota Reservation Control
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                Default: {slotSettings.skilledReservationPercent ?? 25}% Reserved
              </span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/90 max-w-3xl leading-relaxed">
              By default, <strong>25% of jobs</strong> like the Tech Team, Innovation 2.0, Web, Photography, Audio/Visual, and First Aid are reserved for skilled kids with certificates. Uncertified students are accepted first on open slots; if skilled students arrive, certificate preemption is strictly capped to this reserved percentage. The remaining <strong>{100 - (slotSettings.skilledReservationPercent ?? 25)}% of slots</strong> are protected for general students.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-indigo-300 font-mono bg-indigo-950/80 px-3 py-1.5 rounded-xl border border-indigo-800">
              Admin Quota Authority
            </span>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Percentage Slider & Presets (7 cols) */}
          <div className="lg:col-span-7 space-y-4 bg-indigo-950/60 border border-indigo-800/60 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Reserved Quota Percentage</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={customReservationPercent}
                  onChange={(e) => setCustomReservationPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  className="w-20 px-3 py-1 text-base font-black text-center bg-indigo-900 border border-indigo-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-400 font-mono"
                />
                <span className="text-sm font-black text-indigo-300">%</span>
              </div>
            </div>

            {/* Range Slider */}
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={customReservationPercent}
              onChange={(e) => setCustomReservationPercent(Number(e.target.value))}
              className="w-full accent-indigo-400 h-2 bg-indigo-900 rounded-lg cursor-pointer"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-indigo-300">Quick Presets:</span>
              {[
                { label: '0% (No Reservation)', val: 0 },
                { label: '15%', val: 15 },
                { label: '20%', val: 20 },
                { label: '25% (Standard Default)', val: 25 },
                { label: '33% (1/3)', val: 33 },
                { label: '50% (Half)', val: 50 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setCustomReservationPercent(preset.val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    customReservationPercent === preset.val
                      ? 'bg-indigo-400 text-slate-900 shadow-xs'
                      : 'bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scope Selector & Execution (5 cols) */}
          <div className="lg:col-span-5 space-y-4 bg-indigo-950/60 border border-indigo-800/60 rounded-2xl p-4 sm:p-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-200 block mb-2">
                Reservation Policy Scope
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    reservationScope === 'skilled-roles-only'
                      ? 'bg-indigo-900/90 border-indigo-400 text-white'
                      : 'bg-indigo-950/40 border-indigo-900 text-indigo-300 hover:bg-indigo-900/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="reservationScope"
                    checked={reservationScope === 'skilled-roles-only'}
                    onChange={() => setReservationScope('skilled-roles-only')}
                    className="mt-0.5 accent-indigo-400"
                  />
                  <div>
                    <div className="text-xs font-bold">Skilled Roles Only (Tech, Media, STEM)</div>
                    <div className="text-[11px] text-indigo-300">Applies to 8 designated technical & specialist positions.</div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                    reservationScope === 'all-jobs'
                      ? 'bg-indigo-900/90 border-indigo-400 text-white'
                      : 'bg-indigo-950/40 border-indigo-900 text-indigo-300 hover:bg-indigo-900/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="reservationScope"
                    checked={reservationScope === 'all-jobs'}
                    onChange={() => setReservationScope('all-jobs')}
                    className="mt-0.5 accent-indigo-400"
                  />
                  <div>
                    <div className="text-xs font-bold">Apply to All Campus Job Positions</div>
                    <div className="text-[11px] text-indigo-300">Enforces the {customReservationPercent}% skilled quota uniformly across every role.</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  handleUpdateSkilledReservation({
                    percent: customReservationPercent,
                    scope: reservationScope,
                    applyToAllJobs: reservationScope === 'all-jobs',
                  })
                }
                disabled={isUpdatingReservation}
                className="w-full py-2.5 px-3.5 bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isUpdatingReservation ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save & Apply Reservation Policy</span>
              </button>
            </div>
          </div>
        </div>

        {/* Role-by-Role Individual Quota Customization Strip */}
        <div className="mt-5 pt-4 border-t border-indigo-900/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-indigo-950/40 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-b-2xl">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-200">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Edit Skilled Candidate Separately for Each Role</span>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                {FILI_JOBS.length} Roles Configurable
              </span>
            </div>
            <p className="text-xs text-indigo-300/90">
              Fine-tune reservation percentages, minimum AI test scores, and specialized certificate requirements individually per job.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={selectedRolePickerId}
              onChange={(e) => setSelectedRolePickerId(e.target.value)}
              className="bg-indigo-900/90 border border-indigo-700 text-white text-xs rounded-xl px-3 py-2 font-medium focus:ring-2 focus:ring-indigo-400 outline-hidden flex-1 md:w-64"
            >
              {FILI_JOBS.map((j) => {
                const customDetails = slotSettings.jobCustomDetails?.[j.id];
                const effectiveTitle = customDetails?.title ?? j.title;
                const hasCustom = slotSettings.jobSkilledReservationPercents?.[j.id] !== undefined || Boolean(customDetails);
                const isSkilled = isJobSkilledRole(j.id);
                const pct =
                  slotSettings.jobSkilledReservationPercents?.[j.id] !== undefined
                    ? slotSettings.jobSkilledReservationPercents![j.id]
                    : isSkilled || slotSettings.skilledReservationScope === 'all-jobs'
                    ? slotSettings.skilledReservationPercent ?? 25
                    : 0;
                return (
                  <option key={j.id} value={j.id}>
                    {effectiveTitle} ({pct}% {hasCustom ? '• Custom' : ''})
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={() => openRoleSkilledModal(selectedRolePickerId)}
              className="py-2 px-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Configure Role Quota</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Controls & Category Filtering */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Manage Slots for All Job Positions ({FILI_JOBS.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Open or close individual position slots at any time. When a slot is closed, students cannot submit applications for that position.
            </p>
          </div>

          {/* Bulk Slot Control Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-open-all-slots"
              type="button"
              onClick={handleOpenAllSlots}
              disabled={isTogglingSlot}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Open All Positions</span>
            </button>

            <button
              id="btn-close-all-slots"
              type="button"
              onClick={handleCloseAllSlots}
              disabled={isTogglingSlot}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Close All Positions</span>
            </button>
          </div>
        </div>

        {/* Search and Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {Array.from(new Set(['All', ...FILI_JOBS.map((j) => slotSettings.jobCustomDetails?.[j.id]?.category || j.category)])).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSlotCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    slotCategoryFilter === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={slotSearchQuery}
              onChange={(e) => setSlotSearchQuery(e.target.value)}
              placeholder="Filter positions by title, keyword..."
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Positions Table with One-Click Slot Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <th className="py-3 px-4">Position & Category</th>
                <th className="py-3 px-4">Monthly Stipend</th>
                <th className="py-3 px-4">Total Quota</th>
                <th className="py-3 px-4 min-w-[220px]">Skilled vs General Quota</th>
                <th className="py-3 px-4">Class Restriction</th>
                <th className="py-3 px-4">Slot Status</th>
                <th className="py-3 px-4 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {FILI_JOBS.filter((job) => {
                const customDetail = slotSettings.jobCustomDetails?.[job.id];
                const effectiveTitle = customDetail?.title ?? job.title;
                const effectiveCategory = customDetail?.category ?? job.category;
                const effectiveDescription = customDetail?.description ?? job.description;

                const matchCategory =
                  slotCategoryFilter === 'All' || effectiveCategory === slotCategoryFilter;
                const matchSearch =
                  !slotSearchQuery.trim() ||
                  effectiveTitle.toLowerCase().includes(slotSearchQuery.toLowerCase()) ||
                  effectiveDescription.toLowerCase().includes(slotSearchQuery.toLowerCase()) ||
                  effectiveCategory.toLowerCase().includes(slotSearchQuery.toLowerCase());
                return matchCategory && matchSearch;
              }).map((job) => {
                const isClosed = slotSettings.closedJobIds.includes(job.id);
                const approvedCount = jobApprovedCounts[job.id] || 0;
                
                // Effective details & custom overrides
                const customDetail = slotSettings.jobCustomDetails?.[job.id];
                const effectiveTitle = customDetail?.title ?? job.title;
                const effectiveCategory = customDetail?.category ?? job.category;
                const effectiveDescription = customDetail?.description ?? job.description;
                const hasCustomDetails = Boolean(customDetail);

                // Effective quota & custom overrides
                const effectiveQuota = slotSettings.jobCustomQuotas?.[job.id] ?? job.totalQuota;
                const hasCustomQuota = slotSettings.jobCustomQuotas?.[job.id] !== undefined;

                // Effective salary & custom overrides
                const effectiveSalaryPayout = slotSettings.jobCustomSalaries?.[job.id]?.payout ?? job.payout;
                const hasCustomSalary = slotSettings.jobCustomSalaries?.[job.id] !== undefined;

                const percentFilled = Math.min(100, Math.round((approvedCount / effectiveQuota) * 100));
                const totalJobApplicants = applications.filter((a) => a.jobId === job.id).length;

                // Quota breakdown for this job
                const isSkilled = isJobSkilledRole(job.id);
                const jobSpecificPct = slotSettings.jobSkilledReservationPercents?.[job.id];
                const activeReservedPct =
                  jobSpecificPct !== undefined
                    ? jobSpecificPct
                    : slotSettings.skilledReservationScope === 'all-jobs' || isSkilled
                    ? slotSettings.skilledReservationPercent ?? 25
                    : 0;

                const breakdown = breakdownMap[job.id] || {
                  jobId: job.id,
                  jobTitle: effectiveTitle,
                  totalQuota: effectiveQuota,
                  isSkilledRole: isSkilled,
                  reservedPercent: activeReservedPct,
                  skilledReservedSlots: Math.round((effectiveQuota * activeReservedPct) / 100),
                  generalProtectedSlots: effectiveQuota - Math.round((effectiveQuota * activeReservedPct) / 100),
                  currentApprovedSkilled: 0,
                  currentApprovedGeneral: approvedCount,
                  openSkilledSlots: Math.max(0, Math.round((effectiveQuota * activeReservedPct) / 100)),
                  openGeneralSlots: Math.max(0, effectiveQuota - Math.round((effectiveQuota * activeReservedPct) / 100) - approvedCount),
                  skilledQuotaReached: false,
                  intakeFullySaturated: approvedCount >= effectiveQuota,
                };

                const skilledPercentOfQuota = effectiveQuota > 0 ? (breakdown.currentApprovedSkilled / effectiveQuota) * 100 : 0;
                const generalPercentOfQuota = effectiveQuota > 0 ? (breakdown.currentApprovedGeneral / effectiveQuota) * 100 : 0;

                const isEditingThisJob = editingJobReservation?.jobId === job.id;

                return (
                  <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Position & Category */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{effectiveTitle}</span>
                        <button
                          type="button"
                          onClick={() => openRoleSkilledModal(job.id)}
                          className="text-indigo-600 hover:text-indigo-800 text-[10px] font-semibold flex items-center gap-0.5 hover:underline cursor-pointer bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded"
                          title="Change how this job name is shown"
                        >
                          <SlidersHorizontal className="w-2.5 h-2.5" />
                          <span>Rename</span>
                        </button>
                        {hasCustomDetails && (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded">
                            Custom Role
                          </span>
                        )}
                        {isSkilled && (
                          <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full">
                            Tech/Skilled Role
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                          {effectiveCategory}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {job.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1" title={effectiveDescription}>
                        {effectiveDescription}
                      </p>
                    </td>

                    {/* Monthly Stipend */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-xs border border-emerald-200">
                          {effectiveSalaryPayout}
                        </span>
                        {hasCustomSalary && (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                            Custom Salary
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Quota Capacity Progress */}
                    <td className="py-3.5 px-4 min-w-[130px]">
                      <div className="flex items-baseline justify-between text-[11px] font-bold text-slate-700 mb-1">
                        <span>{approvedCount} filled</span>
                        <span className="text-slate-400">/ {effectiveQuota} slots</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all duration-300 ${
                            percentFilled >= 100
                              ? 'bg-amber-500'
                              : percentFilled > 50
                              ? 'bg-indigo-600'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(4, percentFilled)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>
                          {effectiveQuota - approvedCount > 0
                            ? `${effectiveQuota - approvedCount} remaining`
                            : 'Full'}
                        </span>
                        {hasCustomQuota && (
                          <span className="font-bold text-indigo-600">Custom Quota</span>
                        )}
                      </div>
                    </td>

                    {/* Skilled vs General Quota Breakdown */}
                    <td className="py-3.5 px-4 min-w-[220px]">
                      <div className="space-y-1.5">
                        {/* Summary Badges */}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <span className="font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Skilled ({breakdown.reservedPercent}%): {breakdown.currentApprovedSkilled}/{breakdown.skilledReservedSlots}
                          </span>
                          <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            General ({100 - breakdown.reservedPercent}%): {breakdown.currentApprovedGeneral}/{breakdown.generalProtectedSlots}
                          </span>
                        </div>

                        {/* Segmented Progress Bar */}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex" title={`Skilled: ${breakdown.currentApprovedSkilled}, General: ${breakdown.currentApprovedGeneral}, Open: ${Math.max(0, effectiveQuota - approvedCount)}`}>
                          <div
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${skilledPercentOfQuota}%` }}
                          ></div>
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${generalPercentOfQuota}%` }}
                          ></div>
                        </div>

                        {/* Custom Override Indicator & Edit Modal Trigger */}
                        <div className="flex items-center justify-between pt-1 text-[10px]">
                          <div>
                            {jobSpecificPct !== undefined ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[9px]">
                                <Sliders className="w-2.5 h-2.5" />
                                Role Custom: {breakdown.reservedPercent}%
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                {isJobSkilledRole(job.id) || slotSettings.skilledReservationScope === 'all-jobs'
                                  ? `Global Policy: ${breakdown.reservedPercent}%`
                                  : 'No Reservation (0%)'}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openRoleSkilledModal(job.id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors cursor-pointer"
                            title={`Configure applicant capacity quota, stipend salary, and criteria for ${job.title}`}
                          >
                            <Settings2 className="w-3 h-3 text-indigo-600" />
                            <span>Edit Role & Quota</span>
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Class Restriction */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 text-xs">
                      {job.maxPerClass ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px] border border-purple-200">
                          Max {job.maxPerClass} per class
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No class cap</span>
                      )}
                    </td>

                    {/* Slot Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {!slotSettings.globalSlotsOpen ? (
                        <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full text-[11px]">
                          <Ban className="w-3 h-3 text-slate-500" /> Intake Paused
                        </span>
                      ) : isClosed ? (
                        <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-100 border border-red-300 px-2.5 py-1 rounded-full text-[11px]">
                          <Ban className="w-3 h-3 text-red-600" /> Slot Closed
                        </span>
                      ) : approvedCount >= effectiveQuota ? (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full text-[11px]">
                          <Clock className="w-3 h-3 text-amber-600" /> Quota Filled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Open & Accepting
                        </span>
                      )}
                    </td>

                    {/* Admin Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Role Quota & Salary button */}
                        <button
                          type="button"
                          onClick={() => openRoleSkilledModal(job.id)}
                          className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Change participants capacity quota and monthly salary for this role"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Edit Name & Quota</span>
                        </button>

                        {/* Jump to applicants in roster */}
                        <button
                          type="button"
                          onClick={() => {
                            setJobFilter(job.id);
                            setStatusFilter('All');
                            setActiveTab('roster');
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="View all candidate applications for this position"
                        >
                          Roster ({totalJobApplicants})
                        </button>

                        {/* Slot Toggle Button */}
                        <button
                          id={`toggle-slot-${job.id}`}
                          type="button"
                          onClick={() => handleToggleJobSlot(job.id, isClosed)}
                          disabled={isTogglingSlot}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                            isClosed
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                          }`}
                        >
                          {isClosed ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Reopen Slot</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Close Slot</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* Application Detail / Review Drawer Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  {selectedApp.accountOwner === 'parent' && selectedApp.actualStudentName ? selectedApp.actualStudentName.charAt(0) : selectedApp.studentName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold">{selectedApp.accountOwner === 'parent' && selectedApp.actualStudentName ? selectedApp.actualStudentName : selectedApp.studentName}</h3>
                    {selectedApp.accountOwner === 'parent' && (
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 rounded font-mono">
                        via Parent Account
                      </span>
                    )}
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded font-mono">
                      Rank #{selectedApp.rank}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{selectedApp.studentEmail}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content Scroll */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Placement & Status Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Role</span>
                    {slotSettings.closedJobIds.includes(selectedApp.jobId) ? (
                      <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded">
                        Slot Closed
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                        Slot Open
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-900 block">{selectedApp.jobTitle}</span>
                  <span className="text-[11px] text-emerald-700 font-bold">{selectedApp.payout}</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">FCFS Timestamp</span>
                  <span className="text-xs font-bold text-slate-900 font-mono block">
                    {new Date(selectedApp.submissionTimestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      fractionalSecondDigits: 3,
                    })}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(selectedApp.submissionTimestamp).toISOString()}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">AI Skill Match</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-indigo-700">{selectedApp.skillScore}</span>
                    <span className="text-slate-400">/ 100</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {selectedApp.resumeValidity === 'valid' ? 'Valid PDF attached' : 'General FCFS Entry'}
                  </span>
                </div>
              </div>

              {/* Displacement / Preemption Audit Box */}
              {(selectedApp.displacedByCandidateName || selectedApp.displacedCandidateName || selectedApp.hasCertificates) && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                    FiLi Preemption & Certification Audit
                  </span>

                  {selectedApp.hasCertificates && (
                    <div className="text-xs text-purple-950 font-medium">
                      ★ <strong>Certified Candidate:</strong> Verified official certificates ({selectedApp.certificateNames?.join(', ') || 'Official accreditation'}).
                    </div>
                  )}

                  {selectedApp.displacedByCandidateName && (
                    <div className="text-xs text-orange-900 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      <span><strong>Kicked Out of Slot:</strong> Displaced by incoming certified candidate <strong>{selectedApp.displacedByCandidateName}</strong>.</span>
                    </div>
                  )}

                  {selectedApp.displacedCandidateName && (
                    <div className="text-xs text-purple-900 font-medium">
                      ✓ <strong>Preempted Slot:</strong> This candidate replaced previous uncertified student <strong>{selectedApp.displacedCandidateName}</strong>.
                    </div>
                  )}
                </div>
              )}

              {/* Explicit AI Reasoning Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    AI Screening Reasoning
                  </span>
                  <button
                    onClick={handleRescreen}
                    disabled={isUpdatingStatus}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isUpdatingStatus ? 'animate-spin' : ''}`} />
                    <span>Re-evaluate with Gemini</span>
                  </button>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium leading-relaxed">
                  {selectedApp.aiReasoning}
                </div>

                {selectedApp.aiAnalysis?.verifiedSkills?.length ? (
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-slate-500">Identified Competencies: </span>
                    <span className="text-[11px] text-slate-700 font-medium">
                      {selectedApp.aiAnalysis.verifiedSkills.join(', ')}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Resume File Information */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">
                    {selectedApp.resumeFileName || 'No resume file attached'}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {selectedApp.resumeFileSize ? `${(selectedApp.resumeFileSize / 1024).toFixed(1)} KB` : '0 KB'} • Status: {selectedApp.resumeValidity}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    selectedApp.resumeValidity === 'valid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {selectedApp.resumeValidity === 'valid' ? 'Verified PDF' : 'General FCFS Entry'}
                </span>
              </div>

              {/* Administrative Status Override */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-800 block">
                  Administrative Override & Final Verdict
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleUpdateStatus('Approved')}
                    disabled={isUpdatingStatus}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedApp.status === 'Approved'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Candidate</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Waitlisted')}
                    disabled={isUpdatingStatus}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedApp.status === 'Waitlisted'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Place on Waitlist</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Kicked Out (Displaced by Certified Candidate)')}
                    disabled={isUpdatingStatus}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedApp.status === 'Kicked Out (Displaced by Certified Candidate)'
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Kick Out (Displace)</span>
                  </button>

                  <button
                    onClick={() => handleUpdateStatus('Disqualified (No Resume/Unqualified)')}
                    disabled={isUpdatingStatus}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedApp.status === 'Disqualified (No Resume/Unqualified)'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Disqualify Candidate</span>
                  </button>
                  <button
                    onClick={handleFireStudent}
                    disabled={isUpdatingStatus}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedApp.status === 'Terminated (Fired by Admin)'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Fire Student</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Internal Faculty Notes
                  </label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="e.g. Conduct verified with head of Grade 8..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => printAndDownloadPlacementReceipt(selectedApp)}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-700" />
                <span>Print Official PDF Receipt</span>
              </button>

              <button
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role-Specific Skilled Candidate Customizer Modal */}
      {roleModalToEdit && (() => {
        const baseJob = FILI_JOBS.find((j) => j.id === roleModalToEdit.jobId);
        if (!baseJob) return null;

        const customDetails = slotSettings.jobCustomDetails?.[baseJob.id];
        const effectiveQuota = roleModalToEdit.quota ?? slotSettings.jobCustomQuotas?.[baseJob.id] ?? baseJob.totalQuota;
        const effectiveTitle = roleModalToEdit.title ?? customDetails?.title ?? baseJob.title;
        const effectiveCategory = roleModalToEdit.category ?? customDetails?.category ?? baseJob.category;
        const effectiveDescription = roleModalToEdit.description ?? customDetails?.description ?? baseJob.description;
        const effectiveSalaryPayout = roleModalToEdit.salaryPayout ?? slotSettings.jobCustomSalaries?.[baseJob.id]?.payout ?? baseJob.payout;

        const targetJob = {
          ...baseJob,
          title: effectiveTitle,
          category: effectiveCategory,
          description: effectiveDescription,
          requirements: customDetails?.requirements ?? baseJob.requirements,
          totalQuota: effectiveQuota,
          payout: effectiveSalaryPayout,
          payoutAmount: roleModalToEdit.salaryAmount ?? slotSettings.jobCustomSalaries?.[baseJob.id]?.payoutAmount ?? baseJob.payoutAmount,
        };

        const breakdown = breakdownMap[targetJob.id] || {
          currentApprovedSkilled: 0,
          currentApprovedGeneral: 0,
          currentTotalApproved: 0,
          skilledReservedSlots: Math.max(0, Math.round(targetJob.totalQuota * (roleModalToEdit.percent / 100))),
          generalProtectedSlots: Math.max(0, targetJob.totalQuota - Math.max(0, Math.round(targetJob.totalQuota * (roleModalToEdit.percent / 100)))),
        };

        const calculatedSkilledSlots = roleModalToEdit.percent > 0
          ? Math.max(1, Math.round(targetJob.totalQuota * (roleModalToEdit.percent / 100)))
          : 0;
        const calculatedGeneralSlots = Math.max(0, targetJob.totalQuota - calculatedSkilledSlots);
        const hasCustomOverride = slotSettings.jobSkilledReservationPercents?.[targetJob.id] !== undefined ||
          slotSettings.jobMinSkillScores?.[targetJob.id] !== undefined ||
          slotSettings.jobSkilledRequirements?.[targetJob.id] !== undefined ||
          slotSettings.jobCustomDetails?.[targetJob.id] !== undefined;
        const isSkilled = isJobSkilledRole(targetJob.id);

        // Certificate suggestion chips based on role
        const certificateSuggestions: string[] = [
          'Google Workspace / Chromebook Support',
          'Food Hygiene & Kitchen Diligence',
          'Audio/Visual & Stage Lighting',
          'Red Cross Youth First Aid & CPR',
          'Library Dewey Decimal & Media Catalog',
          'HTML/CSS & School Portal Web Dev',
          'Robotics & 3D Modeling (Makerspace)',
          'Public Speaking & Tour Hosting',
          'Financial Literacy & Cashier Ledger',
          'Sports Referee & Fair Play Badge',
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold">{targetJob.title}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded">
                        {targetJob.category}
                      </span>
                      {hasCustomOverride ? (
                        <span className="text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded">
                          Role Custom
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold bg-white/10 text-indigo-200 px-2 py-0.5 rounded">
                          Inheriting Global ({slotSettings.skilledReservationPercent}%)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-200/80 mt-1">
                      Configure role description, position category, quota capacity, and applicant screening criteria.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleModalToEdit(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-6 max-h-[calc(85vh-160px)] overflow-y-auto">
                {/* Role overview badge banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Intake</span>
                    <span className="font-extrabold text-slate-800">{targetJob.totalQuota} Students</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Monthly Stipend</span>
                    <span className="font-bold text-emerald-700">{targetJob.payout}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Role Type</span>
                    <span className={`font-bold ${isSkilled ? 'text-indigo-600' : 'text-slate-600'}`}>
                      {isSkilled ? 'Specialist / Tech' : 'General Campus'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Filled</span>
                    <span className="font-bold text-slate-700">
                      {breakdown.currentTotalApproved}/{targetJob.totalQuota} slots
                    </span>
                  </div>
                </div>

                {/* Section 0: Role Identity & Description (Admin Customizer) */}
                <div className="space-y-4 bg-amber-50/50 border border-amber-200 rounded-2xl p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600" />
                        <span>Job Display Name & Role Identity</span>
                      </h4>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Change how the name of this specific job is shown to students across the application form, cards, and admin roster.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRoleModalToEdit({
                          ...roleModalToEdit,
                          title: baseJob.title,
                          category: baseJob.category,
                          description: baseJob.description,
                          requirementsText: baseJob.requirements.join('\n'),
                        });
                      }}
                      className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                    >
                      Reset to Default Name
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 block">
                          Job Display Name <span className="text-amber-600">*</span>
                        </label>
                        <span className="text-[10px] text-slate-400">Default: {baseJob.title}</span>
                      </div>
                      <input
                        type="text"
                        value={roleModalToEdit.title ?? baseJob.title}
                        onChange={(e) =>
                          setRoleModalToEdit({
                            ...roleModalToEdit,
                            title: e.target.value,
                          })
                        }
                        placeholder="e.g. Cafeteria Queue Manager, Library Student Associate..."
                        className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                      <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-indigo-700">
                        <span className="font-semibold">Student view preview:</span>
                        <span className="font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {roleModalToEdit.title?.trim() || baseJob.title}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 block">Category</label>
                      <input
                        type="text"
                        value={roleModalToEdit.category ?? baseJob.category}
                        onChange={(e) =>
                          setRoleModalToEdit({
                            ...roleModalToEdit,
                            category: e.target.value,
                          })
                        }
                        placeholder="e.g. Operations, Food Services..."
                        className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Category preset chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400">Quick Category Presets:</span>
                    {['Operations', 'Student Services', 'Food Services & Logistics', 'Technical & Academic Support', 'Facilities & Campus Care', 'Media & Arts', 'STEM & Health', 'Governance'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setRoleModalToEdit({
                            ...roleModalToEdit,
                            category: c,
                          })
                        }
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                          (roleModalToEdit.category ?? baseJob.category) === c
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      Role Description (What students do in this position)
                    </label>
                    <textarea
                      rows={3}
                      value={roleModalToEdit.description ?? baseJob.description}
                      onChange={(e) =>
                        setRoleModalToEdit({
                          ...roleModalToEdit,
                          description: e.target.value,
                        })
                      }
                      placeholder="Explain what the student's responsibilities are in this position..."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 block">
                        Responsibilities & Requirements (One per line)
                      </label>
                      <span className="text-[10px] text-slate-400">Screened by AI Evaluation Engine</span>
                    </div>
                    <textarea
                      rows={3}
                      value={roleModalToEdit.requirementsText ?? baseJob.requirements.join('\n')}
                      onChange={(e) =>
                        setRoleModalToEdit({
                          ...roleModalToEdit,
                          requirementsText: e.target.value,
                        })
                      }
                      placeholder="e.g.&#10;Organized and punctual&#10;Good verbal communication&#10;Respectful teamwork"
                      className="w-full text-xs font-mono px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 outline-hidden leading-relaxed"
                    />
                  </div>
                </div>

                {/* Section 1: Reserved Quota % Slider & Presets */}
                <div className="space-y-3 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Skilled Candidate Reserved Quota</span>
                      </label>
                      <p className="text-[11px] text-indigo-800/80 mt-0.5">
                        Percentage of slots held exclusively for skilled/certified kids in this position.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-indigo-200 px-3 py-1 rounded-xl shadow-xs">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={roleModalToEdit.percent}
                        onChange={(e) =>
                          setRoleModalToEdit({
                            ...roleModalToEdit,
                            percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          })
                        }
                        className="w-12 text-center text-sm font-extrabold text-indigo-950 outline-hidden"
                      />
                      <span className="text-xs font-bold text-indigo-600">%</span>
                    </div>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={roleModalToEdit.percent}
                    onChange={(e) =>
                      setRoleModalToEdit({
                        ...roleModalToEdit,
                        percent: Number(e.target.value),
                      })
                    }
                    className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { label: '0% (None)', val: 0 },
                      { label: '15%', val: 15 },
                      { label: '25% (Standard Default)', val: 25 },
                      { label: '33% (One-Third)', val: 33 },
                      { label: '40% (Tech Focus)', val: 40 },
                      { label: '50% (Half)', val: 50 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setRoleModalToEdit({ ...roleModalToEdit, percent: preset.val })}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                          roleModalToEdit.percent === preset.val
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Real-time Math Breakdown */}
                  <div className="mt-3 pt-3 border-t border-indigo-100 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-xs">
                      <div className="text-[10px] font-bold text-blue-700 uppercase flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>Skilled Reserved ({roleModalToEdit.percent}%)</span>
                      </div>
                      <div className="text-base font-extrabold text-blue-900 mt-0.5">
                        {calculatedSkilledSlots} Slots
                      </div>
                      <p className="text-[10px] text-blue-700 mt-1">
                        Currently filled: {breakdown.currentApprovedSkilled} / {calculatedSkilledSlots}
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-xs">
                      <div className="text-[10px] font-bold text-emerald-700 uppercase flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>General Protected ({100 - roleModalToEdit.percent}%)</span>
                      </div>
                      <div className="text-base font-extrabold text-emerald-900 mt-0.5">
                        {calculatedGeneralSlots} Slots
                      </div>
                      <p className="text-[10px] text-emerald-700 mt-1">
                        Currently filled: {breakdown.currentApprovedGeneral} / {calculatedGeneralSlots}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 1.5: Role Participant Capacity & Monthly Salary */}
                <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 mt-4">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span>Role Participant Capacity & Monthly Salary</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Adjust how many students can apply for this specific role and their monthly BRAED stipend.
                      </p>
                    </div>
                  </div>

                  {/* Quota Row */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Max Participant Capacity (Role Quota)
                      </label>
                      <span className="text-xs font-bold text-slate-500">
                        Default: {targetJob.totalQuota} students
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1180"
                        value={roleModalToEdit.quota || ''}
                        onChange={(e) =>
                          setRoleModalToEdit({
                            ...roleModalToEdit,
                            quota: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="w-32 text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                      />
                      <div className="flex flex-wrap items-center gap-1.5 flex-1">
                        {Array.from(new Set([5, 10, 20, 30, 50, 100, targetJob.totalQuota])).map((q) => (
                          <button
                            key={`quota-opt-${q}`}
                            type="button"
                            onClick={() => applyQuotaPreset(q)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                              roleModalToEdit.quota === q
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {q} slots
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Salary Row */}
                  <div className="space-y-2 pt-1 border-t border-slate-200/60">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">
                        Monthly Stipend / Salary (BRAED)
                      </label>
                      <span className="text-xs font-bold text-emerald-700">
                        Default: {targetJob.payout}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Numeric Amount (BRAED)</span>
                        <input
                          type="number"
                          min="0"
                          value={roleModalToEdit.salaryAmount || ''}
                          onChange={(e) => {
                            const amt = Number(e.target.value) || 0;
                            setRoleModalToEdit({
                              ...roleModalToEdit,
                              salaryAmount: amt,
                              salaryPayout: `${amt} BRAED/Month`,
                            });
                          }}
                          className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Display Label</span>
                        <input
                          type="text"
                          value={roleModalToEdit.salaryPayout || ''}
                          onChange={(e) =>
                            setRoleModalToEdit({
                              ...roleModalToEdit,
                              salaryPayout: e.target.value,
                            })
                          }
                          placeholder={`${targetJob.payoutAmount} BRAED/Month`}
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Quick Salary Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400">Presets:</span>
                      {Array.from(new Set([150, 200, 250, 300, 350, 400, targetJob.payoutAmount])).map((amt) => (
                        <button
                          key={`salary-opt-${amt}`}
                          type="button"
                          onClick={() => applySalaryPreset(amt)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                            roleModalToEdit.salaryAmount === amt
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {amt} BRAED
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Explicit Reserved Seats (Optional) */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block">
                        Custom Reserved Seats (Optional Override)
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Leave blank to let the percentage slider auto-calculate ({calculatedSkilledSlots} seats).
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={roleModalToEdit.reservedSeats !== undefined ? roleModalToEdit.reservedSeats : ''}
                      onChange={(e) =>
                        setRoleModalToEdit({
                          ...roleModalToEdit,
                          reservedSeats: e.target.value !== '' ? Number(e.target.value) : undefined,
                        })
                      }
                      placeholder={`Auto (${calculatedSkilledSlots})`}
                      className="w-28 text-xs px-3 py-1.5 border border-slate-300 rounded-xl bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                  </div>
                </div>

                {/* Section 2: Candidate Screening Criteria */}
                <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Skilled Candidate Qualification Criteria for this Role</span>
                  </h4>

                  {/* Minimum AI Skill Score */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">
                        Minimum AI Test Score (out of 100)
                      </label>
                      <span className="text-xs font-extrabold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded">
                        {roleModalToEdit.minSkillScore} / 100
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="95"
                      step="5"
                      value={roleModalToEdit.minSkillScore}
                      onChange={(e) =>
                        setRoleModalToEdit({
                          ...roleModalToEdit,
                          minSkillScore: Number(e.target.value),
                        })
                      }
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <p className="text-[11px] text-slate-500">
                      Candidates scoring at or above {roleModalToEdit.minSkillScore} (or holding official certificates) qualify for the reserved skilled quota and preemption.
                    </p>
                  </div>

                  {/* Preferred Certificate Focus */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Preferred / Required Certificate Credentials (Optional Focus)
                    </label>
                    <input
                      type="text"
                      value={roleModalToEdit.skilledRequirement}
                      onChange={(e) =>
                        setRoleModalToEdit({
                          ...roleModalToEdit,
                          skilledRequirement: e.target.value,
                        })
                      }
                      placeholder="e.g. Chromebook Repair, Google Workspace, Food Safety, Audio Mixing..."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    />
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-bold text-slate-400">Suggestions:</span>
                      {certificateSuggestions.slice(0, 4).map((sug, idx) => (
                        <button
                          key={`sug-${idx}-${sug}`}
                          type="button"
                          onClick={() =>
                            setRoleModalToEdit({
                              ...roleModalToEdit,
                              skilledRequirement: sug,
                            })
                          }
                          className="text-[10px] bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 3: Fairness Policy Explainer */}
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-amber-950">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>How this quota will be enforced for {targetJob.title}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Students without prior skills can register first on open slots. When candidates with verified certificates or skill scores ≥ {roleModalToEdit.minSkillScore} apply, they can take or preempt up to <strong>{calculatedSkilledSlots} slots</strong> ({roleModalToEdit.percent}%). Once {calculatedSkilledSlots} skilled slots are filled, the remaining <strong>{calculatedGeneralSlots} slots</strong> are strictly protected for general students.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {hasCustomOverride ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSkilledReservation({
                          jobId: targetJob.id,
                          resetJobOverride: true,
                          resetDetails: true,
                          resetQuota: true,
                          resetSalary: true,
                          resetReservedSeats: true,
                        })
                      }
                      disabled={isUpdatingReservation}
                      className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Reset All Settings & Description to Default
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Currently using global default settings
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setRoleModalToEdit(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSkilledReservation({
                        jobId: targetJob.id,
                        percent: roleModalToEdit.percent,
                        minSkillScore: roleModalToEdit.minSkillScore,
                        skilledRequirement: roleModalToEdit.skilledRequirement,
                        quota: roleModalToEdit.quota,
                        salaryPayout: roleModalToEdit.salaryPayout,
                        salaryAmount: roleModalToEdit.salaryAmount,
                        reservedSeats: roleModalToEdit.reservedSeats,
                        title: roleModalToEdit.title,
                        category: roleModalToEdit.category,
                        description: roleModalToEdit.description,
                        requirements: roleModalToEdit.requirementsText
                          ? roleModalToEdit.requirementsText
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : undefined,
                      })
                    }
                    disabled={isUpdatingReservation}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingReservation ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Save Role & Description</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Non-Blocking Fire Student Confirmation Modal */}
      {appToFire && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-red-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-6 space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" /> Administrative Action
              </div>
              <h3 className="text-xl font-black">Fire Student / Terminate Position</h3>
              <p className="text-xs text-red-100">
                Confirm termination of placement for this student.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Student:</span>
                  <span className="font-bold text-slate-900">{appToFire.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Email:</span>
                  <span className="font-mono text-slate-700">{appToFire.studentEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Current Role:</span>
                  <span className="font-bold text-indigo-700">{appToFire.jobTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Class / Section:</span>
                  <span className="font-semibold text-slate-800">{appToFire.studentClass} • {appToFire.section}</span>
                </div>
              </div>

              {/* Policy Rule Clarification */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-1.5 text-red-950">
                <div className="font-bold flex items-center gap-1 text-red-900">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>FiLi Single-Job & Fired Student Policy:</span>
                </div>
                <p className="text-[11px] text-red-800 leading-relaxed">
                  1. Firing this student will immediately <strong>release their quota slot</strong> back into the open pool for other students.
                  <br />
                  2. Their status is set to <strong>Terminated (Fired by Admin)</strong>.
                  <br />
                  3. Under portal policy, <strong>only fired students are authorized to submit a new application</strong> for another open job.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Reason for Termination (Visible to Student & Faculty)
                </label>
                <input
                  type="text"
                  value={fireCustomReason}
                  onChange={(e) => setFireCustomReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, behavioral policy, administrative decision"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-hidden font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAppToFire(null)}
                  disabled={isUpdatingStatus}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-fire-student"
                  type="button"
                  onClick={() => executeFireStudent(appToFire, fireCustomReason)}
                  disabled={isUpdatingStatus}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingStatus ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm & Fire Student</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-Blocking Reset Demo Cohort Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900 text-white p-6 space-y-1">
              <h3 className="text-xl font-black">Reset to Fresh Demo Cohort?</h3>
              <p className="text-xs text-slate-300">
                This will reset all student applications and quotas back to the initial sample middle school cohort.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Existing application records will be replaced with the standard demo seed data. You can re-test the preemption and firing rules with fresh students anytime.
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-reset-demo"
                  type="button"
                  onClick={executeResetDemo}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors cursor-pointer"
                >
                  Yes, Reset Cohort
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Non-Blocking Fire All Students Confirmation Modal */}
      {showFireAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-red-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-600 text-white p-6 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <UserX className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-black">Fire All Students from Jobs?</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFireAllModal(false)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-red-100 leading-relaxed">
                This administrative action will terminate all currently approved students from their jobs, vacate their slots, and restore their eligibility to apply for open positions.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl">
                  <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">
                    Currently Employed
                  </span>
                  <span className="text-2xl font-black text-red-900">
                    {stats.totalApproved}
                  </span>
                  <span className="text-[11px] text-red-700 block mt-0.5">
                    Students will be fired
                  </span>
                </div>
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                    Quota Slots
                  </span>
                  <span className="text-2xl font-black text-emerald-900">
                    100%
                  </span>
                  <span className="text-[11px] text-emerald-700 block mt-0.5">
                    Will reopen for students
                  </span>
                </div>
              </div>

              {/* Policy Explainer */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Portal Placement & Re-application Rules:</span>
                </div>
                <ul className="text-[11px] space-y-1.5 text-slate-600 list-disc list-inside">
                  <li>
                    All <strong>{stats.totalApproved}</strong> currently placed students will have their status updated to <strong className="text-red-700">Terminated (Fired by Admin)</strong>.
                  </li>
                  <li>
                    All job positions and quotas will be immediately vacated and available for new applications.
                  </li>
                  <li>
                    Under FiLi single-job policy, <strong>fired students regain eligibility to submit a new application</strong> for any open middle school position.
                  </li>
                </ul>
              </div>

              {/* Reason input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Reason for Mass Termination (Recorded in Logs)
                </label>
                <input
                  type="text"
                  value={fireAllReason}
                  onChange={(e) => setFireAllReason(e.target.value)}
                  placeholder="e.g. End of campus rotation, administrative term reset, schedule restructuring"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-hidden font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFireAllModal(false)}
                  disabled={isFiringAll}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-fire-all-students"
                  type="button"
                  onClick={executeFireAllStudents}
                  disabled={isFiringAll || stats.totalApproved === 0}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFiringAll ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserX className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {stats.totalApproved === 0
                      ? 'No Students in Jobs to Fire'
                      : `Confirm & Fire All ${stats.totalApproved} Students`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
