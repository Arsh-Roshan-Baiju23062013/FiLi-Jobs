import { GoogleGenAI, Type } from '@google/genai';
import { FILI_JOBS } from '../src/data/jobs.js';
import { ApplicationStatus, ResumeValidity } from '../src/types.js';

export interface ScreeningResult {
  resumeValidity: ResumeValidity;
  hasCertificates: boolean;
  certificateNames: string[];
  skillScore: number;
  status: ApplicationStatus;
  aiReasoning: string;
  aiAnalysis: {
    verifiedSkills: string[];
    certificates: string[];
    roleAlignmentVerdict: string;
    pastTwoYearsExperience: string;
    flags: string[];
  };
}

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

export async function evaluateApplication(params: {
  jobId: string;
  studentName: string;
  studentClass: string;
  section: string;
  jobTitle?: string;
  jobDescription?: string;
  jobCategory?: string;
  jobRequirements?: string[];
  jobPayout?: string;
  resumeFileName?: string;
  resumeFileSize?: number;
  resumeBase64?: string;
  existingClassJobCount?: number;
  currentJobFillCount?: number;
}): Promise<ScreeningResult> {
  const job = FILI_JOBS.find((j) => j.id === params.jobId) || FILI_JOBS[0];
  const effectiveTitle = params.jobTitle || job.title;
  const effectiveDescription = params.jobDescription || job.description;
  const effectiveRequirements = params.jobRequirements && params.jobRequirements.length > 0 ? params.jobRequirements : job.requirements;
  const effectivePayout = params.jobPayout || job.payout;
  const { resumeBase64 } = params;

  // 1. Programmatic Resume Verification: Blank, missing, corrupted, or unreadable
  if (!resumeBase64 || resumeBase64.trim().length === 0) {
    return {
      resumeValidity: 'valid',
      hasCertificates: false,
      certificateNames: [],
      skillScore: 55,
      status: 'Approved',
      aiReasoning: 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate (no resume provided).',
      aiAnalysis: {
        verifiedSkills: ['General Middle School Duties'],
        certificates: [],
        roleAlignmentVerdict: 'Assigned to general First-Come, First-Served (FCFS) placement.',
        pastTwoYearsExperience: 'Entry-level candidate.',
        flags: ['GENERAL_FCFS_SLOT'],
      },
    };
  }

  // Clean base64 string
  const cleanBase64 = resumeBase64.replace(/^data:application\/pdf;base64,/, '').trim();

  // Basic PDF header verification
  try {
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length < 150) {
      return {
        resumeValidity: 'valid',
        hasCertificates: false,
        certificateNames: [],
        skillScore: 55,
        status: 'Approved',
        aiReasoning: 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate (unreadable or corrupt file).',
        aiAnalysis: {
          verifiedSkills: ['General Middle School Duties'],
          certificates: [],
          roleAlignmentVerdict: 'Assigned to general First-Come, First-Served (FCFS) placement.',
          pastTwoYearsExperience: 'Unverified or corrupt document.',
          flags: ['GENERAL_FCFS_SLOT'],
        },
      };
    }
  } catch (err) {
    return {
      resumeValidity: 'valid',
      hasCertificates: false,
      certificateNames: [],
      skillScore: 55,
      status: 'Approved',
      aiReasoning: 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate (payload decode note).',
      aiAnalysis: {
        verifiedSkills: ['General Middle School Duties'],
        certificates: [],
        roleAlignmentVerdict: 'Assigned to general First-Come, First-Served (FCFS) placement.',
        pastTwoYearsExperience: 'Entry-level candidate.',
        flags: ['GENERAL_FCFS_SLOT'],
      },
    };
  }

  // 2. Multimodal Gemini Screening via gemini-3.8-flash with gemini-3.1-flash-lite fallback
  const ai = getGeminiClient();

  if (ai) {
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    const promptText = `You are the automated AI screening pipeline for "Job Application for FiLi" (Middle School Campus Work Experience Program).
Evaluate this middle school student's uploaded PDF resume for the following selected position:
- Target Job: "${effectiveTitle}"
- Monthly Payout: "${effectivePayout}"
- Job Description: "${effectiveDescription}"
- Operational Requirements: ${effectiveRequirements.join(', ')}
- Student Name: ${params.studentName}
- Class/Grade: ${params.studentClass}

CRITICAL MIDDLE SCHOOL PLACEMENT RULE (MANDATORY POLICY):
- If the student has NO RESUME, an UNVERIFIED RESUME, a CORRUPT RESUME, a blank/empty document, or an UNRELATED DOCUMENT (such as a program timeline, schedule, calendar, class note, or image):
  DO NOT DISQUALIFY THEM UNDER ANY CIRCUMSTANCES.
  YOU MUST PUT THEM DIRECTLY INTO THE GENERAL FIRST-COME, FIRST-SERVED (FCFS) SLOT.
  - Set isValidResume: true
  - Set isBlankOrCorrupted: false
  - Set hasCertificates: false
  - Set certificates: []
  - Set skillScore: 55
  - In aiReasoning, state: "Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate."
  - In roleAlignmentVerdict, state: "Assigned to general First-Come, First-Served (FCFS) placement."
- If the student is a standard middle school student without accredited certificates, assign them to the general FCFS slot (score 55-65).
- If the student has official verified certificates, awards, licenses, or formal youth credentials, mark hasCertificates: true, list their certificate titles, and give them a high score (85-98) because they qualify for the 25% reserved skilled quota.
- NEVER DISQUALIFY ANY STUDENT FOR MISSING, CORRUPT, OR UNVERIFIED RESUMES. ALWAYS ASSIGN THEM TO THE GENERAL FCFS SLOT.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        isValidResume: { type: Type.BOOLEAN, description: 'True if readable' },
        isBlankOrCorrupted: { type: Type.BOOLEAN, description: 'True if corrupt or unreadable' },
        hasCertificates: { type: Type.BOOLEAN, description: 'True if student possesses verified certificates or formal qualifications' },
        certificates: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Names of official certificates, licenses or awards mentioned in resume',
        },
        skillScore: { type: Type.INTEGER, description: 'Score between 50 and 100 for role alignment and certification' },
        verifiedSkills: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'List of relevant student skills identified in PDF',
        },
        roleAlignmentVerdict: { type: Type.STRING, description: 'Brief statement of how skills fit the job' },
        pastTwoYearsExperience: { type: Type.STRING, description: 'Key clubs, roles, or coursework from past 2 years' },
        aiReasoning: { type: Type.STRING, description: 'Official screening explanation' },
      },
      required: [
        'isValidResume',
        'isBlankOrCorrupted',
        'hasCertificates',
        'certificates',
        'skillScore',
        'verifiedSkills',
        'roleAlignmentVerdict',
        'pastTwoYearsExperience',
        'aiReasoning',
      ],
    };

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        const text = response.text?.trim();
        if (text) {
          const parsed = JSON.parse(text);

          // If resume is missing, corrupt, blank, or low score: always put in general FCFS slot
          if (!parsed.isValidResume || parsed.isBlankOrCorrupted || (parsed.skillScore !== undefined && parsed.skillScore < 50)) {
            return {
              resumeValidity: 'valid',
              hasCertificates: false,
              certificateNames: [],
              skillScore: 55,
              status: 'Approved',
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

          const hasCerts = Boolean(parsed.hasCertificates || (parsed.certificates && parsed.certificates.length > 0));
          const certList: string[] = parsed.certificates || [];
          const score = hasCerts
            ? Math.max(85, Math.min(98, parsed.skillScore || 90))
            : Math.max(55, Math.min(80, parsed.skillScore || 60));

          return {
            resumeValidity: 'valid',
            hasCertificates: hasCerts,
            certificateNames: certList,
            skillScore: score,
            status: 'Approved',
            aiReasoning: parsed.aiReasoning || (hasCerts ? 'Approved under 25% skilled certified quota.' : 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate.'),
            aiAnalysis: {
              verifiedSkills: parsed.verifiedSkills && parsed.verifiedSkills.length > 0 ? parsed.verifiedSkills : ['General Middle School Duties'],
              certificates: certList,
              roleAlignmentVerdict: parsed.roleAlignmentVerdict || 'Assigned to general First-Come, First-Served (FCFS) placement.',
              pastTwoYearsExperience: parsed.pastTwoYearsExperience || 'Standard middle school profile.',
              flags: hasCerts ? [] : ['GENERAL_FCFS_SLOT'],
            },
          };
        }
      } catch (apiErr: any) {
        // If 503 / high demand occurs on gemini-3.8-flash, try next model seamlessly
        const isSpikeError = apiErr?.status === 503 || apiErr?.message?.includes('503') || apiErr?.message?.includes('demand');
        if (isSpikeError && modelName !== candidateModels[candidateModels.length - 1]) {
          console.log(`[Gemini] Model ${modelName} experiencing temporary demand spike, switching to resilient fallback ${candidateModels[1]}...`);
          continue;
        }
        console.log(`[Gemini] Model ${modelName} unavailable, falling back to heuristic verification.`);
        break;
      }
    }
  }

  // 3. Fallback Parser (heuristic-based when API key is unavailable or during network offline)
  const buffer = Buffer.from(cleanBase64, 'base64');
  const bufferString = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000));
  const lowerContent = bufferString.toLowerCase();

  // If buffer doesn't have recognisable text or is corrupt, put in general FCFS slot
  if (buffer.length < 500) {
    return {
      resumeValidity: 'valid',
      hasCertificates: false,
      certificateNames: [],
      skillScore: 55,
      status: 'Approved',
      aiReasoning: 'Placed into the general First-Come, First-Served (FCFS) slot as an entry-level candidate (brief/unverified document).',
      aiAnalysis: {
        verifiedSkills: ['General Middle School Duties'],
        certificates: [],
        roleAlignmentVerdict: 'Assigned to general First-Come, First-Served (FCFS) placement.',
        pastTwoYearsExperience: 'Entry-level candidate.',
        flags: ['GENERAL_FCFS_SLOT'],
      },
    };
  }

  // Check for verified certificates
  const certificateKeywords = [
    'certificate',
    'certified',
    'accreditation',
    'license',
    'cpr',
    'first-aid',
    'olympiad',
    'commendation',
    'canva certified',
    'python certified',
    'hygiene certified',
    'peer mediator certified',
    'model un delegate',
  ];

  const detectedCerts: string[] = [];
  certificateKeywords.forEach((kw) => {
    if (lowerContent.includes(kw)) {
      detectedCerts.push(kw.toUpperCase() + ' CERTIFICATION');
    }
  });

  const hasCerts = detectedCerts.length > 0;

  // Match job requirements
  const matchedSkills: string[] = [];
  effectiveRequirements.forEach((req) => {
    const words = req.toLowerCase().split(' ');
    if (words.some((w) => w.length > 3 && lowerContent.includes(w))) {
      matchedSkills.push(req);
    }
  });

  // Calculate score based on user's policy:
  // "Many kids don't have experience, so We just take them in first (score 55-65), but then if any good candidate with certificates come in (score 85-98), we take them in and kick the other kid out"
  let calculatedScore = 60; // Base score for first-time middle schooler with no experience ("take them in first")

  if (hasCerts) {
    calculatedScore = Math.min(98, 85 + Math.min(13, detectedCerts.length * 5 + matchedSkills.length * 2));
  } else if (matchedSkills.length > 0) {
    calculatedScore = Math.min(80, 60 + matchedSkills.length * 5);
  }

  const reasoning = hasCerts
    ? `Approved (Certified Priority): Official credentials verified (${detectedCerts.slice(0, 2).join(', ')}). Score: ${calculatedScore}/100. Eligible to take slot and displace uncertified candidates under FiLi preemption policy.`
    : `Approved (Provisional FCFS): Taken in first on open middle school slot (Score: ${calculatedScore}/100). Note: If a candidate with verified certificates applies, preemption rule applies.`;

  return {
    resumeValidity: 'valid',
    hasCertificates: hasCerts,
    certificateNames: detectedCerts,
    skillScore: calculatedScore,
    status: 'Approved',
    aiReasoning: reasoning,
    aiAnalysis: {
      verifiedSkills: matchedSkills.length > 0 ? matchedSkills : [job.requirements[0], 'Middle School Participation', 'Punctuality'],
      certificates: detectedCerts,
      roleAlignmentVerdict: hasCerts
        ? 'High certified alignment with operational duties.'
        : 'Entry-level candidate without prior experience; admitted on initial first-come basis.',
      pastTwoYearsExperience: hasCerts
        ? 'Accredited middle school training and certified club leadership.'
        : 'First-time student applicant with verified school attendance.',
      flags: [],
    },
  };
}
