'use client';

import type { TutorEvent, TutorProposal } from '@/lib/types/domain';
import { fmtRange, getWeekDays } from '@/lib/utils/tutors';
import { cn } from '@/lib/utils/cn';

const ROW_H = 40;
const START_H = 0;
const END_H = 24;
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);

function eventBg(e: TutorEvent) {
  if (e.status === 'cancelled') return { bg: '#FAFAFA', border: '#D4D4D8', text: '#A1A1AA' };
  if (e.kind === 'other')       return { bg: '#F5F5F5', border: '#A1A1AA', text: '#52525B' };
  if (e.status === 'completed') return { bg: '#F4F4F5', border: '#A1A1AA', text: '#52525B' };
  return { bg: '#E8F4F1', border: '#3F9C8B', text: '#1F5349' };
}

interface Props {
  events: TutorEvent[];
  proposal: TutorProposal | null;
  weekOffset: number;
  onOpenSession: (id: string) => void;
}

export function TutorWeekView({ events, proposal, weekOffset, onOpenSession }: Props) {
  const weekDays = getWeekDays(weekOffset);

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Sticky day header */}
      <div
        className="grid sticky top-0 bg-white z-10 border-b border-neutral-200"
        style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}
      >
        <div />
        {weekDays.map((d, i) => (
          <div key={i} className="py-2.5 text-center border-l border-neutral-100">
            <div className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em]">{d.dow}</div>
            <div suppressHydrationWarning className={cn(
              'mt-0.5 mx-auto text-sm font-semibold w-6 h-6 rounded-full flex items-center justify-center',
              d.today ? 'bg-brand-ink text-white' : 'text-fg-1',
            )}>{d.date}</div>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        {/* Hour rail */}
        <div>
          {HOURS.map(h => (
            <div
              key={h}
              style={{ height: ROW_H }}
              className="text-[10px] text-fg-muted text-right pr-1.5 pt-0.5 border-t border-neutral-100 tabular-nums"
            >
              {h === 0 || h === 24 ? '' : h > 12 ? `${h - 12}p` : h === 12 ? '12p' : `${h}a`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {Array.from({ length: 7 }).map((_, di) => {
          const dayEvents  = events.filter(e => e.day === di);
          const dayTuples  = proposal?.tuples.filter(tp => tp.day === di) ?? [];

          return (
            <div key={di} className="border-l border-neutral-100 relative">
              {HOURS.map(h => (
                <div key={h} style={{ height: ROW_H }} className="border-t border-neutral-100" />
              ))}

              {/* Existing events */}
              {dayEvents.map(e => {
                const { bg, border, text } = eventBg(e);
                return (
                  <div
                    key={e.id}
                    onClick={() => onOpenSession(e.id)}
                    style={{
                      position: 'absolute',
                      top: (e.start - START_H) * ROW_H + 1,
                      height: Math.max((e.end - e.start) * ROW_H - 2, 14),
                      left: 3, right: 3,
                      boxSizing: 'border-box',
                      background: bg,
                      borderLeft: `3px solid ${border}`,
                      borderRadius: 4,
                      padding: '3px 5px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      textDecoration: e.status === 'cancelled' ? 'line-through' : 'none',
                      opacity: e.status === 'cancelled' ? 0.7 : 1,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {e.title}
                    </div>
                    {(e.end - e.start) * ROW_H >= 28 && (
                      <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.8, marginTop: 1, color: text }}>
                        {fmtRange(e.start, e.end)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Proposal overlay — dashed striped */}
              {dayTuples.map((tp, ti) => (
                <div
                  key={`p${ti}`}
                  style={{
                    position: 'absolute',
                    top: (tp.start - START_H) * ROW_H + 1,
                    height: (tp.end - tp.start) * ROW_H - 2,
                    left: 3, right: 3,
                    boxSizing: 'border-box',
                    background: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.06) 0 6px,rgba(24,24,27,0.12) 6px 12px)',
                    border: '1.5px dashed #18181B',
                    borderRadius: 6,
                    padding: '4px 6px',
                    overflow: 'hidden',
                    zIndex: 3,
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#18181B', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span>+</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {proposal!.studentName}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.75, marginTop: 1, color: '#18181B' }}>
                    {fmtRange(tp.start, tp.end)} · proposed
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
