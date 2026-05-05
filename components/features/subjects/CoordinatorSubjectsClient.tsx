'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { BadgeVariant } from '@/components/ui/Badge';

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

const CONFIDENCE_OPTIONS = [
  { value: 'HIGH',     label: 'High' },
  { value: 'MEDIUM',   label: 'Med' },
  { value: 'UNPROVEN', label: 'Unp' },
  { value: 'LOW',      label: 'Low' },
] as const;

type ConfidenceValue = typeof CONFIDENCE_OPTIONS[number]['value'];

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
  const [gradingMap, setGradingMap]   = useState<Record<string, ConfidenceValue>>({});
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
    showToast(`Graded as ${confidence.charAt(0) + confidence.slice(1).toLowerCase()}`);
  }

  // ── Group subjects by category ─────────────────────────────────────────────

  const byCategory = subjects.reduce<Record<string, Subject[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-auto bg-surface-2">
      <div className="max-w-[1100px] mx-auto px-8 py-7 pb-16">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-5 mb-6">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-fg-1 mb-1">Subjects</h1>
            <p className="text-sm text-fg-3">Manage the master subject list and grade tutor confidence.</p>
          </div>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="h-9 px-4 rounded-lg bg-brand-ink text-fg-on-brand text-sm font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0"
          >
            <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
              <path d="M6.5 2v9M2 6.5h9" />
            </svg>
            Add subject
          </button>
        </div>

        {/* ── Add subject form ─────────────────────────────────────────────── */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubject}
            className="bg-surface-1 border border-border-default rounded-xl p-5 mb-6 flex gap-3 items-end flex-wrap"
          >
            <div className="flex-[2] min-w-[180px]">
              <label className="block text-[11px] font-bold text-fg-3 uppercase tracking-[0.05em] mb-1.5">
                Subject name
              </label>
              <input
                autoFocus
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="e.g. AP Calculus BC"
                required
                className="w-full h-9 px-3 border border-border-default rounded-lg text-sm text-fg-1 placeholder:text-fg-muted outline-none focus:border-border-strong bg-surface-1 font-[inherit]"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[11px] font-bold text-fg-3 uppercase tracking-[0.05em] mb-1.5">
                Category
              </label>
              <input
                value={addCategory}
                onChange={e => setAddCategory(e.target.value)}
                placeholder="e.g. Math"
                required
                className="w-full h-9 px-3 border border-border-default rounded-lg text-sm text-fg-1 placeholder:text-fg-muted outline-none focus:border-border-strong bg-surface-1 font-[inherit]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-9 px-4 rounded-lg border border-border-default bg-surface-1 text-fg-2 text-sm font-semibold hover:bg-surface-2 transition-colors font-[inherit]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addPending}
                className="h-9 px-4 rounded-lg bg-brand-ink text-fg-on-brand text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity font-[inherit]"
              >
                {addPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        )}

        {/* ── Two-column layout ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-5 items-start">

          {/* ── Pending reviews ──────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[13px] font-bold text-fg-1">Pending reviews</h2>
              {reviews.length > 0 && (
                <Badge variant="warning" size="xs">{reviews.length}</Badge>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="bg-surface-1 border border-border-default rounded-xl p-10 text-center">
                <div className="text-[20px] text-success mb-2">✓</div>
                <div className="text-sm font-semibold text-fg-1">All caught up</div>
                <div className="text-xs text-fg-muted mt-1">No ungraded subject claims.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.map(r => {
                  const selectedConf: ConfidenceValue = gradingMap[r.rowId] ?? 'HIGH';
                  const busy = gradingBusy[r.rowId] ?? false;

                  return (
                    <div
                      key={r.rowId}
                      className="bg-surface-1 border border-border-default rounded-xl overflow-hidden"
                    >
                      {/* Amber left accent — ungraded */}
                      <div className="flex">
                        <div className="w-1 bg-warning shrink-0" />
                        <div className="flex-1 p-4">
                          {/* Tutor + subject row */}
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar initials={r.tutorInitials} tone="dark" size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-bold text-fg-1">{r.tutorName}</div>
                              <div className="text-[11px] text-fg-3 mt-px">{r.subjectCategory} · {r.subjectName}</div>
                            </div>
                            <Badge variant="UNPROVEN" size="xs">Ungraded</Badge>
                          </div>

                          {/* Qualification note */}
                          {r.qualificationNote && (
                            <blockquote className="text-xs text-fg-2 bg-surface-2 border border-border-default rounded-lg px-3 py-2.5 mb-3 italic leading-relaxed m-0">
                              &ldquo;{r.qualificationNote}&rdquo;
                            </blockquote>
                          )}

                          {/* Confidence selector + grade button */}
                          <div className="flex items-center gap-2">
                            <div className="flex p-0.5 bg-surface-3 rounded-lg">
                              {CONFIDENCE_OPTIONS.map(opt => (
                                <button
                                  key={opt.value}
                                  onClick={() => setGradingMap(prev => ({ ...prev, [r.rowId]: opt.value }))}
                                  className={[
                                    'px-2.5 py-1 rounded-md text-xs font-semibold transition-all font-[inherit]',
                                    selectedConf === opt.value
                                      ? 'bg-surface-1 text-fg-1 shadow-xs'
                                      : 'text-fg-3 hover:text-fg-2',
                                  ].join(' ')}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => handleGrade(r.rowId)}
                              disabled={busy}
                              className="h-8 px-4 rounded-lg bg-brand-ink text-fg-on-brand text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity font-[inherit] shrink-0"
                            >
                              {busy ? 'Saving…' : 'Grade'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Master subject list ──────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[13px] font-bold text-fg-1">Master list</h2>
              <Badge variant="default" size="xs">{subjects.length}</Badge>
            </div>

            {subjects.length === 0 ? (
              <div className="bg-surface-1 border-2 border-dashed border-border-default rounded-xl p-10 text-center">
                <div className="text-sm font-semibold text-fg-1">No subjects yet</div>
                <div className="text-xs text-fg-muted mt-1">Add the first subject above.</div>
              </div>
            ) : (
              <div className="bg-surface-1 border border-border-default rounded-xl overflow-hidden">
                {Object.entries(byCategory).map(([cat, subs], catIdx) => (
                  <div key={cat}>
                    {/* Category header */}
                    <div className={[
                      'px-4 py-2 bg-surface-2',
                      catIdx > 0 ? 'border-t border-border-default' : '',
                    ].join(' ')}>
                      <span className="text-[10px] font-bold uppercase tracking-[0.07em] text-fg-muted">{cat}</span>
                    </div>
                    {/* Subject rows */}
                    {subs.map(s => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-t border-border-default first:border-t-0 hover:bg-surface-2 transition-colors group"
                      >
                        <div className="flex-1 min-w-0 text-[13px] font-medium text-fg-1">{s.name}</div>
                        <button
                          onClick={() => handleDeleteSubject(s.id, s.name)}
                          title="Remove subject"
                          className="w-6 h-6 rounded-md border border-transparent text-fg-muted opacity-0 group-hover:opacity-100 hover:!border-danger-bg hover:bg-danger-bg hover:!text-danger transition-all inline-flex items-center justify-center shrink-0"
                        >
                          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
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

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-brand-ink text-fg-on-brand rounded-xl shadow-lg text-sm font-medium">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
