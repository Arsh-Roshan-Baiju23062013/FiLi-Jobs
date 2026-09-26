import fs from 'fs';
import path from 'path';
import { Application, FiLiJob, JobQuotaBreakdown, QuotaStats, ResumeValidity, SlotSettings } from '../src/types.js';
import { FILI_JOBS, TOTAL_MIDDLE_SCHOOL_CAPACITY, isJobSkilledRole } from '../src/data/jobs.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Memory store
let applications: Application[] = [];
let slotSettings: SlotSettings = {
  globalSlotsOpen: true,
  closedJobIds: [],
  noticeMessage: '',
  lastUpdated: new Date().toISOString(),
  updatedBy: 'FiLi Administration',
  skilledReservationPercent: 25, // Default 25% of slots reserved for skilled/certified kids
  jobSkilledReservationPercents: {},
  skilledReservationScope: 'skilled-roles-only',
};

// Ensure data directory exists and initialize storage
export function initStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      applications = JSON.parse(content);
      // Auto-migrate any disqualified applicants into the general FCFS slot
      let needsResave = false;
      applications = applications.map((app) => {
        if (app.status === 'Disqualified (No Resume/Unqualified)' || app.resumeValidity === 'invalid') {
          needsResave = true;
          return {
            ...app,
            status: 'Approved',
            resumeValidity: 'valid',
            skillScore: Math.max(50, app.skillScore || 55),
            aiReasoning: 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate.',
            aiAnalysis: {
              verifiedSkills: ['General Middle School Duties'],
              certificates: [],
              roleAlignmentVerdict: 'Assigned to general First-Come, First-Served (FCFS) placement.',
              pastTwoYearsExperience: 'Entry-level candidate.',
              flags: ['GENERAL_FCFS_SLOT'],
            },
          };
        }
        return app;
      });
      if (needsResave) {
        saveStore();
      }
    } else {
      applications = [];
      saveStore();
    }

    if (fs.existsSync(SETTINGS_FILE)) {
      const settingsContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      slotSettings = {
        ...slotSettings,
        ...JSON.parse(settingsContent),
      };
    } else {
      saveSettings();
    }
  } catch (err) {
    console.error('Error initializing data store:', err);
    applications = [];
  }
}

export function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(applications, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store to file:', err);
  }
}

export function saveSettings() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(slotSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving settings to file:', err);
  }
}

/**
 * Priority Order:
 * 1. Resume Validity (Valid Resumes > No/Invalid Resumes)
 * 2. Status Priority (Approved > Kicked Out/Waitlisted > Disqualified)
 * 3. Skill Relevance Score & Certificate Holder > Timestamp
 */
export function sortApplications(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => {
    // 1. Resume Validity: valid first, invalid last
    if (a.resumeValidity !== b.resumeValidity) {
      return a.resumeValidity === 'valid' ? -1 : 1;
    }

    // 2. Status priority
    const statusWeight: Record<string, number> = {
      'Approved': 1,
      'Kicked Out (Displaced by Certified Candidate)': 2,
      'Waitlisted': 3,
      'Disqualified (No Resume/Unqualified)': 4,
    };
    const weightA = statusWeight[a.status] || 5;
    const weightB = statusWeight[b.status] || 5;
    if (weightA !== weightB) {
      return weightA - weightB;
    }

    // 3. Certificates & Skill Score
    if (a.skillScore !== b.skillScore) {
      return b.skillScore - a.skillScore;
    }

    // 4. Timestamp
    return a.submissionTimestampMs - b.submissionTimestampMs;
  });
}

