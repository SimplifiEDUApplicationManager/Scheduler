'use client';

import type { TutorProposal, TutorEvent, Tuple } from '@/lib/types/domain';
import type { TupleColor } from './tupleColors';
import { fmtRange, getWeekDays } from '@/lib/utils/tutors';

const ROW_H = 38;
const COL_TO_DAY = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

interface Props {
  events: TutorEvent[];
  proposal: TutorProposal;
  placements: ({ day: number; start: number } | null)[];
  tuples: Tuple[];
  overSlot: { day: number; start: number } | null;
  setOverSlot: (s: { day: number; start: number } | null) => void;
  draggingIdx: number | null;
  canDrop: (day: number, start: number, dur: number) => boolean;
  onDrop: (day: number, start: number, e: React.DragEvent) => void;
  startHr: number;
  endHr: number;
  candidateWindows: { day: number; start: number; end: number }[][];
  focusedIdx: number | null;
  onCandidateClick: (idx: number, day: number, start: number) => void;
  onCandidateHover: (idx: number | null) => void;
  tupleColors: TupleColor[];
}

function fmtH(h: number): string {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

export function DropWeek({ events, proposal, placements, tuples, overSlot, setOverSlot, draggingIdx, canDrop, onDrop, startHr, endHr, candidateWindows, focusedIdx, onCandidateClick, onCandidateHover, tupleColors }: Props) {
  const hours = Array.from({ length: endHr - startHr + 1 }, (_, i) => startHr + i);
  const halfSteps = Array.from({ length: (endHr - startHr) * 2 }, (_, i) => startHr + i * 0.5);
  const colHeight = hours.length * ROW_H;
  const weekDays = getWeekDays(0);
  const colDays = COL_TO_DAY.map(dow => weekDays.find(d => d.dayIdx === dow)!);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
      {/* Sticky header */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', position: 'sticky', top: 0, background: '#fff', zIndex: 2, borderBottom: '1px solid #E4E4E7' }}>
        <div />
        {colDays.map((wd, i) => (
          <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{wd.dow}</div>
            <div style={{ marginTop: 2, fontSize: 14, fontWeight: 600, color: wd.today ? '#fff' : '#18181B', background: wd.today ? '#18181B' : 'transparent', borderRadius: 999, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{wd.date}</div>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: ROW_H, fontSize: 10, color: '#A1A1AA', padding: '2px 6px', textAlign: 'right', borderTop: '1px solid #F5F5F5' }}>{fmtH(h)}</div>
          ))}
        </div>

        {COL_TO_DAY.map((dayIdx, ci) => (
          <div key={ci} style={{ borderLeft: '1px solid #F5F5F5', position: 'relative', height: colHeight }}>
            {/* Candidate windows */}
            {tuples.map((tp, ti) => {
              if (placements[ti]) return null;
              const color = tupleColors[ti % tupleColors.length];
              const isFocused = focusedIdx === ti;
              const anyFocused = focusedIdx != null;
              const bg = isFocused ? color.bandBright : anyFocused ? 'rgba(0,0,0,0.02)' : color.band;
              const bdr = isFocused ? `1.5px dashed ${color.strong}` : anyFocused ? '1px dashed rgba(0,0,0,0.08)' : `1px dashed ${color.borderDash}`;
              const dur = tp.end - tp.start;
              return (candidateWindows[ti] || []).filter(w => w.day === dayIdx).map((w, wi) => (
                <div key={`c-${ti}-${wi}`}
                  onMouseEnter={() => onCandidateHover(ti)}
                  onMouseLeave={() => onCandidateHover(null)}
                  onClick={() => onCandidateClick(ti, dayIdx, w.start)}
                  title={`Fits ${proposal.subject} · ${dur} hr · click to place`}
                  style={{ position: 'absolute', top: (w.start - startHr) * ROW_H, height: (w.end - w.start) * ROW_H, left: 2, right: 2, background: bg, border: bdr, borderRadius: 4, cursor: 'pointer', zIndex: isFocused ? 3 : 1, transition: 'background 120ms', display: 'flex', alignItems: 'flex-start', padding: '2px 4px', overflow: 'hidden', pointerEvents: draggingIdx != null ? 'none' : 'auto' }}>
                  {isFocused && (w.end - w.start) * ROW_H >= 24 && (
                    <span style={{ background: 'rgba(255,255,255,0.9)', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: color.strong }}>Fits {dur}hr</span>
                  )}
                </div>
              ));
            })}

            {/* Half-hour drop zones */}
            {halfSteps.map((h, hi) => {
              const isOver = overSlot?.day === dayIdx && Math.abs((overSlot?.start ?? -1) - h) < 0.01;
              const tuple = draggingIdx != null ? tuples[draggingIdx] : null;
              const dur = tuple ? tuple.end - tuple.start : 0;
              const droppable = draggingIdx != null && canDrop(dayIdx, h, dur);
              return (
                <div key={hi}
                  className={'crp-slot' + (isOver && droppable ? ' over' : '')}
                  onDragOver={e => { if (draggingIdx == null || !droppable) return; e.preventDefault(); setOverSlot({ day: dayIdx, start: h }); }}
                  onDragLeave={() => { if (isOver) setOverSlot(null); }}
                  onDrop={e => onDrop(dayIdx, h, e)}
                  style={{ position: 'absolute', top: (h - startHr) * ROW_H, left: 0, right: 0, height: ROW_H / 2 }}
                />
              );
            })}

            {/* Student's preferred times */}
            {tuples.map((tp, i) => {
              if (tp.day !== dayIdx || placements[i]) return null;
              return (
                <div key={`pref-${i}`} style={{ position: 'absolute', top: (tp.start - startHr) * ROW_H + 1, height: (tp.end - tp.start) * ROW_H - 2, left: 4, right: 4, background: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.06) 0 6px,rgba(24,24,27,0.12) 6px 12px)', border: '1.5px dashed #71717A', borderRadius: 4, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#52525B', textAlign: 'center', padding: 4, zIndex: 4 }}>
                  Student prefers
                </div>
              );
            })}

            {/* Existing events */}
            {events.filter(e => e.day === dayIdx).map((e, ei) => (
              <div key={ei} style={{ position: 'absolute', top: (e.start - startHr) * ROW_H + 1, height: (e.end - e.start) * ROW_H - 2, left: 4, right: 4, background: e.status === 'cancelled' ? '#FAFAFA' : e.kind === 'other' ? '#F5F5F5' : e.status === 'completed' ? '#F4F4F5' : '#E8F4F1', borderLeft: `3px solid ${e.status === 'cancelled' ? '#D4D4D8' : e.kind === 'other' ? '#A1A1AA' : e.status === 'completed' ? '#A1A1AA' : '#3F9C8B'}`, borderRadius: 4, padding: '4px 6px', fontSize: 11, fontWeight: 600, color: e.status === 'cancelled' ? '#A1A1AA' : e.kind === 'other' ? '#52525B' : e.status === 'completed' ? '#52525B' : '#1F5349', textDecoration: e.status === 'cancelled' ? 'line-through' : 'none', overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 1 }}>{fmtRange(e.start, e.end)}</div>
              </div>
            ))}

            {/* Placed cards */}
            {placements.map((pl, i) => {
              if (!pl || pl.day !== dayIdx) return null;
              const dur = tuples[i].end - tuples[i].start;
              return (
                <div key={`pl-${i}`} style={{ position: 'absolute', top: (pl.start - startHr) * ROW_H + 1, height: dur * ROW_H - 2, left: 4, right: 4, background: '#22C55E', borderRadius: 6, padding: '4px 6px', fontSize: 11, fontWeight: 700, color: '#fff', overflow: 'hidden', boxShadow: '0 2px 6px rgba(34,197,94,0.35)', pointerEvents: 'none', animation: 'crpSlotPulse 800ms ease-out', zIndex: 6 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{proposal.studentName}</div>
                  <div style={{ fontSize: 9, opacity: 0.9, marginTop: 1 }}>{fmtH(pl.start)}–{fmtH(pl.start + dur)}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
