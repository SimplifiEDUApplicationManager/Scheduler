'use client';

import { useState, useMemo } from 'react';
import type { TutorProposal, TutorEvent } from '@/lib/types/domain';
import { TUPLE_COLORS, countFitSlots } from './tupleColors';
import { DropWeek } from './DropWeek';

const START_HR = 0;
const END_HR = 24;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Placement = { day: number; start: number } | null;

interface Props {
  p: TutorProposal;
  events: TutorEvent[];
  onBack: () => void;
  onConfirm: (placements: Placement[]) => void;
  onDecline: () => void;
}

function fmtH(h: number): string {
  const hr = Math.floor(h % 24); const mn = Math.round((h % 1) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

export function ScheduleStep({ p, events, onBack, onConfirm, onDecline }: Props) {
  const sessionsNeeded = p.sessionsPerWeek ?? 1;
  const durationHrs = (p.sessionDurationMinutes ?? 60) / 60;
  const durationMin = p.sessionDurationMinutes ?? 60;

  const [placements, setPlacements] = useState<Placement[]>(() => Array(sessionsNeeded).fill(null));
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [overSlot, setOverSlot] = useState<{ day: number; start: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);

  const canDrop = (day: number, start: number): boolean => {
    return p.tuples.some(tp => tp.day === day && start >= tp.start && start + durationHrs <= tp.end);
  };

  const candidateWindows = useMemo(() => {
    if (placements[activeIdx]) return p.tuples.map(() => [] as { day: number; start: number; end: number }[]);
    return p.tuples.map(tp => [{ day: tp.day, start: tp.start, end: tp.end }]);
  }, [p.tuples, placements, activeIdx]);

  const totalFitSlots = useMemo(
    () => countFitSlots(p.tuples.map(tp => ({ start: tp.start, end: tp.end })), durationHrs),
    [p.tuples, durationHrs],
  );

  const autoPlace = () => {
    const tp = p.tuples[0];
    if (tp) {
      const next = [...placements];
      next[activeIdx] = { day: tp.day, start: tp.start };
      setPlacements(next);
    }
  };

  const onDrop = (day: number, start: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!canDrop(day, start)) return;
    const next = [...placements];
    next[activeIdx] = { day, start };
    setPlacements(next);
    setOverSlot(null); setDragging(false);
    // Auto-advance to next unplaced session
    const nextEmpty = next.findIndex((pl, i) => i > activeIdx && pl === null);
    if (nextEmpty >= 0) setActiveIdx(nextEmpty);
  };

  const placeAt = (_idx: number, day: number, start: number) => {
    if (!canDrop(day, start)) return;
    const next = [...placements];
    next[activeIdx] = { day, start };
    setPlacements(next);
    setFocused(false); setPinned(false);
    const nextEmpty = next.findIndex((pl, i) => i > activeIdx && pl === null);
    if (nextEmpty >= 0) setActiveIdx(nextEmpty);
  };

  const resetPlacement = (idx: number) => {
    const next = [...placements];
    next[idx] = null;
    setPlacements(next);
    setActiveIdx(idx);
  };

  const color = TUPLE_COLORS[0];
  const allPlaced = placements.every(pl => pl !== null);
  const placedCount = placements.filter(pl => pl !== null).length;

  const durationLabel = durationMin === 60 ? '1 hr' : durationMin === 90 ? '1.5 hr' : `${durationMin}m`;
  const headerLabel = sessionsNeeded === 1
    ? `Pick a ${durationLabel} slot`
    : `Place ${sessionsNeeded} × ${durationLabel} sessions`;

  return (
    <>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <aside style={{ width: 300, background: '#fff', borderRight: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 11, color: '#71717A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Schedule session{sessionsNeeded > 1 ? 's' : ''}</div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.01em' }}>{headerLabel}</h2>
            <div style={{ marginTop: 6, fontSize: 12, color: '#52525B', lineHeight: 1.4 }}>
              {sessionsNeeded > 1
                ? `Drag each card onto a highlighted window. ${placedCount}/${sessionsNeeded} placed.`
                : 'Drag the card onto any highlighted window — or click a window directly to place the session there.'}
            </div>
            <button onClick={autoPlace} style={{ marginTop: 12, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#18181B', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              ✦ Auto-place
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {placements.map((pl, idx) => {
              const isActive = idx === activeIdx;
              const isPlaced = pl !== null;
              return (
                <div
                  key={idx}
                  className={'crp-draggable' + (dragging && isActive ? ' dragging' : '')}
                  draggable={!isPlaced && isActive}
                  onDragStart={e => { setDragging(true); setActiveIdx(idx); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx)); }}
                  onDragEnd={() => { setDragging(false); setOverSlot(null); }}
                  onClick={() => {
                    if (isPlaced) return;
                    setActiveIdx(idx);
                    if (focused && pinned && isActive) { setFocused(false); setPinned(false); }
                    else { setFocused(true); setPinned(true); }
                  }}
                  onMouseEnter={() => { if (!isPlaced && isActive && !pinned) setFocused(true); }}
                  onMouseLeave={() => { if (!pinned) setFocused(false); }}
                  style={{
                    padding: '12px 14px', borderRadius: 10,
                    background: isPlaced ? '#ECFDF5' : isActive && focused ? color.soft : '#fff',
                    border: `1px solid ${isPlaced ? '#86EFAC' : isActive && focused ? color.strong : isActive ? color.borderDash : '#E4E4E7'}`,
                    borderLeft: isPlaced ? '1px solid #86EFAC' : `4px solid ${isActive ? color.strong : '#D4D4D8'}`,
                    cursor: isPlaced ? 'default' : isActive ? 'grab' : 'pointer',
                    transition: 'background 120ms, border-color 120ms',
                    opacity: !isActive && !isPlaced ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    {isPlaced
                      ? <span style={{ padding: '2px 7px', borderRadius: 999, background: '#22C55E', color: '#fff', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>✓ Placed</span>
                      : isActive
                        ? <span style={{ color: '#A1A1AA', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>⋮⋮ Drag</span>
                        : <span style={{ color: '#A1A1AA', fontSize: 10 }}>Session {idx + 1}</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{p.studentName}</div>
                  <div style={{ fontSize: 11, color: '#52525B', marginTop: 2 }}>
                    {p.subject} · {durationLabel}{sessionsNeeded > 1 ? ` (${idx + 1}/${sessionsNeeded})` : '/week'}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#18181B' }}>
                    {pl
                      ? `${DAY_SHORT[pl.day]} · ${fmtH(pl.start)}–${fmtH(pl.start + durationHrs)}`
                      : 'Drop into any highlighted window'}
                  </div>
                  {!isPlaced && isActive && (
                    <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, background: focused ? color.soft : '#FAFAFA', border: `1px solid ${focused ? color.strong : '#E4E4E7'}`, fontSize: 10, color: focused ? color.strong : '#71717A', fontWeight: 600, alignSelf: 'flex-start' }}>
                      {totalFitSlots} slots available
                    </div>
                  )}
                  {isPlaced && (
                    <button onClick={() => resetPlacement(idx)} style={{ marginTop: 8, border: 'none', background: 'transparent', color: '#047857', fontSize: 11, fontWeight: 600, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✕ Reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Your week</h3>
            <div style={{ fontSize: 11, color: '#71717A' }}>Drop anywhere within the student's available windows</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 10, color: '#71717A', alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { bg: '#E8F4F1', bdr: '1px solid #3F9C8B', label: 'Your sessions' },
                { bg: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.06) 0 4px,rgba(24,24,27,0.12) 4px 8px)', bdr: '1.5px dashed #18181B', label: 'Student available' },
                { bg: 'rgba(8,145,178,0.12)', bdr: '1px dashed rgba(8,145,178,0.55)', label: 'Drop zone' },
                { bg: '#22C55E', label: 'Placed' },
              ].map(({ bg, bdr, label }) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: bg, border: bdr, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <DropWeek
            events={events} proposal={p} placements={placements} tuples={p.tuples}
            overSlot={overSlot} setOverSlot={setOverSlot}
            dragging={dragging} canDrop={canDrop} onDrop={onDrop}
            startHr={START_HR} endHr={END_HR}
            candidateWindows={candidateWindows} focused={focused}
            onCandidateClick={placeAt}
            onCandidateHover={on => { if (!pinned) setFocused(on); }}
            tupleColors={TUPLE_COLORS}
          />
        </div>
      </div>

      <div style={{ background: '#fff', borderTop: '1px solid #E4E4E7', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -6px 16px rgba(22,32,51,0.04)' }}>
        <div style={{ flex: 1, fontSize: 12, color: '#71717A' }}>
          {allPlaced
            ? <><b style={{ color: '#047857' }}>{sessionsNeeded === 1 ? 'Session' : `All ${sessionsNeeded} sessions`} placed.</b> Confirm to add {sessionsNeeded === 1 ? 'it' : 'them'} to your calendar.</>
            : `Place ${sessionsNeeded - placedCount} more session${sessionsNeeded - placedCount !== 1 ? 's' : ''} to continue.`}
        </div>
        <button onClick={onDecline} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
        <button onClick={onBack} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Back</button>
        <button disabled={!allPlaced} onClick={() => onConfirm(placements)} style={{ height: 40, padding: '0 22px', borderRadius: 10, border: 'none', background: allPlaced ? '#18181B' : '#E4E4E7', color: allPlaced ? '#fff' : '#A1A1AA', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: allPlaced ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          ✓ Confirm schedule
        </button>
      </div>
    </>
  );
}
