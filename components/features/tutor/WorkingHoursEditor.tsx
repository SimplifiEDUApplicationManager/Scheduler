'use client';

import type { DayKey, HoursMap, TimeWindow } from '@/lib/types/scheduler';
import { DAY_ORDER } from '@/lib/types/scheduler';

// Build time options in 30-min increments: "00:00" to "23:30" for start,
// "00:30" to "47:30" for end (allows cross-midnight up to +24h).
const START_OPTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = (i % 2) * 30;
  return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: fmtTime(h, m) };
});
const END_OPTS = Array.from({ length: 96 }, (_, i) => {
  const half = i + 1; // start from 00:30
  const h = Math.floor(half / 2);
  const m = (half % 2) * 30;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const label = h >= 24 ? `${fmtTime(h % 24, m)} (+1d)` : fmtTime(h, m);
  return { value, label };
});

function fmtTime(h: number, m: number): string {
  const h24 = h % 24;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

interface Props {
  hours: HoursMap;
  onChange: (hours: HoursMap) => void;
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} type="button"
      style={{ width: 36, height: 20, borderRadius: 999, padding: 2, background: on ? '#2B7265' : '#E4E4E7', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background 0.15s', flexShrink: 0 }}>
      <div style={{ width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }} />
    </button>
  );
}

const selectStyle: React.CSSProperties = { height: 32, padding: '0 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' };

function WindowRow({ w, onChange, onRemove }: { w: TimeWindow; onChange: (w: TimeWindow) => void; onRemove: () => void }) {
  const startMins = timeToMinutes(w.start);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select value={w.start} onChange={e => onChange({ ...w, start: e.target.value })} style={selectStyle}>
        {START_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ fontSize: 12, color: '#A1A1AA' }}>→</span>
      <select value={w.end} onChange={e => onChange({ ...w, end: e.target.value })} style={selectStyle}>
        {END_OPTS.filter(o => timeToMinutes(o.value) > startMins).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={onRemove} type="button"
        style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#71717A', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
    </div>
  );
}

export function WorkingHoursEditor({ hours, onChange }: Props) {
  const updateDay = (key: DayKey, windows: TimeWindow[]) => onChange({ ...hours, [key]: windows });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {DAY_ORDER.map(([key, label]) => {
        const windows = hours[key];
        const on = windows.length > 0;
        return (
          <div key={key} style={{ padding: '10px 14px', border: `1px solid ${on ? '#E4E4E7' : '#F5F5F5'}`, borderRadius: 10, background: on ? '#fff' : '#FAFAFA' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140, paddingTop: 2 }}>
                <Toggle on={on} onChange={() => updateDay(key, on ? [] : [{ start: '09:00', end: '17:00' }])} />
                <span style={{ fontSize: 13, fontWeight: 600, color: on ? '#18181B' : '#A1A1AA' }}>{label}</span>
              </div>
              {on ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {windows.map((w, i) => (
                    <WindowRow key={i} w={w}
                      onChange={updated => updateDay(key, windows.map((x, j) => j === i ? updated : x))}
                      onRemove={() => updateDay(key, windows.filter((_, j) => j !== i))} />
                  ))}
                  <button onClick={() => updateDay(key, [...windows, { start: '09:00', end: '17:00' }])} type="button"
                    style={{ alignSelf: 'flex-start', height: 26, padding: '0 10px', borderRadius: 6, border: '1px dashed #D4D4D8', background: '#fff', color: '#71717A', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                    + Add window
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: '#A1A1AA', paddingTop: 2 }}>Unavailable</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
