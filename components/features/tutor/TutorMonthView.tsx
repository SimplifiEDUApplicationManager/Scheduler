'use client';

import { useState, useRef, useCallback } from 'react';
import type { TutorEvent, TutorProposal } from '@/lib/types/domain';
import { getMonthDays, getMonthLabel, DAY_NAMES } from '@/lib/utils/tutors';
import { cn } from '@/lib/utils/cn';

const LONG_PRESS_MS = 500;

interface Props {
  events: TutorEvent[];
  proposal: TutorProposal | null;
  monthOffset: number;
  onOpenSession: (id: string) => void;
  onTogglePin?: (event: TutorEvent) => void;
}

export function TutorMonthView({ events, proposal, monthOffset, onOpenSession, onTogglePin }: Props) {
  const pressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartRef = useRef<number>(0);
  const pressFiredRef = useRef(false);
  const clickBlockRef = useRef(false);

  const stopPress = useCallback(() => {
    if (pressTimerRef.current) {
      clearInterval(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    pressFiredRef.current = false;
    setTimeout(() => { clickBlockRef.current = false; }, 50);
  }, []);

  const startPress = useCallback((e: TutorEvent) => {
    if (e.pinSource === 'app' || e.status === 'cancelled') return;
    pressFiredRef.current = false;
    pressStartRef.current = Date.now();
    clickBlockRef.current = true;

    pressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - pressStartRef.current;
      if (elapsed >= LONG_PRESS_MS) {
        pressFiredRef.current = true;
        if (pressTimerRef.current) {
          clearInterval(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        onTogglePin?.(e);
      }
    }, 16);
  }, [onTogglePin]);

  const handleClick = useCallback((e: TutorEvent) => {
    if (clickBlockRef.current) return;
    onOpenSession(e.id);
  }, [onOpenSession]);
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
              <div suppressHydrationWarning className={cn(
                'text-xs font-semibold w-5 h-5 rounded-full flex items-center justify-center mb-1',
                cell.today    ? 'bg-brand-ink text-white' : '',
                !cell.inMonth ? 'text-fg-muted' : 'text-fg-2',
              )}>{cell.date}</div>

              {dayEvents.map(e => {
                const isPinned = e.pinSource === 'auto' || e.pinSource === 'manual';
                return (
                  <div
                    key={e.id}
                    onClick={() => handleClick(e)}
                    onMouseDown={() => startPress(e)}
                    onMouseUp={stopPress}
                    onMouseLeave={stopPress}
                    onTouchStart={() => startPress(e)}
                    onTouchEnd={stopPress}
                    style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                      cursor: e.pinSource !== 'app' ? 'grab' : 'pointer',
                      background: e.kind === 'other' ? '#F5F5F5' : '#E8F4F1',
                      color: e.kind === 'other' ? '#52525B' : '#1F5349',
                      fontWeight: 600,
                      userSelect: 'none',
                      display: 'flex', alignItems: 'center', gap: 2,
                    }}
                    className="truncate mb-0.5"
                  >
                    {isPinned && (
                      <svg width={8} height={8} viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }}>
                        <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.708l-.565-.565-2.122 2.121a.5.5 0 0 1-.354.147H9.828l-2.828 2.828v1.414a.5.5 0 0 1-.854.354l-4.242-4.243a.5.5 0 0 1 .354-.853h1.414l2.829-2.829V3.757a.5.5 0 0 1 .146-.354l2.122-2.121-.566-.566a.5.5 0 0 1 .147-.707z" />
                      </svg>
                    )}
                    <span className="truncate">{e.title}</span>
                  </div>
                );
              })}

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
