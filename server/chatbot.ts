import { GoogleGenAI } from '@google/genai';
import {
  getSlotSettings,
  getAllEffectiveJobs,
  getAllApplications,
  countJobApproved,
  getAllJobQuotaBreakdowns,
} from './store.js';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  geminiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return geminiClient;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StudentChatContext {
  email?: string;
  name?: string;
  hasSubmitted?: boolean;
  currentApplication?: {
    jobTitle: string;
    status: string;
    skillScore?: number;
    aiReasoning?: string;
    payout?: string;
  } | null;
  clientView?: string;
}

/**
 * Builds real-time context about the current state of the application.
 * This ensures Arsh always has 100% up-to-date data even if an admin
 * changed quotas, closed slots, fired students, or edited job details seconds ago.
 */
export function buildLiveAppContext(studentContext?: StudentChatContext): string {
  const settings = getSlotSettings();
  const effectiveJobs = getAllEffectiveJobs();
  const { applications, stats } = getAllApplications();
  const breakdowns = getAllJobQuotaBreakdowns();

  const isDeadlinePassed = Boolean(
    settings.submissionDeadline &&
      !isNaN(new Date(settings.submissionDeadline).getTime()) &&
      Date.now() > new Date(settings.submissionDeadline).getTime()
  );

  const deadlineFormatted = settings.submissionDeadline
    ? new Date(settings.submissionDeadline).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'No strict deadline set (intake is open while slots last)';

  const totalMaxCapacity = settings.totalMaxCapacity ?? 1180;
  const totalApproved = stats?.totalApproved ?? applications.filter((a) => a.status === 'Approved').length;
  const totalRemaining = Math.max(0, totalMaxCapacity - totalApproved);

  // Summarize all 19 jobs with live capacity
  const jobsSummary = effectiveJobs
    .map((j) => {
      const quota = settings.jobCustomQuotas?.[j.id] ?? j.totalQuota;
      const filled = countJobApproved(j.id);
      const isClosed = settings.closedJobIds.includes(j.id);
      const isFull = filled >= quota;
      const salary = settings.jobCustomSalaries?.[j.id]?.payout ?? j.payout;

      let statusStr = 'OPEN';
      if (!settings.globalSlotsOpen) statusStr = 'CLOSED (Global intake off)';
      else if (isDeadlinePassed) statusStr = 'CLOSED (Deadline passed)';
      else if (isClosed) statusStr = 'CLOSED by Admin';
      else if (isFull) statusStr = 'FULL (Waitlist only)';

      return `- **${j.title}** (ID: ${j.id}, Category: ${j.category}):
  * Monthly Salary: ${salary}
  * Capacity: ${filled}/${quota} filled (${Math.max(0, quota - filled)} spots remaining)
  * Current Status: ${statusStr}
  * Role Summary: ${j.description}
  * Key Requirements: ${j.requirements.slice(0, 3).join(', ')}`;
    })
    .join('\n');

  let studentInfoStr = 'Student is currently browsing as a guest/unauthenticated.';
  if (studentContext?.email) {
    studentInfoStr = `Currently signed-in student: ${studentContext.name || 'Student'} (${studentContext.email}).`;
    if (studentContext.currentApplication) {
      const app = studentContext.currentApplication;
      studentInfoStr += `\nApplication Record: Placed in "${app.jobTitle}" with status "${app.status}" (Score: ${app.skillScore ?? 'N/A'}/100, Salary: ${app.payout || 'N/A'}). AI Note: ${app.aiReasoning || 'Screened'}.`;
    } else {
      studentInfoStr += `\nApplication Record: Has NOT submitted an application yet.`;
    }
  }

  return `=== CURRENT REAL-TIME APP STATE (AUTOMATICALLY UPDATED) ===
• School: FiLi Middle School Campus Placement & Automated AI Screening Portal
• Global Applications Switch: ${settings.globalSlotsOpen ? 'OPEN (Accepting submissions)' : 'CLOSED by Admin'}
• Submission Deadline: ${deadlineFormatted} (Passed: ${isDeadlinePassed ? 'YES' : 'NO'})
• Cohort Capacity: ${totalApproved} approved / ${totalMaxCapacity} maximum campus spots (${totalRemaining} open spots across school)
• Skilled Reservation Quota: ${settings.skilledReservationPercent}% reserved for candidates with verified certificates/skills (Scope: ${settings.skilledReservationScope})
• Current Admin Notice: ${settings.noticeMessage || 'None'}
• User Context: ${studentInfoStr}
• Current Page View: ${studentContext?.clientView || 'Main Portal'}

=== ALL 19 CAMPUS JOBS & LIVE VACANCY STATUS ===
${jobsSummary}

=== OFFICIAL SCHOOL RULES & POLICIES (MANDATORY) ===
1. SINGLE-JOB RULE: Every middle school student can be in ONLY ONE job. Multi-jobs are strictly forbidden. If a student is already placed or taken in, they cannot submit for another job.
2. RE-APPLICATION RULE: Re-submitting an application is ONLY allowed for students who have been terminated/fired by school administration.
3. RESUME POLICY: Middle school students who DO NOT have a resume, have an unverified document, or have no experience are NEVER disqualified! They are automatically accepted into the general First-Come, First-Served (FCFS) slot with a score of 55-65. Students with accredited certificates/awards qualify for the 25% reserved skilled quota with high scores (85-98).
4. MANDATORY APPLICATION DETAILS: Full Legal Student Name, Google Student Email, Grade/Class (6th, 7th, 8th), Section (A, B, C, D...), and selected Job Role. PDF resume is optional but recommended if they have certificates.
5. PARENT ACCOUNTS: If a parent logs in for their child, they MUST provide the student's actual full name.
6. PDF RECEIPT: Upon submitting, students receive an official downloadable FiLi PDF confirmation receipt with a unique application ID and verification timestamp.
7. VOLUNTARY RESIGNATION: Students placed in a job have the option to voluntarily resign if they wish.
8. ADMIN CAPABILITIES: School administration can open/close slots, update salaries, change quotas, fire students, set deadlines, and manage student rosters.`;
}

