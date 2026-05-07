'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Tutor, TuitionRequest, Subject, Invitation } from '@/lib/types/domain';
import {
  parseFilters,
  filtersToParams,
  overlapsTuple,
  getWeekLabel,
  type FilterState,
} from '@/lib/utils/tutors';
import { RequestPickerBlock } from './RequestPickerBlock';
import { FilterPanel } from './FilterPanel';
import { TutorCard } from './TutorCard';
import { ProposeModal } from './ProposeModal';
import { TutorProfileDrawer } from './TutorProfileDrawer';
import { WeekView } from '@/components/features/calendar/WeekView';

interface TutorsClientProps {
  tutors: Tutor[];
  requests: TuitionRequest[];
  subjects: Subject[];
  invitations: Invitation[];
}

export function TutorsClient({ tutors, requests, subjects, invitations }: TutorsClientProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const rawParams  = useSearchParams();

  // Derive all filter state from URL — URL is the single source of truth
  const filters = useMemo(() => parseFilters(rawParams), [rawParams]);

  // UI-only state (not bookmarkable)
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [proposeFor, setProposeFor]            = useState<Tutor | null>(null);
  const [profileTutor, setProfileTutor]        = useState<Tutor | null>(null);
  const [toastName, setToastName]              = useState<string | null>(null);
  const [weekOffset, setWeekOffset]            = useState(0);

  function setFilters(next: FilterState) {
    const params = filtersToParams(next);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    // Deselect tutor when filters change
    setSelectedTutorId(null);
  }

  const activeReq = requests.find(r => r.id === filters.reqId) ?? null;

  // Apply a request → fill subject + tuples + reqId
  function applyRequest(req: TuitionRequest) {
    setFilters({
      ...filters,
      reqId:    req.id,
      subjects: [req.subjectId],
      tuples:   req.tuples,
      conf:     ['HIGH', 'MEDIUM'],
    });
  }

  function clearRequest() {
    setFilters({ ...filters, reqId: null, subjects: [], tuples: [] });
  }

  // Client-side filter logic
  const filtered = useMemo(() => {
    return tutors.filter(t => {
      if (filters.q && !t.name.toLowerCase().includes(filters.q.toLowerCase())) return false;
      if (filters.hideAtCap && t.hoursCurrent >= t.hoursMax) return false;
      if (filters.subjects.length > 0) {
        const hasMatch = t.subjects.some(
          ts => filters.subjects.includes(ts.id) && filters.conf.includes(ts.conf),
        );
        if (!hasMatch) return false;
      }
      if (filters.tuples.length > 0) {
        const anyMatch = filters.tuples.some(tp => overlapsTuple(t.availability, tp));
        if (!anyMatch) return false;
      }
      return true;
    });
  }, [tutors, filters]);

  function handleProposeSend(tutorName: string) {
    setProposeFor(null);
    setToastName(tutorName);
    setTimeout(() => setToastName(null), 3200);
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left panel: request picker + filters + tutor list ─────────────── */}
      <aside className="w-[380px] border-r border-border-default bg-surface-1 flex flex-col shrink-0 min-h-0">
        <RequestPickerBlock
          requests={requests.filter(r => r.status === 'open')}
          activeReq={activeReq}
          onPick={applyRequest}
          onClear={clearRequest}
        />

        {/* Filter panel */}
        <div className="px-4 py-2.5 border-b border-border-default">
          <FilterPanel
            filters={filters}
            subjects={subjects}
            onChange={setFilters}
          />
        </div>

        {/* Tutor list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-4 pt-2.5 pb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em]">
              Matching · {filtered.length} of {tutors.length}
            </span>
            <button
              onClick={() => setFilters({ q: '', subjects: [], conf: ['HIGH', 'MEDIUM'], tuples: [], hideAtCap: true, reqId: null })}
              className="text-[11px] text-fg-3 hover:text-fg-1 transition-colors"
            >
              Clear
            </button>
          </div>

          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-fg-muted leading-relaxed">
              No tutors match the current filters.
            </p>
          )}

          {filtered.map(t => (
            <TutorCard
              key={t.id}
              tutor={t}
              subjects={subjects}
              activeTuples={filters.tuples}
              activeSubjectId={filters.subjects[0]}
              selected={selectedTutorId === t.id}
              onSelect={() => setSelectedTutorId(prev => prev === t.id ? null : t.id)}
              onPropose={() => setProposeFor(t)}
              onProfile={() => setProfileTutor(t)}
            />
          ))}
        </div>
      </aside>

      {/* ── Right panel: shared availability calendar ────────────────────────── */}
      <main className="flex-1 flex flex-col bg-surface-1 min-w-0 min-h-0">
        <div className="px-5 py-3 border-b border-border-default flex items-center gap-3 shrink-0">
          <h3 className="text-[15px] font-semibold text-fg-1">Shared availability</h3>
          {activeReq && (
            <span className="text-[11px] text-fg-3">
              matching <strong className="text-fg-1">{activeReq.studentName}</strong> · {activeReq.subject}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors"
              aria-label="Previous week"
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                <path d="M7.5 2.5L4 6l3.5 3.5" />
              </svg>
            </button>
            <span className="text-[12px] font-medium text-fg-2 min-w-[164px] text-center tabular-nums">
              {getWeekLabel(weekOffset)}
            </span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              className="w-7 h-7 rounded-md border border-border-default flex items-center justify-center text-fg-2 hover:bg-surface-2 transition-colors"
              aria-label="Next week"
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
                <path d="M4.5 2.5L8 6l-3.5 3.5" />
              </svg>
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-2.5 py-1 text-[11px] font-medium text-fg-2 border border-border-default rounded-md hover:bg-surface-2 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
        <WeekView
          tutors={filtered}
          requestTuples={activeReq?.tuples ?? filters.tuples}
          weekOffset={weekOffset}
        />
      </main>

      {/* ── Propose modal ──────────────────────────────────────────────────── */}
      {proposeFor && (
        <ProposeModal
          tutor={proposeFor}
          request={activeReq}
          onClose={() => setProposeFor(null)}
          onSend={() => handleProposeSend(proposeFor.name)}
        />
      )}

      {/* ── Profile drawer ─────────────────────────────────────────────────── */}
      {profileTutor && (
        <TutorProfileDrawer
          tutor={profileTutor}
          subjects={subjects}
          invitations={invitations}
          onClose={() => setProfileTutor(null)}
          onPropose={() => { setProfileTutor(null); setProposeFor(profileTutor); }}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastName && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-surface-1 border border-border-default rounded-xl shadow-md text-sm font-medium text-fg-1">
          <div className="w-2 h-2 rounded-full bg-success shrink-0" />
          Proposal sent to {toastName}
        </div>
      )}
    </div>
  );
}
