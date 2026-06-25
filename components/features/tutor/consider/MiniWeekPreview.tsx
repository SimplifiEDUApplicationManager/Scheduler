'use client';

import type { TutorEvent, Tuple } from '@/lib/types/domain';
import { fmtHour } from '@/lib/utils/tutors';

const START_H = 0;
const END_H = 24;
const ROW_H = 18;
// Column order Mon–Sun; col index → day-of-week
const COL_TO_DAY = [1, 2, 3, 4, 5, 6, 0];
const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOUR_MARKS = [8, 11, 14, 17, 20];

interface ConflictEntry { tp: Tuple; clashes: TutorEvent[] }

interface Props {
  tuples: Tuple[];
  conflicts: ConflictEntry[];
  events: TutorEvent[];
}

export function MiniWeekPreview({ tuples, conflicts, events }: Props) {
  const hours = END_H - START_H;

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden bg-neutral-50">
      {/* Header row */}
      <div className="grid bg-white border-b border-neutral-200" style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}>
        <div />
        {COL_HEADERS.map((d, i) => (
          <div key={i} className="py-1.5 text-center border-l border-neutral-100 text-[9px] font-bold text-fg-muted uppercase tracking-[0.05em]">{d}</div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid relative" style={{ gridTemplateColumns: '32px repeat(7, 1fr)' }}>
        {/* Hour labels */}
        <div style={{ height: hours * ROW_H }}>
          {HOUR_MARKS.map(h => (
            <div key={h} style={{ position: 'absolute', left: 0, width: 32, top: (h - START_H) * ROW_H + 2 }}
              className="text-[9px] text-fg-muted text-right pr-1 tabular-nums">
              {fmtHour(h).replace(' ', '')}
            </div>
          ))}
        </div>

        {COL_TO_DAY.map((dayIdx, ci) => (
          <div key={ci} className="border-l border-neutral-100 relative" style={{ height: hours * ROW_H }}>
            {Array.from({ length: hours }).map((_, i) => (
              <div key={i} style={{ height: ROW_H, borderTop: i === 0 ? 'none' : '1px solid #F5F5F5' }} />
            ))}

            {/* Existing sessions */}
            {events.filter(e => e.day === dayIdx).map((e, ei) => (
              <div key={ei} style={{
                position: 'absolute',
                top: (e.start - START_H) * ROW_H + 1,
                height: Math.max((e.end - e.start) * ROW_H - 2, 6),
                left: 2, right: 2,
                boxSizing: 'border-box',
                background: e.status === 'cancelled' ? '#F4F4F5' : '#E8F4F1',
                borderLeft: `2px solid ${e.status === 'cancelled' ? '#D4D4D8' : '#3F9C8B'}`,
                borderRadius: 3, overflow: 'hidden',
                fontSize: 8, fontWeight: 600,
                color: e.status === 'cancelled' ? '#A1A1AA' : '#1F5349',
                padding: '1px 2px', lineHeight: 1.1,
              }}>
                {e.studentName?.split(' ')[0]}
              </div>
            ))}

            {/* Proposed tuples — split cross-midnight */}
            {(() => {
              const slots: { start: number; end: number; tp: typeof tuples[0] }[] = [];
              for (const tp of tuples) {
                if (tp.day === dayIdx) slots.push({ start: tp.start, end: Math.min(tp.end, END_H), tp });
                if (tp.day === (dayIdx + 6) % 7 && tp.end > 24) slots.push({ start: 0, end: Math.min(tp.end - 24, END_H), tp });
              }
              return slots.map((s, i) => {
                const conflict = conflicts.find(c => c.tp === s.tp);
                const bad = (conflict?.clashes.length ?? 0) > 0;
                const h = Math.max((s.end - s.start) * ROW_H - 2, 6);
                return (
                  <div key={`p${i}`} style={{
                    position: 'absolute',
                    top: (s.start - START_H) * ROW_H + 1,
                    height: h,
                    left: 2, right: 2,
                    boxSizing: 'border-box',
                    background: bad
                      ? 'repeating-linear-gradient(45deg,rgba(220,38,38,0.2) 0 4px,rgba(220,38,38,0.35) 4px 8px)'
                      : 'repeating-linear-gradient(45deg,rgba(24,24,27,0.1) 0 4px,rgba(24,24,27,0.2) 4px 8px)',
                    border: `1.5px dashed ${bad ? '#DC2626' : '#18181B'}`,
                    borderRadius: 3, overflow: 'hidden',
                    fontSize: 8, fontWeight: 700,
                    color: bad ? '#991B1B' : '#18181B',
                    padding: '1px 2px', textAlign: 'center', zIndex: 2,
                  }}>
                    {bad ? '⚠' : '●'}
                  </div>
                );
              });
            })()}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="px-2.5 py-1.5 border-t border-neutral-200 bg-white flex gap-3 text-[10px] text-fg-muted">
        <span className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#E8F4F1', borderLeft: '2px solid #3F9C8B', display: 'inline-block' }} />
          Sessions
        </span>
        <span className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg,rgba(24,24,27,.1) 0 3px,rgba(24,24,27,.2) 3px 6px)', border: '1px dashed #18181B', display: 'inline-block' }} />
          Proposed
        </span>
        <span className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg,rgba(220,38,38,.2) 0 3px,rgba(220,38,38,.35) 3px 6px)', border: '1px dashed #DC2626', display: 'inline-block' }} />
          Conflict
        </span>
      </div>
    </div>
  );
}
