'use client';

import { useState, useEffect } from 'react';
import type { TutorProposal, TutorEvent, Tutor, Tuple, SubjectConf } from '@/lib/types/domain';
import { SUBJECTS } from '@/lib/data/mock';
import { ReviewStep } from './ReviewStep';
import { ScheduleStep } from './ScheduleStep';

interface ConflictEntry { tp: Tuple; clashes: TutorEvent[] }
type Step = 'review' | 'schedule';
type Placement = { day: number; start: number } | null;

interface Props {
  proposal: TutorProposal;
  me: Tutor;
  events: TutorEvent[];
  onClose: () => void;
  onAccept: (placements: Placement[]) => void;
  onDecline: () => void;
}

export function ConsiderModal({ proposal: p, me, events, onClose, onAccept, onDecline }: Props) {
  const [step, setStep] = useState<Step>('review');

  const conflicts: ConflictEntry[] = p.tuples.map(tp => ({
    tp,
    clashes: events.filter(e => e.day === tp.day && e.kind === 'session' && !(tp.end <= e.start || tp.start >= e.end)),
  }));
  const anyConflict = conflicts.some(c => c.clashes.length > 0);

  const subjectMeta = SUBJECTS.find(s => s.name.toLowerCase() === (p.subject || '').toLowerCase());
  const subjectConf: SubjectConf | null = subjectMeta
    ? (me.subjects.find(s => s.id === subjectMeta.id)?.conf ?? null)
    : null;

  const sessionHours = ((p?.sessionDurationMinutes ?? 60) / 60) * (p?.sessionsPerWeek ?? 1);
  const newTotal = me.hoursCurrent + sessionHours;
  const overCap = newTotal > me.hoursMax;

  const activeStudents = new Set(
    events.filter(e => e.kind === 'session' && e.status !== 'cancelled').map(e => e.studentName),
  ).size;

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (step === 'schedule') setStep('review'); else onClose(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, step]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#FAFAFA', zIndex: 80, display: 'flex', flexDirection: 'column', animation: 'crpFadeIn 180ms ease-out' }}>
      {/* Top bar */}
      <div style={{ height: 56, background: '#fff', borderBottom: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, flexShrink: 0 }}>
        <button onClick={() => step === 'schedule' ? setStep('review') : onClose()} style={{ height: 30, padding: '0 10px 0 8px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#52525B', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden><path d="M8 2.5L4.5 6.5L8 10.5" /></svg>
          {step === 'schedule' ? 'Back to review' : 'Back'}
        </button>
        <div style={{ height: 18, width: 1, background: '#E4E4E7' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StepDot n={1} label="Review" active={step === 'review'} done={step === 'schedule'} />
          <div style={{ width: 18, height: 1, background: '#E4E4E7' }} />
          <StepDot n={2} label="Schedule" active={step === 'schedule'} />
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#71717A' }}>
          From <b style={{ color: '#18181B', fontWeight: 600 }}>{p.coordinator}</b> · {p.sentAt}
        </div>
      </div>

      {step === 'review' ? (
        <ReviewStep
          p={p} me={me} events={events}
          conflicts={conflicts} anyConflict={anyConflict}
          subjectConf={subjectConf} overCap={overCap} newTotal={newTotal}
          activeStudents={activeStudents}
          onDecline={onDecline}
          onContinue={() => { setStep('schedule'); window.dispatchEvent(new CustomEvent('sim:demo-schedule')); }}
        />
      ) : (
        <ScheduleStep
          p={p} events={events}
          onBack={() => setStep('review')}
          onConfirm={onAccept}
          onDecline={onDecline}
        />
      )}

      <style>{`
        @keyframes crpFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes crpSlotPulse { 0% { box-shadow:0 0 0 0 rgba(63,156,139,0.4); } 100% { box-shadow:0 0 0 10px rgba(63,156,139,0); } }
        .crp-draggable { transition: transform 120ms, box-shadow 120ms; }
        .crp-draggable:hover { transform:translateY(-1px); box-shadow:0 6px 14px rgba(22,32,51,.10); }
        .crp-draggable.dragging { opacity:0.45; }
        .crp-slot.over { background:rgba(63,156,139,0.14) !important; outline:2px dashed #3F9C8B !important; outline-offset:-2px; }
      `}</style>
    </div>
  );
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done?: boolean }) {
  const color = active ? '#18181B' : done ? '#22C55E' : '#A1A1AA';
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 20, height: 20, borderRadius: 999, background: done ? '#22C55E' : active ? '#18181B' : '#F5F5F5', color: done || active ? '#fff' : '#A1A1AA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
        {done
          ? <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 5l2.5 2.5L8 3" /></svg>
          : n}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}
