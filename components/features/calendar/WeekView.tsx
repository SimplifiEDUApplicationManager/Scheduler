import { useState, useMemo } from 'react';
import type { Tutor, Tuple } from '@/lib/types/domain';
import { fmtRange, getWeekDays } from '@/lib/utils/tutors';
import { cn } from '@/lib/utils/cn';

interface Block { start: number; end: number; key: string; free: number[] }

interface WeekViewProps {
  tutors: Tutor[];
  requestTuples: Tuple[];
  weekOffset: number;
}

const ROW_H = 44;
const START_H = 8;
const END_H = 21;
const HOURS = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i);
const PALETTE = ['#3B82F6','#16A34A','#DB2777','#D97706','#6366F1','#0891B2','#EA580C','#7C3AED'];

export function WeekView({ tutors, requestTuples, weekOffset }: WeekViewProps) {
  const [hoverSlot, setHoverSlot] = useState<{ day: number; start: number; end: number; free: number[] } | null>(null);
  const weekDays = getWeekDays(weekOffset);

  const perDay = useMemo(() => {
    return Array.from({ length: 7 }, (_, di) => {
      const steps: { h: number; free: number[] }[] = [];
      for (let h = START_H; h < END_H; h += 0.5) {
        const free: number[] = [];
        tutors.forEach((t, ti) => {
          const windows = t.availability[di] ?? [];
          if (windows.some(([s, e]) => h >= s && h + 0.5 <= e)) free.push(ti);
        });
        steps.push({ h, free });
      }
      const merged: Block[] = [];
      let cur: Block | null = null;
      for (const st of steps) {
        if (st.free.length === 0) { if (cur) { merged.push(cur); cur = null; } continue; }
        const key = st.free.join(',');
        if (cur && cur.key === key) { cur.end = st.h + 0.5; }
        else { if (cur) merged.push(cur); cur = { start: st.h, end: st.h + 0.5, key, free: st.free }; }
      }
      if (cur) merged.push(cur);
      return merged;
    });
  }, [tutors]);

  const maxOverlap = Math.max(1, ...perDay.flatMap(b => b.map(x => x.free.length)));
  const tint = (n: number) => `rgba(63,156,139,${(0.08 + 0.45 * (n / maxOverlap)).toFixed(2)})`;
  const bdr  = (n: number) => `rgba(31,83,73,${(0.2 + 0.5 * (n / maxOverlap)).toFixed(2)})`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Legend */}
      {tutors.length > 0 && (
        <div className="px-5 py-2 border-b border-neutral-100 bg-surface-2 flex items-center gap-3 text-[11px] text-fg-3 shrink-0 flex-wrap">
          <span className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em]">Coverage</span>
          <div className="flex items-center">
            {[1,2,3,maxOverlap].filter((n,i,a) => a.indexOf(n) === i && n <= maxOverlap).map(n => (
              <span key={n} style={{ width:20, height:12, background:tint(n), border:`1px solid ${bdr(n)}`, borderRight:'none', display:'inline-block' }} />
            ))}
            <span style={{ width:20, height:12, background:tint(maxOverlap), border:`1px solid ${bdr(maxOverlap)}`, display:'inline-block' }} />
          </div>
          <span className="text-fg-muted">1 → {maxOverlap} free</span>
          <span className="ml-auto">{tutors.length} tutor{tutors.length !== 1 ? 's' : ''} · hover to see who</span>
          {requestTuples.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-1 border border-border-default font-semibold text-fg-2">
              <span style={{ width:12, height:12, borderRadius:3, background:'repeating-linear-gradient(45deg,rgba(24,24,27,.06) 0 4px,rgba(24,24,27,.12) 4px 8px)', border:'1.5px dashed #18181B', display:'inline-block' }} />
              Requested
            </span>
          )}
        </div>
      )}

      {/* Scrollable grid */}
      <div className="flex-1 overflow-auto relative">
        {/* Sticky day header */}
        <div className="grid sticky top-0 bg-surface-1 z-10 border-b border-neutral-200 shrink-0" style={{ gridTemplateColumns:'56px repeat(7, 1fr)' }}>
          <div />
          {weekDays.map((d, i) => (
            <div key={i} className="py-2.5 text-center border-l border-neutral-100">
              <div className="text-[9px] font-bold text-fg-muted uppercase tracking-[0.06em]">{d.dow}</div>
              <div suppressHydrationWarning className={cn(
                'mt-0.5 mx-auto text-sm font-semibold w-6 h-6 rounded-full flex items-center justify-center',
                d.today ? 'bg-brand-ink text-fg-on-brand' : 'text-fg-1',
              )}>{d.date}</div>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="grid" style={{ gridTemplateColumns:'56px repeat(7, 1fr)' }}>
          {/* Hours rail */}
          <div>
            {HOURS.map(h => (
              <div key={h} style={{ height: ROW_H }} className="text-[10px] text-fg-muted text-right pr-1.5 pt-0.5 border-t border-neutral-100 tabular-nums">
                {h > 12 ? h - 12 : h}{h >= 12 ? 'p' : 'a'}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {Array.from({ length: 7 }).map((_, di) => {
            const blocks  = perDay[di];
            const dayTups = requestTuples.filter(tp => tp.day === di);
            return (
              <div key={di} className="border-l border-neutral-100 relative">
                {HOURS.map(h => <div key={h} style={{ height: ROW_H }} className="border-t border-neutral-100" />)}

                {/* Coverage tiles */}
                {blocks.map((b, bi) => {
                  const isHot = hoverSlot?.day === di && hoverSlot.start === b.start;
                  const h = (b.end - b.start) * ROW_H;
                  return (
                    <div
                      key={bi}
                      onMouseEnter={() => setHoverSlot({ day: di, start: b.start, end: b.end, free: b.free })}
                      onMouseLeave={() => setHoverSlot(null)}
                      style={{
                        position:'absolute', top:(b.start-START_H)*ROW_H+1, height:h-2, left:2, right:2,
                        background:tint(b.free.length), border:`1px solid ${bdr(b.free.length)}`,
                        borderRadius:4, padding:'3px 5px', overflow:'hidden', cursor:'pointer',
                        zIndex:isHot?3:2, outline:isHot?'2px solid #1F5349':'none', outlineOffset:-1,
                        display:'flex', flexDirection:'column', gap:2,
                      }}
                    >
                      <div style={{ fontSize:10, fontWeight:700, color:'#1F5349', fontFeatureSettings:'"tnum"' }}>{b.free.length}</div>
                      {h >= 28 && (
                        <div style={{ display:'flex', alignItems:'center' }}>
                          {b.free.slice(0,3).map((ti, i) => (
                            <span key={tutors[ti].id} style={{
                              width:16, height:16, borderRadius:999, background:'#fff',
                              border:`1.5px solid ${PALETTE[ti % PALETTE.length]}`,
                              color:'#3F3F46', fontSize:8, fontWeight:700,
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                              marginLeft:i===0?0:-4, boxShadow:'0 0 0 1.5px #fff', flexShrink:0,
                            }}>{tutors[ti].initials}</span>
                          ))}
                          {b.free.length > 3 && (
                            <span style={{ fontSize:9, fontWeight:700, color:'#1F5349', marginLeft:2 }}>+{b.free.length-3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Request tuple overlays */}
                {dayTups.map((tp, ti) => (
                  <div key={`tp${ti}`} style={{
                    position:'absolute', top:(tp.start-START_H)*ROW_H+1, height:(tp.end-tp.start)*ROW_H-2, left:2, right:2,
                    background:'repeating-linear-gradient(45deg,rgba(24,24,27,.06) 0 6px,rgba(24,24,27,.12) 6px 12px)',
                    border:'1.5px dashed #18181B', borderRadius:6, pointerEvents:'none', zIndex:4,
                    display:'flex', alignItems:'flex-start', justifyContent:'flex-end', padding:'3px 5px',
                  }}>
                    <span style={{ fontSize:9, fontWeight:700, color:'#18181B', background:'rgba(255,255,255,0.85)', padding:'1px 5px', borderRadius:3, letterSpacing:'.04em', textTransform:'uppercase' }}>Requested</span>
                  </div>
                ))}

              </div>
            );
          })}
        </div>

        {/* Hover popover — sticky bottom-right */}
        {hoverSlot && hoverSlot.free.length > 0 && (
          <div style={{ position:'sticky', bottom:12, marginLeft:'auto', marginRight:12, width:240, float:'right' }}
            className="bg-surface-1 border border-border-default rounded-xl shadow-lg p-2.5 pointer-events-none"
          >
            <div className="text-[10px] font-bold text-fg-muted uppercase tracking-[0.06em] mb-1.5">
              {weekDays[hoverSlot.day].dow} · {fmtRange(hoverSlot.start, hoverSlot.end)}
            </div>
            <div className="text-xs font-bold text-fg-1 mb-2">{hoverSlot.free.length} tutor{hoverSlot.free.length !== 1 ? 's' : ''} free</div>
            <div className="flex flex-col gap-1 max-h-40 overflow-hidden">
              {hoverSlot.free.slice(0,6).map(ti => {
                const t = tutors[ti];
                return (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-fg-1">
                    <span style={{
                      width:20, height:20, borderRadius:999, background:'#fff',
                      border:`1.5px solid ${PALETTE[ti % PALETTE.length]}`,
                      color:'#3F3F46', fontSize:9, fontWeight:700,
                      display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    }}>{t.initials}</span>
                    <span className="truncate">{t.name}</span>
                  </div>
                );
              })}
              {hoverSlot.free.length > 6 && (
                <div className="text-[11px] text-fg-muted mt-0.5">+{hoverSlot.free.length - 6} more</div>
              )}
            </div>
          </div>
        )}

        {tutors.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-fg-muted border-t border-neutral-100">
            No tutors match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
