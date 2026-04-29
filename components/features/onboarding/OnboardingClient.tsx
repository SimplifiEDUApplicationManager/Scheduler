'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
type HoursMap = Record<DayKey, [number, number][]>;

interface Subject { id: string; name: string; category: string; }

interface InitialUser {
  id:                  string;
  name:                string;
  email:               string;
  timezone:            string;
  calendarConnected:   boolean;
  schedulerConfigured: boolean;
}

interface Props {
  initialUser:  InitialUser;
  subjects:     Subject[];
  initialStep?: number;
  oauthError?:  string;
}

const STEPS = [
  { n: 1, key: 'account',  label: 'Account'  },
  { n: 2, key: 'timezone', label: 'Timezone' },
  { n: 3, key: 'calendar', label: 'Calendar' },
  { n: 4, key: 'hours',    label: 'Hours'    },
  { n: 5, key: 'subjects', label: 'Subjects' },
  { n: 6, key: 'done',     label: 'Done'     },
] as const;

const TZ_OPTIONS: [string, string][] = [
  ['America/Los_Angeles', 'Pacific Time (PT) · Los Angeles'],
  ['America/Denver',      'Mountain Time (MT) · Denver'],
  ['America/Chicago',     'Central Time (CT) · Chicago'],
  ['America/New_York',    'Eastern Time (ET) · New York'],
];

const DAY_ORDER: [DayKey, string][] = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'],
  ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];

const DEFAULT_HOURS: HoursMap = {
  sun: [], mon: [[15, 21]], tue: [[15, 21]], wed: [[15, 21]],
  thu: [[15, 21]], fri: [], sat: [[10, 16]],
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtHour(h: number) {
  const am = h < 12;
  const v = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${v}:00 ${am ? 'AM' : 'PM'}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OnbCard({ kicker, title, intro, children }: {
  kicker: string; title: string; intro?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 16, padding: '36px 40px', boxShadow: '0 1px 2px rgba(22,32,51,0.04)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717A', marginBottom: 6 }}>{kicker}</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{title}</h1>
      {intro && <p style={{ fontSize: 15, color: '#52525B', margin: '0 0 28px', lineHeight: 1.5, maxWidth: 600 }}>{intro}</p>}
      {children}
    </div>
  );
}

function OnbFooter({ onBack, onNext, nextLabel = 'Continue →', nextDisabled, loading }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string;
  nextDisabled?: boolean; loading?: boolean;
}) {
  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        {onBack && (
          <button onClick={onBack} style={{ height: 36, padding: '0 14px', borderRadius: 8, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>← Back</button>
        )}
      </div>
      <button onClick={onNext} disabled={nextDisabled || loading}
        style={{ height: 40, padding: '0 20px', borderRadius: 10, border: 'none', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: (nextDisabled || loading) ? 'not-allowed' : 'pointer', opacity: (nextDisabled || loading) ? 0.4 : 1 }}>
        {loading ? 'Saving…' : nextLabel}
      </button>
    </div>
  );
}

function OnbField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3F3F46', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 6, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return { width: '100%', height: 40, padding: '0 12px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', background: '#fff', boxSizing: 'border-box', ...extra };
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{ width: 36, height: 20, borderRadius: 999, padding: 2, background: on ? '#2B7265' : '#E4E4E7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background 0.15s', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
    </button>
  );
}

// ── Step 1: Account ────────────────────────────────────────────────────────────

