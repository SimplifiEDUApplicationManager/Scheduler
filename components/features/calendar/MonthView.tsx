import { useMemo } from 'react';
import type { Tutor, Tuple } from '@/lib/types/domain';
import { getMonthDays } from '@/lib/utils/tutors';
import { cn } from '@/lib/utils/cn';

interface MonthViewProps {
  tutors: Tutor[];
  requestTuples: Tuple[];
  monthOffset: number;
}

const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function MonthView({ tutors, requestTuples, monthOffset }: MonthViewProps) {
  const cells = useMemo(() => getMonthDays(monthOffset), [monthOffset]);

  // Per day-of-week, how many filtered tutors have any availability
  const coverageByDow = useMemo(() =>
    Array.from({ length: 7 }, (_, di) =>
      tutors.filter(t => (t.availability[di] ?? []).length > 0).length
    ),
  [tutors]);

  const maxCoverage = Math.max(1, ...coverageByDow);
  const requestDows = new Set(requestTuples.map(tp => tp.day));

  return (
    <div className="flex-1 flex flex-col overflow-auto p-5">
      {/* DOW header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em] py-1">{d}</div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 border-t border-l border-neutral-100">
        {cells.map((cell, i) => {
          const n = cell.inMonth ? coverageByDow[cell.dayIdx] : 0;
          const alpha = n > 0 ? (0.08 + 0.45 * (n / maxCoverage)).toFixed(2) : '0';
          const hasRequest = cell.inMonth && requestDows.has(cell.dayIdx);
          return (
            <div
              key={i}
              style={{ background: n > 0 ? `rgba(63,156,139,${alpha})` : undefined }}
              className={cn(
                'relative border-r border-b border-neutral-100 p-1.5 min-h-[72px]',
                !cell.inMonth && 'bg-surface-2',
              )}
            >
              <div suppressHydrationWarning className={cn(
                'text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center',
                cell.today   ? 'bg-brand-ink text-fg-on-brand' : '',
                !cell.inMonth ? 'text-fg-muted' : 'text-fg-2',
              )}>{cell.date}</div>
              {n > 0 && (
                <div style={{ fontSize:10, color:'#1F5349', fontWeight:700, marginTop:2 }}>
                  {n} free
                </div>
              )}
              {hasRequest && (
                <div
                  style={{ position:'absolute', bottom:5, right:5, width:6, height:6, borderRadius:999, background:'#18181B' }}
                  title="Requested window"
                />
              )}
            </div>
          );
        })}
      </div>

      {tutors.length === 0 && (
        <p className="text-center text-sm text-fg-muted mt-6">No tutors match the current filters.</p>
      )}
    </div>
  );
}
