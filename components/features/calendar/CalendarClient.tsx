'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Tutor, TuitionRequest } from '@/lib/types/domain';
import { parseFilters, overlapsTuple, getWeekLabel, getMonthLabel } from '@/lib/utils/tutors';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';

interface CalendarClientProps {
  tutors: Tutor[];
  requests: TuitionRequest[];
}

type Mode = 'week' | 'month';

export function CalendarClient({ tutors, requests }: CalendarClientProps) {
  const rawParams = useSearchParams();
  const filters   = useMemo(() => parseFilters(rawParams), [rawParams]);
  const [mode, setMode]     = useState<Mode>('week');
  const [offset, setOffset] = useState(0);

  const activeReq = requests.find(r => r.id === filters.reqId) ?? null;

  const filtered = useMemo(() => tutors.filter(t => {

    if (filters.q && !t.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.subjects.length > 0) {
      if (!t.subjects.some(ts => filters.subjects.includes(ts.id) && filters.conf.includes(ts.conf))) return false;
    }
    if (filters.tuples.length > 0) {
      if (!filters.tuples.some(tp => overlapsTuple(t.availability, tp))) return false;
    }
    return true;
  }), [tutors, filters]);

  const requestTuples = activeReq?.tuples ?? filters.tuples;
  const label = mode === 'week' ? getWeekLabel(offset) : getMonthLabel(offset);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface-1">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border-default flex items-center gap-3 shrink-0 flex-wrap">
        <div>
          <h2 className="text-[15px] font-semibold text-fg-1">Shared calendar</h2>
          {activeReq ? (
            <p className="text-[11px] text-fg-3 mt-0.5">
              Matching <strong className="text-fg-1">{activeReq.studentName}</strong> · {activeReq.subject}
            </p>
          ) : (
            <p className="text-[11px] text-fg-3 mt-0.5">{filtered.length} tutor{filtered.length !== 1 ? 's' : ''} shown</p>
          )}
        </div>

        {/* Mode toggle */}
        <div className="ml-auto flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-2 border border-border-default">
          {(['week','month'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setOffset(0); }}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize ${
                mode === m ? 'bg-surface-1 text-fg-1 shadow-sm' : 'text-fg-3 hover:text-fg-1'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOffset(o => o - 1)}
            className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors"
            aria-label="Previous"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
              <path d="M7.5 2.5L4 6l3.5 3.5" />
            </svg>
          </button>
          <span className="text-[12px] font-medium text-fg-2 min-w-[164px] text-center tabular-nums">{label}</span>
          <button
            onClick={() => setOffset(o => o + 1)}
            className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors"
            aria-label="Next"
          >
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
              <path d="M4.5 2.5L8 6l-3.5 3.5" />
            </svg>
          </button>
          <button
            onClick={() => setOffset(0)}
            className="px-2.5 py-1 text-[11px] font-medium text-fg-2 border border-border-default rounded-md hover:bg-surface-2 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {mode === 'week' ? (
        <WeekView
          tutors={filtered}
          requestTuples={requestTuples}
          weekOffset={offset}
        />
      ) : (
        <MonthView
          tutors={filtered}
          requestTuples={requestTuples}
          monthOffset={offset}
        />
      )}
    </div>
  );
}
