'use client';

import { useMemo, useState } from 'react';
import type { TuitionRequest, Tutor } from '@/lib/types/domain';
import { overlapsTuple, DAY_NAMES_FULL, fmtRange, getWeekLabel } from '@/lib/utils/tutors';
import { SuggestionRow } from './SuggestionRow';
import { WeekView } from '@/components/features/calendar/WeekView';
import { ProposeModal } from '@/components/features/tutors/ProposeModal';

interface Props {
  request: TuitionRequest;
  tutors: Tutor[];
}

export function ConsiderRequestClient({ request: r, tutors }: Props) {
  const [activeTutorId, setActiveTutorId] = useState<string | null>(null);
  const [proposeFor, setProposeFor]        = useState<Tutor | null>(null);
  const [weekOffset, setWeekOffset]        = useState(0);
  const [toastName, setToastName]          = useState<string | null>(null);

  const CONF_ORDER = ['HIGH', 'MEDIUM', 'UNPROVEN', 'LOW'] as const;

  const suggestions = useMemo(() => {
    return tutors
      .map(t => {
        const subj = t.subjects.find(s => s.id === r.subjectId);
        if (!subj) return null;
        const matches = r.tuples.filter(tp => overlapsTuple(t.availability, tp)).length;
        if (matches === 0) return null;
        return { tutor: t, conf: subj.conf, matches, available: t.hoursCurrent < t.hoursMax };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) =>
        b.matches - a.matches ||
        CONF_ORDER.indexOf(a.conf) - CONF_ORDER.indexOf(b.conf)
      );
  }, [tutors, r]);

  // Calendar shows all matching tutors; narrows to just the hovered one
  const calendarTutors = useMemo(() => {
    if (activeTutorId) {
      const t = suggestions.find(s => s.tutor.id === activeTutorId)?.tutor;
      return t ? [t] : suggestions.map(s => s.tutor);
    }
    return suggestions.map(s => s.tutor);
  }, [suggestions, activeTutorId]);

  function handleProposeSend(name: string) {
    setProposeFor(null);
    setToastName(name);
    setTimeout(() => setToastName(null), 3200);
  }

  const tzShort = r.tz.split('/').pop()?.replace(/_/g, ' ') ?? r.tz;

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left: request summary + suggestions ───────────────────────────── */}
      <aside className="w-[360px] border-r border-border-default bg-surface-1 flex flex-col shrink-0 min-h-0 overflow-y-auto">
        {/* Back link */}
        <div className="px-4 pt-3 pb-0 shrink-0">
          <a href="/dashboard/requests" className="inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-1 transition-colors">
            ← Requests
          </a>
        </div>

        {/* Request summary */}
        <div className="px-4 pt-2 pb-4 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[16px] font-extrabold text-fg-1 tracking-tight leading-tight">{r.studentName}</h1>
            <span className={[
              'text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide whitespace-nowrap shrink-0',
              r.status === 'open' ? 'bg-warning-bg text-warning-ink' : 'bg-success-bg text-success-ink',
            ].join(' ')}>
              {r.status}
            </span>
          </div>
          <div className="text-[12px] font-semibold text-fg-2 mb-2.5">{r.subject}</div>

          {/* Tuples */}
          <div className="flex flex-col gap-1 mb-2.5">
            {r.tuples.map((t, i) => (
              <div key={i} className="text-[12px] text-fg-1 font-medium">
                {DAY_NAMES_FULL[t.day]} · {fmtRange(t.start, t.end)}
                <span className="text-fg-muted ml-1 text-[11px]">{tzShort}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-fg-3">
            <span>Start: {r.startDate}</span>
            <span>·</span>
            <span>{r.receivedAt}</span>
          </div>

          {r.notes && (
            <div className="mt-2.5 px-2.5 py-2 bg-surface-2 rounded-lg text-[11px] text-fg-2 leading-relaxed">
              {r.notes}
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="flex-1 p-4 flex flex-col gap-2">
          <div className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-1">
            Suggested tutors · {suggestions.length}
          </div>

          {suggestions.length === 0 ? (
            <p className="text-[12px] text-fg-muted py-4 text-center">No tutors match this subject and availability.</p>
          ) : (
            suggestions.map(s => (
              <div
                key={s.tutor.id}
                onMouseEnter={() => setActiveTutorId(s.tutor.id)}
                onMouseLeave={() => setActiveTutorId(null)}
                className="rounded-lg transition-shadow"
                style={{ boxShadow: activeTutorId === s.tutor.id ? '0 0 0 2px #3F9C8B' : 'none' }}
              >
                <SuggestionRow
                  tutor={s.tutor}
                  conf={s.conf}
                  matches={s.matches}
                  totalTuples={r.tuples.length}
                  available={s.available}
                  onPropose={() => setProposeFor(s.tutor)}
                />
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Right: calendar ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-surface-1">
        {/* Calendar toolbar */}
        <div className="px-5 py-3 border-b border-border-default flex items-center gap-3 shrink-0">
          <h3 className="text-[14px] font-semibold text-fg-1">
            {activeTutorId
              ? suggestions.find(s => s.tutor.id === activeTutorId)?.tutor.name
              : `${suggestions.length} matching tutor${suggestions.length !== 1 ? 's' : ''}`}
          </h3>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors"
              aria-label="Previous week"
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden><path d="M7.5 2.5L4 6l3.5 3.5" /></svg>
            </button>
            <span className="text-[12px] font-medium text-fg-2 min-w-[164px] text-center tabular-nums">{getWeekLabel(weekOffset)}</span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors"
              aria-label="Next week"
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden><path d="M4.5 2.5L8 6l-3.5 3.5" /></svg>
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-[11px] font-medium text-fg-2 border border-border-default rounded-md hover:bg-surface-2 transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        <WeekView
          tutors={calendarTutors}
          requestTuples={r.tuples}
          weekOffset={weekOffset}
        />
      </main>

      {/* ── Propose modal ────────────────────────────────────────────────────── */}
      {proposeFor && (
        <ProposeModal
          tutor={proposeFor}
          request={r}
          onClose={() => setProposeFor(null)}
          onSend={() => handleProposeSend(proposeFor.name)}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toastName && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-surface-1 border border-border-default rounded-xl shadow-md text-sm font-medium text-fg-1">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          Proposal sent to {toastName}
        </div>
      )}
    </div>
  );
}
