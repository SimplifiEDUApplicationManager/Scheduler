'use client';

import { useState } from 'react';
import type { SubjectConf, CoordConf } from '@/lib/types/domain';

export interface PendingReview {
  rowId: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  subjectName: string;
  subjectCat: string;
  tutorConf: SubjectConf;
  qualificationNote: string;
}

interface Props {
  pending: PendingReview[];
}

const TUTOR_CONF_META: Record<SubjectConf, { label: string; bg: string; fg: string; bar: string }> = {
  HIGH:   { label: 'High',   bg: '#DCFCE7', fg: '#166534', bar: '#22C55E' },
  MEDIUM: { label: 'Medium', bg: '#DBEAFE', fg: '#1E40AF', bar: '#3B82F6' },
  LOW:    { label: 'Low',    bg: '#FEE2E2', fg: '#991B1B', bar: '#EF4444' },
};

const COORD_GRADES: { value: CoordConf; label: string }[] = [
  { value: 'HIGH',     label: 'High' },
  { value: 'MEDIUM',   label: 'Medium' },
  { value: 'LOW',      label: 'Low' },
  { value: 'UNPROVEN', label: 'Keep unproven' },
];

export function SubjectReviewClient({ pending }: Props) {
  const [graded, setGraded]   = useState<Record<string, CoordConf>>({});
  const [saving, setSaving]   = useState<Record<string, boolean>>({});
  const [done, setDone]       = useState<Record<string, boolean>>({});
  const [toast, setToast]     = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function handleGrade(rowId: string, conf: CoordConf, tutorName: string, subjectName: string, isDev: boolean) {
    setSaving(prev => ({ ...prev, [rowId]: true }));
    if (isDev) {
      await new Promise(r => setTimeout(r, 300));
      setDone(prev => ({ ...prev, [rowId]: true }));
      setSaving(prev => ({ ...prev, [rowId]: false }));
      showToast(`${tutorName} · ${subjectName} graded ${conf}`);
      return;
    }
    const res = await fetch(`/api/tutor-subjects/${rowId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confidence: conf }),
    });
    setSaving(prev => ({ ...prev, [rowId]: false }));
    if (!res.ok) {
      showToast('Error saving grade — please try again');
      return;
    }
    setDone(prev => ({ ...prev, [rowId]: true }));
    showToast(`${tutorName} · ${subjectName} graded ${conf}`);
  }

  const visible = pending.filter(r => !done[r.rowId]);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Subjects pending review</h1>
          <p style={{ fontSize: 13, color: '#71717A', margin: 0 }}>
            Tutors have added or updated these subjects. Set your confidence rating for each one.
          </p>
        </div>

        {visible.length === 0 ? (
          <div style={{ padding: '56px 32px', background: '#fff', border: '2px dashed #E4E4E7', borderRadius: 14, textAlign: 'center' }}>
            <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke="#D4D4D8" strokeWidth={1.5} strokeLinecap="round" style={{ marginBottom: 12 }} aria-hidden>
              <path d="M4 14l7 7 13-13" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>All caught up</div>
            <p style={{ fontSize: 12, color: '#71717A', margin: '6px 0 0' }}>No subjects waiting for a confidence rating.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map(r => {
              const confMeta = TUTOR_CONF_META[r.tutorConf];
              const selected = graded[r.rowId];
              const isSaving = saving[r.rowId];
              const isDev    = r.rowId.startsWith('dev-');

              return (
                <div key={r.rowId} style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                    {/* Tutor avatar */}
                    <div style={{ width: 36, height: 36, borderRadius: 999, background: '#18181B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {r.tutorInitials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{r.tutorName}</span>
                        <span style={{ fontSize: 11, color: '#A1A1AA' }}>·</span>
                        <span style={{ fontSize: 13, color: '#3F3F46' }}>{r.subjectName}</span>
                        <span style={{ fontSize: 10, color: '#71717A', background: '#F4F4F5', padding: '2px 6px', borderRadius: 4 }}>{r.subjectCat}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#71717A' }}>Tutor confidence:</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: confMeta.bg, color: confMeta.fg, fontSize: 11, fontWeight: 700 }}>
                          <span style={{ width: 5, height: 5, borderRadius: 999, background: confMeta.bar }} />
                          {confMeta.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Qualification note */}
                  <div style={{ padding: '10px 12px', background: '#FAFAFA', border: '1px solid #F0F0F0', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#3F3F46', lineHeight: 1.6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}>Tutor&apos;s note</span>
                    {r.qualificationNote || <span style={{ color: '#A1A1AA', fontStyle: 'italic' }}>No note provided.</span>}
                  </div>

                  {/* Grade buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#71717A', marginRight: 4 }}>Set coordinator confidence:</span>
                    {COORD_GRADES.map(g => (
                      <button
                        key={g.value}
                        onClick={() => setGraded(prev => ({ ...prev, [r.rowId]: g.value }))}
                        style={{
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 6,
                          border: selected === g.value ? '2px solid #18181B' : '1px solid #E4E4E7',
                          background: selected === g.value ? '#18181B' : '#fff',
                          color: selected === g.value ? '#fff' : '#3F3F46',
                          fontSize: 11,
                          fontWeight: 600,
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        {g.label}
                      </button>
                    ))}
                    <button
                      onClick={() => selected && handleGrade(r.rowId, selected, r.tutorName, r.subjectName, isDev)}
                      disabled={!selected || isSaving}
                      style={{
                        height: 28,
                        padding: '0 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: selected && !isSaving ? '#18181B' : '#E4E4E7',
                        color: selected && !isSaving ? '#fff' : '#A1A1AA',
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        cursor: selected && !isSaving ? 'pointer' : 'default',
                        marginLeft: 'auto',
                      }}
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#18181B', color: '#fff', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.18)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}
