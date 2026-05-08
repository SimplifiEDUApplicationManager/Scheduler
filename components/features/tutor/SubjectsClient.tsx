'use client';

import { useState } from 'react';
import type { Tutor, Subject, TutorSubject, SubjectConf } from '@/lib/types/domain';
import { DEV_BYPASS } from '@/lib/env';
import { AddSubjectModal } from './AddSubjectModal';
import { EditSubjectModal } from './EditSubjectModal';

interface Props {
  me: Tutor;
  allSubjects: Subject[];
}

const CONF_META: Record<SubjectConf, { label: string; bg: string; fg: string; bar: string }> = {
  HIGH:   { label: 'High',   bg: '#DCFCE7', fg: '#166534', bar: '#22C55E' },
  MEDIUM: { label: 'Medium', bg: '#DBEAFE', fg: '#1E40AF', bar: '#3B82F6' },
  LOW:    { label: 'Low',    bg: '#FEE2E2', fg: '#991B1B', bar: '#EF4444' },
};


function SubjectCard({ ts, subject, onEdit, onRemove }: {
  ts: TutorSubject; subject: Subject; onEdit: () => void; onRemove: () => void;
}) {
  const meta = CONF_META[ts.conf];

  return (
    <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      {/* Left confidence bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: meta.bar }} />

      <div style={{ padding: '16px 16px 16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: '#18181B' }}>{subject.name}</div>
            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>{subject.cat}</div>
          </div>
          {/* Confidence badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.bar, flexShrink: 0 }} />
            {meta.label}
          </span>
          <button onClick={onEdit} title="Edit confidence" style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#71717A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
              <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" />
            </svg>
          </button>
          <button onClick={onRemove} title="Remove subject" style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #FECACA', background: '#fff', color: '#DC2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}


export function SubjectsClient({ me, allSubjects }: Props) {
  const [mySubjects, setMySubjects] = useState<TutorSubject[]>(me.subjects);
  const [addOpen, setAddOpen]         = useState(false);
  const [editingTs, setEditingTs]     = useState<TutorSubject | null>(null);
  const [toast, setToast]             = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function handleAdd(ts: TutorSubject) {
    const name = allSubjects.find(s => s.id === ts.id)?.name ?? 'Subject';
    if (DEV_BYPASS) {
      setMySubjects(prev => [...prev, { ...ts, rowId: `dev-${ts.id}`, coordConf: 'UNPROVEN' }]);
      setAddOpen(false);
      showToast(`${name} added · confidence set to Unproven`);
      return;
    }
    const res = await fetch('/api/tutor-subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: ts.id, qualification_note: ts.qualificationNote, tutor_confidence: ts.conf }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to add subject'}`);
      return;
    }
    const row = await res.json() as { id: string; subject_id: string };
    setMySubjects(prev => [...prev, { ...ts, rowId: row.id, coordConf: 'UNPROVEN' }]);
    setAddOpen(false);
    showToast(`${name} added · confidence set to Unproven`);
  }

  async function handleRemove(ts: TutorSubject) {
    if (DEV_BYPASS) {
      setMySubjects(prev => prev.filter(x => x.id !== ts.id));
      showToast('Subject removed');
      return;
    }
    if (!ts.rowId) {
      showToast('Cannot remove: subject has no row ID');
      return;
    }
    const res = await fetch(`/api/tutor-subjects/${ts.rowId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to remove subject'}`);
      return;
    }
    setMySubjects(prev => prev.filter(x => x.id !== ts.id));
    showToast('Subject removed');
  }


  async function handleEdit(ts: TutorSubject, updated: Pick<TutorSubject, 'conf' | 'qualificationNote'>) {
    const name = allSubjects.find(s => s.id === ts.id)?.name ?? 'Subject';
    if (DEV_BYPASS) {
      setMySubjects(prev => prev.map(x => x.id === ts.id ? { ...x, conf: updated.conf, qualificationNote: updated.qualificationNote } : x));
      setEditingTs(null);
      showToast(`${name} updated · coordinator notified`);
      return;
    }
    if (!ts.rowId) {
      showToast('Cannot edit: subject has no row ID');
      return;
    }
    const res = await fetch(`/api/tutor-subjects/${ts.rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutor_confidence: updated.conf, qualification_note: updated.qualificationNote }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to update subject'}`);
      return;
    }
    setMySubjects(prev => prev.map(x => x.id === ts.id ? { ...x, conf: updated.conf, qualificationNote: updated.qualificationNote } : x));
    setEditingTs(null);
    showToast(`${name} updated · coordinator notified`);
  }

  // Sort by tutor self-confidence: HIGH → MEDIUM → LOW
  const ORDER: SubjectConf[] = ['HIGH', 'MEDIUM', 'LOW'];
  const sorted = [...mySubjects].sort((a, b) => ORDER.indexOf(a.conf) - ORDER.indexOf(b.conf));

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>My subjects</h1>
            <p style={{ fontSize: 13, color: '#71717A', margin: 0, lineHeight: 1.5 }}>
              The subjects you teach. Your confidence level reflects how comfortable you feel teaching each one.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6.5 2v9M2 6.5h9" /></svg>
            Add a subject
          </button>
        </div>

        {/* Confidence legend (read-only) */}
        <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My confidence</span>
          {ORDER.map(k => {
            const m = CONF_META[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: m.bar }} />
                <span style={{ fontSize: 11, color: '#52525B', fontWeight: 600 }}>{m.label}</span>
              </div>
            );
          })}

          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#A1A1AA', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
              <rect x={2} y={4} width={6} height={5} rx={1} /><path d="M3.5 4V3a2.5 2.5 0 015 0v1" />
            </svg>
            How comfortable you feel teaching this subject
          </div>
        </div>

        {/* Cards grid */}
        {mySubjects.length === 0 ? (
          <div style={{ padding: '48px 32px', background: '#fff', border: '2px dashed #E4E4E7', borderRadius: 14, textAlign: 'center' }}>
            <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke="#D4D4D8" strokeWidth={1.5} strokeLinecap="round" style={{ marginBottom: 12 }} aria-hidden>
              <rect x={4} y={3} width={20} height={22} rx={3} /><path d="M9 9h10M9 13h10M9 17h6" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>No subjects yet</div>
            <p style={{ fontSize: 12, color: '#71717A', margin: '6px 0 16px' }}>Add the subjects you&apos;re comfortable teaching.</p>
            <button onClick={() => setAddOpen(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              Add a subject
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {sorted.map(ts => {
              const subject = allSubjects.find(s => s.id === ts.id);
              if (!subject) return null;
              return (
                <SubjectCard
                  key={ts.id}
                  ts={ts}
                  subject={subject}
                  onEdit={() => setEditingTs(ts)}
                  onRemove={() => handleRemove(ts)}
                />
              );
            })}
          </div>
        )}
      </div>

      {addOpen && (
        <AddSubjectModal
          allSubjects={allSubjects}
          existing={mySubjects.map(s => s.id)}
          onClose={() => setAddOpen(false)}
          onAdd={handleAdd}
        />
      )}

      {editingTs && (() => {
        const subject = allSubjects.find(s => s.id === editingTs.id);
        return subject ? (
          <EditSubjectModal
            ts={editingTs}
            subject={subject}
            onClose={() => setEditingTs(null)}
            onSave={updated => handleEdit(editingTs, updated)}
          />
        ) : null;
      })()}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#18181B', color: '#fff', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.18)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}
