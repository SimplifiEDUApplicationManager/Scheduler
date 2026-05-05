export type SubjectConf = 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
export type TutorStatus = 'active' | 'onboarding';
export type RequestSource = 'asana' | 'manual';
export type RequestStatus = 'open' | 'matched';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type AtRiskSeverity = 'high' | 'medium';

/** A day-of-week / start-time / end-time availability window (times in 24h decimal). */
export interface Tuple {
  day: number;   // 0 = Sun … 6 = Sat
  start: number; // e.g. 16 = 4 pm
  end: number;   // e.g. 19 = 7 pm
}

/** Availability map: day → array of [start, end] windows. */
export type Availability = Record<number, [number, number][]>;

export interface TutorSubject {
  id: string;       // subject_id
  rowId?: string;   // tutor_subjects row id — present when fetched from DB
  conf: SubjectConf;
  qualificationNote?: string;
}

export interface Tutor {
  id: string;
  initials: string;
  name: string;
  email: string;
  tz: string;
  bio: string;
  personality: string;
  status: TutorStatus;
  subjects: TutorSubject[];
  availability: Availability;
  hoursCurrent: number;
  hoursMax: number;
  hoursMin: number;
}

export interface TuitionRequest {
  id: string;
  source: RequestSource;
  studentName: string;
  studentEmail: string;
  subject: string;
  subjectId: string;
  tuples: Tuple[];
  tz: string;
  startDate: string;
  receivedAt: string;
  notes: string;
  status: RequestStatus;
  matchedTutorId?: string;
}

export interface Invitation {
  id: string;
  tutorId: string;
  requestId?: string;
  studentName: string;
  subject: string;
  sentAt: string;
  sentBy: string;
  status: InvitationStatus;
  declineReason?: string;
}

export interface AtRiskStudent {
  name: string;
  subject: string;
  tutor: string;
  reason: string;
  severity: AtRiskSeverity;
}

export interface Subject {
  id: string;
  name: string;
  cat: string;
}

export const SUBJECTS: Subject[] = [
  { id: 'apcalcbc',  name: 'AP Calculus BC',  cat: 'STEM'      },
  { id: 'apcalcab',  name: 'AP Calculus AB',  cat: 'STEM'      },
  { id: 'apphysc',   name: 'AP Physics C',    cat: 'STEM'      },
  { id: 'apphys1',   name: 'AP Physics 1',    cat: 'STEM'      },
  { id: 'apchem',    name: 'AP Chemistry',    cat: 'STEM'      },
  { id: 'apbio',     name: 'AP Biology',      cat: 'STEM'      },
  { id: 'satmath',   name: 'SAT Math',        cat: 'Test Prep' },
  { id: 'satverb',   name: 'SAT Verbal',      cat: 'Test Prep' },
  { id: 'actmath',   name: 'ACT Math',        cat: 'Test Prep' },
  { id: 'mcat',      name: 'MCAT',            cat: 'Test Prep' },
  { id: 'apstat',    name: 'AP Statistics',   cat: 'STEM'      },
  { id: 'algii',     name: 'Algebra II',      cat: 'STEM'      },
  { id: 'apenglang', name: 'AP English Lang', cat: 'Humanities'},
  { id: 'apushist',  name: 'AP US History',   cat: 'Humanities'},
  { id: 'spanish',   name: 'Spanish',         cat: 'Languages' },
  { id: 'french',    name: 'French',          cat: 'Languages' },
  { id: 'writing',   name: 'Writing',         cat: 'Humanities'},
];

