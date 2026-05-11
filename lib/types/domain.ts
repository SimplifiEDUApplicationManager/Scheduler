// Domain types for the Simplifi EDU scheduling platform.
// These are the canonical TypeScript contracts for all domain concepts.
// See CONTEXT.md for the authoritative glossary behind these names.

// ── Primitives ──────────────────────────────────────────────────────────────

export type SubjectConf    = 'HIGH' | 'MEDIUM' | 'LOW';
export type CoordConf      = 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
export type TutorStatus    = 'active' | 'onboarding';
export type RequestSource  = 'asana' | 'manual';
export type RequestStatus  = 'open' | 'matched';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type AtRiskSeverity = 'high' | 'medium';

// ── Availability ────────────────────────────────────────────────────────────

/** A day-of-week / start-time / end-time availability window (times in 24h decimal). */
export interface Tuple {
  day: number;   // 0 = Sun … 6 = Sat
  start: number; // e.g. 16 = 4 pm
  end: number;   // e.g. 19 = 7 pm
}

/** Availability map: day → array of [start, end] windows. */
export type Availability = Record<number, [number, number][]>;

// ── Subjects ────────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  name: string;
  cat: string;
}

export interface TutorSubject {
  id: string;       // subject_id
  rowId?: string;   // tutor_subjects row id — present when fetched from DB
  conf: SubjectConf;
  coordConf?: CoordConf;
  qualificationNote?: string;
}

// ── Tutor ───────────────────────────────────────────────────────────────────

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
  meetingLink?: string;
  bookingPageUrl?: string;
  nylasSchedulerConfigId?: string;
  nylasGrantId?: string;
}

// ── Request ─────────────────────────────────────────────────────────────────

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
  asanaTaskId?: string;
}

// ── Invitation (system onboarding — not a Proposal) ────────────────────────

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

// ── At-risk students ────────────────────────────────────────────────────────

export interface AtRiskStudent {
  name: string;
  subject: string;
  tutor: string;
  reason: string;
  severity: AtRiskSeverity;
}

// ── Tutor calendar ──────────────────────────────────────────────────────────

export type TutorEventKind   = 'session' | 'other';
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

// ── Coordinator management ──────────────────────────────────────────────────

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