function StepAccount({ name, email, loading, error, onSubmit }: {
  name: string; email: string; loading: boolean; error?: string;
  onSubmit: (name: string, password: string) => void;
}) {
  const [firstName, setFirstName] = useState(name.split(' ')[0] ?? '');
  const [lastName,  setLastName]  = useState(name.split(' ').slice(1).join(' ') ?? '');
  const [pw,  setPw]  = useState('');
  const [pw2, setPw2] = useState('');

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const canContinue = firstName.trim() && pw.length >= 8 && pw === pw2;

  return (
    <OnbCard kicker="Step 1 of 5" title={`Welcome, ${firstName || 'there'}.`}
      intro="Confirm your name and set a password. We've pre-filled what your coordinator told us — tweak anything that's off.">
      {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <OnbField label="First name">
          <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle()} />
        </OnbField>
        <OnbField label="Last name">
          <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle()} />
        </OnbField>
      </div>
      <OnbField label="Email" hint="Your login and where we send notifications. Contact an admin to change it.">
        <input value={email} readOnly style={inputStyle({ background: '#FAFAFA', color: '#71717A' })} />
      </OnbField>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <OnbField label="Password" hint="At least 8 characters.">
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={inputStyle()} />
        </OnbField>
        <OnbField label="Confirm password">
          <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={inputStyle()} />
        </OnbField>
      </div>
      {pw && pw2 && pw !== pw2 && <div style={{ fontSize: 12, color: '#DC2626', marginTop: -8, marginBottom: 12 }}>Passwords don't match.</div>}
      <OnbFooter onNext={() => onSubmit(fullName, pw)} nextDisabled={!canContinue} loading={loading} />
    </OnbCard>
  );
}

// ── Step 2: Timezone ───────────────────────────────────────────────────────────