export const TUTORS: Tutor[] = [
  {
    id: 't-julia', initials: 'JH', name: 'Julia Hering', status: 'active',
    email: 'julia.hering@simplifiedu.com', tz: 'America/New_York',
    bio: 'Julia holds a BS in Mathematics from Cornell and has 4 years of tutoring experience across AP STEM subjects. She specializes in building conceptual intuition before drilling problem sets.',
    personality: 'Patient and methodical — she never moves on until the student demonstrates understanding, not just the right answer.',
    subjects: [
      { id: 'apcalcbc', conf: 'HIGH'   },
      { id: 'apcalcab', conf: 'HIGH'   },
      { id: 'apphysc',  conf: 'HIGH'   },
      { id: 'apchem',   conf: 'MEDIUM' },
    ],
    availability: { 1: [[15,20]], 2: [[9,12],[16,19]], 3: [[15,20]], 4: [[9,12]], 5: [[13,17]] },
    hoursCurrent: 14, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-katrina', initials: 'KA', name: 'Katrina Anderson', status: 'active',
    email: 'katrina.anderson@simplifiedu.com', tz: 'America/Chicago',
    bio: 'Katrina is a second-year medical student who scored in the 99th percentile on the MCAT. She tutors life sciences and test prep with a focus on pre-med students navigating a heavy courseload.',
    personality: 'High-energy and motivating — she meets students where they are and pushes them incrementally without overwhelming them.',
    subjects: [
      { id: 'apbio',  conf: 'HIGH' },
      { id: 'apchem', conf: 'HIGH' },
      { id: 'mcat',   conf: 'HIGH' },
    ],
    availability: { 1: [[17,21]], 3: [[17,21]], 6: [[10,14]] },
    hoursCurrent: 18, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-elisa', initials: 'EK', name: 'Elisa Kim', status: 'active',
    email: 'elisa.kim@simplifiedu.com', tz: 'America/Los_Angeles',
    bio: 'Elisa is a native French speaker and heritage Korean speaker who earned her MA in Linguistics from UCLA. She tutors modern languages and writing with a focus on fluency over rote grammar.',
    personality: 'Warm and conversational — sessions feel like a natural dialogue, which helps anxious students open up.',
    subjects: [
      { id: 'spanish', conf: 'HIGH'   },
      { id: 'french',  conf: 'HIGH'   },
      { id: 'writing', conf: 'MEDIUM' },
    ],
    availability: { 1: [[14,19]], 2: [[14,19]], 3: [[14,19]], 4: [[14,19]] },
    hoursCurrent: 10, hoursMax: 22, hoursMin: 6,
  },
  {
    id: 't-chris', initials: 'CD', name: 'Chris Davis', status: 'active',
    email: 'chris.davis@simplifiedu.com', tz: 'America/New_York',
    bio: 'Chris has a BS in Statistics from Carnegie Mellon and worked as a data analyst before transitioning full-time to tutoring. He excels at making quantitative reasoning click for students who "just aren\'t math people."',
    personality: 'Direct and structured — he teaches in clear steps, calls out common traps, and uses a lot of worked examples.',
    subjects: [
      { id: 'apstat',  conf: 'HIGH'   },
      { id: 'satmath', conf: 'HIGH'   },
      { id: 'actmath', conf: 'MEDIUM' },
      { id: 'algii',   conf: 'HIGH'   },
    ],
    availability: { 1: [[16,20]], 2: [[16,20]], 3: [[16,20]], 4: [[16,20]], 5: [[10,14]] },
    hoursCurrent: 6, hoursMax: 25, hoursMin: 6,
  },
  {
    id: 't-robbie', initials: 'RM', name: 'Robbie Maillard', status: 'onboarding',
    email: 'robbie.maillard@simplifiedu.com', tz: 'America/Chicago',
    bio: 'Robbie is completing his MFA in Creative Writing at Northwestern. He specializes in analytical writing and verbal reasoning, with a track record of dramatically improving student essay scores.',
    personality: 'Socratic — he rarely gives answers directly, instead guiding students to articulate their own reasoning on paper.',
    subjects: [
      { id: 'writing',   conf: 'HIGH'    },
      { id: 'apenglang', conf: 'MEDIUM'  },
      { id: 'satverb',   conf: 'UNPROVEN'},
    ],
    availability: { 2: [[18,21]], 3: [[18,21]], 6: [[9,13]] },
    hoursCurrent: 4, hoursMax: 18, hoursMin: 6,
  },
  {
    id: 't-steven', initials: 'SK', name: 'Steven Kuhn', status: 'active',
    email: 'steven.kuhn@simplifiedu.com', tz: 'America/Denver',
    bio: 'Steven taught high school AP History and English for six years before moving to private tutoring. He brings a classroom teacher\'s perspective — deep knowledge of rubrics and what graders actually want.',
    personality: 'Calm and thorough — he helps students slow down and read critically, which often transforms their written output.',
    subjects: [
      { id: 'apushist',  conf: 'HIGH' },
      { id: 'apenglang', conf: 'HIGH' },
    ],
    availability: { 1: [[15,19]], 2: [[15,19]], 4: [[15,19]], 6: [[10,14]] },
    hoursCurrent: 12, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-sahana', initials: 'SN', name: 'Sahana Nateson', status: 'active',
    email: 'sahana.nateson@simplifiedu.com', tz: 'America/Los_Angeles',
    bio: 'Sahana is a senior at UC Berkeley double-majoring in Mathematics and Statistics. She tutors foundational math and test prep, with particular success helping students bridge the gap between Algebra II and calculus.',
    personality: 'Encouraging and precise — she has a talent for identifying the exact conceptual gap that is causing a student\'s errors.',
    subjects: [
      { id: 'algii',    conf: 'HIGH'   },
      { id: 'apcalcab', conf: 'MEDIUM' },
      { id: 'satmath',  conf: 'MEDIUM' },
    ],
    availability: { 1: [[9,12]], 3: [[9,12]], 5: [[14,18]] },
    hoursCurrent: 22, hoursMax: 22, hoursMin: 6,
  },
  {
    id: 't-maya', initials: 'MP', name: 'Maya Patel', status: 'active',
    email: 'maya.patel@simplifiedu.com', tz: 'America/New_York',
    bio: 'Maya is a physics PhD student at Columbia specializing in experimental mechanics. She tutors AP Physics with a lab-science lens — connecting abstract equations to real physical intuition.',
    personality: 'Enthusiastic and visual — she draws a lot of diagrams and loves when a student has an "aha" moment.',
    subjects: [
      { id: 'apphys1', conf: 'HIGH'    },
      { id: 'apphysc', conf: 'MEDIUM'  },
      { id: 'apchem',  conf: 'UNPROVEN'},
    ],
    availability: { 0: [[10,14]], 2: [[16,21]], 4: [[16,21]] },
    hoursCurrent: 8, hoursMax: 24, hoursMin: 6,
  },
];