export function getAllApplications(options?: {
  status?: string;
  jobId?: string;
  search?: string;
}): { applications: Application[]; stats: QuotaStats } {
  let list = sortApplications(applications);

  // Assign overall rank based on the sorted priority order
  list = list.map((app, index) => ({
    ...app,
    rank: index + 1,
  }));

  const totalCapacity =
    slotSettings.totalMaxCapacity ||
    FILI_JOBS.reduce(
      (sum, j) => sum + (slotSettings.jobCustomQuotas?.[j.id] ?? j.totalQuota),
      0
    );

  const stats: QuotaStats = {
    totalCapacity,
    totalSubmitted: applications.length,
    totalApproved: applications.filter((a) => a.status === 'Approved').length,
    totalWaitlisted: applications.filter((a) => a.status === 'Waitlisted').length,
    totalDisplaced: applications.filter((a) => a.status === 'Kicked Out (Displaced by Certified Candidate)').length,
    totalDisqualified: applications.filter((a) => a.status === 'Disqualified (No Resume/Unqualified)').length,
    totalFired: applications.filter((a) => a.status === 'Terminated (Fired by Admin)').length,
  };

  if (options?.status && options.status !== 'All') {
    if (options.status === 'Displaced' || options.status === 'Kicked Out') {
      list = list.filter((a) => a.status === 'Kicked Out (Displaced by Certified Candidate)');
    } else if (options.status === 'Fired' || options.status === 'Terminated (Fired by Admin)') {
      list = list.filter((a) => a.status === 'Terminated (Fired by Admin)');
    } else {
      list = list.filter((a) => a.status === options.status);
    }
  }
  if (options?.jobId && options.jobId !== 'all') {
    list = list.filter((a) => a.jobId === options.jobId);
  }
  if (options?.search && options.search.trim()) {
    const q = options.search.toLowerCase().trim();
    list = list.filter(
      (a) =>
        a.studentName.toLowerCase().includes(q) ||
        a.studentEmail.toLowerCase().includes(q) ||
        a.studentClass.toLowerCase().includes(q) ||
        a.section.toLowerCase().includes(q) ||
        a.jobTitle.toLowerCase().includes(q)
    );
  }

  return { applications: list, stats };
}

export function getApplicationByEmail(email: string): Application | undefined {
  if (!email) return undefined;
  
  // Find all applications for this user
  const userApps = applications.filter((a) => a.studentEmail.toLowerCase().trim() === email.toLowerCase().trim());
  if (userApps.length === 0) return undefined;
  
  // Sort them so the most recent is checked
  userApps.sort((a, b) => b.submissionTimestampMs - a.submissionTimestampMs);
  
  const activeApp = userApps[0];
  
  // If the latest app is Resigned, they are "taken off"
  if (activeApp.status === 'Resigned') {
    return undefined;
  }
  
  // Return the active application (including if Terminated, so fired students can view status and reapply)
  return activeApp;
}

export function getApplicationById(id: string): Application | undefined {
  return applications.find((a) => a.id === id);
}

export function countClassJobApproved(jobId: string, studentClass: string): number {
  return applications.filter(
    (a) => a.jobId === jobId && a.studentClass.toLowerCase() === studentClass.toLowerCase() && a.status === 'Approved'
  ).length;
}

export function countJobApproved(jobId: string): number {
  return applications.filter((a) => a.jobId === jobId && a.status === 'Approved').length;
}

/**
 * Determines whether a job is governed by the skilled candidate reservation cap.
 * Controlled by the admin (scope: 'skilled-roles-only' vs 'all-jobs').
 */
export function isJobSubjectToReservation(jobId: string): boolean {
  if (slotSettings.skilledReservationScope === 'all-jobs') {
    return true;
  }
  return isJobSkilledRole(jobId);
}

/**
 * Returns the percentage of positions reserved for skilled/certified kids for a given job.
 * Admin can set a global percent or override specific jobs.
 */
export function getJobSkilledReservationPercent(jobId: string): number {
  if (
    slotSettings.jobSkilledReservationPercents &&
    typeof slotSettings.jobSkilledReservationPercents[jobId] === 'number'
  ) {
    return Math.max(0, Math.min(100, slotSettings.jobSkilledReservationPercents[jobId]));
  }
  return typeof slotSettings.skilledReservationPercent === 'number'
    ? Math.max(0, Math.min(100, slotSettings.skilledReservationPercent))
    : 25;
}

/**
 * Returns the effective job definition including any custom title, category,
 * description, requirements, quota, and salary configured by school administrators.
 */
export function getEffectiveJob(jobId: string): FiLiJob {
  const base = FILI_JOBS.find((j) => j.id === jobId) || FILI_JOBS[0];
  const customDetail = slotSettings.jobCustomDetails?.[base.id];
  const customQuota = slotSettings.jobCustomQuotas?.[base.id];
  const customSalary = slotSettings.jobCustomSalaries?.[base.id];

  return {
    ...base,
    title: customDetail?.title?.trim() || base.title,
    category: customDetail?.category?.trim() || base.category,
    description: customDetail?.description?.trim() || base.description,
    requirements:
      customDetail?.requirements && customDetail.requirements.length > 0
        ? customDetail.requirements
        : base.requirements,
    totalQuota: customQuota !== undefined ? Math.max(1, customQuota) : base.totalQuota,
    payout: customSalary?.payout?.trim() || base.payout,
    payoutAmount:
      customSalary?.payoutAmount !== undefined ? customSalary.payoutAmount : base.payoutAmount,
    hasCustomDetails: Boolean(customDetail),
  };
}

