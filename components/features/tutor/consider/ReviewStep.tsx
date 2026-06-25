'use client';

import { useState, type ReactNode } from 'react';
import type { TutorProposal, TutorEvent, Tuple, Tutor, SubjectConf } from '@/lib/types/domain';
import { DAY_NAMES_FULL } from '@/lib/utils/tutors';
import { renderMarkdown } from '@/lib/utils/markdown';
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
  const hr = Math.floor(h % 24); const mn = Math.round((h % 1) * 60);
  const suf = hr >= 12 ? 'p' : 'a'; const h12 = hr % 12 === 0 ? 12 : hr % 12;
  return mn === 0 ? `${h12}${suf}` : `${h12}:${String(mn).padStart(2, '0')}${suf}`;
}

export function ReviewStep({ p, me, events, conflicts, anyConflict, subjectConf, overCap, newTotal, activeStudents, onDecline, onContinue }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const capPct = Math.min(100, Math.round((me.hoursCurrent / me.hoursMax) * 100));
  const newCapPct = Math.min(100, Math.round((newTotal / me.hoursMax) * 100));
  const remaining = Math.max(0, me.hoursMax - newTotal);
  const tz = p.tz.replace('America/', '');
  const conflictN = conflicts.filter(c => c.clashes.length).length;
  const overBudget = p.offeredRate !== undefined && me.minRate > p.offeredRate;

  return (
    <>
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 24px 48px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Request from {p.coordinator}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.015em', lineHeight: 1.2 }}>
              {p.studentName} · {p.subject}
            </h1>
          </div>

          {/* Warning banners */}
          {overBudget && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', gap: 10, marginBottom: 12 }}>
              <span style={{ color: '#DC2626', flexShrink: 0, fontSize: 15 }}>⚠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>Rate below your minimum</div>
                <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2 }}>
                  This request offers ${p.offeredRate}/hr — below your ${me.minRate}/hr minimum. Contact your coordinator if you have questions.
                </div>
              </div>
            </div>
          )}
          {anyConflict && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', gap: 10, marginBottom: 12 }}>
              <span style={{ color: '#DC2626', flexShrink: 0, fontSize: 15 }}>⚠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>{conflictN} calendar conflict{conflictN > 1 ? 's' : ''} detected</div>
                <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 2 }}>You&apos;ll be able to pick a new time during scheduling.</div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginTop: 20 }}>
            {/* ── Left column ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 1. Student snapshot — deterministic fields */}
              <Card title="Student snapshot">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <SnapField label="Student" value={p.studentName} />
                  {p.studentGrade && <SnapField label="Grade" value={p.studentGrade} />}
                  {p.parentName   && <SnapField label="Parent" value={p.parentName} />}
                  {p.testName     && <SnapField label="Test / subject" value={p.testName} />}
                  {(p.startingScore !== undefined || p.goalScore !== undefined) && (
                    <SnapField
                      label="Score target"
                      value={
                        p.startingScore !== undefined && p.goalScore !== undefined
                          ? `${p.startingScore} → ${p.goalScore}`
                          : p.goalScore !== undefined
                          ? `Goal: ${p.goalScore}`
                          : `Current: ${p.startingScore}`
                      }
                    />
                  )}
                  {p.testDates    && <SnapField label="Test dates" value={p.testDates} />}
                  <SnapField label="Start date" value={p.startDate} />
                  <SnapField label="Hours / week" value="1 hr" />
                  <SnapField label="Timezone" value={tz} />
                  {p.offeredRate !== undefined && (
                    <SnapField
                      label="Offered rate"
                      value={`$${p.offeredRate}/hr`}
                      highlight={overBudget ? 'red' : undefined}
                    />
                  )}
                </div>
                {p.accommodations && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F4F4F5' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Accommodations</div>
                    <div style={{ fontSize: 13, color: '#3F3F46', lineHeight: 1.55 }}>{p.accommodations}</div>
                  </div>
                )}
              </Card>

              {/* 2. Request body — Markdown-rendered notes (dominant) */}
              {p.notes && (
                <Card title="Overview">
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: '#3F3F46' }}>
                    {renderMarkdown(p.notes)}
                  </div>
                </Card>
              )}

              {/* 3. Schedule */}
              <Card title="Schedule">
                {/* Free-form schedule description */}
                {p.scheduleNotes && (
                  <div style={{ fontSize: 13, color: '#3F3F46', lineHeight: 1.55, marginBottom: 14, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E4E4E7' }}>
                    {p.scheduleNotes}
                  </div>
                )}

                {/* Requested tuples summary */}
                <div style={{ fontSize: 12, color: '#71717A', marginBottom: 10 }}>
                  {p.tuples.length} proposed time{p.tuples.length !== 1 ? 's' : ''} · {tz}
                  {p.tuples.map((tp, i) => (
                    <span key={i} style={{ display: 'block', fontWeight: 600, color: '#18181B', marginTop: 3 }}>
                      {DAY_NAMES_FULL[tp.day]} {fmtH(tp.start)}–{fmtH(tp.end)}
                      {conflicts[i]?.clashes.length
                        ? <span style={{ color: '#DC2626', fontWeight: 500, marginLeft: 8 }}>conflict</span>
                        : <span style={{ color: '#047857', fontWeight: 500, marginLeft: 8 }}>open</span>
                      }
                    </span>
                  ))}
                </div>

                {/* Calendar toggle */}
                <button
                  onClick={() => setShowCalendar(v => !v)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#52525B', background: 'none', border: '1px solid #E4E4E7', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                    <rect x={1.5} y={2} width={10} height={10} rx={1.5} />
                    <path d="M4 1v2M9 1v2M1.5 5h10" />
                  </svg>
                  {showCalendar ? 'Hide calendar' : 'Show calendar verification'}
                </button>

                {showCalendar && (
                  <div style={{ marginTop: 14 }}>
                    <MiniWeekPreview tuples={p.tuples} conflicts={conflicts} events={events.filter(e => e.kind === 'session')} />
                    {/* Detailed conflict breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                      {conflicts.map(({ tp, clashes }, i) => {
                        const bad = clashes.length > 0;
                        return (
                          <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${bad ? '#FECACA' : '#E4E4E7'}`, background: bad ? '#FEF2F2' : '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>{DAY_NAMES_FULL[tp.day]} · {fmtH(tp.start)}–{fmtH(tp.end)}</div>
                              {bad && (
                                <div style={{ marginTop: 6, fontSize: 11, color: '#7F1D1D', lineHeight: 1.4 }}>
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
                  </div>
                )}
              </Card>

              {/* 4. Match rationale */}
              <Card title="Match rationale">
                {p.rationale && (
                  <div style={{ fontSize: 13, color: '#18181B', lineHeight: 1.5, padding: '10px 12px', borderRadius: 8, background: '#F4F4F5', marginBottom: 12, border: '1px solid #E4E4E7' }}>{p.rationale}</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FitRow ok={!!subjectConf} label={subjectConf ? `You teach ${p.subject} · ${subjectConf.toLowerCase()} confidence` : `${p.subject} is not yet on your subject list`} />
                  <FitRow ok={!anyConflict} label={anyConflict ? `${conflictN} of ${p.tuples.length} proposed times conflict with your calendar` : 'All proposed times are open on your calendar'} />
                  <FitRow ok={!overCap} label={overCap ? `Accepting would put you at ${newTotal}/${me.hoursMax} hrs/week — over your cap` : `Fits under your weekly cap (${newTotal}/${me.hoursMax} hrs after accepting)`} />
                  {p.offeredRate !== undefined && (
                    <FitRow ok={!overBudget} label={overBudget ? `Offered rate ($${p.offeredRate}/hr) is below your minimum ($${me.minRate}/hr)` : `Offered rate ($${p.offeredRate}/hr) meets your minimum ($${me.minRate}/hr)`} />
                  )}
                </div>
              </Card>
            </div>

            {/* ── Right sidebar ── */}
            <aside style={{ position: 'sticky', top: 8, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    ? <><b>Over cap.</b> Accepting adds 1 hr · you&apos;d be {newTotal - me.hoursMax} hr{newTotal - me.hoursMax === 1 ? '' : 's'} over.</>
                    : <><b>Room to take this on.</b> Accepting adds 1 hr · {remaining} hr{remaining === 1 ? '' : 's'} left after.</>}
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

          {/* Action buttons — at the bottom of content so tutors read the full proposal */}
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #E4E4E7', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 12, color: '#71717A' }}>
              {overCap ? "You're at or over your weekly cap — accept only if you're sure." : 'Next: drag proposed times onto your calendar to schedule them.'}
            </div>
            <button onClick={onDecline} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #E4E4E7', background: '#fff', color: '#52525B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Decline</button>
            <button onClick={() => setShowConfirm(true)} style={{ height: 40, padding: '0 22px', borderRadius: 10, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Accept &amp; schedule
              <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M2.5 6.5h8M7 3l3 3.5-3 3.5" /></svg>
            </button>
          </div>
        </div>
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

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #E4E4E7' }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 12px', color: '#18181B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</h3>
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

function SnapField({ label, value, highlight }: { label: string; value: string; highlight?: 'red' }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: highlight === 'red' ? '#DC2626' : '#18181B', marginTop: 2, fontWeight: 600 }}>{value}</div>
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