export const REQUESTS: TuitionRequest[] = [
  {
    id: 'req-1', source: 'asana', status: 'open', receivedAt: '2h ago',
    studentName: 'Ava Rodriguez', studentEmail: 'ava.rodriguez@gmail.com',
    subject: 'AP Calculus BC', subjectId: 'apcalcbc',
    tuples: [{ day: 1, start: 17, end: 20 }, { day: 3, start: 18, end: 21 }],
    tz: 'America/New_York', startDate: 'May 6',
    notes: 'Junior, preparing for May exam. Needs help with series and parametric.',
  },
  {
    id: 'req-2', source: 'asana', status: 'open', receivedAt: 'Yesterday',
    studentName: 'Liam Chen', studentEmail: 'liam.chen@gmail.com',
    subject: 'SAT Math', subjectId: 'satmath',
    tuples: [{ day: 2, start: 16, end: 19 }, { day: 4, start: 16, end: 19 }],
    tz: 'America/Los_Angeles', startDate: 'May 10',
    notes: 'Target score 780+. Currently 680.',
  },
  {
    id: 'req-3', source: 'manual', status: 'open', receivedAt: '3 days ago',
    studentName: 'Zoe Kaplan', studentEmail: 'zoe.kaplan@gmail.com',
    subject: 'AP Physics C', subjectId: 'apphysc',
    tuples: [{ day: 2, start: 15, end: 18 }, { day: 4, start: 15, end: 18 }],
    tz: 'America/Chicago', startDate: 'ASAP',
    notes: 'Mechanics only. E&M is covered at school.',
  },
  {
    id: 'req-4', source: 'asana', status: 'open', receivedAt: '4h ago',
    studentName: 'Mateo Ruiz', studentEmail: 'mateo.ruiz@gmail.com',
    subject: 'Spanish', subjectId: 'spanish',
    tuples: [{ day: 1, start: 15, end: 17 }, { day: 3, start: 15, end: 17 }],
    tz: 'America/New_York', startDate: 'May 12',
    notes: 'Heritage speaker. Weak on formal writing.',
  },
  {
    id: 'req-5', source: 'asana', status: 'open', receivedAt: '5h ago',
    studentName: 'Priya Desai', studentEmail: 'priya.desai@gmail.com',
    subject: 'MCAT', subjectId: 'mcat',
    tuples: [{ day: 0, start: 10, end: 13 }, { day: 6, start: 10, end: 13 }],
    tz: 'America/Chicago', startDate: 'May 18',
    notes: 'Retaking in September. Needs CARS boost.',
  },
  {
    id: 'req-6', source: 'manual', status: 'open', receivedAt: 'Yesterday',
    studentName: 'Jackson Wu', studentEmail: 'jackson.wu@gmail.com',
    subject: 'AP Statistics', subjectId: 'apstat',
    tuples: [{ day: 2, start: 17, end: 19 }, { day: 4, start: 17, end: 19 }],
    tz: 'America/Denver', startDate: 'May 7',
    notes: 'Senior. First AP. Nervous.',
  },
  {
    id: 'req-7', source: 'asana', status: 'open', receivedAt: '2 days ago',
    studentName: 'Hannah Kim', studentEmail: 'hannah.kim@gmail.com',
    subject: 'AP English Lang', subjectId: 'apenglang',
    tuples: [{ day: 2, start: 16, end: 18 }, { day: 5, start: 10, end: 12 }],
    tz: 'America/New_York', startDate: 'ASAP',
    notes: 'Needs essay structure help urgently.',
  },
  {
    id: 'req-8', source: 'asana', status: 'matched', receivedAt: '1 week ago',
    studentName: 'Oliver Grant', studentEmail: 'oliver.grant@gmail.com',
    subject: 'AP Chemistry', subjectId: 'apchem',
    tuples: [{ day: 1, start: 17, end: 19 }, { day: 3, start: 17, end: 19 }],
    tz: 'America/New_York', startDate: 'Apr 21',
    notes: 'Sophomore. Strong math.',
    matchedTutorId: 't-katrina',
  },
];

