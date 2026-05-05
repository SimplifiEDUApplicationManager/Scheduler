'use client';

import type { TutorProposal, TutorEvent, Tuple } from '@/lib/data/dashboard-mock';
import { DAY_NAMES } from '@/lib/utils/tutors';

interface ConflictEntry { tp: Tuple; clashes: TutorEvent[] }

interface Props {
  p: TutorProposal;
  overCap: boolean;
  anyConflict: boolean;
  newTotal: number;
  capHours: number;
  usedHours: number;
  conflicts: ConflictEntry[];
  onCancel: () => void;
  onConfirm: () => void;
}

function fmtH(h: number): string {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}
function fmtHrs(n: number): string {
  return Number.isInteger(n) ? `${n} hr${n === 1 ? '' : 's'}` : `${n.toFixed(1)} hrs`;
}

export function ConfirmAcceptModal({ p, overCap, anyConflict, newTotal, capHours, usedHours, conflicts, onCancel, onConfirm }: Props) {
  const [first, ...rest] = (p.studentName || '').split(' ');
  const studentShort = rest[0] ? `${first} ${rest[0][0]}.` : first;
  const sessions = p.tuples.length;
  const totalHrs = p.tuples.reduce((s, t) => s + (t.end - t.start), 0);
  const conflictCount = conflicts.filter(c => c.clashes.length > 0).length;
  const hasWarning = overCap || anyConflict;

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'crpFadeIn 120ms ease-out' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 34, height: 34, borderRadius: 999, background: hasWarning ? '#FEF3C7' : '#ECFDF5', color: hasWarning ? '#92400E' : '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
              {hasWarning ? '⚠' : '✓'}
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>Confirm acceptance</h3>
          </div>
          <div style={{ fontSize: 13, color: '#52525B', lineHeight: 1.5 }}>
            You&apos;re accepting <b style={{ color: '#18181B' }}>{sessions} session{sessions === 1 ? '' : 's'}</b>{' '}
            totaling <b style={{ color: '#18181B' }}>{fmtHrs(totalHrs)}/week</b>{' '}
            with <b style={{ color: '#18181B' }}>{studentShort}</b>.
          </div>
        </div>

        <div style={{ margin: '16px 24px 0', border: '1px solid #E4E4E7', borderRadius: 10, overflow: 'hidden', background: '#FAFAFA' }}>
          <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.subject}</div>
            <div style={{ fontSize: 11, color: '#71717A' }}>Starts {p.startDate}</div>
          </div>
          <div style={{ padding: '8px 14px 10px' }}>
            {p.tuples.map((tp, i) => {
              const clash = conflicts[i]?.clashes[0] ?? null;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid #F0F0F0' }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: clash ? '#DC2626' : '#22C55E', flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 13, color: '#18181B', fontWeight: 600 }}>
                    {DAY_NAMES[tp.day]} · {fmtH(tp.start)}–{fmtH(tp.end)}
                  </div>
                  <div style={{ fontSize: 11, color: '#71717A' }}>{fmtHrs(tp.end - tp.start)}</div>
                  {clash && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#991B1B', background: '#FEF2F2', padding: '2px 6px', borderRadius: 4, border: '1px solid #FECACA', whiteSpace: 'nowrap' }}>
                      conflicts w/ {clash.studentName ? clash.studentName.split(' ')[0] : 'existing'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {hasWarning && (
          <div style={{ margin: '12px 24px 0', padding: '10px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 12, color: '#78350F', lineHeight: 1.55 }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>A couple of things to confirm:</div>
            <ul style={{ margin: '2px 0 0 16px', padding: 0 }}>
              {overCap && <li>This pushes you to <b>{newTotal}/{capHours} hrs/week</b> — <b>{newTotal - capHours} hr{newTotal - capHours === 1 ? '' : 's'} over</b> your stated cap.</li>}
              {anyConflict && <li>{conflictCount} proposed time{conflictCount === 1 ? '' : 's'} overlap existing session{conflictCount === 1 ? '' : 's'} — you&apos;ll resolve in the scheduling step.</li>}
            </ul>
          </div>
        )}

        {!overCap && (
          <div style={{ margin: '12px 24px 0', fontSize: 11, color: '#71717A' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Weekly capacity after accepting</span>
              <span style={{ fontWeight: 600, color: '#3F3F46' }}>{newTotal}/{capHours} hrs</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: '#F4F4F5', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${Math.min(100, (usedHours / capHours) * 100)}%`, height: '100%', background: '#A1A1AA' }} />
              <div style={{ width: `${Math.min(100, ((newTotal - usedHours) / capHours) * 100)}%`, height: '100%', background: '#22C55E' }} />
            </div>
          </div>
        )}

        <div style={{ padding: '16px 24px 20px', marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #F5F5F5' }}>
          <button onClick={onCancel} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>Back</button>
          <button onClick={onConfirm} style={{ height: 36, padding: '0 18px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {anyConflict ? 'Continue to schedule' : 'Accept & schedule'}
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M2 6h8M7 3l3 3-3 3" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