export function getAllEffectiveJobs(): FiLiJob[] {
  return FILI_JOBS.map((j) => getEffectiveJob(j.id));
}

/**
 * Updates a job role's title, category, description, and requirements.
 */
export function updateJobRoleDetails(params: {
  jobId: string;
  title?: string;
  category?: string;
  description?: string;
  requirements?: string[] | string;
  resetDetails?: boolean;
  updatedBy?: string;
}): SlotSettings {
  const currentDetails = { ...(slotSettings.jobCustomDetails || {}) };
  if (params.resetDetails) {
    delete currentDetails[params.jobId];
  } else {
    const base = FILI_JOBS.find((j) => j.id === params.jobId) || FILI_JOBS[0];
    const prev = currentDetails[params.jobId] || {};
    let reqs: string[] | undefined = undefined;

    if (Array.isArray(params.requirements)) {
      reqs = params.requirements.map((r) => r.trim()).filter(Boolean);
    } else if (typeof params.requirements === 'string') {
      reqs = params.requirements
        .split('\n')
        .map((r) => r.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean);
    }

    currentDetails[params.jobId] = {
      title: params.title !== undefined && params.title.trim().length > 0 ? params.title.trim() : (prev.title || base.title),
      category: params.category !== undefined && params.category.trim().length > 0 ? params.category.trim() : (prev.category || base.category),
      description: params.description !== undefined && params.description.trim().length > 0 ? params.description.trim() : (prev.description || base.description),
      requirements: reqs !== undefined && reqs.length > 0 ? reqs : (prev.requirements || base.requirements),
    };
  }

  slotSettings.jobCustomDetails = currentDetails;
  slotSettings.lastUpdated = new Date().toISOString();
  if (params.updatedBy) {
    slotSettings.updatedBy = params.updatedBy;
  }
  saveSettings();
  return { ...slotSettings };
}

/**
 * Calculates the exact breakdown between:
 * 1. Reserved slots for skilled/certified kids (e.g. 25%)
 * 2. Protected slots for general/uncertified kids (e.g. 75%)
 * Along with current approved counts for each cohort.
 */
export function getJobQuotaBreakdown(jobId: string): JobQuotaBreakdown {
  const job = getEffectiveJob(jobId);
  const isSkilled = isJobSkilledRole(job.id);
  const isSubject = isJobSubjectToReservation(job.id);
  const reservedPercent = isSubject ? getJobSkilledReservationPercent(job.id) : 0;
  const minSkillScore = slotSettings.jobMinSkillScores?.[job.id] ?? 80;
  const skilledRequirement = slotSettings.jobSkilledRequirements?.[job.id] ?? '';
  
  const totalQuota = slotSettings.jobCustomQuotas?.[job.id] ?? job.totalQuota;
  
  const hasCustomOverride =
    slotSettings.jobSkilledReservationPercents?.[job.id] !== undefined ||
    slotSettings.jobMinSkillScores?.[job.id] !== undefined ||
    slotSettings.jobSkilledRequirements?.[job.id] !== undefined ||
    slotSettings.jobCustomQuotas?.[job.id] !== undefined ||
    slotSettings.jobCustomSalaries?.[job.id] !== undefined ||
    slotSettings.jobCustomReservedSeats?.[job.id] !== undefined ||
    slotSettings.jobCustomDetails?.[job.id] !== undefined;

  const customReservedSeats = slotSettings.jobCustomReservedSeats?.[job.id];
  const skilledReservedSlots = customReservedSeats !== undefined 
    ? Math.min(customReservedSeats, totalQuota)
    : (isSubject && reservedPercent > 0
        ? Math.max(1, Math.round(totalQuota * (reservedPercent / 100)))
        : 0);

  const generalProtectedSlots = Math.max(0, totalQuota - skilledReservedSlots);

  const approvedApps = applications.filter((a) => a.jobId === job.id && a.status === 'Approved');
  const currentApprovedSkilled = approvedApps.filter(
    (a) => a.hasCertificates || a.skillScore >= minSkillScore
  ).length;
  const currentApprovedGeneral = approvedApps.filter(
    (a) => !a.hasCertificates && a.skillScore < minSkillScore
  ).length;
  const currentTotalApproved = approvedApps.length;

  return {
    jobId: job.id,
    jobTitle: job.title,
    category: job.category,
    totalQuota: totalQuota,
    isSkilledRole: isSkilled,
    reservedPercent: isSubject ? reservedPercent : 0,
    skilledReservedSlots,
    generalProtectedSlots,
    currentApprovedSkilled,
    currentApprovedGeneral,
    currentTotalApproved,
    isSkilledQuotaFull: currentApprovedSkilled >= skilledReservedSlots,
    isGeneralQuotaFull: currentApprovedGeneral >= generalProtectedSlots,
    isTotalFull: currentTotalApproved >= totalQuota,
    minSkillScore,
    skilledRequirement,
    hasCustomOverride,
  };
}