export const INVITATIONS: Invitation[] = [
  {
    id: 'inv-1', tutorId: 't-julia',  requestId: 'req-1',
    studentName: 'Ava Rodriguez', subject: 'AP Calculus BC',
    sentAt: '2h ago', sentBy: 'Meg Adams', status: 'pending',
  },
  {
    id: 'inv-2', tutorId: 't-maya',   requestId: 'req-3',
    studentName: 'Marcus Webb', subject: 'AP Physics C',
    sentAt: 'Yesterday', sentBy: 'Meg Adams', status: 'pending',
  },
  {
    id: 'inv-3', tutorId: 't-chris',  requestId: 'req-2',
    studentName: 'Liam Chen', subject: 'SAT Math',
    sentAt: '3h ago', sentBy: 'Meg Adams', status: 'accepted',
  },
  {
    id: 'inv-4', tutorId: 't-robbie', requestId: 'req-7',
    studentName: 'Sienna Park', subject: 'Essay Writing',
    sentAt: '2d ago', sentBy: 'Meg Adams', status: 'declined',
    declineReason: 'Schedule conflict — committed hours are full for May.',
  },
  {
    id: 'inv-5', tutorId: 't-elisa',  requestId: 'req-4',
    studentName: 'Noa Friedman', subject: 'Spanish',
    sentAt: '4d ago', sentBy: 'Meg Adams', status: 'expired',
  },
];

export interface Hold {
  id: string;
  tutorId: string;
  coordinatorName: string;
  day: number;   // 0–6
  start: number; // decimal hour
  end: number;
  reason: string;
}

export const HOLDS: Hold[] = [
  { id: 'h-1', tutorId: 't-julia', coordinatorName: 'Austin', day: 1, start: 16,   end: 17.5, reason: 'Internal review'    },
  { id: 'h-2', tutorId: 't-chris', coordinatorName: 'Austin', day: 3, start: 16,   end: 17,   reason: 'Trial session eval'  },
];

// ── Tutor calendar ────────────────────────────────────────────────────────

export type TutorEventKind = 'session' | 'other';
export type TutorEventStatus = 'upcoming' | 'completed' | 'cancelled';

export interface TutorEvent {
  id: string;
  day: number;             // 0=Sun … 6=Sat (recurring day-of-week)
  start: number;           // decimal hour, e.g. 15 = 3 PM
  end: number;
  title: string;
  kind: TutorEventKind;
  status: TutorEventStatus;
  studentName?: string;
  studentInitials?: string;
  subject?: string;
  recurring?: boolean;
}

