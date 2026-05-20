'use client';

import type { SchedulerException, TimeWindow } from '@/lib/types/scheduler';

interface Props {
  exceptions: SchedulerException[];
  onChange: (exceptions: SchedulerException[]) => void;
}

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function WindowRow({ w, onChange, onRemove }: { w: TimeWindow; onChange: (w: TimeWindow) => void; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input type="time" value={w.start} onChange={e => onChange({ ...w, start: e.target.value })}
        style={{ height: 30, padding: '0 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff' }} />
      <span style={{ fontSize: 11, color: '#A1A1AA' }}>→</span>
      <input type="time" value={w.end} onChange={e => onChange({ ...w, end: e.target.value })}
        style={{ height: 30, padding: '0 8px', border: '1px solid #E4E4E7', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: '#fff' }} />
      <button onClick={onRemove} type="button"
        style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#71717A', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
    </div>
  );
}

export function ExceptionsEditor({ exceptions, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const updateAt = (i: number, ex: SchedulerException) =>
    onChange(exceptions.map((x, j) => j === i ? ex : x));
  const removeAt = (i: number) => onChange(exceptions.filter((_, j) => j !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {exceptions.map((ex, i) => {
        const allDay = ex.windows.length === 0;
        return (
          <div key={i} style={{ padding: '12px 14px', border: '1px solid #E4E4E7', borderRadius: 10, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: allDay ? 0 : 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{fmtDate(ex.date)}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#52525B', cursor: 'pointer' }}>
                  <input type="checkbox" checked={allDay}
                    onChange={e => updateAt(i, { ...ex, windows: e.target.checked ? [] : [{ start: '09:00', end: '17:00' }] })}
                    style={{ accentColor: '#2B7265' }} />
                  Unavailable all day
                </label>
              </div>
              <button onClick={() => removeAt(i)} type="button"
                style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#71717A', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            {!allDay && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ex.windows.map((w, j) => (
                  <WindowRow key={j} w={w}
                    onChange={updated => updateAt(i, { ...ex, windows: ex.windows.map((x, k) => k === j ? updated : x) })}
                    onRemove={() => updateAt(i, { ...ex, windows: ex.windows.filter((_, k) => k !== j) })} />
                ))}
                <button onClick={() => updateAt(i, { ...ex, windows: [...ex.windows, { start: '09:00', end: '17:00' }] })} type="button"
                  style={{ alignSelf: 'flex-start', height: 24, padding: '0 10px', borderRadius: 6, border: '1px dashed #D4D4D8', background: '#fff', color: '#71717A', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
                  + Add window
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="date" min={today}
          onChange={e => {
            if (!e.target.value) return;
            if (exceptions.some(x => x.date === e.target.value)) return;
            onChange([...exceptions, { date: e.target.value, windows: [] }]);
            e.target.value = '';
          }}
          style={{ height: 34, padding: '0 10px', border: '1px solid #E4E4E7', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }} />
        <span style={{ fontSize: 12, color: '#A1A1AA' }}>Pick a date to add an exception</span>
      </div>
    </div>
  );
}
