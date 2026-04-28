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
  id: string;
  conf: SubjectConf;
}

export interface Tutor {
  id: string;
  initials: string;
  name: string;
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
  subject: string;
  subjectId: string;
  tuples: Tuple[];
  receivedAt: string;
  notes: string;
  status: RequestStatus;
}

export interface Invitation {
  id: string;
  tutorId: string;
  studentName: string;
  subject: string;
  sentAt: string;
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
}

export const SUBJECTS: Subject[] = [
  { id: 'apcalcbc',  name: 'AP Calculus BC'    },
  { id: 'apcalcab',  name: 'AP Calculus AB'    },
  { id: 'apphysc',   name: 'AP Physics C'      },
  { id: 'apphys1',   name: 'AP Physics 1'      },
  { id: 'apchem',    name: 'AP Chemistry'      },
  { id: 'apbio',     name: 'AP Biology'        },
  { id: 'satmath',   name: 'SAT Math'          },
  { id: 'satverb',   name: 'SAT Verbal'        },
  { id: 'actmath',   name: 'ACT Math'          },
  { id: 'mcat',      name: 'MCAT'              },
  { id: 'apstat',    name: 'AP Statistics'     },
  { id: 'algii',     name: 'Algebra II'        },
  { id: 'apenglang', name: 'AP English Lang'   },
  { id: 'apushist',  name: 'AP US History'     },
  { id: 'spanish',   name: 'Spanish'           },
  { id: 'french',    name: 'French'            },
  { id: 'writing',   name: 'Writing'           },
];

export const TUTORS: Tutor[] = [
  {
    id: 't-julia', initials: 'JH', name: 'Julia Hering', status: 'active',
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
    subjects: [
      { id: 'apushist',  conf: 'HIGH' },
      { id: 'apenglang', conf: 'HIGH' },
    ],
    availability: { 1: [[15,19]], 2: [[15,19]], 4: [[15,19]], 6: [[10,14]] },
    hoursCurrent: 12, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-sahana', initials: 'SN', name: 'Sahana Nateson', status: 'active',
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
    studentName: 'Ava Rodriguez', subject: 'AP Calculus BC', subjectId: 'apcalcbc',
    tuples: [{ day: 1, start: 17, end: 20 }, { day: 3, start: 18, end: 21 }],
    notes: 'Junior, preparing for May exam. Needs help with series and parametric.',
  },
  {
    id: 'req-2', source: 'asana', status: 'open', receivedAt: 'Yesterday',
    studentName: 'Liam Chen', subject: 'SAT Math', subjectId: 'satmath',
    tuples: [{ day: 2, start: 16, end: 19 }, { day: 4, start: 16, end: 19 }],
    notes: 'Target score 780+. Currently 680.',
  },
  {
    id: 'req-3', source: 'manual', status: 'open', receivedAt: '3 days ago',
    studentName: 'Zoe Kaplan', subject: 'AP Physics C', subjectId: 'apphysc',
    tuples: [{ day: 2, start: 15, end: 18 }, { day: 4, start: 15, end: 18 }],
    notes: 'Mechanics only. E&M is covered at school.',
  },
  {
    id: 'req-4', source: 'asana', status: 'open', receivedAt: '4h ago',
    studentName: 'Mateo Ruiz', subject: 'Spanish', subjectId: 'spanish',
    tuples: [{ day: 1, start: 15, end: 17 }, { day: 3, start: 15, end: 17 }],
    notes: 'Heritage speaker. Weak on formal writing.',
  },
  {
    id: 'req-5', source: 'asana', status: 'open', receivedAt: '5h ago',
    studentName: 'Priya Desai', subject: 'MCAT', subjectId: 'mcat',
    tuples: [{ day: 0, start: 10, end: 13 }, { day: 6, start: 10, end: 13 }],
    notes: 'Retaking in September. Needs CARS boost.',
  },
  {
    id: 'req-6', source: 'manual', status: 'open', receivedAt: 'Yesterday',
    studentName: 'Jackson Wu', subject: 'AP Statistics', subjectId: 'apstat',
    tuples: [{ day: 2, start: 17, end: 19 }, { day: 4, start: 17, end: 19 }],
    notes: 'Senior. First AP. Nervous.',
  },
  {
    id: 'req-7', source: 'asana', status: 'open', receivedAt: '2 days ago',
    studentName: 'Hannah Kim', subject: 'AP English Lang', subjectId: 'apenglang',
    tuples: [{ day: 2, start: 16, end: 18 }, { day: 5, start: 10, end: 12 }],
    notes: 'Needs essay structure help urgently.',
  },
  {
    id: 'req-8', source: 'asana', status: 'matched', receivedAt: '1 week ago',
    studentName: 'Oliver Grant', subject: 'AP Chemistry', subjectId: 'apchem',
    tuples: [{ day: 1, start: 17, end: 19 }, { day: 3, start: 17, end: 19 }],
    notes: 'Sophomore. Strong math.',
  },
];

export const INVITATIONS: Invitation[] = [
  {
    id: 'inv-1', tutorId: 't-julia',  studentName: 'Ava Rodriguez', subject: 'AP Calculus BC',
    sentAt: '2h ago', status: 'pending',
  },
  {
    id: 'inv-2', tutorId: 't-maya',   studentName: 'Marcus Webb',   subject: 'AP Physics C',
    sentAt: 'Yesterday', status: 'pending',
  },
  {
    id: 'inv-3', tutorId: 't-chris',  studentName: 'Liam Chen',     subject: 'SAT Math',
    sentAt: '3h ago', status: 'accepted',
  },
  {
    id: 'inv-4', tutorId: 't-robbie', studentName: 'Sienna Park',   subject: 'Essay Writing',
    sentAt: '2d ago', status: 'declined',
    declineReason: 'Schedule conflict — committed hours are full for May.',
  },
  {
    id: 'inv-5', tutorId: 't-elisa',  studentName: 'Noa Friedman',  subject: 'Spanish',
    sentAt: '4d ago', status: 'expired',
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