export type TutorProposalStatus = 'pending' | 'accepted' | 'declined';

export interface TutorProposal {
  id: string;
  studentName: string;
  studentEmail: string;
  subject: string;
  tuples: Tuple[];
  startDate: string;
  hoursPerWeek: number;
  notes: string;
  coordinator: string;
  coordinatorEmail?: string;
  sentAt: string;
  status: TutorProposalStatus;
  declineReason?: string;
  tz: string;
  rationale?: string;
  studentGrade?: string;
}

export const ME_TUTOR_ID = 't-julia';

// Julia Hering's recurring weekly sessions + one-off events
export const TUTOR_EVENTS: TutorEvent[] = [
  { id: 'ev-1', day: 1, start: 15,   end: 17,   title: 'Oliver G. · AP Chem',    kind: 'session', status: 'upcoming',  studentName: 'Oliver Grant', studentInitials: 'OG', subject: 'AP Chemistry', recurring: true  },
  { id: 'ev-2', day: 1, start: 17.5, end: 19.5, title: 'Mia C. · AP Calc BC',    kind: 'session', status: 'upcoming',  studentName: 'Mia Chen',     studentInitials: 'MC', subject: 'AP Calc BC',   recurring: true  },
  { id: 'ev-3', day: 2, start: 9,    end: 11,   title: 'Tyler B. · AP Physics C', kind: 'session', status: 'completed', studentName: 'Tyler Brooks', studentInitials: 'TB', subject: 'AP Physics C', recurring: true  },
  { id: 'ev-4', day: 2, start: 16.5, end: 18.5, title: 'Emma S. · AP Chem',      kind: 'session', status: 'upcoming',  studentName: 'Emma Santos',  studentInitials: 'ES', subject: 'AP Chemistry', recurring: true  },
  { id: 'ev-5', day: 3, start: 15,   end: 17,   title: 'Oliver G. · AP Chem',    kind: 'session', status: 'upcoming',  studentName: 'Oliver Grant', studentInitials: 'OG', subject: 'AP Chemistry', recurring: true  },
  { id: 'ev-6', day: 3, start: 17.5, end: 19.5, title: 'Mia C. · AP Calc BC',    kind: 'session', status: 'upcoming',  studentName: 'Mia Chen',     studentInitials: 'MC', subject: 'AP Calc BC',   recurring: true  },
  { id: 'ev-7', day: 4, start: 9,    end: 11,   title: 'Sofia L. · AP Calc BC',  kind: 'session', status: 'upcoming',  studentName: 'Sofia Lim',    studentInitials: 'SL', subject: 'AP Calc BC',   recurring: true  },
  { id: 'ev-8', day: 5, start: 13,   end: 14.5, title: 'Team sync',              kind: 'other',   status: 'upcoming',  recurring: false },
];

