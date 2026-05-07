'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { TutorEvent } from '@/lib/types/domain';
import { fmtRange, fmtHour, DAY_NAMES_FULL } from '@/lib/utils/tutors';

// Extends TutorEvent with optional rich fields shown in the drawer
export interface SessionDetail extends TutorEvent {
  grade?: string;
  sessionNum?: number;
  sessionTotal?: number;
  /** Human-readable date string, e.g. "Mon May 6" — shown instead of day-of-week when set. */
  date?: string;
  /** e.g. "Weekly on Mondays" */
  recurringPattern?: string;
  cancelReason?: string;
  meetingLink?: string;
  notes?: {
    topics?: string;
    homework?: string;
    mood?: string;
    nextFocus?: string;
  };
}

export interface SessionDetailDrawerProps {
  session: SessionDetail;
  onClose: () => void;
  onCancel: (id: string, scope: 'one' | 'all') => void;
  onReschedule: (
    id: string,
    scope: 'one' | 'all',
    slot: { day: number; start: number; end: number },
  ) => void;
  onUpdate?: (id: string, data: Partial<SessionDetail>) => void;
}

type View = 'detail' | 'reschedule' | 'recurring-prompt';
type PendingChange =
  | { type: 'cancel' }
  | { type: 'reschedule'; day: number; start: number; end: number };

// ── Status badge styles ────────────────────────────────────────────────────
const STATUS_STYLE = {
  upcoming:  { bg: '#E8F4F1', fg: '#1F5349', ring: '#B5D9D0', label: 'Upcoming'  },
  completed: { bg: '#F4F4F5', fg: '#52525B', ring: '#D4D4D8', label: 'Completed' },
  cancelled: { bg: '#FEF2F2', fg: '#991B1B', ring: '#FECACA', label: 'Cancelled' },
} as const;

// ── Icon helpers (inline SVG, no dependency) ───────────────────────────────
function IconX({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="2" y1="2" x2="12" y2="12" />
      <line x1="12" y1="2" x2="2" y2="12" />
    </svg>
  );
}
function IconCalendar({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="11" height="10" rx="2" />
      <line x1="1" y1="5" x2="12" y2="5" />
      <line x1="4" y1="1" x2="4" y2="3" />
      <line x1="9" y1="1" x2="9" y2="3" />
    </svg>
  );
}
function IconLink({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7a3 3 0 0 0 4.5.4l1.5-1.5a3 3 0 0 0-4.2-4.2L5.5 3" />
      <path d="M8 6a3 3 0 0 0-4.5-.4L2 7.1a3 3 0 0 0 4.2 4.2l1.3-1.3" />
    </svg>
  );
}
function IconClock({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
      <circle cx="9" cy="9" r="7.5" />
      <polyline points="9,5 9,9 12,11" />
    </svg>
  );
}
function IconChevronLeft({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6,2 3,5 6,8" />
    </svg>
  );
}

// ── Pretty-print a meeting URL ─────────────────────────────────────────────
function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname.replace(/\/$/, '');
  } catch {
    return url;
  }
}

// ── Duration in whole minutes ──────────────────────────────────────────────
function durationMins(start: number, end: number): number {
  return Math.round((end - start) * 60);
}

