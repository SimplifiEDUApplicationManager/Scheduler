// Domain types for the Simplifi EDU scheduling platform.
// These are the canonical TypeScript contracts for all domain concepts.
// See CONTEXT.md for the authoritative glossary behind these names.

// ── Primitives ──────────────────────────────────────────────────────────────

export type SubjectConf        = 'HIGH' | 'MEDIUM' | 'LOW';
export type CoordConf          = 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
export type SubjectChangeType   = 'ADD' | 'EDIT' | 'REMOVE';
export type SubjectChangeStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
export type AvailabilityRequestType   = 'PAUSE' | 'LOW_MAX_HOURS' | 'LOW_AVAILABILITY_WINDOWS';
export type AvailabilityRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';
export type TutorStatus    = 'active' | 'onboarding';
export type RequestSource  = 'asana' | 'manual';
export type RequestStatus  = 'open' | 'matched';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'finished' | 'tutor_accepted' | 'client_declined';
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

/** A pending or recently-declined change request from a tutor for one of their subjects. */
export interface TutorSubjectChange {
  id: string;
  tutorId: string;
  subjectId: string;
  tutorSubjectId?: string;          // present for EDIT / REMOVE
  changeType: SubjectChangeType;
  requestedConf?: SubjectConf;      // absent for REMOVE
  requestedNote?: string;           // absent for REMOVE
  status: SubjectChangeStatus;
  declineReason?: string;
  createdAt: string;
}

export interface TutorSubject {
  id: string;       // subject_id
  rowId?: string;   // tutor_subjects row id — present when fetched from DB
  conf: SubjectConf;
  coordConf?: CoordConf;
  qualificationNote?: string;
  /** Active PENDING change for this subject, or most-recent DECLINED change. */
  pendingChange?: TutorSubjectChange;
}

// ── Availability requests & activity ────────────────────────────────────────

export interface TutorAvailabilityRequest {
  id: string;
  tutorId: string;
  requestType: AvailabilityRequestType;
  reason: string;
  /** For LOW_MAX_HOURS: { requestedHours: number }
   *  For LOW_AVAILABILITY_WINDOWS: { totalHours: number; prefs: unknown } */
  details?: Record<string, unknown>;
  status: AvailabilityRequestStatus;
  declineReason?: string;
  createdAt: string;
}

export interface TutorAvailabilityActivity {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  eventType: string;
  summary: string;
  details?: Record<string, unknown>;
  createdAt: string;
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
  minRate: number;
  meetingLink?: string;
  bookingPageUrl?: string;
  nylasSchedulerConfigId?: string;
  nylasGrantId?: string;
  photoUrl?: string;
  isPaused: boolean;
  totalAvailabilityHours: number;
  /** Active PENDING or most-recent DECLINED availability requests for this tutor. */
  availabilityRequests: TutorAvailabilityRequest[];
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
  offeredRate?: number;
  sessionDurationMinutes: number;
  sessionsPerWeek: number;
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

export type TutorProposalStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'finished' | 'tutor_accepted' | 'client_declined';

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
  offeredRate?: number;
  sessionDurationMinutes: number;
  sessionsPerWeek: number;
  // Extended student context fields (all optional — absent on older proposals)
  parentName?: string;
  testName?: string;
  startingScore?: number;
  goalScore?: number;
  testDates?: string;
  accommodations?: string;
  scheduleNotes?: string;
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