/**
 * Executes a conversational turn with Arsh using Gemini.
 */
export async function chatWithArsh(params: {
  message: string;
  conversationHistory?: ChatMessage[];
  studentContext?: StudentChatContext;
}): Promise<{
  reply: string;
  suggestedActions?: string[];
  liveStatus: {
    globalOpen: boolean;
    remainingSpots: number;
    openJobsCount: number;
  };
}> {
  const { message, conversationHistory = [], studentContext } = params;
  const liveAppState = buildLiveAppContext(studentContext);

  const settings = getSlotSettings();
  const effectiveJobs = getAllEffectiveJobs();
  const isDeadlinePassed = Boolean(
    settings.submissionDeadline &&
      !isNaN(new Date(settings.submissionDeadline).getTime()) &&
      Date.now() > new Date(settings.submissionDeadline).getTime()
  );

  const openJobsCount = effectiveJobs.filter((j) => {
    const quota = settings.jobCustomQuotas?.[j.id] ?? j.totalQuota;
    const filled = countJobApproved(j.id);
    return settings.globalSlotsOpen && !isDeadlinePassed && !settings.closedJobIds.includes(j.id) && filled < quota;
  }).length;

  const totalMaxCapacity = settings.totalMaxCapacity ?? 1180;
  const { applications, stats } = getAllApplications();
  const totalApproved = stats?.totalApproved ?? applications.filter((a) => a.status === 'Approved').length;
  const remainingSpots = Math.max(0, totalMaxCapacity - totalApproved);

  const systemInstruction = `You are Arsh, the official AI campus placement assistant and guide for FiLi Middle School.
On the outside launcher button, you are called "FiLi Bot", but when students click or talk with you, your personal name is Arsh. Always introduce or refer to yourself as Arsh ("Hi! I'm Arsh, your FiLi campus guide!").

YOUR MISSION:
1. Explain to students how the FiLi Job Portal works, why campus jobs are mandatory for all 1,180 middle schoolers, and how they earn stipends/credits.
2. Walk students through the application process step-by-step whenever asked.
3. Answer any questions about all 19 jobs, open vacancies, requirements, salaries, and capacity.
4. Explain the school rules clearly (Single-job rule, Re-application after being fired, No-disqualification resume policy).
5. Always rely on the provided REAL-TIME APP STATE. You are omniscient about this app: you know every current quota, open/closed slot, deadline, and student status. If an admin changed anything, your state is automatically up-to-date!

STEP-BY-STEP APPLICATION WALKTHROUGH GUIDE (USE WHEN ASKED HOW TO APPLY OR FOR A WALKTHROUGH):
- Step 1: Sign in with your Google account via the Access Portal. (Parents can also sign in, but must enter the student's legal name).
- Step 2: Browse the 19 Job Positions in the Directory or Job List to find one that fits your interests (Tech, Creative, Leadership, Outdoors, Organization).
- Step 3: Check that the job status is "Open" and has available capacity.
- Step 4: Go to the Application Form. Fill in your Grade/Class (6th, 7th, 8th), Section (A, B, C...), and select your desired role.
- Step 5: (Optional) Upload a PDF Resume if you have certificates or awards. (Remind them: NO RESUME? No problem! You will still be placed in the general First-Come First-Served slot; you will NEVER be disqualified!).
- Step 6: Click "Submit Application" — our automated Gemini AI screening pipeline evaluates your submission immediately.
- Step 7: View your instant placement status and download your Official FiLi PDF Receipt!

STYLE & TONE:
- Friendly, warm, student-appropriate, knowledgeable, and upbeat.
- Use clear bullet points, bold key terms, and light emojis for readability.
- Be concise yet thorough. Avoid walls of unbroken text.
- If asked about specific jobs, cite their real monthly salary, current fill count, and remaining slots from the live data.
- If a student already has an approved application, remind them of the single-job rule: they are already placed and cannot apply for a second job unless terminated/fired by administration.`;

  const ai = getGeminiClient();

  if (ai) {
    const candidateModels = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    // Convert conversation history into contents format
    const contents: any[] = [];

    // Provide the dynamic live app state as high-priority context
    contents.push({
      role: 'user',
      parts: [{ text: `[SYSTEM SNAPSHOT OF REAL-TIME PORTAL DATA]\n${liveAppState}\n\nPlease acknowledge and keep this live state in mind for our conversation.` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: `Got it! I am Arsh, and I have synchronized with the live FiLi Job Portal data. I'm ready to help students with up-to-the-minute job openings, quotas, application walkthroughs, and school rules.` }],
    });

    // Append prior conversation history (up to last 10 turns)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }

    // Append user's new message
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            topP: 0.95,
          },
        });

        const reply = response.text?.trim();
        if (reply) {
          // Generate context-aware suggestions
          const suggestedActions = generateSuggestions(message, studentContext, openJobsCount);

          return {
            reply,
            suggestedActions,
            liveStatus: {
              globalOpen: settings.globalSlotsOpen && !isDeadlinePassed,
              remainingSpots,
              openJobsCount,
            },
          };
        }
      } catch (err: any) {
        console.warn(`[Arsh Chatbot] Error with model ${modelName}:`, err?.message || err);
        // Continue to fallback model
      }
    }
  }

  // Resilient heuristic fallback if Gemini API is unreachable or key not set
  const fallbackReply = generateFallbackReply(message, liveAppState, settings, studentContext, openJobsCount);
  return {
    reply: fallbackReply,
    suggestedActions: generateSuggestions(message, studentContext, openJobsCount),
    liveStatus: {
      globalOpen: settings.globalSlotsOpen && !isDeadlinePassed,
      remainingSpots,
      openJobsCount,
    },
  };
}

