'use client';

import { useState, useMemo } from 'react';
import type { TutorProposal, TutorEvent } from '@/lib/types/domain';
import { TUPLE_COLORS, countFitSlots } from './tupleColors';
import { DropWeek } from './DropWeek';

const START_HR = 8;
const END_HR = 21;
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
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

export function ScheduleStep({ p, events, onBack, onConfirm, onDecline }: Props) {
  const [placements, setPlacements] = useState<Placement[]>(() => p.tuples.map(() => null));
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overSlot, setOverSlot] = useState<{ day: number; start: number } | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);

  const allPlaced = placements.every(pl => pl != null);

  // Placement is only valid at the exact proposed day and start time for the
  // tuple being dragged. Tutors confirm the coordinator-proposed windows; they
  // cannot reschedule to arbitrary times.
  const canDrop = (day: number, start: number, _dur: number): boolean => {
    if (draggingIdx === null) return false;
    const tp = p.tuples[draggingIdx];
    return day === tp.day && start === tp.start;
  };

  // Each tuple has exactly one valid slot: the coordinator-proposed day/time.
  const candidateWindows = useMemo(() => {
    return p.tuples.map((tp, idx) => {
      if (placements[idx]) return [];
      return [{ day: tp.day, start: tp.start, end: tp.end }];
    });
  }, [p.tuples, placements]);

  const autoPlace = () => {
    setPlacements(p.tuples.map(tp => ({ day: tp.day, start: tp.start })));
  };

  const onDrop = (day: number, start: number, e: React.DragEvent) => {
    e.preventDefault();
    const idx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(idx)) return;
    if (!canDrop(day, start, p.tuples[idx].end - p.tuples[idx].start)) return;
    setPlacements(pls => pls.map((pl, i) => i === idx ? { day, start } : pl));
    setOverSlot(null); setDraggingIdx(null);
  };

  const placeAt = (idx: number, day: number, start: number) => {
    const tp = p.tuples[idx];
    if (day !== tp.day || start !== tp.start) return;
    setPlacements(pls => pls.map((pl, i) => i === idx ? { day, start } : pl));
    setFocusedIdx(null); setPinned(false);
  };

  return (
    <>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <aside style={{ width: 300, background: '#fff', borderRight: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 11, color: '#71717A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Proposed times</div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.01em' }}>Drag each to your calendar</h2>
            <div style={{ marginTop: 6, fontSize: 12, color: '#52525B', lineHeight: 1.4 }}>The student offered these slots. Place each one on your week to schedule it.</div>
            <button onClick={autoPlace} style={{ marginTop: 12, height: 28, padding: '0 10px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#18181B', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              ✦ Auto-place all
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {p.tuples.map((tp, i) => {
              const placed = placements[i];
              const color = TUPLE_COLORS[i % TUPLE_COLORS.length];
              const isFocused = focusedIdx === i;
              const dur = tp.end - tp.start;
              return (
                <div key={i}
                  className={'crp-draggable' + (draggingIdx === i ? ' dragging' : '')}
                  draggable={!placed}
                  onDragStart={e => { setDraggingIdx(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                  onDragEnd={() => { setDraggingIdx(null); setOverSlot(null); }}
                  onMouseEnter={() => { if (!placed && !pinned) setFocusedIdx(i); }}
                  onMouseLeave={() => { if (!pinned) setFocusedIdx(null); }}
                  onClick={() => {
                    if (placed) return;
                    if (isFocused && pinned) { setFocusedIdx(null); setPinned(false); }
                    else { setFocusedIdx(i); setPinned(true); }
                  }}
                  style={{ padding: '12px 14px', borderRadius: 10, background: placed ? '#ECFDF5' : isFocused ? color.soft : '#fff', border: `1px solid ${placed ? '#86EFAC' : isFocused ? color.strong : '#E4E4E7'}`, borderLeft: placed ? '1px solid #86EFAC' : `4px solid ${color.strong}`, cursor: placed ? 'default' : 'grab', transition: 'transform 120ms, box-shadow 120ms, background 120ms', boxShadow: isFocused ? `0 2px 10px ${color.shadow}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    {!placed
                      ? <span style={{ color: '#A1A1AA', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>⋮⋮ Drag</span>
                      : <span style={{ padding: '2px 7px', borderRadius: 999, background: '#22C55E', color: '#fff', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>✓ Placed</span>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{p.studentName}</div>
                  <div style={{ fontSize: 11, color: '#52525B', marginTop: 2 }}>{p.subject} · {dur} hr</div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#18181B' }}>
                    {placed
                      ? `${DAY_SHORT[placed.day]} · ${fmtH(placed.start)}–${fmtH(placed.start + dur)}`
                      : `Student proposed ${DAY_SHORT[tp.day]} ${fmtH(tp.start)}–${fmtH(tp.end)}`}
                  </div>
                  {!placed && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: isFocused ? color.strong : '#71717A', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, background: isFocused ? color.soft : '#FAFAFA', border: `1px solid ${isFocused ? color.strong : '#E4E4E7'}`, fontSize: 10 }}>
                        {countFitSlots(candidateWindows[i], dur)} slots fit
                      </span>
                      {isFocused && pinned && <span style={{ fontSize: 10, color: '#71717A', fontWeight: 500 }}>· click again to unpin</span>}
                    </div>
                  )}
                  {placed && (
                    <button onClick={() => setPlacements(pls => pls.map((pl, j) => j === i ? null : pl))} style={{ marginTop: 8, border: 'none', background: 'transparent', color: '#047857', fontSize: 11, fontWeight: 600, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
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
            <div style={{ fontSize: 11, color: '#71717A' }}>Drop onto any open 30-min slot</div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 10, color: '#71717A', alignItems: 'center', flexWrap: 'wrap' }}>
              {[
                { bg: '#E8F4F1', bdr: '1px solid #3F9C8B', bdrL: 3, label: 'Your sessions' },
                { bg: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.06) 0 4px,rgba(24,24,27,0.12) 4px 8px)', bdr: '1.5px dashed #18181B', label: 'Student preferred' },
                { bg: 'rgba(8,145,178,0.12)', bdr: '1px dashed rgba(8,145,178,0.55)', label: 'Where it fits' },
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
            draggingIdx={draggingIdx} canDrop={canDrop} onDrop={onDrop}
            startHr={START_HR} endHr={END_HR}
            candidateWindows={candidateWindows} focusedIdx={focusedIdx}
            onCandidateClick={placeAt}
            onCandidateHover={idx => { if (!pinned) setFocusedIdx(idx); }}
            tupleColors={TUPLE_COLORS}
          />
        </div>
      </div>

      <div style={{ background: '#fff', borderTop: '1px solid #E4E4E7', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -6px 16px rgba(22,32,51,0.04)' }}>
        <div style={{ flex: 1, fontSize: 12, color: '#71717A' }}>
          {allPlaced
            ? <><b style={{ color: '#047857' }}>All {placements.length} slots placed.</b> Confirm to add them to your calendar.</>
            : `${placements.filter(Boolean).length} of ${placements.length} placed. Drag the remaining cards onto any open slot.`}
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
