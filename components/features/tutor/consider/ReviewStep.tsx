'use client';

import { useState, type ReactNode } from 'react';
import type { TutorProposal, TutorEvent, Tuple, Tutor, SubjectConf } from '@/lib/data/dashboard-mock';
import { DAY_NAMES_FULL } from '@/lib/utils/tutors';
import { MiniWeekPreview } from './MiniWeekPreview';
import { ConfirmAcceptModal } from './ConfirmAcceptModal';

interface ConflictEntry { tp: Tuple; clashes: TutorEvent[] }

interface Props {
  p: TutorProposal;
  me: Tutor;
  events: TutorEvent[];
  conflicts: ConflictEntry[];
  anyConflict: boolean;
  subjectConf: SubjectConf | null;
  overCap: boolean;
  newTotal: number;
  activeStudents: number;
  onDecline: () => void;
  onContinue: () => void;
}

function fmtH(h: number): string {
  const hr = Math.floor(h); const mn = Math.round((h - hr) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

export function ReviewStep({ p, me, events, conflicts, anyConflict, subjectConf, overCap, newTotal, activeStudents, onDecline, onContinue }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const capPct = Math.min(100, Math.round((me.hoursCurrent / me.hoursMax) * 100));
  const newCapPct = Math.min(100, Math.round((newTotal / me.hoursMax) * 100));
  const remaining = Math.max(0, me.hoursMax - newTotal);
  const tz = p.tz.replace('America/', '');
  const conflictN = conflicts.filter(c => c.clashes.length).length;

  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 24px 120px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Request from {p.coordinator}</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.015em', lineHeight: 1.2 }}>{p.studentName} · {p.subject}</h1>
            <div style={{ marginTop: 8, fontSize: 13, color: '#52525B', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {p.studentGrade && <><span>{p.studentGrade}</span><span style={{ color: '#D4D4D8' }}>·</span></>}
              <span>Start {p.startDate}</span><span style={{ color: '#D4D4D8' }}>·</span>
              <span>{p.hoursPerWeek} hrs/week</span><span style={{ color: '#D4D4D8' }}>·</span>
              <span>{tz}</span>
            </div>
          </div>

          {anyConflict && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', gap: 10, marginBottom: 20 }}>
              <span style={{ color: '#DC2626', flexShrink: 0, fontSize: 15 }}>⚠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>{conflictN} calendar conflict{conflictN > 1 ? 's' : ''} detected</div>
                <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2 }}>You'll be able to pick a new time during scheduling.</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Card title="Calendar preview" subtitle="Proposed times shown against your week">
                <MiniWeekPreview tuples={p.tuples} conflicts={conflicts} events={events.filter(e => e.kind === 'session')} />
              </Card>
              <Card title="Requested windows">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {conflicts.map(({ tp, clashes }, i) => {
                    const bad = clashes.length > 0;
                    return (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${bad ? '#FECACA' : '#E4E4E7'}`, background: bad ? '#FEF2F2' : '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{DAY_NAMES_FULL[tp.day]} · {fmtH(tp.start)}–{fmtH(tp.end)}</div>
                          <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>{tp.end - tp.start} hr session · {tz}</div>
                          {bad && (
                            <div style={{ marginTop: 8, padding: '6px 8px', background: '#fff', borderRadius: 6, border: '1px solid #FECACA', fontSize: 11, color: '#7F1D1D', lineHeight: 1.4 }}>
                              <b>Conflicts with:</b>{' '}
                              {clashes.map((c, j) => <span key={j}>{j > 0 && ', '}{c.title} ({fmtH(c.start)}–{fmtH(c.end)})</span>)}
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '3px 8px', borderRadius: 999, background: bad ? '#DC2626' : '#ECFDF5', color: bad ? '#fff' : '#047857', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                          {bad ? 'Conflict' : 'Open'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
              {p.notes && (
                <Card title="Note from coordinator">
                  <div style={{ padding: 12, borderRadius: 8, background: '#FEFCE8', border: '1px solid #FEF08A', fontSize: 13, lineHeight: 1.55, color: '#422006' }}>{p.notes}</div>
                </Card>
              )}
              <Card title="Match rationale">
                {p.rationale && <div style={{ fontSize: 13, color: '#18181B', lineHeight: 1.5, padding: '10px 12px', borderRadius: 8, background: '#F4F4F5', marginBottom: 12, border: '1px solid #E4E4E7' }}>{p.rationale}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FitRow ok={!!subjectConf} label={subjectConf ? `You teach ${p.subject} · ${subjectConf.toLowerCase()} confidence` : `${p.subject} is not yet on your subject list`} />
                  <FitRow ok={!anyConflict} label={anyConflict ? `${conflictN} of ${p.tuples.length} proposed times conflict with your calendar` : 'All proposed times are open on your calendar'} />
                  <FitRow ok={!overCap} label={overCap ? `Accepting would put you at ${newTotal}/${me.hoursMax} hrs/week — over your cap` : `Fits under your weekly cap (${newTotal}/${me.hoursMax} hrs after accepting)`} />
                </div>
              </Card>
            </div>

            <aside style={{ position: 'sticky', top: 8, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SideCard label="Student">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: '#E8F4F1', color: '#1F5349', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
                    {(p.studentName || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.25 }}>{p.studentName}</div>
                    <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>{p.studentGrade || 'New match'}</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F5F5F5', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Meta label="Subject" value={p.subject} />
                  <Meta label="Start" value={p.startDate} />
                  <Meta label="Hours/wk" value={`${p.hoursPerWeek}`} />
                  <Meta label="Timezone" value={tz} />
                </div>
              </SideCard>

              <SideCard label="Your capacity · this week" border={overCap ? '#FECACA' : '#E4E4E7'}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#18181B', lineHeight: 1 }}>{me.hoursCurrent}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#71717A' }}>/ {me.hoursMax} hrs</div>
                </div>
                <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>{activeStudents} active student{activeStudents === 1 ? '' : 's'}</div>
                <div style={{ marginTop: 12, position: 'relative', height: 8, borderRadius: 999, background: '#F4F4F5', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${capPct}%`, background: '#18181B' }} />
                  <div style={{ position: 'absolute', left: `${capPct}%`, top: 0, bottom: 0, width: `${Math.max(0, newCapPct - capPct)}%`, background: overCap ? '#DC2626' : '#3F9C8B', opacity: 0.85 }} />
                </div>
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: overCap ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${overCap ? '#FECACA' : '#BBF7D0'}`, fontSize: 12, color: overCap ? '#991B1B' : '#166534', lineHeight: 1.4 }}>
                  {overCap
                    ? <><b>Over cap.</b> Accepting adds {p.hoursPerWeek} hrs · you'd be {newTotal - me.hoursMax} hr{newTotal - me.hoursMax === 1 ? '' : 's'} over.</>
                    : <><b>Room to take this on.</b> Accepting adds {p.hoursPerWeek} hrs · {remaining} hr{remaining === 1 ? '' : 's'} left after.</>}
                </div>
              </SideCard>

              <SideCard label="Coordinator">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, background: '#F5F0E8', color: '#92400E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {(p.coordinator || '').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.coordinator}</div>
                    <div style={{ fontSize: 11, color: '#71717A', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.coordinatorEmail}</div>
                  </div>
                </div>
              </SideCard>
            </aside>
          </div>
        </div>
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #E4E4E7', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 -6px 16px rgba(22,32,51,0.04)' }}>
        <div style={{ flex: 1, fontSize: 12, color: '#71717A' }}>
          {overCap ? "You're at or over your weekly cap — accept only if you're sure." : 'Next: drag proposed times onto your calendar to schedule them.'}
        </div>
        <button onClick={onDecline} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
        <button onClick={() => setShowConfirm(true)} style={{ height: 40, padding: '0 22px', borderRadius: 10, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Accept &amp; schedule
          <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M2.5 6.5h8M7 3l3 3.5-3 3.5" /></svg>
        </button>
      </div>

      {showConfirm && (
        <ConfirmAcceptModal
          p={p} overCap={overCap} anyConflict={anyConflict}
          newTotal={newTotal} capHours={me.hoursMax} usedHours={me.hoursCurrent}
          conflicts={conflicts}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => { setShowConfirm(false); onContinue(); }}
        />
      )}
    </>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #E4E4E7' }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, margin: 0, color: '#18181B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h3>
        {subtitle && <div style={{ fontSize: 11, color: '#71717A', marginTop: 4, lineHeight: 1.4 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function SideCard({ label, border = '#E4E4E7', children }: { label: string; border?: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: `1px solid ${border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#71717A', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#18181B', marginTop: 2, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function FitRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: 999, flexShrink: 0, background: ok ? '#ECFDF5' : '#FEF2F2', color: ok ? '#047857' : '#DC2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
        {ok ? '✓' : '✗'}
      </div>
      <div style={{ fontSize: 13, color: '#18181B', lineHeight: 1.4, paddingTop: 1 }}>{label}</div>
    </div>
  );
}