function generateSuggestions(message: string, studentContext?: StudentChatContext, openJobsCount = 0): string[] {
  const lower = message.toLowerCase();

  if (lower.includes('apply') || lower.includes('step') || lower.includes('walkthrough')) {
    return [
      'What jobs are currently open?',
      'Do I need a resume to get placed?',
      'Can I apply for multiple jobs?',
    ];
  }

  if (lower.includes('job') || lower.includes('open') || lower.includes('vacancy')) {
    return [
      'Walk me through the application steps',
      'Which jobs pay the highest stipend?',
      'Tell me about the AV Crew & Tech Support jobs',
    ];
  }

  if (studentContext?.currentApplication) {
    return [
      'How does the single-job rule work?',
      'Can I resign from my current position?',
      'Where can I download my PDF receipt?',
    ];
  }

  return [
    'How do I apply? (Step-by-step)',
    `Which jobs have open slots right now? (${openJobsCount} open)`,
    'Do I need experience or certificates?',
    'How do student salaries work?',
  ];
}

function generateFallbackReply(
  message: string,
  liveAppState: string,
  settings: any,
  studentContext?: StudentChatContext,
  openJobsCount = 0
): string {
  const lower = message.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('who are you')) {
    return `Hello! I'm **Arsh**, your personal FiLi Campus Placement Assistant! 🎓✨

I know all the details about our school's 19 job positions, live quota vacancies, application steps, and school rules. 

Currently, there are **${openJobsCount} positions with open slots**! How can I help you today?
- Ask me for a **step-by-step walkthrough** of how to apply.
- Ask me about **which jobs are open**.
- Ask about **salaries, certificates, or school policies**!`;
  }

  if (lower.includes('step') || lower.includes('how to apply') || lower.includes('walkthrough') || lower.includes('guide')) {
    return `Here is your **Official FiLi Step-by-Step Application Walkthrough**:

1. **Step 1: Sign In** — Head to the Access Portal and sign in with your official school Google account. (Parents can also log in on your behalf, but must include your full legal student name).
2. **Step 2: Browse Positions** — Look through our 19 campus jobs to find a role that fits your interests (Tech, Media, Athletics, Library, Arts, Stage, or Greenhouse).
3. **Step 3: Check Slot Availability** — Ensure the job has open capacity (FCFS is active!). Right now, **${openJobsCount} jobs are accepting applications**.
4. **Step 4: Complete the Form** — Enter your Grade (6th, 7th, 8th), Section (A, B, C...), and select your chosen job role.
5. **Step 5: Upload Resume (Optional)** — If you have certificates or credentials, upload a PDF resume. **Important: If you have no resume or no experience, do not worry! You will NEVER be disqualified.** You will simply be admitted into the general FCFS pool!
6. **Step 6: Submit & Get Placed** — Hit submit! Our automated Gemini AI screening pipeline evaluates your submission instantly.
7. **Step 7: Download Receipt** — Once placed, download your official FiLi PDF Confirmation Receipt with your unique tracking ID!`;
  }

  if (lower.includes('resume') || lower.includes('disqualif') || lower.includes('certificate') || lower.includes('experience')) {
    return `**Great news regarding resumes at FiLi Middle School:**

• **NO RESUME? NO EXPERIENCE? YOU ARE NEVER DISQUALIFIED!** 
Our school policy guarantees that entry-level middle schoolers without past experience or resumes are automatically placed directly into the general **First-Come, First-Served (FCFS) slot** with a score of 55–65.
• **Have Certificates or Accreditations?**
If you have verified certificates, awards, CPR/First Aid, or tech credentials, upload your PDF resume! You will qualify for the **25% reserved skilled quota** with a high score (85–98).`;
  }

  if (lower.includes('multiple') || lower.includes('two jobs') || lower.includes('more jobs')) {
    return `**Single-Job Policy (Strict School Rule):**

At FiLi Middle School, **multi-jobs are strictly forbidden**. 
- Each student is permitted to hold **only one job** at a time.
- If you are already placed or taken into a job, you cannot apply for another position.
- Re-submitting an application is **only allowed for students who have been terminated/fired by school administration** or who voluntarily resign.`;
  }

  return `I'm **Arsh**, your FiLi Campus Assistant! 🎓 

Here is what you should know about the portal right now:
- **Global Intake Status:** ${settings.globalSlotsOpen ? 'Open & accepting submissions' : 'Closed by Administration'}
- **Open Jobs:** ${openJobsCount} positions currently have vacancies.
- **Single-Job Rule:** Each student can hold only 1 job.
- **Resume Policy:** No resume or experience required; you are never disqualified!

Would you like me to walk you through how to submit your application step-by-step?`;
}
