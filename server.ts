import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { FILI_JOBS } from './src/data/jobs.js';
import {
  initStore,
  getAllApplications,
  getApplicationByEmail,
  getApplicationById,
  addApplication,
  updateApplication,
  fireAllStudents,
  resetDemoStore,
  countClassJobApproved,
  countJobApproved,
  getSlotSettings,
  updateSlotSettings,
  toggleGlobalSlots,
  toggleJobSlots,
  getAllJobQuotaBreakdowns,
  getJobQuotaBreakdown,
  updateSkilledReservationSettings,
  updateJobCustomSettings,
  updateSubmissionDeadline,
  updateTotalMaxCapacity,
  getEffectiveJob,
  getAllEffectiveJobs,
  updateJobRoleDetails,
} from './server/store.js';
import { evaluateApplication } from './server/evaluator.js';
import { chatWithArsh } from './server/chatbot.js';
import { Application } from './src/types.js';

dotenv.config();

const PORT = 3000;
const ADMIN_USERNAME = 'admin_fili';
const ADMIN_PASSWORD = 'fili_secure_2026';

// Initialize data storage
initStore();

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Safe JSON parse error handler for incoming API requests
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON payload in request body.' });
    }
    next(err);
  });

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'FiLi Job Portal',
      time: new Date().toISOString(),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  // Slot settings public endpoint
  app.get('/api/slot-settings', (req, res) => {
    const settings = getSlotSettings();
    res.json({ slotSettings: settings });
  });

  // Arsh (FiLi Bot) conversational assistant endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, conversationHistory, studentContext } = req.body;
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message text is required' });
      }

      const result = await chatWithArsh({
        message: message.trim(),
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        studentContext: studentContext || undefined,
      });

      res.json({
        success: true,
        reply: result.reply,
        suggestedActions: result.suggestedActions,
        liveStatus: result.liveStatus,
        botName: 'Arsh',
        externalName: 'FiLi Bot',
      });
    } catch (err: any) {
      console.error('Error in /api/chat:', err);
      res.status(500).json({
        error: err.message || 'Chatbot encountered an unexpected error.',
        reply: "I'm having a little trouble connecting right now, but please check the live Job Directory or Application Form in the meantime!",
      });
    }
  });

  // Jobs listing with live capacity and admin slot status
  app.get('/api/jobs', (req, res) => {
    const settings = getSlotSettings();
    const isDeadlinePassed = Boolean(
      settings.submissionDeadline &&
        !isNaN(new Date(settings.submissionDeadline).getTime()) &&
        Date.now() > new Date(settings.submissionDeadline).getTime()
    );

    const effectiveJobs = getAllEffectiveJobs();
    const jobsWithCounts = effectiveJobs.map((j) => {
      const effectiveQuota = settings.jobCustomQuotas?.[j.id] ?? j.totalQuota;
      const effectiveSalary = settings.jobCustomSalaries?.[j.id];
      const payout = effectiveSalary?.payout ?? j.payout;
      const payoutAmount = effectiveSalary?.payoutAmount ?? j.payoutAmount;

      const filled = countJobApproved(j.id);
      const isClosedByAdmin = settings.closedJobIds.includes(j.id);
      const isQuotaFull = filled >= effectiveQuota;
      const isSlotOpen =
        settings.globalSlotsOpen && !isDeadlinePassed && !isClosedByAdmin && !isQuotaFull;

      return {
        ...j,
        totalQuota: effectiveQuota,
        payout,
        payoutAmount,
        filledCount: filled,
        isFull: isQuotaFull,
        isClosedByAdmin,
        isSlotOpen,
        slotStatus: !settings.globalSlotsOpen
          ? 'System-wide Intake Closed'
          : isDeadlinePassed
          ? 'Intake Deadline Passed'
          : isClosedByAdmin
          ? 'Closed by Admin'
          : isQuotaFull
          ? 'Full (Waitlist Only)'
          : 'Open',
      };
    });
    res.json({ jobs: jobsWithCounts, slotSettings: settings, breakdowns: getAllJobQuotaBreakdowns() });
  });

  // Get quota breakdown for all jobs (skilled reservation stats)
  app.get('/api/slot-settings/breakdowns', (req, res) => {
    res.json({
      success: true,
      breakdowns: getAllJobQuotaBreakdowns(),
      slotSettings: getSlotSettings(),
    });
  });

  // Check if a student email has already submitted an application
  app.get('/api/applications/check', (req, res) => {
    const email = (req.query.email as string)?.trim();
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const existing = getApplicationByEmail(email);
    if (existing) {
      return res.json({
        hasSubmitted: true,
        exists: true,
        application: existing,
      });
    }
    return res.json({ hasSubmitted: false, exists: false });
  });

  // Submit new application
  app.post('/api/applications', async (req, res) => {
    try {
      const {
        studentName,
        accountOwner,
        actualStudentName,
        studentEmail,
        studentAvatar,
        studentClass,
        section,
        jobId,
        resumeFileName,
        resumeFileSize,
        resumeBase64,
      } = req.body;

      if (!studentName || !studentEmail || !studentClass || !section || !jobId) {
        return res.status(400).json({ error: 'All fields (Name, Email, Class, Section, Job) are mandatory.' });
      }

      if (accountOwner === 'parent' && (!actualStudentName || actualStudentName.trim().length < 3)) {
        return res.status(400).json({ error: "Please enter the student's full legitimate name. Fake accounts without a valid student name are not permitted." });
      }

      const job = getEffectiveJob(jobId);
      if (!job) {
        return res.status(400).json({ error: 'Selected job does not exist.' });
      }

      // Enforce single-job policy and fired-student requirement:
      // "The submit application is only for students who got fired. If a student gets placed or gets taken in, they can't submit a new application. A student can be in only one job. They can't go for more jobs. Multi-jobs are not allowed."
      const existingUserApp = getApplicationByEmail(studentEmail);
      if (existingUserApp) {
        if (existingUserApp.status === 'Approved' || existingUserApp.status === 'Waitlisted') {
          return res.status(403).json({
            error: `Multi-jobs are strictly forbidden. You are currently placed or taken in for "${existingUserApp.jobTitle}". A student can be in only one job. Application re-submission is only permitted for students who have been terminated/fired by administration.`,
          });
        }
        if (existingUserApp.status !== 'Terminated (Fired by Admin)') {
          return res.status(403).json({
            error: `Application re-submission is only available for students who have been terminated/fired by administration.`,
          });
        }
      }

      // Check slot status
      const slotSettings = getSlotSettings();
      if (!slotSettings.globalSlotsOpen) {
        return res.status(403).json({
          error: 'Application intake is currently closed by the school administration. Slots are not accepting submissions at this time.',
        });
      }
      if (slotSettings.submissionDeadline) {
        const deadlineMs = new Date(slotSettings.submissionDeadline).getTime();
        if (!isNaN(deadlineMs) && Date.now() > deadlineMs) {
          const formatted = new Date(deadlineMs).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          });
          return res.status(403).json({
            error: `Application intake has officially closed. The submission deadline was ${formatted}. New applications can no longer be submitted.`,
          });
        }
      }
      if (slotSettings.closedJobIds.includes(jobId)) {
        return res.status(403).json({
          error: `Application slots for "${job.title}" are currently closed by administration.`,
        });
      }

      // Check single job quota capacity
      const effectiveJobQuota = slotSettings.jobCustomQuotas?.[jobId] ?? job.totalQuota;
      const currentFillCount = countJobApproved(jobId);
      if (currentFillCount >= effectiveJobQuota) {
        return res.status(403).json({
          error: `Applications for "${job.title}" are currently closed because this position is at full capacity (${currentFillCount}/${effectiveJobQuota} slots filled).`,
        });
      }

      // Check total cohort capacity against configured max capacity (default 1,180)
      const totalMaxCapacity = slotSettings.totalMaxCapacity ?? 1180;
      const { applications: allApps, stats: allStats } = getAllApplications();
      const totalApprovedCount = allStats?.totalApproved ?? allApps.filter((a) => a.status === 'Approved').length;
      if (totalApprovedCount >= totalMaxCapacity) {
        return res.status(403).json({
          error: `Application intake has reached the maximum middle school cohort capacity (${totalMaxCapacity.toLocaleString()} students). Administration has capped further submissions.`,
        });
      }

      // High-precision timestamp for strict FCFS queue ordering
      const submissionTimestampMs = Date.now();
      const submissionTimestamp = new Date(submissionTimestampMs).toISOString();

      // Existing counts for quota calculation
      const existingClassCount = countClassJobApproved(jobId, studentClass);

      // Execute AI screening pipeline (Resume verification + Role alignment + Scoring)
      const screeningResult = await evaluateApplication({
        jobId,
        studentName,
        studentClass,
        section,
        jobTitle: job.title,
        jobDescription: job.description,
        jobCategory: job.category,
        jobRequirements: job.requirements,
        jobPayout: job.payout,
        resumeFileName,
        resumeFileSize,
        resumeBase64,
        existingClassJobCount: existingClassCount,
        currentJobFillCount: currentFillCount,
      });

      const effectiveSalary = job.payout;

      const newApp: Application = {
        id: `fili_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentName: studentName.trim(),
        accountOwner,
        actualStudentName: accountOwner === 'parent' ? actualStudentName.trim() : undefined,
        studentEmail: studentEmail.trim().toLowerCase(),
        studentAvatar,
        studentClass: studentClass.trim(),
        section: section.trim(),
        jobId: job.id,
        jobTitle: job.title,
        payout: effectiveSalary,
        submissionTimestamp,
        submissionTimestampMs,
        resumeFileName,
        resumeFileSize,
        resumeBase64: resumeBase64 ? resumeBase64.substring(0, 1000000) : undefined, // store sample for review
        resumeValidity: screeningResult.resumeValidity,
        hasCertificates: screeningResult.hasCertificates,
        certificateNames: screeningResult.certificateNames,
        skillScore: screeningResult.skillScore,
        status: screeningResult.status,
        aiReasoning: screeningResult.aiReasoning,
        aiAnalysis: screeningResult.aiAnalysis,
      };

      const finalApp = addApplication(newApp);

      return res.status(201).json({
        success: true,
        message: 'Application submitted and screened successfully.',
        application: finalApp,
      });
    } catch (err: any) {
      console.error('Error submitting application:', err);
      return res.status(500).json({ error: err.message || 'Server error processing application.' });
    }
  });

  // Admin login endpoint
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = `fili_admin_token_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return res.json({
        success: true,
        token,
        user: {
          username: ADMIN_USERNAME,
          role: 'admin',
        },
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid Credentials. Please check username and password.',
    });
  });

  // Admin login via Google Account (Unified Access Page)
  app.post('/api/admin/google-login', (req, res) => {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    const normalized = String(email).trim().toLowerCase();
    const isAdmin =
      normalized === 'baijuqs@gmail.com' ||
      normalized === 'admin@fili.edu' ||
      normalized === 'admin_fili@gmail.com' ||
      normalized.startsWith('admin.') ||
      normalized.startsWith('admin_') ||
      normalized.includes('admin');

    if (isAdmin) {
      const token = `fili_admin_google_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      return res.json({
        success: true,
        token,
        user: {
          username: name || normalized.split('@')[0],
          email: normalized,
          role: 'admin',
          isGoogleAdmin: true,
        },
      });
    }

    return res.status(403).json({
      success: false,
      error: 'This Google Account does not have administrator clearance for FiLi Middle School.',
    });
  });

  // Admin get all applications (sorted by AI pipeline priority)
  app.get('/api/admin/applications', (req, res) => {
    const status = req.query.status as string | undefined;
    const jobId = req.query.jobId as string | undefined;
    const search = req.query.search as string | undefined;

    const data = getAllApplications({ status, jobId, search });
    res.json(data);
  });

  // Admin manual status override or notes
  app.patch('/api/admin/applications/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminNotes } = req.body;
      const updated = updateApplication(id, {
        ...(status ? { status } : {}),
        ...(adminNotes !== undefined ? { adminNotes } : {}),
      });
      res.json({ success: true, application: updated });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Admin firing single student
  app.post('/api/admin/applications/:id/fire', (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const now = new Date();
      const effective = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days
      const updated = updateApplication(id, {
        status: 'Terminated (Fired by Admin)',
        firedAt: now.toISOString(),
        firedEffectiveAt: effective.toISOString(),
        firedReason: reason || 'Administrative decision',
      });
      res.json({ success: true, application: updated });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Admin firing all students from their jobs
  app.post('/api/admin/applications/fire-all', (req, res) => {
    try {
      const { reason } = req.body || {};
      const result = fireAllStudents({ reason });
      res.json({
        success: true,
        count: result.count,
        firedStudentNames: result.firedStudentNames,
        firedAppIds: result.firedAppIds,
        message: `Successfully fired ${result.count} student${result.count === 1 ? '' : 's'} from their jobs. All quota slots have been released.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fire all students.' });
    }
  });

  // Student resignation
  app.post('/api/applications/:id/resign', (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const updated = updateApplication(id, {
        status: 'Resigned',
        resignedAt: new Date().toISOString(),
        resignedReason: reason || 'Voluntary resignation',
      });
      res.json({ success: true, application: updated });
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  // Admin re-screen application with Gemini
  app.post('/api/admin/applications/:id/rescreen', async (req, res) => {
    try {
      const { id } = req.params;
      const appRecord = getApplicationById(id);
      if (!appRecord) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const existingClassCount = countClassJobApproved(appRecord.jobId, appRecord.studentClass);
      const currentFillCount = countJobApproved(appRecord.jobId);
      const job = getEffectiveJob(appRecord.jobId);

      const screeningResult = await evaluateApplication({
        jobId: appRecord.jobId,
        studentName: appRecord.studentName,
        studentClass: appRecord.studentClass,
        section: appRecord.section,
        jobTitle: job.title,
        jobDescription: job.description,
        jobCategory: job.category,
        jobRequirements: job.requirements,
        jobPayout: job.payout,
        resumeFileName: appRecord.resumeFileName,
        resumeFileSize: appRecord.resumeFileSize,
        resumeBase64: appRecord.resumeBase64,
        existingClassJobCount: existingClassCount,
        currentJobFillCount: currentFillCount,
      });

      const updated = updateApplication(id, {
        resumeValidity: screeningResult.resumeValidity,
        skillScore: screeningResult.skillScore,
        status: screeningResult.status,
        aiReasoning: screeningResult.aiReasoning,
        aiAnalysis: screeningResult.aiAnalysis,
      });

      res.json({ success: true, application: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset / Clear applications
  app.post('/api/admin/reset-demo', (req, res) => {
    resetDemoStore();
    const data = getAllApplications();
    res.json({ success: true, message: 'All applications cleared. Roster is empty.', ...data });
  });

  // Admin slot management endpoints
  app.post('/api/admin/slots/toggle-global', (req, res) => {
    const { open, updatedBy } = req.body;
    const settings = toggleGlobalSlots(Boolean(open), updatedBy || 'FiLi Administration');
    res.json({
      success: true,
      message: open ? 'All student application slots have been opened.' : 'All student application slots have been closed.',
      slotSettings: settings,
    });
  });

  app.post('/api/admin/slots/toggle-job', (req, res) => {
    const { jobId, open, updatedBy } = req.body;
    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }
    const settings = toggleJobSlots(jobId, Boolean(open), updatedBy || 'FiLi Administration');
    const job = FILI_JOBS.find((j) => j.id === jobId);
    res.json({
      success: true,
      message: open
        ? `Slots for "${job?.title || jobId}" are now OPEN.`
        : `Slots for "${job?.title || jobId}" are now CLOSED.`,
      slotSettings: settings,
    });
  });

  app.post('/api/admin/slots/update', (req, res) => {
    const { globalSlotsOpen, closedJobIds, noticeMessage, updatedBy } = req.body;
    const settings = updateSlotSettings({
      ...(globalSlotsOpen !== undefined ? { globalSlotsOpen: Boolean(globalSlotsOpen) } : {}),
      ...(Array.isArray(closedJobIds) ? { closedJobIds } : {}),
      ...(noticeMessage !== undefined ? { noticeMessage } : {}),
      ...(updatedBy ? { updatedBy } : {}),
    });
    res.json({ success: true, slotSettings: settings });
  });

  app.post('/api/admin/slots/open-all-jobs', (req, res) => {
    const settings = updateSlotSettings({
      globalSlotsOpen: true,
      closedJobIds: [],
      updatedBy: req.body.updatedBy || 'FiLi Administration',
    });
    res.json({
      success: true,
      message: 'All 19 job position slots are now open.',
      slotSettings: settings,
    });
  });

  app.post('/api/admin/slots/close-all-jobs', (req, res) => {
    const allJobIds = FILI_JOBS.map((j) => j.id);
    const settings = updateSlotSettings({
      closedJobIds: allJobIds,
      updatedBy: req.body.updatedBy || 'FiLi Administration',
    });
    res.json({
      success: true,
      message: 'All individual job position slots have been closed.',
      slotSettings: settings,
    });
  });

  // Admin update job role definition (Title, Category, Description, Requirements)
  app.post('/api/admin/slots/job-details', (req, res) => {
    const {
      jobId,
      title,
      category,
      description,
      requirements,
      resetDetails,
      updatedBy,
    } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const settings = updateJobRoleDetails({
      jobId,
      title,
      category,
      description,
      requirements,
      resetDetails: Boolean(resetDetails),
      updatedBy: updatedBy || 'FiLi Administration',
    });

    const effectiveJob = getEffectiveJob(jobId);
    const breakdowns = getAllJobQuotaBreakdowns();

    res.json({
      success: true,
      message: resetDetails
        ? `Role definition for "${effectiveJob.title}" reset to FiLi default.`
        : `Role definition for "${effectiveJob.title}" (${effectiveJob.category}) updated successfully.`,
      slotSettings: settings,
      job: effectiveJob,
      breakdowns,
    });
  });

  app.post('/api/admin/slots/job-custom', (req, res) => {
    const {
      jobId,
      quota,
      salaryPayout,
      salaryAmount,
      reservedSeats,
      resetQuota,
      resetSalary,
      resetReservedSeats,
      title,
      category,
      description,
      requirements,
      resetDetails,
      updatedBy,
    } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    // If role description/category/title/requirements details provided, update them
    if (
      title !== undefined ||
      category !== undefined ||
      description !== undefined ||
      requirements !== undefined ||
      resetDetails
    ) {
      updateJobRoleDetails({
        jobId,
        title,
        category,
        description,
        requirements,
        resetDetails: Boolean(resetDetails),
        updatedBy: updatedBy || 'FiLi Administration',
      });
    }

    const settings = updateJobCustomSettings({
      jobId,
      quota: quota !== undefined ? Number(quota) : undefined,
      salaryPayout,
      salaryAmount: salaryAmount !== undefined ? Number(salaryAmount) : undefined,
      reservedSeats: reservedSeats !== undefined ? Number(reservedSeats) : undefined,
      resetQuota: Boolean(resetQuota),
      resetSalary: Boolean(resetSalary),
      resetReservedSeats: Boolean(resetReservedSeats),
      updatedBy: updatedBy || 'FiLi Administration',
    });

    const effectiveJob = getEffectiveJob(jobId);
    const breakdowns = getAllJobQuotaBreakdowns();
    res.json({
      success: true,
      message: `Updated custom role and quota settings for "${effectiveJob.title}".`,
      slotSettings: settings,
      job: effectiveJob,
      breakdowns,
    });
  });

  // Admin update skilled reservation quota percentage & scope
  // "so that only 25% of the jobs like tech team - or which students might already have skills in,
  // are reserved for skilled kids, but it can be controlled by the admin, if the admin wants,
  // the admin can change the percent reserved for all jobs"
  app.post('/api/admin/slots/skilled-reservation', (req, res) => {
    const { percent, scope, jobId, minSkillScore, skilledRequirement, resetJobOverride, applyToAllJobs, updatedBy } = req.body;
    const settings = updateSkilledReservationSettings({
      percent: percent !== undefined && percent !== null ? Number(percent) : undefined,
      scope,
      jobId,
      minSkillScore: minSkillScore !== undefined && minSkillScore !== null ? Number(minSkillScore) : undefined,
      skilledRequirement: typeof skilledRequirement === 'string' ? skilledRequirement : undefined,
      resetJobOverride: Boolean(resetJobOverride),
      applyToAllJobs: Boolean(applyToAllJobs),
      updatedBy: updatedBy || 'FiLi Administration',
    });

    const breakdowns = getAllJobQuotaBreakdowns();
    res.json({
      success: true,
      message: resetJobOverride
        ? `Reset ${jobId} to global skilled reservation settings.`
        : applyToAllJobs
        ? `Reserved skilled quota set to ${settings.skilledReservationPercent}% across all campus jobs.`
        : jobId
        ? `Updated skilled candidate settings for ${jobId}.`
        : `Default skilled reservation updated to ${settings.skilledReservationPercent}%.`,
      slotSettings: settings,
      breakdowns,
    });
  });

  // Admin set submission deadline
  app.post('/api/admin/slots/set-deadline', (req, res) => {
    try {
      const { deadline, updatedBy } = req.body;
      const settings = updateSubmissionDeadline(deadline || null, updatedBy || 'FiLi Administration');
      res.json({
        success: true,
        message: deadline
          ? `Submission deadline set to ${new Date(deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`
          : 'Submission deadline removed. Intake will remain open based on slot availability.',
        slotSettings: settings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update submission deadline' });
    }
  });

  // Admin set total middle school capacity
  app.post('/api/admin/slots/set-capacity', (req, res) => {
    try {
      const { capacity, updatedBy } = req.body;
      const numCapacity = Number(capacity);
      if (!capacity || isNaN(numCapacity) || numCapacity < 1) {
        return res.status(400).json({ error: 'Valid positive capacity number is required' });
      }
      const settings = updateTotalMaxCapacity(numCapacity, updatedBy || 'FiLi Administration');
      res.json({
        success: true,
        message: `Total cohort capacity updated to ${settings.totalMaxCapacity} students.`,
        slotSettings: settings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update capacity' });
    }
  });

  // API 404 handler - prevents API calls from falling through to Vite SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // API global error handler - guarantees JSON responses for all API errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error on path:', req.originalUrl, err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'An unexpected internal server error occurred.';
    res.status(status).json({
      error: message,
      status,
    });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FiLi Job Portal server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
