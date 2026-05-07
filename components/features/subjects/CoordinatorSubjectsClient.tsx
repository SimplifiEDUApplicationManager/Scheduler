'use client';

import { useState, useMemo } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import type { SubjectRow, TutorClaim } from '@/app/(main)/dashboard/subjects/page';

interface Props {
  initialSubjects: SubjectRow[];
  claimsBySubject: Record<string, TutorClaim[]>;
}

const CONF_OPTIONS = ['HIGH', 'MEDIUM', 'UNPROVEN', 'LOW'] as const;
type Conf = typeof CONF_OPTIONS[number];

const CONF_LABEL: Record<Conf, string> = {
  HIGH:     'High',
  MEDIUM:   'Medium',
  UNPROVEN: 'Unproven',
  LOW:      'Low',
};

// Active button styles per confidence level
const CONF_ACTIVE: Record<Conf, string> = {
  HIGH:     'bg-fg-1 text-fg-on-brand',
  MEDIUM:   'bg-warning-ink text-white',
  UNPROVEN: 'bg-neutral-200 text-fg-2',
  LOW:      'bg-danger text-white',
};

const AVATAR_TONES = ['brand', 'cream', 'dark', 'neutral'] as const;
function avatarTone(idx: number) { return AVATAR_TONES[idx % AVATAR_TONES.length]; }

