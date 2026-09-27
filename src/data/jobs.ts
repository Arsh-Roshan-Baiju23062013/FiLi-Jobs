import { FiLiJob } from '../types';

export const FILI_JOBS: FiLiJob[] = [
  {
    id: 'cafeteria-queue',
    title: 'Cafeteria Queue Manager',
    payout: '200 BRAED/Month',
    payoutAmount: 200,
    category: 'Operations',
    totalQuota: 70,
    description: 'Ensure orderly lunch queues, maintain noise discipline, assist younger peers, and prevent food tray congestion.',
    requirements: ['Calm assertiveness', 'Patience', 'Conflict de-escalation', 'Consistent daily attendance']
  },
  {
    id: 'bus-recycling',
    title: 'Bus & Recycling Team',
    payout: '220 BRAED/Month',
    payoutAmount: 220,
    category: 'Operations',
    totalQuota: 65,
    description: 'Monitor eco-bin sorting, facilitate orderly school bus loading, track waste diversion metrics, and supervise campus recycling hubs.',
    requirements: ['Environmental awareness', 'Physical diligence', 'Safety compliance', 'Team coordination']
  },
  {
    id: 'student-banking',
    title: 'Student Banking Staff',
    payout: '220 BRAED/Month',
    payoutAmount: 220,
    category: 'Student Services',
    totalQuota: 45,
    isSkilledRole: true,
    description: 'Operate the campus BRAED credit ledger, stamp deposit slips, reconcile student point passes, and safeguard transactional receipts.',
    requirements: ['Basic arithmetic & ledger accuracy', 'Absolute honesty & integrity', 'Attention to detail', 'Confidentiality']
  },
  {
    id: 'entrepreneurship-market',
    title: 'Entrepreneurship Market Team',
    payout: '300 BRAED/Month',
    payoutAmount: 300,
    category: 'Student Services',
    totalQuota: 60,
    description: 'Organize student pop-up markets, manage stall allocation, track retail turnover, and foster middle school micro-enterprises.',
    requirements: ['Sales and marketing enthusiasm', 'Basic bookkeeping', 'Merchandise organization', 'Proactive problem solving']
  },
  {
    id: 'school-store',
    title: 'School Store Assistant',
    payout: '200 BRAED/Month',
    payoutAmount: 200,
    category: 'Student Services',
    totalQuota: 55,
    description: 'Restock stationery, uniform badges, and classroom notebooks; handle BRAED token exchanges and maintain tidy inventory shelves.',
    requirements: ['Friendly customer service', 'Accurate stock replenishment', 'Reliability during morning & recess hours']
  },
  {
    id: 'event-org',
    title: 'Event Organization Team',
    payout: '300 BRAED/Month',
    payoutAmount: 300,
    category: 'Media & Arts',
    totalQuota: 75,
    description: 'Plan school cultural galas, sports days, and academic fairs; arrange seating layouts, banners, cue sheets, and backstage logistics.',
    requirements: ['Logistical planning', 'High stamina & teamwork', 'Time management', 'Coordination under pressure']
  },
  {
    id: 'photo-media',
    title: 'Photography & Media Team',
    payout: '300 BRAED/Month',
    payoutAmount: 300,
    category: 'Media & Arts',
    totalQuota: 50,
    isSkilledRole: true,
    description: 'Capture high-resolution photos and video clips of school activities, manage digital archives, and support the yearbook production.',
    requirements: ['Camera framing skills', 'Basic photo editing', 'Respect for student privacy', 'Equipment care']
  },
  {
    id: 'digital-poster',
    title: 'Digital Poster Designer',
    payout: '240 BRAED/Month',
    payoutAmount: 240,
    category: 'Media & Arts',
    totalQuota: 45,
    isSkilledRole: true,
    description: 'Design captivating digital posters, announcements, and display board graphics using Canva or graphic software for campus initiatives.',
    requirements: ['Eye for visual typography & color', 'Familiarity with digital design tools', 'Ability to meet tight deadlines']
  },
  {
    id: 'school-news',
    title: 'School News Management',
    payout: '330 BRAED/Month',
    payoutAmount: 330,
    category: 'Media & Arts',
    totalQuota: 40,
    isSkilledRole: true,
    description: 'Interview teachers and club presidents, author feature articles for the bi-weekly FiLi Gazette, and maintain high journalistic integrity.',
    requirements: ['Strong writing & editing skills', 'Curiosity and investigative questions', 'Grammar precision', 'Fact-checking']
  },
  {
    id: 'discipline-mgmt',
    title: 'Discipline Management',
    payout: '300 BRAED/Month',
    payoutAmount: 300,
    category: 'Governance',
    totalQuota: 65,
    description: 'Assist prefects with morning uniform checks, corridor order, locker area inspections, and reporting minor infractions with fairness.',
    requirements: ['Firm yet respectful demeanor', 'Strong personal discipline', 'Fair judgment', 'Zero favoritism']
  },
  {
    id: 'assembly-presentation',
    title: 'Assembly Presentation Team',
    payout: '250 BRAED/Month',
    payoutAmount: 250,
    category: 'Governance',
    totalQuota: 45,
    isSkilledRole: true,
    description: 'Host Monday morning assemblies, recite student pledges, deliver weekly reminders, and operate auditorium podium microphones.',
    requirements: ['Clear voice projection', 'Confidence in front of 600+ students', 'Stage presence', 'Script memorization']
  },
  {
    id: 'tech-support',
    title: 'Tech Support Team',
    payout: '300 BRAED/Month',
    payoutAmount: 300,
    category: 'STEM & Health',
    totalQuota: 55,
    isSkilledRole: true,
    description: 'Troubleshoot interactive classroom smartboards, manage Chromebook charging carts, resolve HDMI audio cords, and assist IT teachers.',
    requirements: ['Basic computer hardware & cable troubleshooting', 'Patience with non-technical users', 'Methodical diagnosis']
  },
  {
    id: 'garden-sustainability',
    title: 'Garden & Sustainability Team',
    payout: '210 BRAED/Month',
    payoutAmount: 210,
    category: 'Operations',
    totalQuota: 55,
    description: 'Tend to the middle school greenhouse, water hydroponic herbs, monitor organic compost bins, and study plant growth cycles.',
    requirements: ['Love for plants and nature', 'Diligence with routine watering chores', 'Weather adaptability', 'Outdoor work']
  },
  {
    id: 'health-wellness',
    title: 'Health & Wellness Team',
    payout: '220 BRAED/Month',
    payoutAmount: 220,
    category: 'STEM & Health',
    totalQuota: 50,
    description: 'Assist the campus nurse, check first-aid kit supplies, lead stretching sessions, and champion mental wellness & sleep awareness campaigns.',
    requirements: ['Empathy and warm listening skills', 'Basic first-aid awareness', 'Discretion with medical notes', 'Hygiene standards']
  },
  {
    id: 'innovation-2',
    title: 'Innovation 2.0 Team',
    payout: '350 BRAED/Month',
    payoutAmount: 350,
    category: 'STEM & Health',
    totalQuota: 40,
    isSkilledRole: true,
    description: 'Lead makerspace 3D printing, program Arduino/micro:bit gadgets, prototype solutions for campus life problems, and mentor junior coders.',
    requirements: ['Coding, electronics or 3D modeling experience', 'Creative engineering mindset', 'Trial-and-error persistence']
  },
  {
    id: 'supervision-team',
    title: 'Supervision Team',
    payout: '250 BRAED/Month',
    payoutAmount: 250,
    category: 'Governance',
    totalQuota: 70,
    description: 'Supervise playground sports courts during morning and lunch breaks, maintain fair ball rotation, and alert duty teachers of hazards.',
    requirements: ['Attentive observational focus', 'Fair rule enforcement', 'Quick response to emergencies', 'Reliability']
  },
  {
    id: 'surprise-team',
    title: 'Surprise Team',
    payout: '280 BRAED/Month',
    payoutAmount: 280,
    category: 'Events & Campus Life',
    totalQuota: 125,
    description: 'Plan spontaneous events, organize secret appreciation days for staff, coordinate campus scavenger hunts, and boost school morale through unexpected positive initiatives.',
    requirements: ['Creativity', 'Event planning skills', 'Positive energy', 'Team collaboration']
  },
  {
    id: 'tax-mgmt-team',
    title: 'Tax Management Team',
    payout: '320 BRAED/Month',
    payoutAmount: 320,
    category: 'Financial Services',
    totalQuota: 130,
    isSkilledRole: true,
    description: 'Calculate and collect monthly BRAED tax percentages from student businesses, audit class-level tax forms, manage revenue sheets, and report anomalies to the central reserve.',
    requirements: ['High mathematical accuracy', 'Data entry & spreadsheet skills', 'Honesty and integrity', 'Attention to detail']
  }
];

export const TOTAL_MIDDLE_SCHOOL_CAPACITY = FILI_JOBS.reduce((acc, j) => acc + j.totalQuota, 0);

export function isJobSkilledRole(jobId: string): boolean {
  const job = FILI_JOBS.find((j) => j.id === jobId);
  return Boolean(job?.isSkilledRole);
}

export function getSkilledJobs(): FiLiJob[] {
  return FILI_JOBS.filter((j) => j.isSkilledRole);
}