export function getAllJobQuotaBreakdowns(): JobQuotaBreakdown[] {
  return FILI_JOBS.map((j) => getJobQuotaBreakdown(j.id));
}

/**
 * Executes the core business logic described by the user:
 * 1. "Many kids don't have experience, so We just take them in first"
 * 2. "only 25% of the jobs like tech team - or which students might already have skills in, are reserved for skilled kids"
 * 3. "it can be controlled by the admin, if the admin wants, the admin can change the percent reserved for all jobs"
 * 4. Certified candidates can preempt up to the reserved percentage.
 * 5. Once the skilled reserved percentage (e.g. 25%) is full, the remaining 75% are permanently PROTECTED for regular students!
 */
export function addApplication(app: Application): Application {
  // Check if global slots are closed by admin
  if (!slotSettings.globalSlotsOpen) {
    throw new Error('Application intake is currently closed by the school administration. Slots are not accepting submissions at this time.');
  }

  // Check if this specific job's slots are closed by admin
  if (slotSettings.closedJobIds.includes(app.jobId)) {
    throw new Error(`Application slots for this position are currently closed by administration.`);
  }

  const job = getEffectiveJob(app.jobId);
  app.jobTitle = job.title;
  if (!app.payout) {
    app.payout = job.payout;
  }
  if (!app.skillScore) {
    app.skillScore = 50;
  }
  app.resumeValidity = 'valid';

  const currentClassApprovedCount = countClassJobApproved(app.jobId, app.studentClass);
  const currentTotalApprovedCount = countJobApproved(app.jobId);

  const breakdown = getJobQuotaBreakdown(app.jobId);

  const isClassLimited = Boolean(job.maxPerClass && currentClassApprovedCount >= job.maxPerClass);
  const isTotalLimited = currentTotalApprovedCount >= breakdown.totalQuota;
  const isSlotContested = isClassLimited || isTotalLimited;
  const minRequiredScore = slotSettings.jobMinSkillScores?.[app.jobId] ?? 80;
  const isCandidateSkilled = Boolean(app.hasCertificates || app.skillScore >= minRequiredScore);
  const certTitle = app.certificateNames?.[0] || 'Official Certificate';

  // 1. Check Class Quota first (e.g., max 2 PR Ambassadors per class)
  if (job.maxPerClass && currentClassApprovedCount >= job.maxPerClass) {
    app.status = 'Waitlisted';
    app.aiReasoning = `Waitlisted: The maximum quota for your class/grade (${job.maxPerClass} per class) has already been reached for this position.`;
  } else {
    // 2. Check Role Quotas without kicking anyone out (Strict Partition)
    if (isCandidateSkilled) {
      if (breakdown.currentApprovedSkilled < breakdown.skilledReservedSlots) {
        // Skilled applicant takes a Skill-Reserved slot
        app.status = 'Approved';
        app.aiReasoning = `Approved (Skilled Reserved Quota): Admitted under the ${breakdown.reservedPercent}% skilled quota (${breakdown.currentApprovedSkilled + 1}/${breakdown.skilledReservedSlots} slots filled). Certificate/merit verified (${certTitle}, Score: ${app.skillScore}/100, Threshold: ${minRequiredScore}).`;
      } else if (breakdown.currentApprovedGeneral < breakdown.generalProtectedSlots) {
        // Skilled applicant spills over into a General FCFS slot
        app.status = 'Approved';
        app.aiReasoning = `Approved (General Open Slot): The ${breakdown.reservedPercent}% skilled reservation is filled, but open general slots remain available. Admitted into general placement (Score: ${app.skillScore}/100).`;
      } else {
        // All slots full
        app.status = 'Waitlisted';
        app.aiReasoning = `Waitlisted: All positions for ${job.title} (both skilled and general) are currently occupied.`;
      }
    } else {
      if (breakdown.currentApprovedGeneral < breakdown.generalProtectedSlots) {
        // General applicant takes a General FCFS slot
        app.status = 'Approved';
        app.aiReasoning = app.aiReasoning && app.aiReasoning.includes('general')
          ? app.aiReasoning
          : `Approved (FCFS General Slot): Admitted on open middle school entry (Score: ${app.skillScore}/100). Note: Secured one of the ${breakdown.generalProtectedSlots} general slots.`;
      } else {
        // General slots are full. They CANNOT touch the skilled slots.
        app.status = 'Waitlisted';
        app.aiReasoning = `Waitlisted: All general FCFS slots (${breakdown.generalProtectedSlots}) are currently occupied. The remaining slots are strictly locked for skilled/certified candidates.`;
      }
    }
  }

  // Enforce Single-Job Rule: Replace/archive any previous application for this student (fired application)
  // Multi-jobs are strictly forbidden.
  const prevAppIndex = applications.findIndex(
    (a) => a.studentEmail.toLowerCase().trim() === app.studentEmail.toLowerCase().trim()
  );
  if (prevAppIndex !== -1) {
    applications.splice(prevAppIndex, 1);
  }

  applications.unshift(app);
  saveStore();
  return app;
}