// Proposals sent to Julia by coordinators
export const TUTOR_PROPOSALS: TutorProposal[] = [
  {
    id: 'tp-1', status: 'pending', sentAt: '2h ago',
    studentName: 'Ava Rodriguez', studentEmail: 'ava.rodriguez@gmail.com',
    subject: 'AP Calculus BC', tz: 'America/New_York',
    tuples: [{ day: 1, start: 17, end: 20 }, { day: 3, start: 18, end: 21 }],
    startDate: 'May 6', hoursPerWeek: 6,
    notes: 'Junior, preparing for May exam. Needs help with series and parametric.',
    coordinator: 'Meg Adams', coordinatorEmail: 'meg@simplifiedu.com',
    studentGrade: 'Junior',
    rationale: 'Julia has high confidence in AP Calc BC and strong availability overlap on Mon/Wed evenings — a clean match for Ava\'s study window before the May exam.',
  },
  {
    id: 'tp-2', status: 'pending', sentAt: '1d ago',
    studentName: 'Jackson Wu', studentEmail: 'jackson.wu@gmail.com',
    subject: 'AP Physics C', tz: 'America/Chicago',
    tuples: [{ day: 4, start: 9, end: 11 }],
    startDate: 'May 7', hoursPerWeek: 2,
    notes: 'Senior. First AP. Nervous. Mechanics focus.',
    coordinator: 'Austin R.', coordinatorEmail: 'austin@simplifiedu.com',
    studentGrade: 'Senior',
  },
  {
    id: 'tp-3', status: 'accepted', sentAt: '3d ago',
    studentName: 'Liam Chen', studentEmail: 'liam.chen@gmail.com',
    subject: 'AP Calculus AB', tz: 'America/Los_Angeles',
    tuples: [{ day: 2, start: 16, end: 18 }],
    startDate: 'May 10', hoursPerWeek: 2,
    notes: 'Needs to solidify integration before finals.',
    coordinator: 'Meg Adams', coordinatorEmail: 'meg@simplifiedu.com',
  },
  {
    id: 'tp-4', status: 'declined', sentAt: '5d ago',
    studentName: 'Chloe Park', studentEmail: 'chloe.park@gmail.com',
    subject: 'AP Chemistry', tz: 'America/New_York',
    tuples: [{ day: 1, start: 15, end: 17 }],
    startDate: 'ASAP', hoursPerWeek: 2,
    notes: 'Weak on equilibrium and thermodynamics.',
    coordinator: 'Austin R.', coordinatorEmail: 'austin@simplifiedu.com',
    declineReason: 'Schedule conflict — committed hours are full for May.',
  },
];

// ── Admin / Coordinator management ────────────────────────────────────────

export interface Coordinator {
  id: string;
  initials: string;
  name: string;
  email: string;
  region: string;
  role: string;
  status: 'active' | 'inactive';
  activeTutors: number;
  activeStudents: number;
  openRequests: number;
  lastActive: string;
  deactivatedAt?: string | null;
  deactivatedReason?: string | null;
}

export interface CoordinatorInvite {
  id: string;
  name: string;
  email: string;
  region: string;
  invitedBy: string;
  sentAt: string;
  expiresIn: string;
  status: 'pending';
  message?: string | null;
  warning?: string | null;
}

export const COORDINATORS: Coordinator[] = [
  {
    id: 'coord-meg', initials: 'MA', name: 'Meg Adams',
    email: 'meg@simplifiedu.com', region: 'Bay Area', role: 'Coordinator',
    status: 'active', activeTutors: 12, activeStudents: 28, openRequests: 6,
    lastActive: '2 hours ago',
  },
  {
    id: 'coord-james', initials: 'JL', name: 'James Liu',
    email: 'james@simplifiedu.com', region: 'Pacific Northwest', role: 'Coordinator',
    status: 'active', activeTutors: 8, activeStudents: 19, openRequests: 3,
    lastActive: 'Yesterday',
  },
  {
    id: 'coord-priya', initials: 'PS', name: 'Priya Sharma',
    email: 'priya.s@simplifiedu.com', region: 'Midwest', role: 'Coordinator',
    status: 'inactive', activeTutors: 0, activeStudents: 0, openRequests: 0,
    lastActive: '3 months ago', deactivatedAt: '2 months ago', deactivatedReason: 'Left the team',
  },
];

export const COORDINATOR_INVITES: CoordinatorInvite[] = [
  {
    id: 'cinv-1', name: 'Rachel Kim', email: 'rachel.kim@example.com',
    region: 'New England', invitedBy: 'Austin R.', sentAt: '2 days ago',
    expiresIn: '5 days', status: 'pending',
  },
  {
    id: 'cinv-2', name: '', email: 'carlos.m@example.com',
    region: 'Southwest', invitedBy: 'Austin R.', sentAt: '6 days ago',
    expiresIn: '1 day', status: 'pending', warning: 'Expires tomorrow',
  },
];

export const AT_RISK_STUDENTS: AtRiskStudent[] = [
  {
    name: 'Tyler Brooks', subject: 'AP Chemistry', tutor: 'Katrina A.',
    reason: 'Missed last 2 sessions', severity: 'high',
  },
  {
    name: 'Jordan Lee', subject: 'SAT Math', tutor: 'Chris D.',
    reason: 'Score plateau · 40 sessions in', severity: 'medium',
  },
  {
    name: 'Mia Chen', subject: 'AP Calc BC', tutor: 'Julia H.',
    reason: 'Parent flagged stress', severity: 'medium',
  },
];
