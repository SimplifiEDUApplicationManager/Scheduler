'use client';

import { useState, useEffect } from 'react';
import type { HoursMap } from '@/lib/types/scheduler';
import { EMPTY_HOURS_MAP } from '@/lib/types/scheduler';
import type { SchedulerSummary } from '@/lib/nylas/scheduler';
import { WorkingHoursEditor } from './WorkingHoursEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (summary: SchedulerSummary) => void;
}

function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}
        style={{ width: 16, height: 16, borderRadius: 999, background: '#E4E4E7', color: '#71717A', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', flexShrink: 0 }}>?</span>
      {visible && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6, background: '#18181B', color: '#fff', fontSize: 12, lineHeight: 1.5, padding: '8px 12px', borderRadius: 8, width: 240, zIndex: 100, pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {text}
        </div>
      )}
    </span>
  );
}

function SectionLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3F3F46', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
      {tooltip && <InfoTooltip text={tooltip} />}
    </div>
  );
}

export function SchedulerPreferencesModal({ open, onClose, onSaved }: Props) {
  const [hours, setHours]           = useState<HoursMap>({ ...EMPTY_HOURS_MAP });
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch('/api/nylas/scheduler')
      .then(r => {
        if (!r.ok) throw new Error('load_failed');
        return r.json();
      })
      .then((data: { hours?: HoursMap }) => {
        setHours(data.hours ?? { ...EMPTY_HOURS_MAP });
      })
      .catch(() => setError('Could not load your current preferences.'))
      .finally(() => setLoading(false));
  }, [open]);

  function windowsOverlap(ws: { start: string; end: string }[]): boolean {
    for (let i = 0; i < ws.length; i++) {
      for (let j = i + 1; j < ws.length; j++) {
        const a = ws[i]!, b = ws[j]!;
        if (a.start < b.end && b.start < a.end) return true;
      }
    }
    return false;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      for (const [day, windows] of Object.entries(hours)) {
        if (windows.length > 1 && windowsOverlap(windows)) {
          setError(`Overlapping time windows on ${day.charAt(0).toUpperCase() + day.slice(1)}. Please fix before saving.`);
          setSaving(false);
          return;
        }
      }
      const res = await fetch('/api/nylas/scheduler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      const data = await res.json() as { ok?: boolean; summary?: SchedulerSummary; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed to save preferences.'); return; }
      onSaved(data.summary!);
      onClose();
    } catch {
      setError('Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px 40px', background: 'rgba(0,0,0,0.35)', overflowY: 'auto' }}>
      <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 16, padding: '36px 40px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', width: '100%', maxWidth: 640, position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#71717A', marginBottom: 6 }}>Scheduling preferences</div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.02em' }}>Working hours &amp; availability</h2>
        <p style={{ fontSize: 14, color: '#52525B', margin: '0 0 28px', lineHeight: 1.5 }}>Set when you're generally open to tutor each week.</p>

        {error && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', fontSize: 14, color: '#71717A' }}>Loading your preferences…</div>
        ) : (
          <>
            <SectionLabel>Weekly working hours</SectionLabel>
            <WorkingHoursEditor hours={hours} onChange={setHours} />
          </>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px dashed #E4E4E7', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} type="button" disabled={saving}
            style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} type="button" disabled={saving || loading}
            style={{ height: 40, padding: '0 20px', borderRadius: 10, border: 'none', background: '#18181B', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: (saving || loading) ? 'not-allowed' : 'pointer', opacity: (saving || loading) ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