export function updateApplication(id: string, updates: Partial<Application>): Application {
  const index = applications.findIndex((a) => a.id === id);
  if (index === -1) {
    throw new Error(`Application ${id} not found.`);
  }

  applications[index] = {
    ...applications[index],
    ...updates,
  };

  saveStore();
  return applications[index];
}

export function fireAllStudents(options?: { reason?: string }): {
  count: number;
  firedStudentNames: string[];
  firedAppIds: string[];
  applications: Application[];
} {
  const reason = options?.reason || 'Administrative decision - placement terminated for all students';
  const now = new Date();
  const effective = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days

  const firedStudentNames: string[] = [];
  const firedAppIds: string[] = [];

  applications = applications.map((app) => {
    if (app.status === 'Approved') {
      firedStudentNames.push(app.studentName);
      firedAppIds.push(app.id);
      return {
        ...app,
        status: 'Terminated (Fired by Admin)',
        firedAt: now.toISOString(),
        firedEffectiveAt: effective.toISOString(),
        firedReason: reason,
      };
    }
    return app;
  });

  saveStore();
  return {
    count: firedAppIds.length,
    firedStudentNames,
    firedAppIds,
    applications,
  };
}

export function resetDemoStore(): void {
  applications = [];
  saveStore();
}

export function getSlotSettings(): SlotSettings {
  return { ...slotSettings };
}

