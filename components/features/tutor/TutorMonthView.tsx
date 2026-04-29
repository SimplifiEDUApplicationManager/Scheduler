'use client';

import type { TutorEvent, TutorProposal } from '@/lib/data/dashboard-mock';
import { getMonthDays, getMonthLabel, DAY_NAMES } from '@/lib/utils/tutors';
import { cn } from '@/lib/utils/cn';

interface Props {
  events: TutorEvent[];
  proposal: TutorProposal | null;
  monthOffset: number;
  onOpenSession: (id: string) => void;
}

export function TutorMonthView({ events, proposal, monthOffset, onOpenSession }: Props) {
  const cells = getMonthDays(monthOffset);
  const proposalDows = new Set(proposal?.tuples.map(tp => tp.day) ?? []);

  return (
    <div className="flex-1 overflow-auto p-4 bg-white flex flex-col">
      <div className="text-[13px] font-semibold text-fg-1 mb-3 shrink-0">{getMonthLabel(monthOffset)}</div>

      {/* DOW header */}
      <div className="grid grid-cols-7 mb-1 shrink-0">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em] py-1">{d}</div>
        ))}
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-7 border-t border-l border-neutral-100 flex-1">
        {cells.map((cell, i) => {
          const dayEvents = cell.inMonth
            ? events.filter(e => e.day === cell.dayIdx && e.status !== 'cancelled').slice(0, 2)
            : [];
          const hasProposal = cell.inMonth && proposalDows.has(cell.dayIdx);

          return (
            <div
              key={i}
              className={cn(
                'border-r border-b border-neutral-100 p-1.5 min-h-[76px]',
                !cell.inMonth && 'bg-surface-2',
              )}
            >
              <div className={cn(
                'text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center mb-1',
                cell.today    ? 'bg-brand-ink text-white' : '',
                !cell.inMonth ? 'text-fg-muted' : 'text-fg-2',
              )}>{cell.date}</div>

              {dayEvents.map(e => (
                <div
                  key={e.id}
                  onClick={() => onOpenSession(e.id)}
                  style={{
                    fontSize: 9, padding: '1px 5px', borderRadius: 3, cursor: 'pointer',
                    background: e.kind === 'other' ? '#F5F5F5' : '#E8F4F1',
                    color: e.kind === 'other' ? '#52525B' : '#1F5349',
                    fontWeight: 600,
                  }}
                  className="truncate mb-0.5"
                >
                  {e.title}
                </div>
              ))}

              {hasProposal && proposal && (
                <div
                  style={{
                    fontSize: 9, padding: '2px 5px', borderRadius: 3,
                    background: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.08) 0 4px,rgba(24,24,27,0.16) 4px 8px)',
                    border: '1px dashed #18181B',
                    color: '#18181B', fontWeight: 700,
                  }}
                  className="truncate"
                >
                  + {proposal.studentName}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
