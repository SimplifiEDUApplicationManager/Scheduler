'use client';

import { useState, useCallback, useRef } from 'react';
import type { TutorProposal, TutorEvent, Tuple } from '@/lib/types/domain';
import { fmtRange, getWeekDays } from '@/lib/utils/tutors';

const ROW_H = 38;
const SLOT_MIN = 15;
const SLOTS_PER_HOUR = 60 / SLOT_MIN;
const SLOT_H = ROW_H / SLOTS_PER_HOUR;
const COL_TO_DAY = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtH(h: number): string {
  if (h === 0 || h === 24) return '';
  const hr = Math.floor(h % 24);
  const mn = Math.round((h - Math.floor(h)) * 60);
  const suf = hr >= 12 ? 'p' : 'a';
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

/** Subtract tutor events from student availability to get paintable windows. */
function subtractEvents(tuples: Tuple[], events: TutorEvent[]): Tuple[] {
  const result: Tuple[] = [];
  for (const tp of tuples) {
    let windows: { start: number; end: number }[] = [{ start: tp.start, end: tp.end }];
    for (const ev of events) {
      if (ev.day !== tp.day || ev.status === 'cancelled') continue;
      const next: { start: number; end: number }[] = [];
      for (const w of windows) {
        if (ev.end <= w.start || ev.start >= w.end) {
          next.push(w);
        } else {
          if (ev.start > w.start) next.push({ start: w.start, end: ev.start });
          if (ev.end < w.end) next.push({ start: ev.end, end: w.end });
        }
      }
      windows = next;
    }
    for (const w of windows) {
      if (w.end - w.start >= 0.25) {
        result.push({ day: tp.day, start: w.start, end: w.end });
      }
    }
  }
  return result;
}

/** Check if a slot is within any of the given windows. */
function isInWindow(day: number, slotStart: number, windows: Tuple[]): boolean {
  return windows.some(w => w.day === day && slotStart >= w.start && slotStart + 0.25 <= w.end + 0.001);
}

interface Props {
  proposal: TutorProposal;
  events: TutorEvent[];
  /** Student's availability tuples (already converted to tutor's TZ). */
  tuples: Tuple[];
  /** Current painted ranges. */
  painted: Tuple[];
  onPaintChange: (ranges: Tuple[]) => void;
  startHr: number;
  endHr: number;
}

export function PaintWeek({ proposal, events, tuples, painted, onPaintChange, startHr, endHr }: Props) {
  const hours = Array.from({ length: endHr - startHr + 1 }, (_, i) => startHr + i);
  const colHeight = hours.length * ROW_H;
  const weekDays = getWeekDays(0);
  const colDays = COL_TO_DAY.map(dow => weekDays.find(d => d.dayIdx === dow)!);

  // Compute paintable windows (student availability minus tutor events)
  const paintableWindows = subtractEvents(tuples, events);

  // Paint state
  const [painting, setPainting] = useState(false);
  const [paintMode, setPaintMode] = useState<'add' | 'remove'>('add');
  const paintDay = useRef<number | null>(null);
  const paintStart = useRef<number | null>(null);
  const [paintPreview, setPaintPreview] = useState<{ day: number; start: number; end: number } | null>(null);

  const isPainted = useCallback((day: number, slotStart: number): boolean => {
    return painted.some(p => p.day === day && slotStart >= p.start && slotStart + 0.25 <= p.end + 0.001);
  }, [painted]);

  const handlePointerDown = useCallback((day: number, slotStart: number) => {
    if (!isInWindow(day, slotStart, paintableWindows)) return;
    const alreadyPainted = isPainted(day, slotStart);
    setPainting(true);
    setPaintMode(alreadyPainted ? 'remove' : 'add');
    paintDay.current = day;
    paintStart.current = slotStart;
    setPaintPreview({ day, start: slotStart, end: slotStart + 0.25 });
  }, [paintableWindows, isPainted]);

  const handlePointerMove = useCallback((day: number, slotStart: number) => {
    if (!painting || paintDay.current === null || paintStart.current === null) return;
    if (day !== paintDay.current) return;
    if (!isInWindow(day, slotStart, paintableWindows)) return;
    const s = Math.min(paintStart.current, slotStart);
    const e = Math.max(paintStart.current, slotStart) + 0.25;
    setPaintPreview({ day, start: s, end: e });
  }, [painting, paintableWindows]);

  const handlePointerUp = useCallback(() => {
    if (!painting || !paintPreview) {
      setPainting(false);
      setPaintPreview(null);
      return;
    }

    const { day, start, end } = paintPreview;

    // Clamp to paintable windows
    const clampedRanges: Tuple[] = [];
    for (const w of paintableWindows) {
      if (w.day !== day) continue;
      const overlapStart = Math.max(start, w.start);
      const overlapEnd = Math.min(end, w.end);
      if (overlapEnd > overlapStart) {
        clampedRanges.push({ day, start: overlapStart, end: overlapEnd });
      }
    }

    let next = [...painted];
    if (paintMode === 'add') {
      for (const range of clampedRanges) {
        // Merge with existing painted ranges on the same day
        const overlapping = next.filter(p => p.day === range.day && !(p.end <= range.start || p.start >= range.end));
        const nonOverlapping = next.filter(p => !(p.day === range.day && !(p.end <= range.start || p.start >= range.end)));
        const merged: Tuple = {
          day: range.day,
          start: Math.min(range.start, ...overlapping.map(p => p.start)),
          end: Math.max(range.end, ...overlapping.map(p => p.end)),
        };
        next = [...nonOverlapping, merged];
      }
    } else {
      // Remove: punch holes in existing painted ranges
      for (const range of clampedRanges) {
        const result: Tuple[] = [];
        for (const p of next) {
          if (p.day !== range.day || p.end <= range.start || p.start >= range.end) {
            result.push(p);
          } else {
            if (range.start > p.start) result.push({ day: p.day, start: p.start, end: range.start });
            if (range.end < p.end) result.push({ day: p.day, start: range.end, end: p.end });
          }
        }
        next = result;
      }
    }

    // Filter out tiny ranges
    next = next.filter(p => p.end - p.start >= 0.25);
    // Sort
    next.sort((a, b) => a.day - b.day || a.start - b.start);

    onPaintChange(next);
    if (paintMode === 'add' && next.length > 0) {
      window.dispatchEvent(new CustomEvent('sim:demo-placed'));
    }
    setPainting(false);
    setPaintPreview(null);
    paintDay.current = null;
    paintStart.current = null;
  }, [painting, paintPreview, paintMode, painted, paintableWindows, onPaintChange]);

  return (
    <div
      style={{ flex: 1, overflow: 'auto', background: '#fff', userSelect: 'none' }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Sticky header */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', position: 'sticky', top: 0, background: '#fff', zIndex: 2, borderBottom: '1px solid #E4E4E7' }}>
        <div />
        {colDays.map((wd, i) => (
          <div key={i} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{wd.dow}</div>
            <div suppressHydrationWarning style={{ marginTop: 2, fontSize: 14, fontWeight: 600, color: wd.today ? '#fff' : '#18181B', background: wd.today ? '#18181B' : 'transparent', borderRadius: 999, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{wd.date}</div>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        {/* Hour labels */}
        <div>
          {hours.map(h => (
            <div key={h} style={{ height: ROW_H, fontSize: 10, color: '#A1A1AA', padding: '2px 6px', textAlign: 'right', borderTop: '1px solid #F5F5F5' }}>{fmtH(h)}</div>
          ))}
        </div>

        {COL_TO_DAY.map((dayIdx, ci) => (
          <div key={ci} style={{ borderLeft: '1px solid #F5F5F5', position: 'relative', height: colHeight }}>

            {/* Paintable windows (student availability minus events) — shown as subtle background */}
            {paintableWindows.filter(w => w.day === dayIdx).map((w, wi) => (
              <div key={`pw-${wi}`} style={{
                position: 'absolute',
                top: (w.start - startHr) * ROW_H,
                height: (w.end - w.start) * ROW_H,
                left: 2, right: 2,
                background: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.04) 0 6px,rgba(24,24,27,0.08) 6px 12px)',
                border: '1px dashed #A1A1AA',
                borderRadius: 4,
                pointerEvents: 'none',
                zIndex: 1,
              }} />
            ))}

            {/* Interactive paint slots — 15-min granularity */}
            {Array.from({ length: (endHr - startHr) * SLOTS_PER_HOUR }, (_, i) => {
              const slotStart = +(startHr + i / SLOTS_PER_HOUR).toFixed(4);
              const inWindow = isInWindow(dayIdx, slotStart, paintableWindows);
              return (
                <div
                  key={i}
                  onPointerDown={() => handlePointerDown(dayIdx, slotStart)}
                  onPointerEnter={() => handlePointerMove(dayIdx, slotStart)}
                  style={{
                    position: 'absolute',
                    top: (slotStart - startHr) * ROW_H,
                    left: 0, right: 0,
                    height: SLOT_H,
                    cursor: inWindow ? 'crosshair' : 'default',
                    zIndex: 10,
                  }}
                />
              );
            })}

            {/* Painted ranges */}
            {painted.filter(p => p.day === dayIdx).map((p, pi) => (
              <div key={`paint-${pi}`} style={{
                position: 'absolute',
                top: (p.start - startHr) * ROW_H + 1,
                height: (p.end - p.start) * ROW_H - 2,
                left: 4, right: 4,
                background: 'rgba(63,156,139,0.25)',
                border: '2px solid #3F9C8B',
                borderRadius: 6,
                pointerEvents: 'none',
                zIndex: 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#1F5349',
              }}>
                {(p.end - p.start) * ROW_H >= 28 && (
                  <span>{fmtH(p.start)}–{fmtH(p.end)}</span>
                )}
              </div>
            ))}

            {/* Paint preview */}
            {paintPreview && paintPreview.day === dayIdx && (
              <div style={{
                position: 'absolute',
                top: (paintPreview.start - startHr) * ROW_H + 1,
                height: (paintPreview.end - paintPreview.start) * ROW_H - 2,
                left: 4, right: 4,
                background: paintMode === 'add' ? 'rgba(63,156,139,0.35)' : 'rgba(220,38,38,0.20)',
                border: `2px dashed ${paintMode === 'add' ? '#3F9C8B' : '#DC2626'}`,
                borderRadius: 6,
                pointerEvents: 'none',
                zIndex: 8,
              }} />
            )}

            {/* Existing tutor events (blocked out) */}
            {events.filter(e => e.day === dayIdx && e.status !== 'cancelled').map((e, ei) => (
              <div key={`ev-${ei}`} style={{
                position: 'absolute',
                top: (e.start - startHr) * ROW_H + 1,
                height: (e.end - e.start) * ROW_H - 2,
                left: 4, right: 4,
                background: e.kind === 'other' ? '#F5F5F5' : '#E8F4F1',
                borderLeft: `3px solid ${e.kind === 'other' ? '#A1A1AA' : '#3F9C8B'}`,
                borderRadius: 4,
                padding: '4px 6px',
                fontSize: 11, fontWeight: 600,
                color: e.kind === 'other' ? '#52525B' : '#1F5349',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 3,
              }}>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 9, opacity: 0.8, marginTop: 1 }}>{fmtRange(e.start, e.end)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