export function CoordinatorSubjectsClient({ initialSubjects, claimsBySubject }: Props) {
  const [subjects, setSubjects]   = useState<SubjectRow[]>(initialSubjects);
  // Live claims map — mutated as coordinator grades
  const [claims, setClaims]       = useState<Record<string, TutorClaim[]>>(claimsBySubject);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSubjects[0]?.id ?? null,
  );

  // Left-panel state
  const [search, setSearch]         = useState('');
  const [categoryFilter, setCatFilter] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName]         = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addPending, setAddPending]   = useState(false);

  // Grading busy state: rowId → true
  const [busyRows, setBusyRows] = useState<Record<string, boolean>>({});

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  // ── Derived ───────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const cats = [...new Set(subjects.map(s => s.category))].sort();
    return ['All', ...cats];
  }, [subjects]);

  const totalPending = useMemo(
    () => Object.values(claims).flat().filter(c => c.gradedBy === null).length,
    [claims],
  );

  const filteredSubjects = useMemo(() => {
    return subjects.filter(s => {
      if (categoryFilter !== 'All' && s.category !== categoryFilter) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [subjects, categoryFilter, search]);

  const selectedSubject = subjects.find(s => s.id === selectedId) ?? null;
  const selectedClaims  = selectedId ? (claims[selectedId] ?? []) : [];

  // ── Grade a tutor_subject ─────────────────────────────────────────────────

  async function handleGrade(subjectId: string, rowId: string, confidence: Conf) {
    setBusyRows(prev => ({ ...prev, [rowId]: true }));

    const res = await fetch(`/api/tutor-subjects/${rowId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confidence }),
    });

    setBusyRows(prev => ({ ...prev, [rowId]: false }));
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to grade'}`);
      return;
    }

    // Update local claim — mark as graded (gradedBy non-null) and set new confidence
    setClaims(prev => ({
      ...prev,
      [subjectId]: (prev[subjectId] ?? []).map(c =>
        c.rowId === rowId ? { ...c, confidence, gradedBy: 'graded' } : c,
      ),
    }));

    // Recalculate pendingCount: pending = gradedBy === null
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      const updatedClaims = (claims[subjectId] ?? []).map(c =>
        c.rowId === rowId ? { ...c, gradedBy: 'graded' } : c,
      );
      return { ...s, pendingCount: updatedClaims.filter(c => c.gradedBy === null).length };
    }));

    showToast(`Graded as ${CONF_LABEL[confidence]}`);
  }

  // ── Add subject ───────────────────────────────────────────────────────────

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

    const subject = await res.json() as { id: string; name: string; category: string };
    const newRow: SubjectRow = { ...subject, tutorCount: 0, pendingCount: 0 };
    setSubjects(prev =>
      [...prev, newRow].sort((a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
      ),
    );
    setAddName('');
    setAddCategory('');
    setShowAddForm(false);
    setSelectedId(subject.id);
    showToast(`${subject.name} added`);
  }

  // ── Delete subject ────────────────────────────────────────────────────────

  async function handleDeleteSubject(id: string, name: string) {
    const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to delete subject'}`);
      return;
    }
    setSubjects(prev => {
      const next = prev.filter(s => s.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
    showToast(`${name} removed`);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Left sidebar: subject list ────────────────────────────────────── */}
      <div className="w-[272px] shrink-0 border-r border-border-default bg-surface-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[17px] font-extrabold tracking-[-0.015em] text-fg-1">Subjects</h1>
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="h-7 px-2.5 rounded-md bg-brand-ink text-fg-on-brand text-[11px] font-bold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                <path d="M5 1v8M1 5h8" />
              </svg>
              Add
            </button>
          </div>

          {/* Add subject inline form */}
          {showAddForm && (
            <form onSubmit={handleAddSubject} className="mb-3 flex flex-col gap-2">
              <input
                autoFocus
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="Subject name"
                required
                className="w-full h-8 px-2.5 text-xs border border-border-default rounded-lg text-fg-1 placeholder:text-fg-muted outline-none focus:border-border-strong bg-surface-1 font-[inherit]"
              />
              <input
                value={addCategory}
                onChange={e => setAddCategory(e.target.value)}
                placeholder="Category (e.g. STEM)"
                required
                className="w-full h-8 px-2.5 text-xs border border-border-default rounded-lg text-fg-1 placeholder:text-fg-muted outline-none focus:border-border-strong bg-surface-1 font-[inherit]"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-7 rounded-md border border-border-default text-[11px] font-semibold text-fg-2 hover:bg-surface-2 transition-colors font-[inherit]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addPending}
                  className="flex-1 h-7 rounded-md bg-brand-ink text-fg-on-brand text-[11px] font-bold disabled:opacity-50 hover:opacity-90 transition-opacity font-[inherit]"
                >
                  {addPending ? '…' : 'Add'}
                </button>
              </div>
            </form>
          )}

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-2 text-fg-muted" width={13} height={13} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
              <circle cx={6} cy={6} r={4.5} /><path d="M10 10l2 2" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subjects…"
              className="w-full h-8 pl-8 pr-2.5 text-xs border border-border-default rounded-lg text-fg-1 placeholder:text-fg-muted outline-none focus:border-border-strong bg-surface-1 font-[inherit]"
            />
          </div>
        </div>

        {/* Category filter pills */}
        <div className="px-4 pb-2 flex gap-1.5 flex-wrap shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={[
                'h-6 px-2.5 rounded-full text-[11px] font-semibold transition-colors font-[inherit]',
                cat === categoryFilter
                  ? 'bg-fg-1 text-fg-on-brand'
                  : 'bg-surface-3 text-fg-2 hover:bg-surface-3 hover:text-fg-1',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subject list */}
        <div className="flex-1 overflow-y-auto">
          {filteredSubjects.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-fg-muted">No subjects found</div>
          )}
          {filteredSubjects.map(s => {
            const isActive = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={[
                  'w-full text-left px-4 py-3 border-b border-border-default transition-colors font-[inherit]',
                  isActive ? 'bg-fg-1' : 'hover:bg-surface-2',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={['text-[13px] font-semibold leading-snug', isActive ? 'text-fg-on-brand' : 'text-fg-1'].join(' ')}>
                    {s.name}
                  </span>
                  {s.pendingCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-px rounded-full bg-warning-bg text-warning-ink shrink-0 whitespace-nowrap">
                      {s.pendingCount} pending
                    </span>
                  )}
                </div>
                <div className={['text-[11px] mt-0.5', isActive ? 'text-neutral-400' : 'text-fg-3'].join(' ')}>
                  {s.category} · {s.tutorCount} {s.tutorCount === 1 ? 'tutor' : 'tutors'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right panel: subject detail ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-surface-2">
        {!selectedSubject ? (
          <div className="flex items-center justify-center h-full text-fg-muted text-sm">
            Select a subject to view tutors
          </div>
        ) : (
          <div className="max-w-[820px] mx-auto px-8 py-8">

            {/* Subject heading */}
            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-fg-3 mb-1">
                {selectedSubject.category}
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[28px] font-extrabold tracking-[-0.02em] text-fg-1 leading-tight">
                    {selectedSubject.name}
                  </h2>
                  <p className="text-sm text-fg-3 mt-1">
                    {selectedSubject.tutorCount} {selectedSubject.tutorCount === 1 ? 'tutor claims' : 'tutors claim'} this subject
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteSubject(selectedSubject.id, selectedSubject.name)}
                  className="h-8 px-3 rounded-lg border border-border-default bg-surface-1 text-xs font-semibold text-fg-3 hover:border-danger hover:text-danger hover:bg-danger-bg transition-colors shrink-0 mt-1"
                >
                  Remove subject
                </button>
              </div>
            </div>

            {/* Pending banner */}
            {totalPending > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 bg-warning-bg border border-warning rounded-xl mb-6 text-sm">
                <svg className="text-warning-ink shrink-0 mt-px" width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
                  <path d="M8 7v3M8 12v.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
                <span className="text-warning-ink text-[13px]">
                  <strong>{totalPending} pending {totalPending === 1 ? 'review' : 'reviews'}</strong> across all subjects. Grade below to make these tutors filterable.
                </span>
              </div>
            )}

            {/* Tutors section */}
            {selectedClaims.length === 0 ? (
              <div className="bg-surface-1 border border-border-default rounded-xl p-10 text-center">
                <div className="text-sm font-semibold text-fg-1">No tutors yet</div>
                <div className="text-xs text-fg-muted mt-1">Tutors can add this subject from their profile.</div>
              </div>
            ) : (
              <div className="bg-surface-1 border border-border-default rounded-xl overflow-hidden">
                {/* Section label */}
                <div className="px-5 py-2.5 border-b border-border-default bg-surface-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-fg-muted">
                    Tutors · Grade confidence
                  </span>
                </div>

                {/* Tutor rows */}
                {selectedClaims.map((claim, idx) => {
                  const busy = busyRows[claim.rowId] ?? false;
                  return (
                    <div
                      key={claim.rowId}
                      className={['flex items-center gap-4 px-5 py-4', idx > 0 ? 'border-t border-border-default' : ''].join(' ')}
                    >
                      <Avatar initials={claim.tutorInitials} tone={avatarTone(idx)} size="md" />

                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-fg-1">{claim.tutorName}</div>
                        {claim.tutorBio && (
                          <div className="text-[11px] text-fg-3 mt-px truncate">{claim.tutorBio}</div>
                        )}
                        {claim.qualificationNote && !claim.tutorBio && (
                          <div className="text-[11px] text-fg-3 mt-px truncate italic">&ldquo;{claim.qualificationNote}&rdquo;</div>
                        )}
                      </div>

                      {/* Confidence toggle buttons — nothing selected until a coordinator grades */}
                      <div className="flex items-center gap-1 shrink-0">
                        {CONF_OPTIONS.map(conf => {
                          const isSelected = claim.gradedBy !== null && claim.confidence === conf;
                          return (
                            <button
                              key={conf}
                              onClick={() => handleGrade(selectedSubject.id, claim.rowId, conf)}
                              disabled={busy}
                              title={`Grade as ${CONF_LABEL[conf]}`}
                              className={[
                                'h-7 px-3 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-50 font-[inherit]',
                                isSelected
                                  ? CONF_ACTIVE[conf]
                                  : 'text-fg-3 hover:bg-surface-3 hover:text-fg-2',
                              ].join(' ')}
                            >
                              {CONF_LABEL[conf]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-brand-ink text-fg-on-brand rounded-xl shadow-lg text-sm font-medium pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
