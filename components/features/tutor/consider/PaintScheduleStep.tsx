'use client';

import { useState, useMemo } from 'react';
import type { TutorProposal, TutorEvent, Tuple } from '@/lib/types/domain';
import { PaintWeek } from './PaintWeek';

const START_HR = 0;
const END_HR = 24;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
  onConfirm: (availability: Tuple[]) => void;
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

export function PaintScheduleStep({ p, events, onBack, onConfirm, onDecline }: Props) {
  const sessionsNeeded = p.sessionsPerWeek ?? 1;
  const durationMin = p.sessionDurationMinutes ?? 60;
  const durationLabel = durationMin === 60 ? '1 hr' : durationMin === 90 ? '1.5 hr' : `${durationMin}m`;

  const [painted, setPainted] = useState<Tuple[]>([]);

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
              Click and drag within the student&apos;s available windows to mark when you&apos;re free.
              You need at least <b>{sessionsNeeded}</b> block{sessionsNeeded > 1 ? 's' : ''} of <b>{durationLabel}</b> on <b>{sessionsNeeded} different day{sessionsNeeded > 1 ? 's' : ''}</b>.
            </div>
          </div>

          {/* Painted ranges summary */}
          <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {painted.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: '#A1A1AA', fontSize: 12 }}>
                No availability marked yet. Click and drag on the calendar to paint your available times.
              </div>
            ) : (
              painted.map((range, i) => {
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
              })
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
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Your week</h3>
            <div style={{ fontSize: 11, color: '#71717A' }}>Click and drag within the dashed windows to mark your availability</div>
          </div>
          <PaintWeek
            proposal={p}
            events={events}
            tuples={p.tuples}
            painted={painted}
            onPaintChange={setPainted}
            startHr={START_HR}
            endHr={END_HR}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ background: '#fff', borderTop: '1px solid #E4E4E7', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -6px 16px rgba(22,32,51,0.04)' }}>
        <div style={{ flex: 1, fontSize: 12, color: '#71717A' }}>
          {validation.valid
            ? <><b style={{ color: '#047857' }}>Ready to confirm.</b> Your availability will be shared with the coordinator.</>
            : `Mark your availability within the student's windows to continue.`}
        </div>
        <button onClick={onDecline} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
        <button onClick={onBack} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Back</button>
        <button
          disabled={!validation.valid}
          onClick={() => onConfirm(painted)}
          style={{ height: 40, padding: '0 22px', borderRadius: 10, border: 'none', background: validation.valid ? '#18181B' : '#E4E4E7', color: validation.valid ? '#fff' : '#A1A1AA', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: validation.valid ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          ✓ Confirm availability
        </button>
      </div>
    </>
  );
}
