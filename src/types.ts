export type ApplicationStatus =
  | 'Approved'
  | 'Waitlisted'
  | 'Kicked Out (Displaced by Certified Candidate)'
  | 'Disqualified (No Resume/Unqualified)'
  | 'Terminated (Fired by Admin)'
  | 'Resigned';

export type ResumeValidity = 'valid' | 'invalid';

export interface FiLiJob {
  id: string;
  title: string;
  payout: string; // e.g. "200 BRAED/Month"
  payoutAmount: number;
  category: string;
  maxPerClass?: number; // e.g. 2 for School PR Ambassador
  totalQuota: number; // e.g. 60
  description: string;
  requirements: string[];
  isSkilledRole?: boolean; // Whether role typically involves existing skills/tech background (e.g. Tech Support, Innovation, Media)
  hasCustomDetails?: boolean;
}

export interface StudentProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  isGoogleVerified: boolean;
}

export interface Application {
  id: string;
  studentName: string;
  accountOwner?: 'student' | 'parent';
  actualStudentName?: string;
  studentEmail: string;
  studentAvatar?: string;
  studentClass: string;
  section: string;
  jobId: string;
  jobTitle: string;
  payout: string;
  submissionTimestamp: string; // ISO 8601 with ms
  submissionTimestampMs: number;
  resumeFileName?: string;
  resumeFileSize?: number;
  resumeBase64?: string; // Stored for review/preview
  resumeValidity: ResumeValidity;
  hasCertificates?: boolean;
  certificateNames?: string[];
  skillScore: number; // 0-100 calculated by Gemini
  status: ApplicationStatus;
  aiReasoning: string;
  displacedCandidateName?: string; // Name of uncertified student who was kicked out by this candidate
  displacedByCandidateName?: string; // Name of certified student who kicked out this student
  displacementTimestamp?: string;
  // Firing and resignation lifecycle tracking
  firedAt?: string; // ISO timestamp when admin fired the student
  firedEffectiveAt?: string; // ISO timestamp (2 days after firedAt) when access is automatically revoked
  firedReason?: string;
  resignedAt?: string; // ISO timestamp when student resigned
  resignedReason?: string;
  aiAnalysis?: {
    verifiedSkills: string[];
    certificates?: string[];
    roleAlignmentVerdict: string;
    pastTwoYearsExperience: string;
    flags?: string[];
  };
  adminNotes?: string;
  rank?: number;
}

export interface AdminUser {
  username: string;
  email?: string;
  token: string;
  role: 'admin';
  isGoogleAdmin?: boolean;
}

export interface QuotaStats {
  totalCapacity: number; // 1,180
  totalSubmitted: number;
  totalApproved: number;
  totalWaitlisted: number;
  totalDisplaced: number; // Kicked out by incoming certified candidates
  totalDisqualified: number;
  totalFired?: number;
}

export interface SlotSettings {
  globalSlotsOpen: boolean; // Master switch: whether middle school applications are open
  closedJobIds: string[]; // Specific job IDs whose slots are closed by admin
  noticeMessage?: string; // Optional custom administrator alert message
  lastUpdated: string;
  updatedBy?: string;
  submissionDeadline?: string | null; // ISO timestamp string when submission window closes for all students
  totalMaxCapacity?: number; // Total middle school participant capacity (default: 1180)
  skilledReservationPercent: number; // Default: 25. Percent of positions reserved for skilled/certified kids
  jobSkilledReservationPercents?: Record<string, number>; // Custom overrides per job ID
  jobMinSkillScores?: Record<string, number>; // Custom minimum skill score (e.g. 70) required for skilled status
  jobSkilledRequirements?: Record<string, string>; // Custom skilled criteria or required certificate focus per role
  skilledReservationScope: 'skilled-roles-only' | 'all-jobs'; // Whether 25% reservation applies to skilled roles only or all jobs
  // Admin custom controls:
  // - the number of workers who can apply for each job (total quota)
  // - the salary of each job (payout string and amount)
  // - how many seats are reserved for each job (explicit reserved seats count override)
  jobCustomQuotas?: Record<string, number>; // Custom capacity / worker count per job
  jobCustomSalaries?: Record<string, { payout: string; payoutAmount: number }>; // Custom salary/payout per job
  jobCustomReservedSeats?: Record<string, number>; // Exact number of reserved seats override per job
  jobCustomDetails?: Record<
    string,
    {
      title?: string;
      category?: string;
      description?: string;
      requirements?: string[];
    }
  >; // Custom title, category, description, and requirements per job position
}

export interface JobQuotaBreakdown {
  jobId: string;
  jobTitle: string;
  category: string;
  totalQuota: number;
  isSkilledRole: boolean;
  reservedPercent: number;
  skilledReservedSlots: number;
  generalProtectedSlots: number;
  currentApprovedSkilled: number;
  currentApprovedGeneral: number;
  currentTotalApproved: number;
  isSkilledQuotaFull: boolean;
  isGeneralQuotaFull: boolean;
  isTotalFull: boolean;
  minSkillScore?: number;
  skilledRequirement?: string;
  hasCustomOverride?: boolean;
}
