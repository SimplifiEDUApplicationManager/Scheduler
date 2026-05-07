'use client';

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { Tutor, Subject, TutorSubject } from '@/lib/types/domain';
import type { SchedulerSummary } from '@/lib/nylas/scheduler';
import { Avatar } from '@/components/ui/Avatar';
import { CapacityBar } from '@/components/ui/CapacityBar';
import { AddSubjectModal } from './AddSubjectModal';
import { BookingPagePreview } from './BookingPagePreview';

interface Props { me: Tutor; allSubjects: Subject[]; schedulerSummary: SchedulerSummary | null }

const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];


const NAV = [
  ['profile',       'Profile'],
  ['capacity',      'Capacity'],
  ['hours',         'Working hours'],
  ['calendar',      'Calendar'],
  ['notifications', 'Notifications'],
  ['pause',         'Pause tutoring'],
] as const;
type SectionId = typeof NAV[number][0];

export function SettingsClient({ me, allSubjects, schedulerSummary }: Props) {
  const [name, setName]           = useState(me.name);
  const [tz, setTz]               = useState(me.tz);
  const [meetingLink, setLink]    = useState(me.meetingLink ?? '');
  const [maxHours, setMax]        = useState(me.hoursMax);
  const [minHours, setMin]        = useState(me.hoursMin);
  const bookingUrl                = me.bookingPageUrl ?? null;
  const [mySubjects, setSubjects] = useState<TutorSubject[]>(me.subjects);
  const [notifs, setNotifs]       = useState({ newRequest: true, reminders: true, coordMessages: true, cancellations: true, weeklySummary: false });
  const [dirty, setDirty]         = useState(false);
  const [isPaused, setIsPaused]   = useState(false);
  const [addOpen, setAddOpen]     = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [toast, setToast]         = useState<string | null>(null);
  const [activeSection, setActive] = useState<SectionId>('profile');
  const [editingScheduler, setEditingScheduler] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const touch = () => setDirty(true);

  const openSchedulerEdit = useCallback(async () => {
    setEditingScheduler(true);
    try {
      const res = await fetch('/api/nylas/scheduler-edit-link', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) { showToast(data.error ?? 'Could not open scheduler'); return; }
      window.open(data.url, '_blank', 'noreferrer');
    } catch {
      showToast('Could not open scheduler');
    } finally {
      setEditingScheduler(false);
    }
  }, []);
  const maxError = maxHours < 6 || maxHours > 40;

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function save(msg: string) {
    try {
      const res = await fetch('/api/tutor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          timezone: tz,
          maxWeeklyHours: maxHours,
          minWeeklyHours: minHours,
          meetingLink,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? 'Failed to save changes');
        return;
      }
    } catch {
      showToast('Failed to save changes');
      return;
    }
    setDirty(false);
    showToast(msg);
  }

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
        <aside style={{ position: 'sticky', top: 24, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>Settings</h1>
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
              <button onClick={() => { setIsPaused(false); save('Availability resumed'); }} style={btn('secondary')}>Resume</button>
            </div>
          )}

          {/* Profile */}
          <Card id="profile" title="Profile" subtitle="Shown to coordinators on your tutor card.">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
              <Avatar initials={me.initials} size="xl" tone="brand" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{me.name}</div>
                <div style={{ fontSize: 12, color: '#71717A' }}>{me.email}</div>
              </div>
              <button style={btn('secondary')}>Change photo</button>
            </div>
            <Row label="Full name" sub="Appears on your tutor card, proposals, and calendar invites.">
              <input value={name} onChange={e => { setName(e.target.value); touch(); }} style={input()} />
            </Row>
            <Row label="Email address" sub="Changes must be made by an admin.">
              <input defaultValue={me.email} disabled style={{ ...input(), background: '#FAFAFA', color: '#71717A' }} />
            </Row>
            <Row label="Timezone" sub="We interpret your working hours in this timezone and convert session times for students.">
              <select value={tz} onChange={e => { setTz(e.target.value); touch(); }} style={input()}>
                {TIMEZONES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Row>
            <Row label="Bio" sub="Admin-controlled — contact your coordinator to update.">
              <div style={{ padding: 12, background: '#FAFAFA', border: '1px solid #F5F5F5', borderRadius: 8, fontSize: 13, color: '#52525B', lineHeight: 1.5 }}>{me.bio}</div>
            </Row>
          </Card>

          {/* Capacity */}
          <Card id="capacity" title="Capacity" subtitle="Coordinators use these numbers to decide how many sessions to route to you. Max is required and must be between 6 and 40.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={metaLabel}>Maximum weekly hours</label>
                <input type="number" min={6} max={40} value={maxHours} onChange={e => { setMax(+e.target.value); touch(); }} style={{ ...input(), borderColor: maxError ? '#DC2626' : '#E4E4E7' }} />
                <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>Hard ceiling. Coordinators can&apos;t schedule past this.</div>
                {maxError && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>Must be between 6 and 40 hours.</div>}
              </div>
              <div>
                <label style={metaLabel}>Minimum weekly hours</label>
                <input type="number" min={6} value={minHours} onChange={e => { setMin(+e.target.value); touch(); }} style={input()} />
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
          </Card>

          {/* Working hours & meeting link */}
          <Card id="hours" title="Working hours & meeting link" subtitle="Working hours and exceptions are managed on Nylas. Your permanent meeting link auto-populates in all calendar invites.">
            <Row label="Permanent meeting link" sub="Pasted into every confirmed session invite. Use a link that doesn't expire (e.g. Google Meet personal room or Zoom PMI).">
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" style={{ position: 'absolute', left: 10, top: 11 }} aria-hidden>
                    <path d="M5 9L2 12M8.5 1.5l4 4-5 5-4-4 5-5z" /><path d="M3.5 7.5l3-3" />
                  </svg>
                  <input value={meetingLink} onChange={e => { setLink(e.target.value); touch(); }} style={{ ...input(), paddingLeft: 32 }} />
                </div>
              </div>
            </Row>
            {schedulerSummary ? (
              <div style={{ padding: 14, background: '#FAFAFA', borderRadius: 10, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
                <PrefRow label="Working hours" value={schedulerSummary.workingHours} />
                <PrefRow label="Exceptions to my upcoming availability" value={schedulerSummary.exceptions} />
                <PrefRow label="Break between sessions" value={schedulerSummary.breakDuration} />
              </div>
            ) : (
              <div style={{ padding: 14, background: '#FAFAFA', borderRadius: 10, fontSize: 12, color: '#A1A1AA', marginBottom: 12 }}>
                {me.nylasSchedulerConfigId
                  ? 'Could not load scheduling preferences — try again later.'
                  : 'No scheduling preferences configured yet. Click "Edit scheduling preferences" to set them up on Nylas.'}
              </div>
            )}
            <button
              onClick={openSchedulerEdit}
              disabled={!me.nylasSchedulerConfigId || editingScheduler}
              style={{ ...btn('primary'), opacity: (!me.nylasSchedulerConfigId || editingScheduler) ? 0.5 : 1, cursor: (!me.nylasSchedulerConfigId || editingScheduler) ? 'not-allowed' : 'pointer' }}
            >
              <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" aria-hidden><rect x={1.5} y={2.5} width={10} height={9} rx={1.5} /><path d="M1.5 5.5h10M4.5 1v3M8.5 1v3" /></svg>
              {editingScheduler ? 'Opening…' : 'Edit scheduling preferences'}
            </button>
          </Card>

          {/* Calendar connection & booking page */}
          <Card id="calendar" title="Calendar connection" subtitle="We read your existing events via Nylas to block off busy time — so coordinators never propose a session on top of something you already have.">
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
                  <button style={btn('secondary', 'sm')}>Disconnect</button>
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
            <div style={{ padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 12, color: '#78350F', lineHeight: 1.55, marginBottom: 16 }}>
              <b>Careful:</b> disconnecting your calendar hides your availability from coordinators until a new calendar is connected.
            </div>
            <div style={{ height: 1, background: '#F5F5F5', margin: '0 0 16px' }} />
            <Row label="Personal booking page" sub="A Nylas-hosted page students can use to book time directly with you, based on your working hours and connected calendar.">
              {bookingUrl ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <input readOnly value={bookingUrl} style={{ ...input(), fontFamily: 'monospace', fontSize: 12 }} />
                  <button onClick={copyBookingUrl} style={btn('secondary')}>Copy</button>
                  <a href={bookingUrl} target="_blank" rel="noreferrer" style={{ ...btn('secondary'), textDecoration: 'none' }}>Open ↗</a>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#71717A', padding: '8px 0' }}>No booking page connected yet.</div>
              )}
              <BookingPagePreview tutor={me} />
            </Row>
          </Card>

          {/* Notifications */}
          <Card id="notifications" title="Notifications" subtitle="Choose how and when we reach out. Keep session reminders on so you don't miss a booking.">
            <NotifRow label="New tutoring request" sub="A coordinator proposed a session to you." detail="Email + in-app + push" value={notifs.newRequest} onChange={v => { setNotifs(n => ({ ...n, newRequest: v })); touch(); }} />
            <NotifRow label="Session reminders" sub="Before a confirmed session." detail="24h + 1h before · push" value={notifs.reminders} onChange={v => { setNotifs(n => ({ ...n, reminders: v })); touch(); }} />
            <NotifRow label="Coordinator messages" sub="Direct messages from your coordinator." detail="Email + in-app" value={notifs.coordMessages} onChange={v => { setNotifs(n => ({ ...n, coordMessages: v })); touch(); }} />
            <NotifRow label="Student cancellations" sub="When a student or parent cancels." detail="Email + push" value={notifs.cancellations} onChange={v => { setNotifs(n => ({ ...n, cancellations: v })); touch(); }} />
            <NotifRow label="Weekly summary" sub="Hours booked, upcoming sessions, and stats." detail="Email · Sunday 7 pm" value={notifs.weeklySummary} onChange={v => { setNotifs(n => ({ ...n, weeklySummary: v })); touch(); }} last />
          </Card>

          {/* Pause */}
          <Card id="pause" title="Pause tutoring" subtitle="Temporarily hide your availability from all coordinator views. Existing confirmed sessions stay booked." danger>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={() => setPauseOpen(true)} style={{ ...btn('primary'), background: isPaused ? '#fff' : '#DC2626', color: isPaused ? '#991B1B' : '#fff', border: isPaused ? '1px solid #FECACA' : 'none' }}>
                {isPaused ? 'Resume availability' : 'Pause my availability'}
              </button>
              <div style={{ fontSize: 12, color: '#71717A' }}>
                {isPaused ? "You're currently paused. Click Resume to make yourself available again." : "You'll stop receiving new proposals until you resume."}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderTop: '1px solid #E4E4E7', padding: '12px 32px', zIndex: 20 }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontSize: 12, color: '#71717A', display: 'flex', alignItems: 'center', gap: 6 }}>
            {dirty && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#F59E0B', display: 'inline-block' }} />}
            {dirty ? 'Unsaved changes · hours & timezone recompute availability automatically.' : 'All changes recompute availability automatically.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={!dirty} onClick={() => { setDirty(false); showToast('Changes discarded'); }} style={{ ...btn('secondary'), opacity: dirty ? 1 : 0.5 }}>Discard</button>
            <button disabled={!dirty || maxError} onClick={() => save('Changes saved')} style={{ ...btn('primary'), opacity: (!dirty || maxError) ? 0.5 : 1, cursor: (!dirty || maxError) ? 'not-allowed' : 'pointer' }}>Save changes</button>
          </div>
        </div>
      </div>

      {addOpen && (
        <AddSubjectModal
          allSubjects={allSubjects}
          existing={mySubjects.map(s => s.id)}
          onClose={() => setAddOpen(false)}
          onAdd={ts => { setSubjects(prev => [...prev, ts]); setAddOpen(false); save('Subject added · pending coordinator review'); touch(); }}
        />
      )}

      {pauseOpen && (
        <PauseModal
          isPaused={isPaused}
          onClose={() => setPauseOpen(false)}
          onConfirm={() => { setIsPaused(p => !p); setPauseOpen(false); save(isPaused ? 'Availability resumed' : 'Availability paused'); }}
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

function Card({ id, title, subtitle, children, danger }: { id: SectionId; title: string; subtitle?: string; children: ReactNode; danger?: boolean }) {
  return (
    <section id={`sec-${id}`} style={{ background: '#fff', border: `1px solid ${danger ? '#FECACA' : '#E4E4E7'}`, borderRadius: 12, padding: 20, marginBottom: 16, scrollMarginTop: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: danger ? '#991B1B' : '#18181B' }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 12, color: '#71717A', margin: '4px 0 0', lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
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

function NotifRow({ label, sub, detail, value, onChange, last }: { label: string; sub: string; detail: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : '1px solid #F5F5F5' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 11, color: value ? '#47624E' : '#A1A1AA', fontWeight: 500, minWidth: 140, textAlign: 'right' }}>{value ? detail : 'Off'}</div>
      <button onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 999, padding: 2, background: value ? '#2B7265' : '#E4E4E7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: value ? 'flex-end' : 'flex-start', transition: 'background 0.15s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
      </button>
    </div>
  );
}

function PauseModal({ isPaused, onClose, onConfirm }: { isPaused: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 460, padding: 24, boxShadow: '0 16px 34px rgba(22,32,51,0.18)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: isPaused ? '#ECFDF5' : '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          {isPaused
            ? <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="#16A34A" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M4 10l5 5 7-8" /></svg>
            : <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M10 6v4M10 13v1" /><circle cx={10} cy={10} r={8.5} /></svg>}
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isPaused ? 'Resume your availability?' : 'Pause your availability?'}</h2>
        <p style={{ fontSize: 13, color: '#52525B', margin: '8px 0 0', lineHeight: 1.55 }}>
          {isPaused ? 'Coordinators will be able to see your calendar and send you new proposals again.' : "Coordinators won't see your calendar or be able to send you new proposals until you resume. Existing confirmed sessions stay booked."}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={btn('secondary')}>Cancel</button>
          <button onClick={onConfirm} style={{ ...btn('primary'), background: isPaused ? '#16A34A' : '#DC2626' }}>{isPaused ? 'Resume' : 'Pause availability'}</button>
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

function btn(variant: 'primary' | 'secondary', size?: 'sm'): React.CSSProperties {
  const h = size === 'sm' ? 28 : 32;
  const base: React.CSSProperties = { height: h, padding: h === 28 ? '0 10px' : '0 14px', borderRadius: 8, fontSize: h === 28 ? 11 : 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', whiteSpace: 'nowrap' };
  return variant === 'primary' ? { ...base, background: '#18181B', color: '#fff' } : { ...base, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7' };
}
