'use client';

import { useState, useRef, useCallback } from 'react';
import type { TutorEvent, TutorProposal } from '@/lib/types/domain';
import { fmtRange, getWeekDays } from '@/lib/utils/tutors';
import { cn } from '@/lib/utils/cn';

const ROW_H = 40;
const START_H = 0;
const END_H = 24;
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);
const LONG_PRESS_MS = 500;

/** Parse hex color (#RRGGBB or #RGB) to [r, g, b]. */
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Linearly blend two hex colors by progress (0→1). */
function blendColor(from: string, to: string, progress: number): string {
  const [r1, g1, b1] = parseHex(from);
  const [r2, g2, b2] = parseHex(to);
  const r = Math.round(r1 + (r2 - r1) * progress);
  const g = Math.round(g1 + (g2 - g1) * progress);
  const b = Math.round(b1 + (b2 - b1) * progress);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const TEAL  = { bg: '#E8F4F1', border: '#3F9C8B', text: '#1F5349' };
const GRAY  = { bg: '#F5F5F5', border: '#A1A1AA', text: '#52525B' };

function eventBg(e: TutorEvent) {
  if (e.status === 'cancelled') return { bg: '#FAFAFA', border: '#D4D4D8', text: '#A1A1AA' };
  if (e.kind === 'other')       return GRAY;
  if (e.status === 'completed') return { bg: '#F4F4F5', border: '#A1A1AA', text: '#52525B' };
  return TEAL;
}

/** Pin icon (SVG) shown on toggleable teal events. */
function PinIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }}>
      <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.708l-.565-.565-2.122 2.121a.5.5 0 0 1-.354.147H9.828l-2.828 2.828v1.414a.5.5 0 0 1-.854.354l-4.242-4.243a.5.5 0 0 1 .354-.853h1.414l2.829-2.829V3.757a.5.5 0 0 1 .146-.354l2.122-2.121-.566-.566a.5.5 0 0 1 .147-.707z" />
    </svg>
  );
}

interface Props {
  events: TutorEvent[];
  proposal: TutorProposal | null;
  weekOffset: number;
  onOpenSession: (id: string) => void;
  onTogglePin?: (event: TutorEvent) => void;
}

export function TutorWeekView({ events, proposal, weekOffset, onOpenSession, onTogglePin }: Props) {
  // Long-press state: which event is being held and its progress (0→1)
  const [pressState, setPressState] = useState<{ id: string; progress: number } | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressStartRef = useRef<number>(0);
  const pressFiredRef = useRef(false);
  const clickBlockRef = useRef(false);

  const stopPress = useCallback(() => {
    if (pressTimerRef.current) {
      clearInterval(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (!pressFiredRef.current) {
      setPressState(null);
    }
    pressFiredRef.current = false;
    // Unblock clicks after a short delay so the mouseup click doesn't fire
    setTimeout(() => { clickBlockRef.current = false; }, 50);
  }, []);

  const startPress = useCallback((e: TutorEvent) => {
    if (e.pinSource === 'app' || e.status === 'cancelled') return;
    pressFiredRef.current = false;
    pressStartRef.current = Date.now();
    clickBlockRef.current = true;
    setPressState({ id: e.id, progress: 0 });

    pressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - pressStartRef.current;
      const progress = Math.min(elapsed / LONG_PRESS_MS, 1);
      setPressState({ id: e.id, progress });

      if (progress >= 1) {
        pressFiredRef.current = true;
        if (pressTimerRef.current) {
          clearInterval(pressTimerRef.current);
          pressTimerRef.current = null;
        }
        // Brief scale pulse then clear
        setTimeout(() => setPressState(null), 200);
        onTogglePin?.(e);
      }
    }, 16);
  }, [onTogglePin]);

  const handleClick = useCallback((e: TutorEvent) => {
    if (clickBlockRef.current) return;
    onOpenSession(e.id);
  }, [onOpenSession]);
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
          // Split cross-midnight proposal tuples across day columns
          const dayTuples: { start: number; end: number; day: number }[] = [];
          for (const tp of proposal?.tuples ?? []) {
            if (tp.day === di) dayTuples.push({ ...tp, end: Math.min(tp.end, END_H) });
            if (tp.day === (di + 6) % 7 && tp.end > 24) dayTuples.push({ day: di, start: 0, end: Math.min(tp.end - 24, END_H) });
          }

          return (
            <div key={di} className="border-l border-neutral-100 relative">
              {HOURS.map(h => (
                <div key={h} style={{ height: ROW_H }} className="border-t border-neutral-100" />
              ))}

              {/* Existing events */}
              {dayEvents.map(e => {
                const colors = eventBg(e);
                const isToggleable = e.pinSource !== 'app' && e.status !== 'cancelled';
                const isPinned = e.pinSource === 'auto' || e.pinSource === 'manual';
                const press = pressState?.id === e.id ? pressState : null;
                const completed = press && press.progress >= 1;

                // During long-press, interpolate background from current → target color
                const targetColors = e.kind === 'session' ? GRAY : TEAL;
                let bg = colors.bg;
                let border = colors.border;
                let text = colors.text;
                if (press && isToggleable) {
                  const p = press.progress;
                  bg = p < 1 ? blendColor(colors.bg, targetColors.bg, p) : targetColors.bg;
                  border = p < 1 ? blendColor(colors.border, targetColors.border, p) : targetColors.border;
                  text = p < 1 ? blendColor(colors.text, targetColors.text, p) : targetColors.text;
                }

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
                      cursor: isToggleable ? 'grab' : 'pointer',
                      textDecoration: e.status === 'cancelled' ? 'line-through' : 'none',
                      opacity: e.status === 'cancelled' ? 0.7 : 1,
                      transform: completed ? 'scale(1.03)' : 'scale(1)',
                      transition: completed ? 'transform 0.15s ease-out' : 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 3 }}>
                      {isPinned && !press && <PinIcon />}
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
