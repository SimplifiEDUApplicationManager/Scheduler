'use client';

import { useState } from 'react';

interface Subject {
  id: string;
  name: string;
  category: string;
}

interface PendingReview {
  rowId: string;
  tutorId: string;
  tutorName: string;
  tutorInitials: string;
  subjectId: string;
  subjectName: string;
  subjectCategory: string;
  qualificationNote: string;
  confidence: 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW';
}

interface Props {
  initialSubjects: Subject[];
  initialPendingReviews: PendingReview[];
}

const CONF_META = {
  HIGH:     { label: 'High',     bg: '#DCFCE7', fg: '#166534', bar: '#22C55E' },
  MEDIUM:   { label: 'Medium',   bg: '#DBEAFE', fg: '#1E40AF', bar: '#3B82F6' },
  UNPROVEN: { label: 'Unproven', bg: '#FEF3C7', fg: '#92400E', bar: '#F59E0B' },
  LOW:      { label: 'Low',      bg: '#FEE2E2', fg: '#991B1B', bar: '#EF4444' },
} as const;

const CONFIDENCE_OPTIONS = ['HIGH', 'MEDIUM', 'UNPROVEN', 'LOW'] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function CoordinatorSubjectsClient({ initialSubjects, initialPendingReviews }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);
  const [reviews, setReviews]   = useState<PendingReview[]>(initialPendingReviews);
  const [toast, setToast]       = useState<string | null>(null);

  // Add subject form
  const [addName, setAddName]         = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addPending, setAddPending]   = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Grading state: rowId → selected confidence
  const [gradingMap, setGradingMap]   = useState<Record<string, 'HIGH' | 'MEDIUM' | 'UNPROVEN' | 'LOW'>>({});
  const [gradingBusy, setGradingBusy] = useState<Record<string, boolean>>({});

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2800); }

  // ── Add Subject ────────────────────────────────────────────────────────────

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addCategory.trim()) return;
    setAddPending(true);

    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName.trim(), category: addCategory.trim() }),
    });

    setAddPending(false);
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to add subject'}`);
      return;
    }

    const subject = await res.json() as Subject;
    setSubjects(prev => [...prev, subject].sort((a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    ));
    setAddName('');
    setAddCategory('');
    setShowAddForm(false);
    showToast(`${subject.name} added to master list`);
  }

  // ── Delete Subject ─────────────────────────────────────────────────────────

  async function handleDeleteSubject(id: string, name: string) {
    const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to delete subject'}`);
      return;
    }
    setSubjects(prev => prev.filter(s => s.id !== id));
    showToast(`${name} removed from master list`);
  }

  // ── Grade tutor_subject ────────────────────────────────────────────────────

  async function handleGrade(rowId: string) {
    const confidence = gradingMap[rowId] ?? 'HIGH';
    setGradingBusy(prev => ({ ...prev, [rowId]: true }));

    const res = await fetch(`/api/tutor-subjects/${rowId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confidence }),
    });

    setGradingBusy(prev => ({ ...prev, [rowId]: false }));
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to grade subject'}`);
      return;
    }

    setReviews(prev =>
      confidence === 'UNPROVEN'
        ? prev.map(r => r.rowId === rowId ? { ...r, confidence: 'UNPROVEN' } : r)
        : prev.filter(r => r.rowId !== rowId),
    );
    showToast(`Graded as ${CONF_META[confidence].label}`);
  }

  // ── Group subjects by category ─────────────────────────────────────────────

  const byCategory = subjects.reduce<Record<string, Subject[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Subjects</h1>
            <p style={{ fontSize: 13, color: '#71717A', margin: 0 }}>
              Manage the master subject list and grade tutor confidence.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6.5 2v9M2 6.5h9" /></svg>
            Add subject
          </button>
        </div>

        {/* ── Add subject form ─────────────────────────────────────────────── */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubject}
            style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '18px 20px', marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#52525B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject name</label>
              <input
                autoFocus
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="e.g. AP Calculus BC"
                required
                style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid #E4E4E7', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#52525B', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
              <input
                value={addCategory}
                onChange={e => setAddCategory(e.target.value)}
                placeholder="e.g. Math"
                required
                style={{ width: '100%', height: 36, padding: '0 10px', border: '1px solid #E4E4E7', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ height: 36, padding: '0 12px', borderRadius: 7, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={addPending} style={{ height: 36, padding: '0 14px', borderRadius: 7, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: addPending ? 'wait' : 'pointer', opacity: addPending ? 0.7 : 1 }}>
                {addPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Pending reviews ─────────────────────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Pending reviews</h2>
              {reviews.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#FEF3C7', color: '#92400E' }}>
                  {reviews.length}
                </span>
              )}
            </div>

            {reviews.length === 0 ? (
              <div style={{ padding: '40px 24px', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, color: '#A7F3D0', marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#52525B' }}>All caught up</div>
                <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 3 }}>No ungraded subject claims.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reviews.map(r => {
                  const selectedConf = gradingMap[r.rowId] ?? 'HIGH';
                  const busy = gradingBusy[r.rowId] ?? false;
                  const meta = CONF_META[selectedConf];
                  return (
                    <div key={r.rowId} style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#F59E0B' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 999, background: '#18181B', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {r.tutorInitials || initials(r.tutorName)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>{r.tutorName}</div>
                          <div style={{ fontSize: 11, color: '#A1A1AA' }}>{r.subjectCategory} · {r.subjectName}</div>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>Ungraded</span>
                      </div>

                      {r.qualificationNote && (
                        <div style={{ fontSize: 12, color: '#52525B', background: '#FAFAFA', border: '1px solid #F5F5F5', borderRadius: 8, padding: '8px 10px', marginBottom: 10, lineHeight: 1.55, fontStyle: 'italic' }}>
                          &ldquo;{r.qualificationNote}&rdquo;
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          value={selectedConf}
                          onChange={e => setGradingMap(prev => ({ ...prev, [r.rowId]: e.target.value as typeof selectedConf }))}
                          style={{ flex: 1, height: 32, padding: '0 8px', border: `1px solid ${meta.bar}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: meta.bg, color: meta.fg, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                        >
                          {CONFIDENCE_OPTIONS.map(c => (
                            <option key={c} value={c}>{CONF_META[c].label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleGrade(r.rowId)}
                          disabled={busy}
                          style={{ height: 32, padding: '0 12px', borderRadius: 6, border: 'none', background: '#18181B', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1, flexShrink: 0 }}
                        >
                          {busy ? 'Saving…' : 'Grade'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Master subject list ──────────────────────────────────────────── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Master list</h2>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#F5F5F5', color: '#52525B' }}>
                {subjects.length}
              </span>
            </div>

            {subjects.length === 0 ? (
              <div style={{ padding: '40px 24px', background: '#fff', border: '2px dashed #E4E4E7', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#52525B' }}>No subjects yet</div>
                <div style={{ fontSize: 12, color: '#A1A1AA', marginTop: 3 }}>Add the first subject above.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(byCategory).map(([cat, subs]) => (
                  <div key={cat}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A1A1AA', padding: '6px 4px 4px' }}>{cat}</div>
                    {subs.map(s => (
                      <div
                        key={s.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 8, marginBottom: 4 }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{s.name}</div>
                        </div>
                        <button
                          onClick={() => handleDeleteSubject(s.id, s.name)}
                          title="Remove subject"
                          style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid #FECACA', background: '#fff', color: '#DC2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" aria-hidden>
                            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
