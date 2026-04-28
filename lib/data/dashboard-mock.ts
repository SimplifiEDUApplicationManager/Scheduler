export type SubjectConf = 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
export type TutorStatus = 'active' | 'onboarding';
export type RequestSource = 'asana' | 'manual';
export type RequestStatus = 'open' | 'matched';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type AtRiskSeverity = 'high' | 'medium';

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
  hoursCurrent: number;
  hoursMax: number;
  hoursMin: number;
}

export interface TuitionRequest {
  id: string;
  source: RequestSource;
  studentName: string;
  subject: string;
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
    hoursCurrent: 14, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-katrina', initials: 'KA', name: 'Katrina Anderson', status: 'active',
    subjects: [
      { id: 'apbio',  conf: 'HIGH' },
      { id: 'apchem', conf: 'HIGH' },
      { id: 'mcat',   conf: 'HIGH' },
    ],
    hoursCurrent: 18, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-elisa', initials: 'EK', name: 'Elisa Kim', status: 'active',
    subjects: [
      { id: 'spanish', conf: 'HIGH'   },
      { id: 'french',  conf: 'HIGH'   },
      { id: 'writing', conf: 'MEDIUM' },
    ],
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
    hoursCurrent: 6, hoursMax: 25, hoursMin: 6,
  },
  {
    id: 't-robbie', initials: 'RM', name: 'Robbie Maillard', status: 'onboarding',
    subjects: [
      { id: 'writing',   conf: 'HIGH'    },
      { id: 'apenglang', conf: 'MEDIUM'  },
      { id: 'satverb',   conf: 'UNPROVEN'},
    ],
    hoursCurrent: 4, hoursMax: 18, hoursMin: 6,
  },
  {
    id: 't-steven', initials: 'SK', name: 'Steven Kuhn', status: 'active',
    subjects: [
      { id: 'apushist',  conf: 'HIGH' },
      { id: 'apenglang', conf: 'HIGH' },
    ],
    hoursCurrent: 12, hoursMax: 20, hoursMin: 6,
  },
  {
    id: 't-sahana', initials: 'SN', name: 'Sahana Nateson', status: 'active',
    subjects: [
      { id: 'algii',    conf: 'HIGH'   },
      { id: 'apcalcab', conf: 'MEDIUM' },
      { id: 'satmath',  conf: 'MEDIUM' },
    ],
    hoursCurrent: 22, hoursMax: 22, hoursMin: 6,
  },
  {
    id: 't-maya', initials: 'MP', name: 'Maya Patel', status: 'active',
    subjects: [
      { id: 'apphys1', conf: 'HIGH'    },
      { id: 'apphysc', conf: 'MEDIUM'  },
      { id: 'apchem',  conf: 'UNPROVEN'},
    ],
    hoursCurrent: 8, hoursMax: 24, hoursMin: 6,
  },
];

export const REQUESTS: TuitionRequest[] = [
  { id: 'req-1', source: 'asana',  studentName: 'Ava Rodriguez', subject: 'AP Calculus BC',      status: 'open'    },
  { id: 'req-2', source: 'asana',  studentName: 'Liam Chen',     subject: 'SAT Math',            status: 'open'    },
  { id: 'req-3', source: 'manual', studentName: 'Zoe Kaplan',    subject: 'AP Physics C',        status: 'open'    },
  { id: 'req-4', source: 'asana',  studentName: 'Mateo Ruiz',    subject: 'AP Spanish',          status: 'open'    },
  { id: 'req-5', source: 'asana',  studentName: 'Priya Desai',   subject: 'MCAT Prep',           status: 'open'    },
  { id: 'req-6', source: 'manual', studentName: 'Jackson Wu',    subject: 'AP Statistics',       status: 'open'    },
  { id: 'req-7', source: 'asana',  studentName: 'Hannah Kim',    subject: 'AP English Language', status: 'open'    },
  { id: 'req-8', source: 'asana',  studentName: 'Oliver Grant',  subject: 'AP Chemistry',        status: 'matched' },
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