export function updateSlotSettings(updates: Partial<SlotSettings>): SlotSettings {
  slotSettings = {
    ...slotSettings,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  saveSettings();
  return { ...slotSettings };
}

export function toggleGlobalSlots(open: boolean, updatedBy: string = 'FiLi Administration'): SlotSettings {
  slotSettings = {
    ...slotSettings,
    globalSlotsOpen: open,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };
  saveSettings();
  return { ...slotSettings };
}

export function toggleJobSlots(jobId: string, open: boolean, updatedBy: string = 'FiLi Administration'): SlotSettings {
  let closed = [...slotSettings.closedJobIds];
  if (!open) {
    if (!closed.includes(jobId)) {
      closed.push(jobId);
    }
  } else {
    closed = closed.filter((id) => id !== jobId);
  }

  slotSettings = {
    ...slotSettings,
    closedJobIds: closed,
    lastUpdated: new Date().toISOString(),
    updatedBy,
  };
  saveSettings();
  return { ...slotSettings };
}

export function updateJobCustomSettings(params: {
  jobId: string;
  quota?: number;
  salaryPayout?: string;
  salaryAmount?: number;
  reservedSeats?: number;
  resetQuota?: boolean;
  resetSalary?: boolean;
  resetReservedSeats?: boolean;
  updatedBy?: string;
}): SlotSettings {
  const currentQuotas = { ...(slotSettings.jobCustomQuotas || {}) };
  const currentSalaries = { ...(slotSettings.jobCustomSalaries || {}) };
  const currentReservedSeats = { ...(slotSettings.jobCustomReservedSeats || {}) };

  if (params.resetQuota) {
    delete currentQuotas[params.jobId];
  } else if (params.quota !== undefined) {
    currentQuotas[params.jobId] = Math.max(1, params.quota);
  }

  if (params.resetSalary) {
    delete currentSalaries[params.jobId];
  } else if (params.salaryPayout !== undefined || params.salaryAmount !== undefined) {
    const job = FILI_JOBS.find((j) => j.id === params.jobId);
    const amount =
      params.salaryAmount !== undefined
        ? Number(params.salaryAmount)
        : job?.payoutAmount || 200;
    const payout = params.salaryPayout?.trim() || `${amount} BRAED/Month`;
    currentSalaries[params.jobId] = { payout, payoutAmount: amount };
  }

  if (params.resetReservedSeats) {
    delete currentReservedSeats[params.jobId];
  } else if (params.reservedSeats !== undefined) {
    currentReservedSeats[params.jobId] = Math.max(0, params.reservedSeats);
  }

  slotSettings.jobCustomQuotas = currentQuotas;
  slotSettings.jobCustomSalaries = currentSalaries;
  slotSettings.jobCustomReservedSeats = currentReservedSeats;

  slotSettings.lastUpdated = new Date().toISOString();
  if (params.updatedBy) {
    slotSettings.updatedBy = params.updatedBy;
  }

  saveSettings();
  return { ...slotSettings };
}

export function updateSubmissionDeadline(
  deadline: string | null,
  updatedBy?: string
): SlotSettings {
  slotSettings.submissionDeadline = deadline ? deadline.trim() : null;
  slotSettings.lastUpdated = new Date().toISOString();
  if (updatedBy) {
    slotSettings.updatedBy = updatedBy;
  }
  saveSettings();
  return { ...slotSettings };
}

export function updateTotalMaxCapacity(
  capacity: number,
  updatedBy?: string
): SlotSettings {
  slotSettings.totalMaxCapacity = Math.max(1, capacity);
  slotSettings.lastUpdated = new Date().toISOString();
  if (updatedBy) {
    slotSettings.updatedBy = updatedBy;
  }
  saveSettings();
  return { ...slotSettings };
}

export function updateSkilledReservationSettings(params: {
  percent?: number;
  scope?: 'skilled-roles-only' | 'all-jobs';
  jobId?: string;
  minSkillScore?: number;
  skilledRequirement?: string;
  resetJobOverride?: boolean;
  applyToAllJobs?: boolean;
  updatedBy?: string;
}): SlotSettings {
  const currentOverrides = { ...(slotSettings.jobSkilledReservationPercents || {}) };
  const currentMinScores = { ...(slotSettings.jobMinSkillScores || {}) };
  const currentRequirements = { ...(slotSettings.jobSkilledRequirements || {}) };

  if (params.jobId) {
    if (params.resetJobOverride) {
      delete currentOverrides[params.jobId];
      delete currentMinScores[params.jobId];
      delete currentRequirements[params.jobId];
      slotSettings.jobSkilledReservationPercents = currentOverrides;
      slotSettings.jobMinSkillScores = currentMinScores;
      slotSettings.jobSkilledRequirements = currentRequirements;
    } else {
      if (typeof params.percent === 'number') {
        currentOverrides[params.jobId] = Math.max(0, Math.min(100, Math.round(params.percent)));
        slotSettings.jobSkilledReservationPercents = currentOverrides;
      }
      if (typeof params.minSkillScore === 'number') {
        currentMinScores[params.jobId] = Math.max(0, Math.min(100, Math.round(params.minSkillScore)));
        slotSettings.jobMinSkillScores = currentMinScores;
      }
      if (typeof params.skilledRequirement === 'string') {
        currentRequirements[params.jobId] = params.skilledRequirement.trim();
        slotSettings.jobSkilledRequirements = currentRequirements;
      }
    }
  } else if (typeof params.percent === 'number') {
    const clamped = Math.max(0, Math.min(100, Math.round(params.percent)));

    if (params.applyToAllJobs) {
      // Set global percent and clear per-job overrides so all jobs follow this percent!
      slotSettings.skilledReservationPercent = clamped;
      slotSettings.jobSkilledReservationPercents = {};
    } else {
      slotSettings.skilledReservationPercent = clamped;
    }
  }

  if (params.scope) {
    slotSettings.skilledReservationScope = params.scope;
  }

  slotSettings.lastUpdated = new Date().toISOString();
  if (params.updatedBy) {
    slotSettings.updatedBy = params.updatedBy;
  }

  saveSettings();
  return { ...slotSettings };
}