// ── Main export ────────────────────────────────────────────────────────────
export function SessionDetailDrawer({
  session,
  onClose,
  onCancel,
  onReschedule,
  onUpdate,
}: SessionDetailDrawerProps) {
  const [view, setView] = useState<View>('detail');
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

  const isUpcoming  = session.status === 'upcoming';
  const isCompleted = session.status === 'completed';
  const isCancelled = session.status === 'cancelled';
  const isInternal  = session.kind === 'other';
  const statusStyle = STATUS_STYLE[session.status];

  const handleCancelClick = () => {
    if (session.recurring) {
      setPendingChange({ type: 'cancel' });
      setView('recurring-prompt');
    } else {
      onCancel(session.id, 'one');
    }
  };

  const handleRescheduleApply = (day: number, start: number, end: number) => {
    if (session.recurring) {
      setPendingChange({ type: 'reschedule', day, start, end });
      setView('recurring-prompt');
    } else {
      onReschedule(session.id, 'one', { day, start, end });
      onClose();
    }
  };

  const applyRecurringScope = (scope: 'one' | 'all') => {
    if (!pendingChange) return;
    if (pendingChange.type === 'cancel') {
      onCancel(session.id, scope);
    } else {
      onReschedule(session.id, scope, {
        day:   pendingChange.day,
        start: pendingChange.start,
        end:   pendingChange.end,
      });
    }
    setPendingChange(null);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{
          background: 'rgba(24,24,27,0.32)',
          backdropFilter: 'blur(2px)',
          animation: 'drawerFade 140ms ease-out',
        }}
      />

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-50 bg-white flex flex-col"
        style={{
          width: 440,
          boxShadow: '-8px 0 28px rgba(22,32,51,0.12)',
          animation: 'drawerSlide 220ms cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded-xs"
              style={{
                background: statusStyle.bg,
                color: statusStyle.fg,
                border: `1px solid ${statusStyle.ring}`,
              }}
            >
              {statusStyle.label}
            </span>
            {session.recurring && !isInternal && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-fg-3">
                <IconClock size={10} />
                Recurring
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md text-fg-3 hover:text-fg-1 hover:bg-surface-3 transition-colors"
          >
            <IconX size={14} />
          </button>
        </header>

        {view === 'detail' && (
          <DetailContent
            session={session}
            isInternal={isInternal}
            isUpcoming={isUpcoming}
            isCompleted={isCompleted}
            isCancelled={isCancelled}
            onCancel={handleCancelClick}
            onReschedule={() => setView('reschedule')}
            onEditNotes={onUpdate ? () => onUpdate(session.id, {}) : undefined}
          />
        )}
        {view === 'reschedule' && (
          <ReschedulePanel
            session={session}
            onBack={() => setView('detail')}
            onApply={handleRescheduleApply}
          />
        )}
        {view === 'recurring-prompt' && pendingChange && (
          <RecurringScopePrompt
            session={session}
            pendingChange={pendingChange}
            onBack={() => { setView('detail'); setPendingChange(null); }}
            onChoose={applyRecurringScope}
          />
        )}
      </aside>
    </>
  );
}

// ── Detail content ─────────────────────────────────────────────────────────
interface DetailContentProps {
  session: SessionDetail;
  isInternal: boolean;
  isUpcoming: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  onCancel: () => void;
  onReschedule: () => void;
  onEditNotes?: () => void;
}

function DetailContent({
  session,
  isInternal,
  isUpcoming,
  isCompleted,
  isCancelled,
  onCancel,
  onReschedule,
  onEditNotes,
}: DetailContentProps) {
  const dim = isCancelled ? 0.55 : isCompleted ? 0.88 : 1;
  const when = session.date ?? DAY_NAMES_FULL[session.day];

  return (
    <div className="flex-1 overflow-auto" style={{ opacity: dim }}>
      {/* Title block */}
      <div className="px-6 pt-[22px] pb-[18px] border-b border-neutral-100">
        {isInternal ? (
          <div>
            <div className="text-[11px] font-semibold text-fg-3 mb-1.5">Internal event</div>
            <h2 className="text-h3 font-extrabold m-0 font-display tracking-tight">
              {session.title}
            </h2>
          </div>
        ) : (
          <div className="flex items-start gap-3.5">
            <Avatar
              initials={session.studentInitials ?? (session.studentName?.slice(0, 2).toUpperCase() ?? '?')}
              tone="brand"
              size="xl"
            />
            <div className="flex-1 min-w-0">
              <h2
                className="text-h3 font-extrabold m-0 font-display tracking-tight"
                style={{ textDecoration: isCancelled ? 'line-through' : 'none' }}
              >
                {session.studentName ?? session.title}
              </h2>
              {(session.subject || session.grade) && (
                <div className="text-sm text-fg-2 mt-1">
                  {[session.subject, session.grade].filter(Boolean).join(' · ')}
                </div>
              )}
              {session.sessionNum != null && session.sessionTotal != null && (
                <div className="text-[11px] text-fg-muted mt-1 tabular-nums">
                  Session {session.sessionNum} of {session.sessionTotal}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* When / Where */}
      <div className="px-6 py-4 border-b border-neutral-100">
        <InfoRow
          icon={<IconCalendar />}
          label="When"
          value={
            <>
              <div className="font-semibold text-fg-1">
                {when} · {fmtRange(session.start, session.end)}
              </div>
              <div className="text-[11px] text-fg-3 mt-0.5">
                {durationMins(session.start, session.end)} min
                {session.recurringPattern && ` · ${session.recurringPattern}`}
              </div>
            </>
          }
        />
        {!isInternal && session.meetingLink && (
          <InfoRow
            icon={<IconLink />}
            label="Where"
            value={
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="text-brand-primary-deep font-semibold text-sm no-underline hover:underline"
              >
                {prettyUrl(session.meetingLink)}
              </a>
            }
          />
        )}
        {isCancelled && session.cancelReason && (
          <div
            className="mt-3 px-3 py-2.5 rounded-md text-xs text-danger-ink"
            style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}
          >
            <b>Cancelled:</b> {session.cancelReason}
          </div>
        )}
      </div>

      {/* Session notes — completed only */}
      {isCompleted && session.notes && (
        <div className="px-6 py-[18px] border-b border-neutral-100">
          <div className="text-[10px] font-bold tracking-[0.06em] uppercase text-fg-3 mb-3">
            Session notes
          </div>
          {session.notes.topics    && <NoteBlock label="Topics covered"    value={session.notes.topics}    />}
          {session.notes.homework  && <NoteBlock label="Homework assigned" value={session.notes.homework}  />}
          {session.notes.mood      && <NoteBlock label="Student mood"      value={session.notes.mood}      />}
          {session.notes.nextFocus && <NoteBlock label="Next focus"        value={session.notes.nextFocus} last />}
        </div>
      )}

      {/* Actions */}
      {isUpcoming && !isInternal && (
        <div className="px-6 py-5 flex flex-col gap-2">
          {session.meetingLink && (
            <a
              href={session.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-[10px] bg-brand-primary-deep text-white text-sm font-bold no-underline hover:opacity-90 transition-opacity"
            >
              <IconLink size={14} />
              Join meeting
            </a>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={onReschedule}
              className="flex-1 h-[38px] flex items-center justify-center gap-1.5 rounded-md border border-border-default bg-white text-fg-2 text-sm font-semibold hover:bg-surface-3 transition-colors"
            >
              <IconCalendar size={13} />
              Reschedule
            </button>
            <button
              onClick={onCancel}
              className="flex-1 h-[38px] flex items-center justify-center gap-1.5 rounded-md border bg-white text-sm font-semibold transition-colors hover:bg-danger-bg"
              style={{ borderColor: '#FECACA', color: '#991B1B' }}
            >
              <span className="text-danger-ink"><IconX size={12} /></span>
              Cancel session
            </button>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="px-6 py-4">
          <button
            onClick={onEditNotes}
            className="w-full h-[38px] rounded-md border border-border-default bg-white text-fg-2 text-sm font-semibold hover:bg-surface-3 transition-colors"
          >
            Edit notes
          </button>
        </div>
      )}
    </div>
  );
}

// ── InfoRow ────────────────────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex gap-3 mb-3">
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-fg-2"
        style={{ background: '#FAFAFA', border: '1px solid #F5F5F5' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold tracking-[0.06em] uppercase text-fg-muted mb-0.5">
          {label}
        </div>
        <div className="text-sm text-fg-1">{value}</div>
      </div>
    </div>
  );
}

// ── NoteBlock ──────────────────────────────────────────────────────────────
function NoteBlock({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={last ? '' : 'mb-3.5'}>
      <div className="text-[10px] font-bold tracking-[0.04em] text-fg-3 mb-1">{label}</div>
      <div
        className="text-sm text-fg-1 leading-relaxed px-3 py-2 rounded-md"
        style={{ background: '#FAFAFA', border: '1px solid #F5F5F5' }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Reschedule panel ───────────────────────────────────────────────────────
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const HOURS  = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] as const;

function ReschedulePanel({
  session,
  onBack,
  onApply,
}: {
  session: SessionDetail;
  onBack: () => void;
  onApply: (day: number, start: number, end: number) => void;
}) {
  const [day,   setDay]   = useState(session.day);
  const snappedStart = Math.floor(session.start);
  const [start, setStart] = useState(snappedStart);
  const dur = session.end - session.start;

  return (
    <div className="flex-1 overflow-auto">
      {/* Sub-header */}
      <div className="px-6 py-[18px] border-b border-neutral-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] font-semibold text-fg-3 mb-2.5 bg-transparent border-none p-0 cursor-pointer hover:text-fg-1 transition-colors"
        >
          <IconChevronLeft size={10} /> Back
        </button>
        <h3 className="text-h4 font-bold m-0 font-display tracking-tight">Reschedule</h3>
        <div className="text-xs text-fg-3 mt-1">
          Current: {DAY_NAMES_FULL[session.day]} · {fmtRange(session.start, session.end)}
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Day picker */}
        <FieldLabel>New day</FieldLabel>
        <div className="grid grid-cols-7 gap-1 mb-5">
          {DAYS.map((d, i) => (
            <button
              key={i}
              onClick={() => setDay(i)}
              className="h-[38px] rounded-md text-[11px] font-bold cursor-pointer transition-colors"
              style={{
                border:     `1px solid ${day === i ? '#18181B' : '#E4E4E7'}`,
                background: day === i ? '#18181B' : '#fff',
                color:      day === i ? '#fff'    : '#3F3F46',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Hour picker */}
        <FieldLabel>New start time</FieldLabel>
        <div className="grid grid-cols-4 gap-1 mb-5">
          {HOURS.map(h => (
            <button
              key={h}
              onClick={() => setStart(h)}
              className="h-9 rounded-md text-[11px] font-semibold cursor-pointer transition-colors tabular-nums"
              style={{
                border:     `1px solid ${start === h ? '#18181B' : '#E4E4E7'}`,
                background: start === h ? '#18181B' : '#fff',
                color:      start === h ? '#fff'    : '#3F3F46',
              }}
            >
              {fmtHour(h)}
            </button>
          ))}
        </div>

        {/* New slot preview */}
        <div
          className="px-3.5 py-3 rounded-[10px] text-xs text-fg-2 mb-4"
          style={{ background: '#FAFAFA', border: '1px solid #F5F5F5' }}
        >
          <b className="text-fg-1">New slot:</b>{' '}
          {DAYS[day]} · {fmtRange(start, start + dur)}
          <div className="text-[11px] text-fg-muted mt-0.5">
            {durationMins(start, start + dur)} min · parent will be notified
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onBack}
            className="flex-1 h-[38px] rounded-md border border-border-default bg-white text-fg-2 text-sm font-semibold hover:bg-surface-3 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => onApply(day, start, start + dur)}
            className="flex-[2] h-[38px] rounded-md border-none bg-neutral-900 text-white text-sm font-bold cursor-pointer hover:bg-neutral-800 transition-colors"
          >
            Apply new time
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring scope prompt ─────────────────────────────────────────────────
function RecurringScopePrompt({
  session,
  pendingChange,
  onBack,
  onChoose,
}: {
  session: SessionDetail;
  pendingChange: PendingChange;
  onBack: () => void;
  onChoose: (scope: 'one' | 'all') => void;
}) {
  const verb = pendingChange.type === 'cancel' ? 'cancel' : 'reschedule';
  const when = session.date ?? DAY_NAMES_FULL[session.day];

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 pt-6">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3.5 text-warning-ink"
          style={{ background: '#FEF3C7' }}
        >
          <IconClock size={18} />
        </div>
        <h3 className="text-h4 font-bold m-0 font-display tracking-tight">
          This is a recurring session
        </h3>
        <p className="text-sm text-fg-2 leading-relaxed mt-1.5">
          {session.recurringPattern ?? 'Recurring session'}.{' '}
          Should we {verb} just this one, or this and all future sessions in the series?
        </p>
      </div>

      <div className="px-6 py-4 flex flex-col gap-2">
        <ScopeChoice
          title="Just this session"
          sub={`Only ${when}. The rest of the series continues as planned.`}
          onClick={() => onChoose('one')}
        />
        <ScopeChoice
          title="This and all future sessions"
          sub="Ends the recurring series from this date forward."
          danger={pendingChange.type === 'cancel'}
          onClick={() => onChoose('all')}
        />
        <button
          onClick={onBack}
          className="mt-1 h-[38px] bg-transparent border-none text-xs font-semibold text-fg-3 cursor-pointer hover:text-fg-1 transition-colors"
        >
          Go back
        </button>
      </div>
    </div>
  );
}

function ScopeChoice({
  title,
  sub,
  danger,
  onClick,
}: {
  title: string;
  sub: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-4 py-3.5 rounded-[10px] text-left cursor-pointer transition-all"
      style={{
        border:     `1px solid ${hover ? (danger ? '#FECACA' : '#D4D4D8') : '#E4E4E7'}`,
        background: hover ? (danger ? '#FEF2F2' : '#FAFAFA') : '#fff',
      }}
    >
      <div
        className="text-sm font-bold"
        style={{ color: danger ? '#991B1B' : '#18181B' }}
      >
        {title}
      </div>
      <div className="text-[11px] text-fg-3 mt-0.5 leading-snug">{sub}</div>
    </button>
  );
}

// ── FieldLabel ─────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.06em] uppercase text-fg-3 mb-2">
      {children}
    </div>
  );
}
