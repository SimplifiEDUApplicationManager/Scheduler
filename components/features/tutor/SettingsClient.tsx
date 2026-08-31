'use client';

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { uploadTutorPhoto } from '@/lib/utils/uploadTutorPhoto';
import { useSearchParams } from 'next/navigation';
import type { Tutor, Subject, TutorSubject, SubjectConf } from '@/lib/types/domain';
import { subjectDisplayName } from '@/lib/types/domain';
import type { SchedulerSummary } from '@/lib/nylas/scheduler';
import { Avatar } from '@/components/ui/Avatar';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { AddSubjectModal } from './AddSubjectModal';
import { EditSubjectModal } from './EditSubjectModal';
import { DeleteSubjectModal } from './DeleteSubjectModal';
import { BookingPagePreview } from './BookingPagePreview';
import { SchedulerPreferencesModal } from './SchedulerPreferencesModal';
import { DEV_BYPASS } from '@/lib/env';
import { formatTimezoneLabel } from '@/lib/utils/timezone';

interface Props { me: Tutor; allSubjects: Subject[]; schedulerSummary: SchedulerSummary | null; }


const CONF_META: Record<SubjectConf, { label: string; bg: string; fg: string; bar: string }> = {
  HIGH:   { label: 'High',   bg: '#DCFCE7', fg: '#166534', bar: '#22C55E' },
  MEDIUM: { label: 'Medium', bg: '#DBEAFE', fg: '#1E40AF', bar: '#3B82F6' },
  LOW:    { label: 'Low',    bg: '#FEE2E2', fg: '#991B1B', bar: '#EF4444' },
};
const CONF_ORDER: SubjectConf[] = ['HIGH', 'MEDIUM', 'LOW'];

const NAV = [
  ['profile',  'Profile'],
  ['capacity', 'Capacity'],
  ['subjects', 'My subjects'],
  ['hours',    'Working hours'],
  ['calendar', 'Calendar'],
  ['pause',    'Pause tutoring'],
] as const;
type SectionId = typeof NAV[number][0];

