'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { TutorProposal, TutorEvent, Tuple } from '@/lib/types/domain';
import { getWeekDays } from '@/lib/utils/tutors';
import { PaintWeek } from './PaintWeek';

const START_HR = 0;
const END_HR = 24;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtH(h: number): string {
  const hr = Math.floor(h % 24);
  const mn = Math.round((h - Math.floor(h)) * 60);
  const suf = hr >= 12 ? 'p' : 'a';
  const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

interface Props {
  p: TutorProposal;
  events: TutorEvent[];
  onBack: () => void;
  onConfirm: (availability: Tuple[], startDate: string) => void;
  onDecline: () => void;
}

interface ValidationResult {
  valid: boolean;
  validBlockCount: number;
  distinctDays: number;
  totalMinutes: number;
  requiredSessions: number;
  requiredMinutesPerSession: number;
  errors: string[];
}

function validate(painted: Tuple[], sessionsPerWeek: number, sessionDurationMinutes: number): ValidationResult {
  const durationHrs = sessionDurationMinutes / 60;
  const validBlocks = painted.filter(p => (p.end - p.start) >= durationHrs);
  const distinctDays = new Set(validBlocks.map(b => b.day)).size;
  const totalMinutes = painted.reduce((sum, p) => sum + (p.end - p.start) * 60, 0);

  const errors: string[] = [];
  const tooSmall = painted.filter(p => (p.end - p.start) < durationHrs);
  if (tooSmall.length > 0) {
    errors.push(`${tooSmall.length} block${tooSmall.length > 1 ? 's are' : ' is'} shorter than ${sessionDurationMinutes}min — too small for a session`);
  }
  if (validBlocks.length < sessionsPerWeek) {
    errors.push(`Need ${sessionsPerWeek} block${sessionsPerWeek > 1 ? 's' : ''} large enough for a session — have ${validBlocks.length}`);
  }
  if (distinctDays < sessionsPerWeek) {
    errors.push(`Need availability on ${sessionsPerWeek} distinct day${sessionsPerWeek > 1 ? 's' : ''} — have ${distinctDays}`);
  }

  return {
    valid: errors.length === 0,
    validBlockCount: validBlocks.length,
    distinctDays,
    totalMinutes,
    requiredSessions: sessionsPerWeek,
    requiredMinutesPerSession: sessionDurationMinutes,
    errors,
  };
}

/** Get the Sunday date string (YYYY-MM-DD) for a given weekOffset. */
function getWeekSunday(weekOffset: number): string {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, '0');
  const d = String(sunday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekLabel(weekOffset: number): string {
  const days = getWeekDays(weekOffset);
  const sun = days[0];
  const sat = days[6];
  if (sun.month === sat.month) {
    return `${MONTH_SHORT[sun.month]} ${sun.date}–${sat.date}, ${sun.year}`;
  }
  return `${MONTH_SHORT[sun.month]} ${sun.date} – ${MONTH_SHORT[sat.month]} ${sat.date}`;
}

export function PaintScheduleStep({ p, events: initialEvents, onBack, onConfirm, onDecline }: Props) {
  const sessionsNeeded = p.sessionsPerWeek ?? 1;
  const durationMin = p.sessionDurationMinutes ?? 60;
  const durationLabel = durationMin === 60 ? '1 hr' : durationMin === 90 ? '1.5 hr' : `${durationMin}m`;

  const [weekOffset, setWeekOffset] = useState(0);
  const [painted, setPainted] = useState<Tuple[]>([]);
  const [weekEvents, setWeekEvents] = useState<TutorEvent[]>(initialEvents);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Fetch events when week changes
  const fetchWeekEvents = useCallback(async (offset: number) => {
    if (offset === 0) {
      setWeekEvents(initialEvents);
      return;
    }
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/nylas/events?weekOffset=${offset}`);
      if (res.ok) {
        const data = await res.json() as TutorEvent[];
        setWeekEvents(data);
      }
    } catch {
      // Keep previous events on error
    }
    setLoadingEvents(false);
  }, [initialEvents]);

  useEffect(() => {
    fetchWeekEvents(weekOffset);
  }, [weekOffset, fetchWeekEvents]);

  function navigateWeek(delta: number) {
    setPainted([]); // Clear painting when navigating
    setWeekOffset(prev => prev + delta);
  }

  const startDate = getWeekSunday(weekOffset);

  const validation = useMemo(
    () => validate(painted, sessionsNeeded, durationMin),
    [painted, sessionsNeeded, durationMin],
  );

  return (
    <>
      <div data-tour="schedule-area" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left sidebar */}
        <aside style={{ width: 300, background: '#fff', borderRight: '1px solid #E4E4E7', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ fontSize: 11, color: '#71717A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Mark your availability</div>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: '4px 0 0', letterSpacing: '-0.01em' }}>
              When can you tutor {p.studentName}?
            </h2>
            <div style={{ marginTop: 6, fontSize: 12, color: '#52525B', lineHeight: 1.5 }}>
              Navigate to the week you&apos;d like to <b>start</b>, then click and drag within the student&apos;s windows to mark your availability.
              You need at least <b>{sessionsNeeded}</b> block{sessionsNeeded > 1 ? 's' : ''} of <b>{durationLabel}</b> on <b>{sessionsNeeded} different day{sessionsNeeded > 1 ? 's' : ''}</b>.
            </div>
          </div>

          {/* Painted ranges summary */}
          <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {painted.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: '#A1A1AA', fontSize: 12 }}>
                No availability marked yet. Use the arrows above the calendar to pick your start week, then paint your available times.
              </div>
            ) : (
              <>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: '#EEF2FF', border: '1px solid #C7D2FE', fontSize: 12, color: '#3730A3', fontWeight: 600 }}>
                  Starting week of {weekLabel(weekOffset)}
                </div>
                {painted.map((range, i) => {
                  const isValid = (range.end - range.start) >= durationMin / 60;
                  return (
                    <div key={i} style={{
                      padding: '10px 12px', borderRadius: 8,
                      background: isValid ? '#ECFDF5' : '#FEF2F2',
                      border: `1px solid ${isValid ? '#86EFAC' : '#FECACA'}`,
                      borderLeft: `4px solid ${isValid ? '#22C55E' : '#EF4444'}`,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>
                        {DAY_SHORT[range.day]} · {fmtH(range.start)}–{fmtH(range.end)}
                      </div>
                      <div style={{ fontSize: 11, color: isValid ? '#047857' : '#DC2626', marginTop: 2 }}>
                        {Math.round((range.end - range.start) * 60)}min
                        {!isValid && ` — needs ${durationMin}min minimum`}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Validation status */}
            {painted.length > 0 && (
              <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: validation.valid ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${validation.valid ? '#BBF7D0' : '#FDE68A'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: validation.valid ? '#166534' : '#92400E', marginBottom: 4 }}>
                  {validation.valid ? '✓ Requirements met' : 'Requirements'}
                </div>
                <div style={{ fontSize: 11, color: '#52525B', lineHeight: 1.5 }}>
                  <div>
                    {validation.validBlockCount >= sessionsNeeded ? '✓' : '✗'} {validation.validBlockCount}/{sessionsNeeded} blocks ≥ {durationLabel}
                  </div>
                  <div>
                    {validation.distinctDays >= sessionsNeeded ? '✓' : '✗'} {validation.distinctDays}/{sessionsNeeded} distinct days
                  </div>
                </div>
                {validation.errors.length > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#DC2626', lineHeight: 1.5 }}>
                    {validation.errors.map((e, i) => <div key={i}>• {e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ padding: '12px 18px', borderTop: '1px solid #F5F5F5', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legend</div>
            {[
              { bg: 'repeating-linear-gradient(45deg,rgba(24,24,27,0.04) 0 6px,rgba(24,24,27,0.08) 6px 12px)', bdr: '1px dashed #A1A1AA', label: 'Student available' },
              { bg: 'rgba(63,156,139,0.25)', bdr: '2px solid #3F9C8B', label: 'Your availability' },
              { bg: '#E8F4F1', bdr: '1px solid #3F9C8B', label: 'Your existing sessions' },
            ].map(({ bg, bdr, label }) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#52525B' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: bdr, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
        </aside>

        {/* Calendar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
          {/* Week navigation header */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigateWeek(-1)}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#52525B" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M7 2L3 6l4 4" /></svg>
            </button>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B', minWidth: 180, textAlign: 'center' }}>
              {weekLabel(weekOffset)}
            </div>
            <button
              onClick={() => navigateWeek(1)}
              style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#52525B" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M5 2l4 4-4 4" /></svg>
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => { setPainted([]); setWeekOffset(0); }}
                style={{ height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Today
              </button>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: '#71717A' }}>
              {loadingEvents ? 'Loading calendar…' : 'Click and drag to mark availability'}
            </div>
          </div>
          <PaintWeek
            proposal={p}
            events={weekEvents}
            tuples={p.tuples}
            painted={painted}
            onPaintChange={setPainted}
            startHr={START_HR}
            endHr={END_HR}
            weekOffset={weekOffset}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: '#fff', borderTop: '1px solid #E4E4E7', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -6px 16px rgba(22,32,51,0.04)' }}>
        <div style={{ flex: 1, fontSize: 12, color: '#71717A' }}>
          {validation.valid
            ? <><b style={{ color: '#047857' }}>Ready to confirm.</b> Starting week of {weekLabel(weekOffset)}. Your availability will be shared with the coordinator.</>
            : `Navigate to your desired start week, then mark your availability.`}
        </div>
        <button onClick={onDecline} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
        <button onClick={onBack} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Back</button>
        <button
          data-tour="confirm-schedule-btn"
          disabled={!validation.valid}
          onClick={() => onConfirm(painted, startDate)}
          style={{ height: 40, padding: '0 22px', borderRadius: 10, border: 'none', background: validation.valid ? '#18181B' : '#E4E4E7', color: validation.valid ? '#fff' : '#A1A1AA', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: validation.valid ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          ✓ Confirm availability
        </button>
      </div>
    </>
  );
}
