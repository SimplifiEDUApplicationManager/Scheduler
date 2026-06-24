'use client';

import { useMemo, useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { CalendarStatus } from '@/app/api/nylas/free-busy/route';
import type { BusyBlock } from '@/app/api/nylas/weekly-busy/route';
import type { Tutor, TuitionRequest, Subject, Invitation } from '@/lib/types/domain';
import {
  parseFilters,
  filtersToParams,
  filterTutors,
  getWeekLabel,
  DEFAULT_CONF,
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
  coordinatorTz?: string;
}

export function TutorsClient({ tutors, requests, subjects, invitations }: TutorsClientProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const rawParams  = useSearchParams();

  // URL is the durable source of truth, but we keep an optimistic copy
  // so the UI updates instantly while router.replace settles in the background.
  const urlFilters = useMemo(() => parseFilters(rawParams), [rawParams]);
  const [optimisticFilters, setOptimisticFilters] = useState<FilterState | null>(null);
  const [, startTransition] = useTransition();
  const filters = optimisticFilters ?? urlFilters;

  // Sync optimistic state back to null once the URL catches up
  useEffect(() => {
    if (optimisticFilters && JSON.stringify(optimisticFilters) === JSON.stringify(urlFilters)) {
      setOptimisticFilters(null);
    }
  }, [urlFilters, optimisticFilters]);

  // UI-only state (not bookmarkable)
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [proposeFor, setProposeFor]            = useState<Tutor | null>(null);
  const [profileTutor, setProfileTutor]        = useState<Tutor | null>(null);
  const [toastName, setToastName]              = useState<string | null>(null);
  const [proposedReqIds, setProposedReqIds]    = useState<Set<string>>(new Set());
  const [weekOffset, setWeekOffset]            = useState(0);
  const [calendarStatuses, setCalendarStatuses] = useState<Record<string, CalendarStatus>>({});
  const [weeklyBusy, setWeeklyBusy]             = useState<Record<string, BusyBlock[]>>({});
  const freeBusyAbortRef  = useRef<AbortController | null>(null);
  const weeklyBusyAbortRef = useRef<AbortController | null>(null);

  function setFilters(next: FilterState) {
    // Update UI instantly
    setOptimisticFilters(next);
    setSelectedTutorId(null);
    // Push to URL in the background (non-blocking)
    const params = filtersToParams(next);
    const qs = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    });
  }

  const activeReq = (filters.reqId && !proposedReqIds.has(filters.reqId))
    ? requests.find(r => r.id === filters.reqId) ?? null
    : null;

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

  const filtered = useMemo(() => filterTutors(tutors, filters), [tutors, filters]);

  // Stable key representing the current set of filtered tutor IDs.
  // Changes only when the actual set of IDs changes, not on every render —
  // prevents spurious free-busy fetches when non-tuple filters change.
  const filteredIdKey = useMemo(
    () => [...filtered.map(t => t.id)].sort().join(','),
    [filtered],
  );

  // When tuples are active, check each filtered tutor's real calendar availability.
  // Re-runs when the tuple set, coordinator timezone, or tutor roster changes.
  const coordinatorTz = rawParams.get('tz') ?? 'America/New_York';
  useEffect(() => {
    if (filters.tuples.length === 0) {
      setCalendarStatuses({});
      return;
    }

    const tutorIds = filteredIdKey ? filteredIdKey.split(',') : [];
    if (!tutorIds.length) { setCalendarStatuses({}); return; }

    // Preserve existing statuses; only mark newly-visible tutors as 'unknown'
    // so that toggling non-tuple filters doesn't flash all badges to loading.
    setCalendarStatuses(prev => {
      const next: Record<string, CalendarStatus> = {};
      for (const id of tutorIds) next[id] = prev[id] ?? 'unknown';
      return next;
    });

    freeBusyAbortRef.current?.abort();
    const ctrl = new AbortController();
    freeBusyAbortRef.current = ctrl;

    fetch('/api/nylas/free-busy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tutorIds, tuples: filters.tuples, tz: coordinatorTz }),
      signal:  ctrl.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { results: Record<string, CalendarStatus> }) => setCalendarStatuses(data.results))
      .catch(() => { /* aborted or error — leave 'unknown' */ });

    return () => ctrl.abort();
  }, [filteredIdKey, filters.tuples, coordinatorTz]);

  // Fetch actual calendar events for the displayed week so WeekView can
  // subtract booked time from availability windows.
  useEffect(() => {
    const tutorIds = filteredIdKey ? filteredIdKey.split(',') : [];
    if (!tutorIds.length) { setWeeklyBusy({}); return; }

    weeklyBusyAbortRef.current?.abort();
    const ctrl = new AbortController();
    weeklyBusyAbortRef.current = ctrl;

    fetch('/api/nylas/weekly-busy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tutorIds, weekOffset, tz: coordinatorTz }),
      signal:  ctrl.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: { busySlots: Record<string, BusyBlock[]> }) => setWeeklyBusy(data.busySlots))
      .catch(() => { /* aborted or error — leave existing state */ });

    return () => ctrl.abort();
  }, [filteredIdKey, weekOffset, coordinatorTz]);

  function handleProposeSend(tutorName: string) {
    // Remove the proposed request from the picker and fully reset filters
    if (activeReq) {
      setProposedReqIds(prev => new Set(prev).add(activeReq.id));
    }
    setFilters({ q: '', subjects: [], conf: DEFAULT_CONF, tuples: [], reqId: null });
    setProposeFor(null);
    setToastName(tutorName);
    setTimeout(() => setToastName(null), 3200);
  }

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Left panel: request picker + filters + tutor list ─────────────── */}
      <aside className="w-[380px] border-r border-border-default bg-surface-1 flex flex-col shrink-0 min-h-0">
        <RequestPickerBlock
          requests={requests.filter(r => r.status === 'open' && !proposedReqIds.has(r.id))}
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
              onClick={() => setFilters({ q: '', subjects: [], conf: ['HIGH', 'MEDIUM'], tuples: [], reqId: null })}
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
              canPropose={!!activeReq}
              offeredRate={activeReq?.offeredRate}
              calendarStatus={filters.tuples.length > 0 ? (calendarStatuses[t.id] ?? 'unknown') : undefined}
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
          <h3 className="text-[15px] font-semibold text-fg-1">
            {selectedTutorId
              ? `${filtered.find(t => t.id === selectedTutorId)?.name ?? 'Tutor'}'s availability`
              : 'Shared availability'}
          </h3>
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
          tutors={selectedTutorId ? filtered.filter(t => t.id === selectedTutorId) : filtered}
          requestTuples={activeReq?.tuples ?? filters.tuples}
          weekOffset={weekOffset}
          busySlotsPerTutor={weeklyBusy}
        />
      </main>

      {/* ── Propose modal ──────────────────────────────────────────────────── */}
      {proposeFor && (
        <ProposeModal
          tutor={proposeFor}
          request={activeReq}
          onClose={() => setProposeFor(null)}
          onSend={() => handleProposeSend(proposeFor.name)}
          asanaTaskId={activeReq?.asanaTaskId}
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
