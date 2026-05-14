'use client';

import { useMemo } from 'react';
import type { TuitionRequest, Invitation, Tutor } from '@/lib/types/domain';
import { overlapsTuple, DAY_NAMES_FULL, fmtRange } from '@/lib/utils/tutors';
import { convertTupleTimezone } from '@/lib/utils/timezone';
import { RequestDetailCard } from './RequestDetailCard';
import { RequestTimeline } from './RequestTimeline';
import { SuggestionRow } from './SuggestionRow';

interface Props {
  request: TuitionRequest;
  invitations: Invitation[];
  tutors: Tutor[];
  matchedTutor?: Tutor;
  coordinatorTz: string;
  onPropose: (tutor: Tutor) => void;
}

export function RequestDetail({ request: r, invitations, tutors, matchedTutor, coordinatorTz, onPropose }: Props) {
  const suggestions = useMemo(() => {
    const CONF_ORDER = ['HIGH', 'MEDIUM', 'UNPROVEN', 'LOW'] as const;
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

  const studentTzShort   = r.tz.split('/').pop()?.replace(/_/g, ' ') ?? r.tz;
  const coordTzShort     = coordinatorTz.split('/').pop()?.replace(/_/g, ' ') ?? coordinatorTz;
  const showTzConversion = r.tz !== coordinatorTz;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border-default shrink-0 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[18px] font-extrabold text-fg-1 tracking-tight truncate">{r.studentName}</h2>
              <span className={[
                'text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wide whitespace-nowrap shrink-0',
                r.status === 'open' ? 'bg-warning-bg text-warning-ink' : 'bg-success-bg text-success-ink',
              ].join(' ')}>
                {r.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-fg-3">
              <span className="px-1.5 py-px bg-surface-3 text-fg-3 rounded text-[9px] font-bold uppercase tracking-wide">{r.source}</span>
              <span>·</span>
              <span>{r.subject}</span>
              <span>·</span>
              <span>{r.receivedAt}</span>
            </div>
          </div>
          {r.status === 'open' && (
            <a
              href={`/dashboard/requests/${r.id}/consider`}
              className="h-8 px-3.5 rounded-lg bg-brand-ink text-white text-[12px] font-semibold flex items-center gap-1.5 hover:bg-neutral-700 transition-colors shrink-0"
            >
              Find a tutor →
            </a>
          )}
        </div>

        {/* Matched banner */}
        {matchedTutor && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-success-bg rounded-lg text-[12px] font-semibold text-success-ink">
            <span>✓</span>
            <span>Matched with {matchedTutor.name}</span>
            <span className="font-normal text-fg-3 ml-auto text-[11px]">Tutoring underway</span>
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-neutral-50 p-5 flex flex-col gap-4">

        {/* 2-col grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Requested times */}
          <RequestDetailCard title="Requested times" subtitle={`Start: ${r.startDate} · ${showTzConversion ? coordTzShort : studentTzShort}`}>
            <div className="flex flex-col gap-1.5">
              {r.tuples.map((t, i) => {
                const coordT = showTzConversion
                  ? convertTupleTimezone(t, r.tz, coordinatorTz)
                  : t;
                return (
                  <div key={i} className="text-[12px] font-medium text-fg-1">
                    {DAY_NAMES_FULL[coordT.day]} · {fmtRange(coordT.start, coordT.end)}
                    {showTzConversion && (
                      <span className="text-fg-3 ml-1.5 text-[10px] font-normal">
                        ({DAY_NAMES_FULL[t.day]} · {fmtRange(t.start, t.end)} {studentTzShort})
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </RequestDetailCard>

          {/* Student */}
          <RequestDetailCard title="Student">
            <div className="flex flex-col gap-1">
              <div className="text-[12px] text-fg-1">{r.studentEmail}</div>
              <div className="text-[11px] text-fg-3">{r.tz.replace(/_/g, ' ')}</div>
            </div>
          </RequestDetailCard>

          {/* Notes */}
          <RequestDetailCard title="Notes">
            <p className="text-[12px] text-fg-2 leading-relaxed">
              {r.notes || <span className="text-fg-muted italic">No notes</span>}
            </p>
          </RequestDetailCard>

          {/* Activity */}
          <RequestDetailCard title="Activity">
            <RequestTimeline
              request={r}
              invitations={invitations}
              tutors={tutors}
              matchedTutor={matchedTutor}
            />
          </RequestDetailCard>
        </div>

        {/* Suggestions */}
        {r.status === 'open' && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em]">
                Suggested tutors · {suggestions.length}
              </span>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-[12px] text-fg-muted py-4 text-center">
                No tutors match this subject and availability.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {suggestions.map(s => (
                  <SuggestionRow
                    key={s.tutor.id}
                    tutor={s.tutor}
                    conf={s.conf}
                    matches={s.matches}
                    totalTuples={r.tuples.length}
                    available={s.available}
                    onPropose={() => onPropose(s.tutor)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