export function SettingsClient({ me, allSubjects, schedulerSummary }: Props) {
  const [name, setName]           = useState(me.name);
  const [tz, setTz]               = useState(me.tz);
  const [meetingLink, setLink]    = useState(me.meetingLink ?? '');
  const [maxHours, setMax]        = useState(me.hoursMax);
  const [minHours, setMin]        = useState(me.hoursMin);
  const [minRate, setMinRate]     = useState(me.minRate);
  const [photoUrl, setPhotoUrl]   = useState(me.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const bookingUrl                = me.bookingPageUrl ?? null;
  const [mySubjects, setSubjects] = useState<TutorSubject[]>(me.subjects);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveInitRef = useRef(false);
  const [isPaused, setIsPaused]   = useState(me.isPaused);
  const [availReqs, setAvailReqs] = useState(me.availabilityRequests);
  const [addOpen, setAddOpen]       = useState(false);
  const [editingTs, setEditingTs]   = useState<TutorSubject | null>(null);
  const [deletingTs, setDeletingTs] = useState<TutorSubject | null>(null);
  const [pauseOpen, setPauseOpen]   = useState(false);
  const [lowHoursOpen, setLowHoursOpen] = useState(false);
  const [toast, setToast]         = useState<string | null>(null);
  const [activeSection, setActive] = useState<SectionId>('profile');
  const [schedulerSummaryState, setSchedulerSummary] = useState<SchedulerSummary | null>(schedulerSummary);
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [nylasCalendars, setNylasCalendars] = useState<{ id: string; name: string }[] | null>(null);
  const [selectedCalIds, setSelectedCalIds] = useState<string[] | null>(null);
  const [calPickerLoading, setCalPickerLoading] = useState(false);
  const [calPickerSaving, setCalPickerSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();


  // Derived availability request states
  const pendingPause        = availReqs.find(r => r.requestType === 'PAUSE' && r.status === 'PENDING');
  const declinedPause       = availReqs.find(r => r.requestType === 'PAUSE' && r.status === 'DECLINED');
  const pendingLowHours     = availReqs.find(r => r.requestType === 'LOW_MAX_HOURS' && r.status === 'PENDING');
  const declinedLowHours    = availReqs.find(r => r.requestType === 'LOW_MAX_HOURS' && r.status === 'DECLINED');
  const pendingLowWindows   = availReqs.find(r => r.requestType === 'LOW_AVAILABILITY_WINDOWS' && r.status === 'PENDING');

  // Max hours input is "locked" when a LOW_MAX_HOURS request is pending
  const maxHoursLocked = !!pendingLowHours;

  // Hard validation: max > total availability hours (only if tutor has set prefs)
  const totalAvail = me.totalAvailabilityHours;
  const maxExceedsAvail = totalAvail > 0 && maxHours > totalAvail;
  const maxError = maxHours < 1 || maxHours > 40 || maxExceedsAvail;

  const [settingsBusy, setSettingsBusy] = useState<string | null>(null);

  async function handleResume() {
    setSettingsBusy('resume');
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? 'Failed to resume');
        return;
      }
      setIsPaused(false);
      showToast('Availability resumed');
    } catch {
      showToast('Failed to resume — check your connection and try again');
    } finally {
      setSettingsBusy(null);
    }
  }

  async function handleCancelAvailRequest(id: string) {
    setSettingsBusy(`cancel-${id}`);
    try {
      const res = await fetch(`/api/tutor/availability-request/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? 'Failed to cancel request');
        return;
      }
      setAvailReqs(prev => prev.filter(r => r.id !== id));
      showToast('Request cancelled');
    } catch {
      showToast('Failed to cancel request — check your connection and try again');
    } finally {
      setSettingsBusy(null);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const photoUrl = await uploadTutorPhoto(file);
      setPhotoUrl(photoUrl);
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed — check your connection and try again');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const openSchedulerEdit = useCallback(() => {
    setShowSchedulerModal(true);
  }, []);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function safeJson(res: Response): Promise<Record<string, unknown>> {
    try { return await res.json() as Record<string, unknown>; } catch { return {}; }
  }

  async function handleAdd(ts: TutorSubject) {
    const name = (() => { const s = allSubjects.find(x => x.id === ts.id); return s ? subjectDisplayName(s) : 'Subject'; })();
    if (DEV_BYPASS) {
      setSubjects(prev => [...prev, {
        ...ts,
        pendingChange: { id: `dev-${ts.id}`, tutorId: '', subjectId: ts.id, changeType: 'ADD' as const, requestedConf: ts.conf, requestedNote: ts.qualificationNote, status: 'PENDING' as const, createdAt: new Date().toISOString() },
      }]);
      setAddOpen(false);
      showToast(`${name} submitted for coordinator review`);
      return;
    }
    try {
      const res = await fetch('/api/tutor-subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_id: ts.id, qualification_note: ts.qualificationNote, tutor_confidence: ts.conf }),
      });
      const body = await safeJson(res);
      if (!res.ok) { showToast(`Error: ${String(body.error ?? 'Failed to submit request')}`); return; }
      setSubjects(prev => [...prev, {
        ...ts,
        // No rowId — not in tutor_subjects until the coordinator approves
        pendingChange: {
          id: String(body.id ?? ''),
          tutorId: '',
          subjectId: ts.id,
          changeType: 'ADD' as const,
          requestedConf: ts.conf,
          requestedNote: ts.qualificationNote,
          status: 'PENDING' as const,
          createdAt: String(body.created_at ?? new Date().toISOString()),
        },
      }]);
      setAddOpen(false);
      showToast(`${name} submitted for coordinator review`);
    } catch {
      showToast('Failed to submit request — check your connection and try again');
    }
  }

  async function handleEdit(ts: TutorSubject, updated: Pick<TutorSubject, 'conf' | 'qualificationNote'>) {
    const name = (() => { const s = allSubjects.find(x => x.id === ts.id); return s ? subjectDisplayName(s) : 'Subject'; })();
    if (DEV_BYPASS) {
      setSubjects(prev => prev.map(x => x.id === ts.id ? {
        ...x,
        pendingChange: { id: `dev-edit-${ts.id}`, tutorId: '', subjectId: ts.id, tutorSubjectId: ts.rowId, changeType: 'EDIT' as const, requestedConf: updated.conf, requestedNote: updated.qualificationNote, status: 'PENDING' as const, createdAt: new Date().toISOString() },
      } : x));
      setEditingTs(null);
      showToast(`${name} change submitted for coordinator review`);
      return;
    }
    if (!ts.rowId) { showToast('Cannot edit: subject has no row ID'); return; }
    try {
      const res = await fetch(`/api/tutor-subjects/${ts.rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutor_confidence: updated.conf, qualification_note: updated.qualificationNote }),
      });
      const body = await safeJson(res);
      if (!res.ok) { showToast(`Error: ${String(body.error ?? 'Failed to submit change')}`); return; }
      // Mark the subject as having a pending edit — confidence unchanged until coordinator approves
      setSubjects(prev => prev.map(x => x.id === ts.id ? {
        ...x,
        pendingChange: {
          id: String(body.id ?? ''),
          tutorId: '',
          subjectId: ts.id,
          tutorSubjectId: ts.rowId,
          changeType: 'EDIT' as const,
          requestedConf: updated.conf,
          requestedNote: updated.qualificationNote,
          status: 'PENDING' as const,
          createdAt: String(body.created_at ?? new Date().toISOString()),
        },
      } : x));
      setEditingTs(null);
      showToast(`${name} change submitted for coordinator review`);
    } catch {
      showToast('Failed to submit change — check your connection and try again');
    }
  }

  async function handleRemove(ts: TutorSubject, reason: string) {
    if (DEV_BYPASS) {
      setDeletingTs(null);
      setSubjects(prev => prev.map(x => x.id === ts.id ? {
        ...x,
        pendingChange: { id: `dev-remove-${ts.id}`, tutorId: '', subjectId: ts.id, tutorSubjectId: ts.rowId, changeType: 'REMOVE' as const, requestedNote: reason, status: 'PENDING' as const, createdAt: new Date().toISOString() },
      } : x));
      showToast('Removal request submitted for coordinator review');
      return;
    }
    if (!ts.rowId) { setDeletingTs(null); showToast('Cannot remove: subject has no row ID'); return; }
    try {
      const res = await fetch(`/api/tutor-subjects/${ts.rowId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const body = await safeJson(res);
      if (!res.ok) { showToast(`Error: ${String(body.error ?? 'Failed to submit removal request')}`); return; }
      setDeletingTs(null);
      setSubjects(prev => prev.map(x => x.id === ts.id ? {
        ...x,
        pendingChange: {
          id: String(body.id ?? ''),
          tutorId: '',
          subjectId: ts.id,
          tutorSubjectId: ts.rowId,
          changeType: 'REMOVE' as const,
          requestedNote: reason,
          status: 'PENDING' as const,
          createdAt: String(body.created_at ?? new Date().toISOString()),
        },
      } : x));
      showToast('Removal request submitted for coordinator review');
    } catch {
      showToast('Failed to submit removal request — check your connection and try again');
    }
  }

  // Auto-save: debounce 800ms after any profile field changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!autoSaveInitRef.current) { autoSaveInitRef.current = true; return; }
    if (maxHours < 1 || maxHours > 40 || (totalAvail > 0 && maxHours > totalAvail)) return;

    setAutoSaveStatus('idle');
    const timer = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        const res = await fetch('/api/tutor/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            timezone: tz,
            ...(maxHours > 5 ? { maxWeeklyHours: maxHours } : {}),
            minWeeklyHours: minHours,
            minRate,
            meetingLink,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          showToast(data.error ?? 'Failed to save');
          setAutoSaveStatus('idle');
          return;
        }
      } catch {
        showToast('Failed to save — check your connection');
        setAutoSaveStatus('idle');
        return;
      }
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }, 800);

    return () => clearTimeout(timer);
  }, [name, tz, maxHours, minHours, minRate, meetingLink]);

  // Fetch writable calendars from Nylas when connected
  useEffect(() => {
    if (!me.nylasGrantId) return;
    setCalPickerLoading(true);
    fetch('/api/tutor/calendars')
      .then(res => res.json())
      .then((data: { calendars: { id: string; name: string }[]; selectedIds: string[] | null }) => {
        setNylasCalendars(data.calendars ?? []);
        setSelectedCalIds(data.selectedIds);
      })
      .catch(() => { /* non-fatal */ })
      .finally(() => setCalPickerLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCalendarToggle(calId: string, checked: boolean) {
    if (!nylasCalendars) return;
    // If currently null (all selected), start from the full list
    const current = selectedCalIds ?? nylasCalendars.map(c => c.id);
    const next = checked
      ? [...current, calId]
      : current.filter(id => id !== calId);

    // Don't allow deselecting all calendars
    if (next.length === 0) {
      showToast('You must keep at least one calendar selected');
      return;
    }

    // If all calendars are now selected, store null (= all)
    const allSelected = nylasCalendars.every(c => next.includes(c.id));
    const toSave = allSelected ? null : next;

    setSelectedCalIds(toSave);
    setCalPickerSaving(true);
    try {
      const res = await fetch('/api/tutor/calendars', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedIds: toSave }),
      });
      if (!res.ok) {
        showToast('Failed to save calendar selection');
        setSelectedCalIds(selectedCalIds); // revert
      }
    } catch {
      showToast('Failed to save — check your connection');
      setSelectedCalIds(selectedCalIds); // revert
    } finally {
      setCalPickerSaving(false);
    }
  }

  // Scroll to section from ?section= query param on initial mount
  useEffect(() => {
    const section = searchParams.get('section') as SectionId | null;
    if (!section) return;
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`#sec-${section}`);
    if (root && el) root.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scrollspy
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    function handler() {
      let current: SectionId = 'profile';
      for (const [id] of NAV) {
        const el = root!.querySelector<HTMLElement>(`#sec-${id}`);
        if (el && el.offsetTop - 100 <= root!.scrollTop) current = id;
      }
      setActive(current);
    }
    root.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => root.removeEventListener('scroll', handler);
  }, []);

  function jumpTo(id: SectionId) {
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`#sec-${id}`);
    if (root && el) root.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
  }

  function copyBookingUrl() {
    if (!bookingUrl) return;
    navigator.clipboard?.writeText(bookingUrl).catch(() => {});
    showToast('Booking link copied to clipboard');
  }

  return (
    <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '24px 32px 120px', display: 'grid', gridTemplateColumns: '192px minmax(0,1fr)', gap: 32 }}>

        {/* Sticky sub-nav */}
        <aside data-tour="settings-subnav" style={{ position: 'sticky', top: 24, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 10px' }}>Jump to</div>
          {NAV.map(([id, label]) => {
            const active = activeSection === id;
            return (
              <button key={id} onClick={() => jumpTo(id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: active ? 600 : 500, color: active ? '#18181B' : '#71717A', background: active ? '#fff' : 'transparent', border: active ? '1px solid #E4E4E7' : '1px solid transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: active ? '#2B7265' : 'transparent' }} />
                {label}
                {id === 'pause' && isPaused && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#DC2626' }}>ON</span>}
              </button>
            );
          })}
        </aside>

        {/* Main content */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.015em' }}>Settings</h1>
            {autoSaveStatus !== 'idle' && (
              <span style={{ fontSize: 12, color: autoSaveStatus === 'saving' ? '#A1A1AA' : '#22C55E', transition: 'color 0.2s' }}>
                {autoSaveStatus === 'saving' ? 'Saving…' : 'Saved ✓'}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: '#71717A', margin: '0 0 24px' }}>Profile, capacity, and scheduling preferences for your tutoring account.</p>

          {isPaused && (
            <div style={{ padding: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#DC2626" strokeWidth={1.5} strokeLinecap="round" aria-hidden><path d="M8 5v3M8 10.5v.5" /><circle cx={8} cy={8} r={6.5} /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>Your availability is paused</div>
                <div style={{ fontSize: 12, color: '#B91C1C' }}>Coordinators can&apos;t see your calendar. Existing sessions stay booked.</div>
              </div>
              <button onClick={handleResume} disabled={settingsBusy === 'resume'} style={{ ...btn('secondary'), opacity: settingsBusy === 'resume' ? 0.6 : 1 }}>{settingsBusy === 'resume' ? 'Resuming\u2026' : 'Resume'}</button>
            </div>
          )}

          {/* Profile */}
          <Card id="profile" title="Profile" subtitle="Shown to coordinators on your tutor card.">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Avatar initials={me.initials} src={photoUrl ?? undefined} size="xl" tone="brand" />
                {uploading && (
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '999px', animation: 'spin 0.7s linear infinite' }} />
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{me.name}</div>
                <div style={{ fontSize: 12, color: '#71717A' }}>{me.email}</div>
              </div>
              {/* Implicit label containment: the browser activates the input when the label is clicked,
                  no htmlFor or programmatic .click() needed — works in all browsers */}
              <label style={{ ...btn('secondary'), opacity: uploading ? 0.5 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? 'Uploading…' : 'Change photo'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading}
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
            <Row label="Full name" sub="Appears on your tutor card, proposals, and calendar invites.">
              <input value={name} onChange={e => { setName(e.target.value); }} style={input()} />
            </Row>
            <Row label="Email address" sub="Changes must be made by an admin.">
              <input defaultValue={me.email} disabled style={{ ...input(), background: '#FAFAFA', color: '#71717A' }} />
            </Row>
            <Row label="Timezone" sub="We interpret your working hours in this timezone and convert session times for students.">
              <TimezoneSelect value={tz} onChange={v => { setTz(v); }} />
            </Row>
            <Row label="Bio" sub="Admin-controlled — contact your coordinator to update.">
              <div style={{ padding: 12, background: '#FAFAFA', border: '1px solid #F5F5F5', borderRadius: 8, fontSize: 13, color: '#52525B', lineHeight: 1.5 }}>{me.bio}</div>
            </Row>
          </Card>

          {/* Capacity */}
          <Card id="capacity" dataTour="settings-capacity" title="Capacity" subtitle="Coordinators use these numbers to decide how many sessions to route to you. Max is required and must be between 1 and 40.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={metaLabel}>Maximum weekly hours</label>
                {maxHoursLocked ? (
                  <div style={{ padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, color: '#78350F' }}>
                    {pendingLowHours!.details?.requested_hours as number} hrs — pending coordinator approval
                    <button onClick={() => handleCancelAvailRequest(pendingLowHours!.id)} disabled={settingsBusy === `cancel-${pendingLowHours!.id}`} style={{ marginLeft: 10, fontSize: 11, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', opacity: settingsBusy === `cancel-${pendingLowHours!.id}` ? 0.5 : 1 }}>{settingsBusy === `cancel-${pendingLowHours!.id}` ? 'Cancelling\u2026' : 'Cancel request'}</button>
                  </div>
                ) : (
                  <input type="number" min={1} max={40} value={maxHours} onChange={e => { setMax(+e.target.value); }} style={{ ...input(), borderColor: maxError ? '#DC2626' : '#E4E4E7' }} />
                )}
                <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>Hard ceiling. Coordinators can&apos;t schedule past this.</div>
                {maxExceedsAvail && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Cannot exceed your {totalAvail} hrs/week of availability windows.</div>}
                {!maxExceedsAvail && maxHours < 1 && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Must be at least 1 hour.</div>}
                {!maxExceedsAvail && maxHours > 40 && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Must be 40 hours or less.</div>}
                {!maxHoursLocked && maxHours <= 5 && maxHours >= 1 && (
                  <div style={{ marginTop: 6, padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 12, color: '#78350F' }}>
                    Hours of 5 or below require coordinator approval.{' '}
                    <button onClick={() => setLowHoursOpen(true)} style={{ fontWeight: 700, color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0, textDecoration: 'underline' }}>Submit for approval</button>
                  </div>
                )}
                {declinedLowHours && !pendingLowHours && (
                  <div style={{ marginTop: 6, padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12, color: '#991B1B' }}>
                    Previous request declined{declinedLowHours.declineReason ? ` — ${declinedLowHours.declineReason}` : ''}.
                  </div>
                )}
              </div>
              <div>
                <label style={metaLabel}>Minimum weekly hours</label>
                <input type="number" min={6} value={minHours} onChange={e => { setMin(+e.target.value); }} style={input()} />
                <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>Target floor — flags you as underbooked. System min: 6 hours.</div>
              </div>
            </div>
            <div style={{ padding: 14, background: '#FAFAFA', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#71717A', marginBottom: 2 }}>Current week</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{me.hoursCurrent}</span>
                  <span style={{ fontSize: 12, color: '#71717A' }}>of {maxHours} hours booked</span>
                </div>
              </div>
              <CapacityBar current={me.hoursCurrent} max={maxHours} showLabel={false} className="w-40" />
            </div>

            {/* Minimum rate */}
            <div style={{ marginTop: 16 }}>
              <label style={metaLabel}>Minimum hourly rate</label>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                {[20, 25, 30, 35, 40].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => { setMinRate(r); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid',
                      fontSize: 13,
                      fontWeight: minRate === r ? 600 : 400,
                      cursor: 'pointer',
                      background: minRate === r ? '#18181B' : '#FFFFFF',
                      color: minRate === r ? '#FFFFFF' : '#3F3F46',
                      borderColor: minRate === r ? '#18181B' : '#E4E4E7',
                      transition: 'all 0.1s',
                    }}
                  >
                    ${r}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>Proposals below this rate will show as &quot;Over budget&quot; on coordinator screens.</div>
            </div>
          </Card>

          {/* My subjects */}
          <Card id="subjects" dataTour="settings-subjects" title="My subjects" subtitle="The subjects you teach. Coordinators see your confidence level when filtering tutors.">
            {/* Confidence legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: '#FAFAFA', borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My confidence</span>
              {CONF_ORDER.map(k => {
                const m = CONF_META[k];
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 3, background: m.bar }} />
                    <span style={{ fontSize: 11, color: '#52525B', fontWeight: 600 }}>{m.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Cards grid */}
            {mySubjects.length === 0 ? (
              <div style={{ padding: '28px 16px', border: '2px dashed #E4E4E7', borderRadius: 10, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>No subjects yet</div>
                <p style={{ fontSize: 12, color: '#71717A', margin: '4px 0 0' }}>Add the subjects you&apos;re comfortable teaching.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
                {[...mySubjects].sort((a, b) => CONF_ORDER.indexOf(a.conf) - CONF_ORDER.indexOf(b.conf)).map(ts => {
                  const subject = allSubjects.find(s => s.id === ts.id);
                  if (!subject) return null;
                  const meta        = CONF_META[ts.conf];
                  const pending     = ts.pendingChange;
                  const isPending   = pending?.status === 'PENDING';
                  const isRemovePending = isPending && pending?.changeType === 'REMOVE';
                  const isAddPending    = isPending && pending?.changeType === 'ADD';
                  const isEditPending   = isPending && pending?.changeType === 'EDIT';
                  const isDeclined  = pending?.status === 'DECLINED';

                  const cardOpacity = isRemovePending ? 0.55 : 1;
                  const borderColor = isAddPending ? '#D97706' : isDeclined ? '#DC2626' : '#E4E4E7';
                  const accentColor = isAddPending ? '#D97706' : isDeclined ? '#DC2626' : meta.bar;

                  return (
                    <div key={`${ts.id}-${pending?.id ?? 'approved'}`} style={{ background: '#fff', border: `1px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden', position: 'relative', opacity: cardOpacity }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accentColor }} />
                      <div style={{ padding: '12px 12px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B', textDecoration: isRemovePending ? 'line-through' : 'none' }}>{subjectDisplayName(subject)}</div>
                            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 1 }}>{subject.cat}</div>
                          </div>

                          {/* Confidence badge — show current (or requested for ADD) */}
                          {!isPending || isEditPending || isRemovePending ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: meta.bg, color: meta.fg, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              <span style={{ width: 5, height: 5, borderRadius: 999, background: meta.bar }} />
                              {meta.label}
                            </span>
                          ) : null}
                          {isAddPending && pending.requestedConf && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: CONF_META[pending.requestedConf].bg, color: CONF_META[pending.requestedConf].fg, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              <span style={{ width: 5, height: 5, borderRadius: 999, background: CONF_META[pending.requestedConf].bar }} />
                              {CONF_META[pending.requestedConf].label}
                            </span>
                          )}

                          {/* Action buttons — disabled when a change is pending */}
                          {!isPending && (
                            <>
                              <button onClick={() => setEditingTs(ts)} title="Edit confidence" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#71717A', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width={11} height={11} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden><path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" /></svg>
                              </button>
                              <button onClick={() => setDeletingTs(ts)} title="Remove subject" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #FECACA', background: '#fff', color: '#DC2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <svg width={11} height={11} viewBox="0 0 12 12" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M2 2l8 8M10 2l-8 8" /></svg>
                              </button>
                            </>
                          )}
                        </div>

                        {/* Pending / declined status line */}
                        {isAddPending    && <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 4, padding: '2px 6px', display: 'inline-block', alignSelf: 'flex-start' }}>Pending coordinator review</div>}
                        {isEditPending   && <div style={{ fontSize: 10, fontWeight: 700, color: '#1E40AF', background: '#DBEAFE', borderRadius: 4, padding: '2px 6px', display: 'inline-block', alignSelf: 'flex-start' }}>Confidence change pending: {CONF_META[ts.conf].label} → {pending.requestedConf ? CONF_META[pending.requestedConf].label : '?'}</div>}
                        {isRemovePending && <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 4, padding: '2px 6px', display: 'inline-block', alignSelf: 'flex-start' }}>Removal pending coordinator review</div>}
                        {isDeclined      && <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B', background: '#FEE2E2', borderRadius: 4, padding: '2px 6px', display: 'inline-block', alignSelf: 'flex-start' }}>Request declined{pending?.declineReason ? ` — ${pending.declineReason}` : ''}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setAddOpen(true)}
              style={{ height: 34, padding: '0 14px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg width={12} height={12} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6.5 2v9M2 6.5h9" /></svg>
              Add a subject
            </button>
          </Card>

          {/* Working hours & meeting link */}
          <Card id="hours" dataTour="settings-hours" title="Working hours & meeting link" subtitle="Set your weekly working hours. Your permanent meeting link auto-populates in all calendar invites.">
            <Row label="Permanent meeting link" sub="Pasted into every confirmed session invite. Use a link that doesn't expire (e.g. Google Meet personal room or Zoom PMI).">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" style={{ position: 'absolute', left: 10, top: 11 }} aria-hidden>
                    <path d="M5 9L2 12M8.5 1.5l4 4-5 5-4-4 5-5z" /><path d="M3.5 7.5l3-3" />
                  </svg>
                  <input value={meetingLink} onChange={e => { setLink(e.target.value); }} style={{ ...input(), paddingLeft: 32 }} />
                </div>
              </div>
            </Row>
            {schedulerSummaryState ? (
              <div style={{ padding: 14, background: '#FAFAFA', borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
                <PrefRow label="Working hours" value={schedulerSummaryState.workingHours} />
              </div>
            ) : (
              <div style={{ padding: 14, background: '#FAFAFA', borderRadius: 10, fontSize: 12, color: '#A1A1AA', marginBottom: 12 }}>
                No scheduling preferences configured yet. Click below to set them up.
              </div>
            )}
            {pendingLowWindows && (
              <div style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 10, fontSize: 12, color: '#78350F', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Scheduling change pending coordinator approval</div>
                  <div style={{ color: '#92400E' }}>Proposed availability totals {(pendingLowWindows.details?.total_hours as number | undefined)?.toFixed(1)} hrs/week (below 10-hour minimum).</div>
                </div>
                <button onClick={() => handleCancelAvailRequest(pendingLowWindows.id)} disabled={settingsBusy === `cancel-${pendingLowWindows.id}`} style={{ ...btn('secondary'), marginLeft: 12, color: '#B45309', borderColor: '#FDE68A', flexShrink: 0, opacity: settingsBusy === `cancel-${pendingLowWindows.id}` ? 0.5 : 1 }}>{settingsBusy === `cancel-${pendingLowWindows.id}` ? 'Cancelling\u2026' : 'Cancel'}</button>
              </div>
            )}
            <button
              onClick={openSchedulerEdit}
              disabled={false}
              style={{ ...btn('primary') }}
            >
              <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" aria-hidden><rect x={1.5} y={2.5} width={10} height={9} rx={1.5} /><path d="M1.5 5.5h10M4.5 1v3M8.5 1v3" /></svg>
              Edit scheduling preferences
            </button>
          </Card>

          {/* Calendar connection & booking page */}
          <Card id="calendar" dataTour="settings-calendar" title="Calendar connection" subtitle="We read your existing events via Nylas to block off busy time — so coordinators never propose a session on top of something you already have.">
            {me.nylasGrantId ? (
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 14, alignItems: 'center', background: '#F0FDF9', border: '1px solid #A7F3D0', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#18181B' }}>G</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Google Calendar · {me.email}</div>
                  <div style={{ fontSize: 12, color: '#47624E', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: '#22C55E' }} />
                    Connected
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={async () => {
                      if (!confirm('Disconnect your calendar? Coordinators won\'t see your availability until you reconnect.')) return;
                      setSettingsBusy('disconnect');
                      const res = await fetch('/api/tutor/profile', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ disconnectCalendar: true }),
                      });
                      if (res.ok) {
                        showToast('Calendar disconnected');
                        window.location.reload();
                      } else {
                        showToast('Failed to disconnect');
                      }
                      setSettingsBusy(null);
                    }}
                    disabled={settingsBusy === 'disconnect'}
                    style={{ ...btn('secondary', 'sm'), opacity: settingsBusy === 'disconnect' ? 0.5 : 1 }}
                  >
                    {settingsBusy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 14, alignItems: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#fff', border: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#18181B' }}>G</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>No calendar connected</div>
                  <div style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>Connect your Google Calendar so coordinators can see your availability.</div>
                </div>
                <a href={`/api/nylas/auth?userId=${me.id}&email=${encodeURIComponent(me.email)}`} style={{ ...btn('primary'), background: '#1a73e8', textDecoration: 'none' }}>
                  Connect Google
                </a>
              </div>
            )}
            {/* Calendar picker — choose which calendars are read */}
            {me.nylasGrantId && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 6 }}>Connected calendars</div>
                <div style={{ fontSize: 11, color: '#A1A1AA', marginBottom: 8 }}>Choose which calendars we check for busy times. Only selected calendars affect your availability.</div>
                {calPickerLoading ? (
                  <div style={{ fontSize: 12, color: '#A1A1AA', padding: '8px 0' }}>Loading calendars…</div>
                ) : nylasCalendars && nylasCalendars.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nylasCalendars.map(cal => {
                      const isChecked = selectedCalIds === null || selectedCalIds.includes(cal.id);
                      return (
                        <label key={cal.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: isChecked ? '#F0FDF9' : '#FAFAFA', border: `1px solid ${isChecked ? '#A7F3D0' : '#E4E4E7'}`, borderRadius: 8, cursor: calPickerSaving ? 'not-allowed' : 'pointer', transition: 'all 0.12s', opacity: calPickerSaving ? 0.6 : 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => handleCalendarToggle(cal.id, e.target.checked)}
                            disabled={calPickerSaving}
                            style={{ width: 16, height: 16, accentColor: '#2B7265', cursor: 'inherit' }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#18181B' }}>{cal.name}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : nylasCalendars && nylasCalendars.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#A1A1AA', padding: '8px 0' }}>No writable calendars found.</div>
                ) : null}
              </div>
            )}

            <div style={{ padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 12, color: '#78350F', lineHeight: 1.55, marginBottom: 16 }}>
              <b>Careful:</b> disconnecting your calendar hides your availability from coordinators until a new calendar is connected.
            </div>
            <div style={{ height: 1, background: '#F5F5F5', margin: '0 0 16px' }} />
            <Row label="Personal booking page" dataTour="settings-booking-preview" sub="A Nylas-hosted page students can use to book time directly with you, based on your working hours and connected calendar.">
              {bookingUrl ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <input readOnly value={bookingUrl} style={{ ...input(), fontFamily: 'monospace', fontSize: 12 }} />
                  <button onClick={copyBookingUrl} style={btn('secondary')}>Copy</button>
                  <a href={bookingUrl} target="_blank" rel="noreferrer" style={{ ...btn('secondary'), textDecoration: 'none' }}>Open ↗</a>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#71717A', padding: '8px 0' }}>No booking page connected yet.</div>
              )}
              <BookingPagePreview tutor={me} bookingUrl={bookingUrl ?? undefined} />
            </Row>
          </Card>

          {/* Pause */}
          <Card id="pause" title="Pause tutoring" subtitle="Temporarily hide your availability from all coordinator views. Existing confirmed sessions stay booked." danger>
            {isPaused ? (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={handleResume} disabled={settingsBusy === 'resume'} style={{ ...btn('primary'), background: '#16A34A', opacity: settingsBusy === 'resume' ? 0.6 : 1 }}>{settingsBusy === 'resume' ? 'Resuming\u2026' : 'Resume availability'}</button>
                <div style={{ fontSize: 12, color: '#71717A' }}>You&apos;re currently paused. Coordinators can&apos;t see your calendar.</div>
              </div>
            ) : pendingPause ? (
              <div>
                <div style={{ padding: '12px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#78350F', marginBottom: 4 }}>Pause request pending coordinator approval</div>
                  <div style={{ fontSize: 12, color: '#92400E', marginBottom: 2 }}>Reason: {pendingPause.reason}</div>
                  <div style={{ fontSize: 11, color: '#A1A1AA' }}>Submitted {new Date(pendingPause.createdAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => handleCancelAvailRequest(pendingPause.id)} disabled={settingsBusy === `cancel-${pendingPause.id}`} style={{ ...btn('secondary'), color: '#DC2626', borderColor: '#FECACA', opacity: settingsBusy === `cancel-${pendingPause.id}` ? 0.5 : 1 }}>{settingsBusy === `cancel-${pendingPause.id}` ? 'Cancelling\u2026' : 'Cancel request'}</button>
              </div>
            ) : (
              <div>
                {declinedPause && (
                  <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#991B1B' }}>
                    Previous pause request declined{declinedPause.declineReason ? ` — ${declinedPause.declineReason}` : ''}. You may submit a new request.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button onClick={() => setPauseOpen(true)} style={{ ...btn('primary'), background: '#DC2626' }}>Pause my availability</button>
                  <div style={{ fontSize: 12, color: '#71717A' }}>You&apos;ll stop receiving new proposals until a coordinator approves the pause.</div>
                </div>
              </div>
            )}
          </Card>
        </div>
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

      {deletingTs && (() => {
        const subject = allSubjects.find(s => s.id === deletingTs.id);
        return subject ? (
          <DeleteSubjectModal
            subject={subject}
            onClose={() => setDeletingTs(null)}
            onConfirm={reason => handleRemove(deletingTs, reason)}
          />
        ) : null;
      })()}

      <SchedulerPreferencesModal
        open={showSchedulerModal}
        onClose={() => setShowSchedulerModal(false)}
        onSaved={summary => { setSchedulerSummary(summary); showToast('Scheduling preferences saved'); }}
      />

      {pauseOpen && (
        <PauseModal
          onClose={() => setPauseOpen(false)}
          onConfirm={async (reason) => {
            try {
              const res = await fetch('/api/tutor/availability-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_type: 'PAUSE', reason }),
              });
              const data = await res.json() as Record<string, unknown>;
              if (!res.ok) { showToast(String(data.error ?? 'Failed to submit request')); return; }
              setAvailReqs(prev => [...prev, {
                id:          String(data.id),
                tutorId:     me.id,
                requestType: 'PAUSE' as const,
                reason,
                status:      'PENDING' as const,
                createdAt:   String(data.created_at ?? new Date().toISOString()),
              }]);
              setPauseOpen(false);
              showToast('Pause request submitted for coordinator approval');
            } catch {
              showToast('Failed to submit request — check your connection and try again');
            }
          }}
        />
      )}

      {lowHoursOpen && (
        <LowHoursModal
          requestedHours={maxHours}
          onClose={() => setLowHoursOpen(false)}
          onConfirm={async (reason) => {
            try {
              const res = await fetch('/api/tutor/availability-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ request_type: 'LOW_MAX_HOURS', reason, details: { requested_hours: maxHours } }),
              });
              const data = await res.json() as Record<string, unknown>;
              if (!res.ok) { showToast(String(data.error ?? 'Failed to submit request')); return; }
              setAvailReqs(prev => [...prev, {
                id:          String(data.id),
                tutorId:     me.id,
                requestType: 'LOW_MAX_HOURS' as const,
                reason,
                details:     { requested_hours: maxHours },
                status:      'PENDING' as const,
                createdAt:   String(data.created_at ?? new Date().toISOString()),
              }]);
              setLowHoursOpen(false);
              showToast('Request submitted for coordinator approval');
            } catch {
              showToast('Failed to submit request — check your connection and try again');
            }
          }}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.12)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E' }} />
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── Local helper components ──────────────────────────────────────────────────

function Card({ id, dataTour, title, subtitle, children, danger }: { id: SectionId; dataTour?: string; title: string; subtitle?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section id={`sec-${id}`} data-tour={dataTour} style={{ background: '#fff', border: `1px solid ${danger ? '#FECACA' : '#E4E4E7'}`, borderRadius: 12, padding: 20, marginBottom: 16, scrollMarginTop: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: danger ? '#991B1B' : '#18181B' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: '#71717A', margin: '4px 0 0', lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, sub, dataTour, children }: { label: string; sub?: string; dataTour?: string; children: ReactNode }) {
  return (
    <div data-tour={dataTour} style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: sub ? 2 : 6 }}>{label}</label>
      {sub && <div style={{ fontSize: 11, color: '#A1A1AA', marginBottom: 6 }}>{sub}</div>}
      {children}
    </div>
  );
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{value}</div>
    </div>
  );
}

function PauseModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const tooShort              = reason.trim().length < 5;

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(reason.trim());
    setSaving(false);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 480, padding: 24, boxShadow: '0 16px 34px rgba(22,32,51,0.18)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M10 6v4M10 13v1" /><circle cx={10} cy={10} r={8.5} /></svg>
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Request to pause your availability?</h2>
        <p style={{ fontSize: 13, color: '#52525B', margin: '8px 0 16px', lineHeight: 1.55 }}>
          A coordinator will need to approve this before your availability is hidden. Existing confirmed sessions stay booked.
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 6 }}>Reason for pausing <span style={{ color: '#A1A1AA', fontWeight: 400 }}>(required)</span></label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Taking a vacation, medical leave, reducing workload…"
          rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={btn('secondary')}>Cancel</button>
          <button onClick={handleConfirm} disabled={tooShort || saving} style={{ ...btn('primary'), background: '#DC2626', opacity: (tooShort || saving) ? 0.5 : 1, cursor: (tooShort || saving) ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Submitting…' : 'Submit pause request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LowHoursModal({ requestedHours, onClose, onConfirm }: { requestedHours: number; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason]   = useState('');
  const [saving, setSaving]   = useState(false);
  const tooShort              = reason.trim().length < 5;

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(reason.trim());
    setSaving(false);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 480, padding: 24, boxShadow: '0 16px 34px rgba(22,32,51,0.18)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M10 6v4M10 13v1" /><circle cx={10} cy={10} r={8.5} /></svg>
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Request max of {requestedHours} hrs/week?</h2>
        <p style={{ fontSize: 13, color: '#52525B', margin: '8px 0 16px', lineHeight: 1.55 }}>
          Hours of 5 or below require coordinator approval before taking effect. Your current max stays active until approved.
        </p>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#3F3F46', marginBottom: 6 }}>Reason <span style={{ color: '#A1A1AA', fontWeight: 400 }}>(required)</span></label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Reducing workload for the semester, recovering from an injury…"
          rows={3}
          style={{ width: '100%', padding: '8px 10px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={btn('secondary')}>Cancel</button>
          <button onClick={handleConfirm} disabled={tooShort || saving} style={{ ...btn('primary'), background: '#D97706', opacity: (tooShort || saving) ? 0.5 : 1, cursor: (tooShort || saving) ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const metaLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#3F3F46', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 };

function input(extra?: React.CSSProperties): React.CSSProperties {
  return { width: '100%', height: 36, padding: '0 10px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', ...extra };
}

function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');
  const containerRef        = useRef<HTMLDivElement>(null);
  const searchRef           = useRef<HTMLInputElement>(null);

  const allTz = useMemo(() => {
    const now = Date.now();
    const zones: string[] = (Intl as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    return zones.map(tz => ({ tz, label: formatTimezoneLabel(tz, now) }))
      .sort((a, b) => {
        const parse = (l: string) => { const m = l.match(/UTC([+-])(\d+):?(\d*)/); return m ? (m[1] === '+' ? 1 : -1) * (parseInt(m[2]) * 60 + parseInt(m[3] || '0')) : 0; };
        return parse(a.label) - parse(b.label);
      });
  }, []);

  const filtered = search
    ? allTz.filter(t => t.label.toLowerCase().includes(search.toLowerCase()))
    : allTz;

  const selectedLabel = allTz.find(t => t.tz === value)?.label ?? value;

  useEffect(() => {
    if (!open) { setSearch(''); return; }
    searchRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...input(), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', background: '#fff', textAlign: 'left' }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" aria-hidden style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #E4E4E7', borderRadius: 8, boxShadow: '0 10px 24px rgba(22,32,51,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 8px 6px', borderBottom: '1px solid #F5F5F5' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search timezones…"
              style={{ width: '100%', height: 30, padding: '0 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 240 }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#A1A1AA' }}>No timezones found.</div>
            )}
            {filtered.map(({ tz, label }) => (
              <button
                key={tz}
                type="button"
                onClick={() => { onChange(tz); setOpen(false); }}
                style={{ display: 'block', width: '100%', padding: '7px 12px', textAlign: 'left', fontSize: 12, fontFamily: 'inherit', border: 'none', cursor: 'pointer', background: tz === value ? '#E8F4F1' : 'transparent', color: tz === value ? '#2B7265' : '#18181B', fontWeight: tz === value ? 600 : 400 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function btn(variant: 'primary' | 'secondary', size?: 'sm'): React.CSSProperties {
  const h = size === 'sm' ? 28 : 32;
  const base: React.CSSProperties = { height: h, padding: h === 28 ? '0 10px' : '0 14px', borderRadius: 8, fontSize: h === 28 ? 11 : 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', whiteSpace: 'nowrap' };
  return variant === 'primary' ? { ...base, background: '#18181B', color: '#fff' } : { ...base, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7' };
}
