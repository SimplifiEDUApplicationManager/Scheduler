import { useState } from 'react';
import type { Subject, Tuple } from '@/lib/types/domain';
import type { FilterState } from '@/lib/utils/tutors';
import { TupleRow } from './TupleRow';

const CONF_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
const CONF_LABEL: Record<string, string> = {
  HIGH: 'High', MEDIUM: 'Med', LOW: 'Low',
};

interface FilterPanelProps {
  filters: FilterState;
  subjects: Subject[];
  onChange: (f: FilterState) => void;
}

export function FilterPanel({ filters, subjects, onChange }: FilterPanelProps) {
  const [subjectOpen, setSubjectOpen] = useState(false);

  function set<K extends keyof FilterState>(key: K, val: FilterState[K]) {
    onChange({ ...filters, [key]: val });
  }

  function toggleConf(c: string) {
    const next = filters.conf.includes(c)
      ? filters.conf.filter(x => x !== c)
      : [...filters.conf, c];
    set('conf', next);
  }

  function addTuple() {
    if (filters.tuples.length >= 4) return;
    set('tuples', [...filters.tuples, { day: 1, start: 16, end: 19 } satisfies Tuple]);
  }

  function updateTuple(i: number, t: Tuple) {
    set('tuples', filters.tuples.map((x, xi) => xi === i ? t : x));
  }

  function removeTuple(i: number) {
    set('tuples', filters.tuples.filter((_, xi) => xi !== i));
  }

  const unselectedSubjects = subjects.filter(s => !filters.subjects.includes(s.id));

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-2 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none"
          width={13} height={13} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden
        >
          <circle cx={6} cy={6} r={4.5} />
          <path d="M10 10l2.5 2.5" />
        </svg>
        <input
          type="search"
          value={filters.q}
          onChange={e => set('q', e.target.value)}
          placeholder="Search tutors by name…"
          className="w-full h-8 pl-7 pr-3 text-xs border border-border-default rounded-lg bg-surface-1 text-fg-1 placeholder:text-fg-muted focus:outline-none focus:border-neutral-400"
        />
      </div>

      {/* Subject chips */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em]">Subjects</span>
          <button
            onClick={() => setSubjectOpen(v => !v)}
            className="text-[11px] text-fg-3 hover:text-fg-1 underline transition-colors"
          >
            {subjectOpen ? 'Hide' : 'Edit'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {filters.subjects.length === 0 && !subjectOpen && (
            <span className="text-[11px] text-fg-muted">Any subject</span>
          )}
          {filters.subjects.map(id => {
            const s = subjects.find(x => x.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-ink text-fg-on-brand text-[10px] font-semibold"
              >
                {s?.name ?? id}
                <button
                  onClick={() => set('subjects', filters.subjects.filter(x => x !== id))}
                  aria-label={`Remove ${s?.name}`}
                  className="flex items-center opacity-70 hover:opacity-100 transition-opacity"
                >
                  <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                    <path d="M2 2L8 8M8 2L2 8" />
                  </svg>
                </button>
              </span>
            );
          })}
          {subjectOpen && unselectedSubjects.slice(0, 8).map(s => (
            <button
              key={s.id}
              onClick={() => { set('subjects', [...filters.subjects, s.id]); }}
              className="px-2 py-0.5 rounded-full bg-surface-3 text-fg-2 text-[10px] font-medium hover:bg-neutral-200 transition-colors"
            >
              + {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence toggles */}
      <div>
        <span className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em] block mb-1">Confidence</span>
        <div className="flex gap-1">
          {CONF_LEVELS.map(c => {
            const on = filters.conf.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleConf(c)}
                className={`flex-1 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
                  on
                    ? 'bg-brand-ink text-fg-on-brand border-brand-ink'
                    : 'bg-surface-1 text-fg-3 border-border-default hover:border-neutral-300'
                }`}
              >
                {CONF_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Availability tuples */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em]">Availability windows</span>
          {filters.tuples.length < 4 && (
            <button
              onClick={addTuple}
              className="text-[11px] font-semibold text-brand-primary-ink hover:text-brand-primary-deep transition-colors"
            >
              + Add
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          {filters.tuples.length === 0 && (
            <span className="text-[11px] text-fg-muted">Any time</span>
          )}
          {filters.tuples.map((t, i) => (
            <TupleRow
              key={i}
              tuple={t}
              onChange={nt => updateTuple(i, nt)}
              onRemove={() => removeTuple(i)}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