function StepTimezone({ tz, loading, error, onBack, onSubmit }: {
  tz: string; loading: boolean; error?: string;
  onBack: () => void; onSubmit: (tz: string) => void;
}) {
  const [selected, setSelected] = useState(tz);

  const autoDetect = () => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = TZ_OPTIONS.find(([v]) => v === detected);
    if (match) setSelected(match[0]);
  };

  return (
    <OnbCard kicker="Step 2 of 5" title="Where in the world are you?"
      intro="We use your timezone to interpret your working hours and to show your availability correctly to coordinators and students in other regions.">
      {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{error}</div>}
      <OnbField label="Your timezone">
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={inputStyle({ flex: '1 1 auto' } as React.CSSProperties)}>
            {TZ_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={autoDetect} style={{ height: 40, padding: '0 14px', borderRadius: 8, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Auto-detect
          </button>
        </div>
      </OnbField>
      <div style={{ marginTop: 8, padding: 16, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, fontSize: 13, color: '#78350F', lineHeight: 1.5 }}>
        Working hours are stored in your local time, so they don't shift with daylight saving. Individual sessions are always stored in UTC and converted for display.
      </div>
      <OnbFooter onBack={onBack} onNext={() => onSubmit(selected)} loading={loading} />
    </OnbCard>
  );
}

// ── Step 3: Calendar ───────────────────────────────────────────────────────────

const CALENDAR_OPTIONS = [
  { id: 'google',  label: 'G',  name: 'Google Calendar',        desc: 'Connect via Nylas OAuth. Recommended for most tutors.' },
  { id: 'outlook', label: 'O',  name: 'Outlook / Microsoft 365', desc: 'Work or personal Outlook accounts.' },
  { id: 'icloud',  label: '☁', name: 'iCloud Calendar',         desc: 'Apple calendar via app-specific password.' },
] as const;

function StepCalendar({ alreadyConnected, oauthError, onBack }: {
  alreadyConnected: boolean; oauthError?: string; onBack: () => void;
}) {
  const [provider, setProvider] = useState<'google' | 'outlook' | 'icloud'>('google');

  if (alreadyConnected) {
    return (
      <OnbCard kicker="Step 3 of 5" title="Calendar connected." intro="Your calendar is connected. You can move on to set your working hours.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: '#F0FDF9', border: '1px solid #A7F3D0', borderRadius: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: '#22C55E', flexShrink: 0 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F4D40' }}>Calendar access granted</div>
        </div>
        <OnbFooter onBack={onBack} onNext={() => { window.location.href = '/onboarding?step=4'; }} nextLabel="Continue →" />
      </OnbCard>
    );
  }

  return (
    <OnbCard kicker="Step 3 of 5" title="Connect your calendar."
      intro="So we can see when you're busy and compute real availability. We'll never create, move, or delete anything in your calendar — we only read your events.">
      {oauthError && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
          Calendar connection failed ({oauthError}). Please try again.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {CALENDAR_OPTIONS.map(o => {
          const picked = provider === o.id;
          return (
            <button key={o.id} onClick={() => setProvider(o.id)}
              style={{ textAlign: 'left', padding: 16, background: picked ? '#F0FDF9' : '#fff', border: `1.5px solid ${picked ? '#2B7265' : '#E4E4E7'}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: picked ? '0 2px 8px rgba(43,114,101,0.12)' : 'none' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#18181B' }}>{o.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>{o.name}</div>
              <div style={{ fontSize: 11, color: '#71717A', lineHeight: 1.4 }}>{o.desc}</div>
              {picked && <div style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: '#2B7265', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Selected</div>}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 20, padding: 14, background: '#FAFAFA', border: '1px solid #F5F5F5', borderRadius: 10, fontSize: 12, color: '#52525B', lineHeight: 1.55 }}>
        <b>Why is this required?</b> Your real-time availability depends on what's already on your calendar. Without a calendar connection, we can't show coordinators when you're actually free.
      </div>
      {/* Navigates to API route which redirects to Nylas OAuth */}
      <OnbFooter onBack={onBack}
        onNext={() => { window.location.href = `/api/nylas/connect?provider=${provider}`; }}
        nextLabel="Authorize & continue →" />
    </OnbCard>
  );
}

// ── Step 4: Hours ──────────────────────────────────────────────────────────────

function StepHours({ hours, setHours, breakMin, setBreakMin, loading, error, onBack, onSubmit }: {
  hours: HoursMap; setHours: (h: HoursMap) => void;
  breakMin: number; setBreakMin: (m: number) => void;
  loading: boolean; error?: string;
  onBack: () => void; onSubmit: () => void;
}) {
  const toggleDay = (key: DayKey) => {
    const isOn = hours[key].length > 0;
    setHours({ ...hours, [key]: isOn ? [] : [[15, 21]] });
  };

  return (
    <OnbCard kicker="Step 4 of 5" title="Your weekly working hours."
      intro="These are the windows when you're generally open to tutor. You can add date-specific overrides later from your settings.">
      {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DAY_ORDER.map(([key, label]) => {
          const blocks = hours[key];
          const on = blocks.length > 0;
          return (
            <div key={key} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 14, alignItems: 'center', padding: '10px 14px', border: `1px solid ${on ? '#E4E4E7' : '#F5F5F5'}`, borderRadius: 10, background: on ? '#fff' : '#FAFAFA', opacity: on ? 1 : 0.7 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle on={on} onChange={() => toggleDay(key)} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{label}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {on ? blocks.map((b, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    <span style={{ padding: '3px 8px', border: '1px solid #E4E4E7', borderRadius: 6, background: '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtHour(b[0])}</span>
                    <span style={{ color: '#A1A1AA' }}>→</span>
                    <span style={{ padding: '3px 8px', border: '1px solid #E4E4E7', borderRadius: 6, background: '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtHour(b[1])}</span>
                  </span>
                )) : <span style={{ fontSize: 12, color: '#A1A1AA' }}>Unavailable</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 22 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3F3F46', marginBottom: 8 }}>Break between sessions</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[0, 15, 30, 45, 60].map(v => {
            const picked = breakMin === v;
            return (
              <button key={v} onClick={() => setBreakMin(v)} style={{ padding: '6px 14px', borderRadius: 999, background: picked ? '#2B7265' : '#fff', color: picked ? '#fff' : '#3F3F46', border: `1px solid ${picked ? '#2B7265' : '#E4E4E7'}`, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                {v} min
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 6, lineHeight: 1.4 }}>
          After a session ends, the next availability block starts once this buffer has passed.
        </div>
      </div>
      <OnbFooter onBack={onBack} onNext={onSubmit} loading={loading} />
    </OnbCard>
  );
}

// ── Step 5: Subjects ───────────────────────────────────────────────────────────

function StepSubjects({ subjects, selected, setSelected, loading, error, onBack, onSubmit }: {
  subjects: Subject[]; selected: string[]; setSelected: (s: string[]) => void;
  loading: boolean; error?: string;
  onBack: () => void; onSubmit: () => void;
}) {
  const [query, setQuery]       = useState('');
  const [activeCat, setActiveCat] = useState<string>('');

  // Group subjects by category
  const cats = subjects.reduce<Record<string, Subject[]>>((acc, s) => {
    const c = s.category || 'Other';
    if (!acc[c]) acc[c] = [];
    acc[c].push(s);
    return acc;
  }, {});
  const catList = Object.keys(cats);

  // Default to first category
  useEffect(() => { if (!activeCat && catList.length > 0) setActiveCat(catList[0]); }, [catList, activeCat]);

  const toggle = (id: string) => {
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const visible = (cats[activeCat] ?? []).filter(s =>
    !query.trim() || s.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <OnbCard kicker="Step 5 of 5" title="What subjects do you teach?"
      intro="Pick everything you're qualified to teach — coordinators filter by subject to find you. You can always adjust this later; your coordinator will grade your confidence in each subject.">
      {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{error}</div>}
      <div style={{ marginBottom: 14 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search subjects…" style={inputStyle()} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {catList.map(c => {
            const on = activeCat === c;
            const n = (cats[c] ?? []).filter(s => selected.includes(s.id)).length;
            return (
              <button key={c} onClick={() => setActiveCat(c)}
                style={{ textAlign: 'left', padding: '10px 12px', background: on ? '#F0FDF9' : '#fff', border: `1px solid ${on ? '#A7F3D0' : '#E4E4E7'}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: on ? '#0F4D40' : '#18181B' }}>{c}</span>
                {n > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: on ? '#2B7265' : '#F5F5F5', color: on ? '#fff' : '#71717A' }}>{n}</span>}
              </button>
            );
          })}
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#71717A', marginBottom: 10 }}>
            <b style={{ color: '#18181B' }}>{selected.length}</b> subject{selected.length === 1 ? '' : 's'} selected across all categories
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {visible.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: 12, color: '#A1A1AA', width: '100%', textAlign: 'center' }}>No subjects match your search.</div>
            ) : visible.map(s => {
              const on = selected.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggle(s.id)}
                  style={{ padding: '7px 12px', borderRadius: 999, background: on ? '#18181B' : '#fff', color: on ? '#fff' : '#3F3F46', border: `1px solid ${on ? '#18181B' : '#E4E4E7'}`, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {on && <span style={{ marginRight: 4 }}>✓</span>}{s.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <OnbFooter onBack={onBack} onNext={onSubmit} nextLabel="Finish setup →" nextDisabled={selected.length === 0} loading={loading} />
    </OnbCard>
  );
}

// ── Step 6: Done ───────────────────────────────────────────────────────────────

function StepDone({ firstName }: { firstName: string }) {
  const router = useRouter();
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 16, padding: '48px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 1px 2px rgba(22,32,51,0.04)' }}>
      <div aria-hidden style={{ position: 'absolute', left: -60, top: -60, width: 180, height: 180, borderRadius: '50%', background: '#F5F0E8', opacity: 0.55, pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', right: -40, bottom: -40, width: 140, height: 140, borderRadius: '50%', background: '#D1FAE5', opacity: 0.7, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#2B7265', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={32} height={32} viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 16l7 7 13-13" />
          </svg>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717A', marginBottom: 6 }}>All set</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: '0 0 10px', letterSpacing: '-0.02em' }}>You're live, {firstName}.</h1>
        <p style={{ fontSize: 15, color: '#52525B', margin: '0 auto 28px', lineHeight: 1.5, maxWidth: 460 }}>
          Your availability is now visible to coordinators. We'll email you when a tutoring request comes in — accept or decline right from the inbox.
        </p>
        <button onClick={() => router.push('/tutor')} style={{ height: 44, padding: '0 24px', borderRadius: 10, border: 'none', background: '#18181B', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
          Go to my calendar →
        </button>
        <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 16 }}>You can revisit any of these settings from the Settings tab.</div>
      </div>
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export function OnboardingClient({ initialUser, subjects, initialStep, oauthError }: Props) {
  const STORAGE_KEY = 'simplifi_onb_step';

  const [step, setStep] = useState<number>(() => {
    if (initialStep) return initialStep;
    if (typeof window !== 'undefined') {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY) ?? '1', 10);
      return Math.max(1, Math.min(6, isNaN(saved) ? 1 : saved));
    }
    return 1;
  });

  // Cross-step state
  const [name,     setName]     = useState(initialUser.name);
  const [tz,       setTz]       = useState(initialUser.timezone);
  const [hours,    setHours]    = useState<HoursMap>(DEFAULT_HOURS);
  const [breakMin, setBreakMin] = useState(15);
  const [selected, setSelected] = useState<string[]>([]);

  // Per-step loading/error
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | undefined>();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist step in localStorage
  useEffect(() => { localStorage.setItem(STORAGE_KEY, String(step)); }, [step]);

  // Scroll to top on step change
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);

  const next = () => { setError(undefined); setStep(s => Math.min(6, s + 1)); };
  const prev = () => { setError(undefined); setStep(s => Math.max(1, s - 1)); };
  const jump = (n: number) => { setError(undefined); setStep(n); };

  // ── Step handlers ────────────────────────────────────────────────────────────

  async function handleAccount(fullName: string, password: string) {
    setLoading(true);
    setError(undefined);
    try {
      // 1. Set password via Supabase Auth (browser client)
      const supabase = createClient();
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) throw new Error(pwError.message);

      // 2. Persist name in public.users
      const res = await fetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fullName }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save profile');
      }
      setName(fullName);
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleTimezone(timezone: string) {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save timezone');
      }
      setTz(timezone);
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleHours() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch('/api/nylas/scheduler', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours, breakMin }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save working hours');
      }
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubjects() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch('/api/onboarding/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectIds: selected }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to save subjects');
      }
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const firstName = name.split(' ')[0] ?? name;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FAFAFA', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
      {/* Header */}
      <header style={{ height: 56, background: '#fff', borderBottom: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#2B7265', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800 }}>S</div>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>Simplifi EDU · Tutor setup</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 11, color: '#71717A', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: '#22C55E' }} />
            Progress is saved automatically
          </div>
          <button onClick={() => window.location.href = '/tutor'} style={{ height: 30, padding: '0 12px', borderRadius: 8, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Skip for now
          </button>
        </div>
      </header>

      {/* Progress rail */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E4E4E7', padding: '14px 24px', flexShrink: 0 }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto' }}>
          {STEPS.map((s, i) => {
            const isDone = s.n < step;
            const isCur  = s.n === step;
            return (
              <span key={s.key} style={{ display: 'contents' }}>
                <button onClick={() => isDone && jump(s.n)} disabled={!isDone}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: isCur ? '#18181B' : (isDone ? '#F0FDF9' : '#fff'), color: isCur ? '#fff' : (isDone ? '#0F4D40' : '#71717A'), border: `1px solid ${isCur ? '#18181B' : (isDone ? '#A7F3D0' : '#E4E4E7')}`, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: isDone ? 'pointer' : 'default', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: isCur ? 'rgba(255,255,255,0.15)' : (isDone ? '#2B7265' : '#F5F5F5'), color: isCur ? '#fff' : (isDone ? '#fff' : '#A1A1AA') }}>
                    {isDone ? '✓' : s.n}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{ flexShrink: 0, width: 12, height: 1, background: s.n < step ? '#A7F3D0' : '#E4E4E7' }} />
                )}
              </span>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 60px' }}>
          {step === 1 && <StepAccount name={name} email={initialUser.email} loading={loading} error={error} onSubmit={handleAccount} />}
          {step === 2 && <StepTimezone tz={tz} loading={loading} error={error} onBack={prev} onSubmit={handleTimezone} />}
          {step === 3 && <StepCalendar alreadyConnected={initialUser.calendarConnected} oauthError={oauthError} onBack={prev} />}
          {step === 4 && <StepHours hours={hours} setHours={setHours} breakMin={breakMin} setBreakMin={setBreakMin} loading={loading} error={error} onBack={prev} onSubmit={handleHours} />}
          {step === 5 && <StepSubjects subjects={subjects} selected={selected} setSelected={setSelected} loading={loading} error={error} onBack={prev} onSubmit={handleSubjects} />}
          {step === 6 && <StepDone firstName={firstName} />}
        </div>
      </div>
    </div>
  );
}
