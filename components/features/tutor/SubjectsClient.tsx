'use client';

import { useState } from 'react';
import type { Tutor, Subject, TutorSubject, SubjectConf } from '@/lib/types/domain';
import { AddSubjectModal } from './AddSubjectModal';

interface Props {
  me: Tutor;
  allSubjects: Subject[];
}

const CONF_META: Record<SubjectConf, { label: string; bg: string; fg: string; bar: string }> = {
  HIGH:   { label: 'High',   bg: '#DCFCE7', fg: '#166534', bar: '#22C55E' },
  MEDIUM: { label: 'Medium', bg: '#DBEAFE', fg: '#1E40AF', bar: '#3B82F6' },
  LOW:    { label: 'Low',    bg: '#FEE2E2', fg: '#991B1B', bar: '#EF4444' },
};

function statsFor(subjId: string, tutorId: string) {
  const seed = (subjId + tutorId).length;
  return {
    studentsAllTime: 2 + (seed % 14),
    hoursLogged:     30 + (seed * 7 % 220),
    avgRating:       Math.round((4.3 + ((seed * 3) % 7) / 10) * 10) / 10,
    reviewCount:     8 + (seed * 2 % 38),
    lastTaught:      ['this week', 'last week', '2 weeks ago', 'this month', 'last month'][seed % 5],
  };
}

function distributionFor(avg: number, total: number, seed: number): Record<number, number> {
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!total) return dist;
  const weights = avg >= 4.7
    ? { 5: 0.78, 4: 0.17, 3: 0.03, 2: 0.015, 1: 0.005 }
    : avg >= 4.4
    ? { 5: 0.62, 4: 0.27, 3: 0.07, 2: 0.03, 1: 0.01 }
    : { 5: 0.48, 4: 0.30, 3: 0.13, 2: 0.06, 1: 0.03 };
  let remaining = total;
  for (const k of [5, 4, 3, 2] as const) { dist[k] = Math.round(weights[k] * total); remaining -= dist[k]; }
  dist[1] = Math.max(0, remaining);
  if (total > 8 && dist[5] > 0) { const shift = seed % 3; dist[5] -= shift; dist[4] += shift; }
  return dist;
}

function sampleQuotes(subjId: string, seed: number) {
  const bank: Record<string, { author: string; rating: number; text: string }[]> = {
    apcalcbc: [
      { author: 'Ava R. · 11th grade', rating: 5, text: "Julia's Socratic style finally made series click for me. Went from a 3 to a 5 on the practice exam." },
      { author: 'Marcus T. · 12th grade', rating: 5, text: 'Patient even when I asked the same question three times. Parametrics made sense after one session.' },
      { author: 'Priya S. · 11th grade', rating: 4, text: "Really thorough. Sometimes I wished we'd go faster but the foundations are solid now." },
    ],
    apcalcab: [
      { author: 'Jordan L. · 11th grade', rating: 5, text: "She doesn't just give you the answer — she teaches you to find it. Huge for AP prep." },
      { author: 'Emma B. · 10th grade', rating: 5, text: 'Related rates were my nightmare. Two sessions with Julia and I actually like them now.' },
      { author: 'Diego V. · 11th grade', rating: 4, text: 'Great at derivative rules. Warm and encouraging when I got stuck.' },
    ],
    apphysc: [
      { author: 'Noah K. · 12th grade', rating: 5, text: "Best physics tutor I've had. The way she draws out free-body diagrams helped me visualize everything." },
      { author: 'Sasha M. · 11th grade', rating: 4, text: 'Electromagnetism finally clicked. Would love if we did more problem sets together.' },
      { author: 'Rohan P. · 12th grade', rating: 5, text: 'She makes problem-solving feel like a craft rather than a checklist.' },
    ],
    apchem: [
      { author: 'Liam C. · 11th grade', rating: 4, text: "Patient with my mistakes. We worked through stoichiometry carefully — super helpful." },
      { author: 'Zoe H. · 10th grade', rating: 4, text: "She's honest when I'm not ready for a topic, which I actually appreciate." },
      { author: 'Aiden F. · 11th grade', rating: 5, text: 'Equilibrium problems used to stump me. Not anymore.' },
    ],
  };
  const fallback = [
    { author: 'Student · 11th grade', rating: 5, text: 'Super patient and easy to follow. I feel more confident after every session.' },
    { author: 'Student · 12th grade', rating: 4, text: "Clear explanations and good at spotting exactly where I'm stuck." },
  ];
  const pool = bank[subjId] ?? fallback;
  const start = seed % pool.length;
  return [pool[start], pool[(start + 1) % pool.length]];
}

function Stars({ rating, size = 12, color = '#F59E0B', muted = '#E4E4E7' }: { rating: number; size?: number; color?: string; muted?: string }) {
  return (
    <div style={{ display: 'inline-flex', gap: 1 }}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <div key={i} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" fill={muted} style={{ display: 'block' }} aria-hidden>
              <path d="M12 2.5l2.9 6.32 6.85.63-5.18 4.63 1.53 6.78L12 17.3l-6.1 3.56 1.53-6.78L2.25 9.45l6.85-.63L12 2.5z" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, width: `${fill * 100}%`, overflow: 'hidden' }}>
              <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ display: 'block' }} aria-hidden>
                <path d="M12 2.5l2.9 6.32 6.85.63-5.18 4.63 1.53 6.78L12 17.3l-6.1 3.56 1.53-6.78L2.25 9.45l6.85-.63L12 2.5z" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubjectCard({ ts, subject, tutorId, expanded, onToggle, onRemove }: {
  ts: TutorSubject; subject: Subject; tutorId: string;
  expanded: boolean; onToggle: () => void; onRemove: () => void;
}) {
  const meta  = CONF_META[ts.conf];
  const stats = statsFor(ts.id, tutorId);
  const seed  = (ts.id + tutorId).length;

  return (
    <div style={{ background: '#fff', border: '1px solid #E4E4E7', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
      {/* Left confidence bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: meta.bar }} />

      <div style={{ padding: '16px 16px 16px 18px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: '#18181B' }}>{subject.name}</div>
            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 2 }}>{subject.cat} · Last taught {stats.lastTaught}</div>
          </div>
          {/* Read-only confidence badge */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: meta.bg, color: meta.fg, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: meta.bar, flexShrink: 0 }} />
            {meta.label}
          </span>
        </div>

        {/* Student rating row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FAFAFA', borderRadius: 8, border: '1px solid #F5F5F5', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: '#18181B' }}>{stats.avgRating.toFixed(1)}</span>
            <Stars rating={stats.avgRating} size={12} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Students say</div>
            <div style={{ fontSize: 11, color: '#52525B', marginTop: 1 }}>Based on {stats.reviewCount} session reviews</div>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <MiniStat icon="👤" label="Students" value={stats.studentsAllTime} />
          <MiniStat icon="⏱" label="Hours" value={stats.hoursLogged} />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onToggle} style={{ flex: 1, height: 30, borderRadius: 6, border: '1px solid #E4E4E7', background: '#fff', color: '#3F3F46', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {expanded ? 'Hide details' : 'Recent reviews'}
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} aria-hidden>
              <path d="M2 3l3 4 3-4" />
            </svg>
          </button>
          <button onClick={onRemove} title="Remove subject" style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid #FECACA', background: '#fff', color: '#DC2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        </div>
      </div>

      {/* Expanded: reviews breakdown */}
      {expanded && (
        <ExpandedReviews subjId={ts.id} stats={stats} seed={seed} />
      )}
    </div>
  );
}

function ExpandedReviews({ subjId, stats, seed }: { subjId: string; stats: ReturnType<typeof statsFor>; seed: number }) {
  const dist   = distributionFor(stats.avgRating, stats.reviewCount, seed);
  const quotes = sampleQuotes(subjId, seed);

  return (
    <div style={{ borderTop: '1px solid #F5F5F5', background: '#FAFAFA', padding: 16 }}>
      <div style={{ fontSize: 10, color: '#71717A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ratings breakdown</div>
      <div style={{ marginBottom: 14 }}>
        {[5, 4, 3, 2, 1].map(n => {
          const count = dist[n] ?? 0;
          const pct   = stats.reviewCount ? count / stats.reviewCount : 0;
          return (
            <div key={n} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 24px', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#71717A', fontWeight: 600, textAlign: 'right' }}>{n}★</span>
              <div style={{ height: 6, background: '#E4E4E7', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct * 100}%`, height: '100%', background: n >= 4 ? '#10B981' : n === 3 ? '#F59E0B' : '#EF4444' }} />
              </div>
              <span style={{ fontSize: 10, color: '#A1A1AA' }}>{count}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#71717A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Recent student feedback</div>
      {quotes.map((q, i) => (
        <div key={i} style={{ padding: '10px 12px', background: '#fff', border: '1px solid #EFEFEF', borderRadius: 8, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#52525B' }}>{q.author}</span>
            <Stars rating={q.rating} size={10} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#3F3F46', lineHeight: 1.5 }}>&ldquo;{q.text}&rdquo;</p>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div style={{ padding: '8px 10px', background: '#FAFAFA', border: '1px solid #F5F5F5', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 9, color: '#A1A1AA', marginTop: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A1A1AA', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 6 }}>{hint}</div>
    </div>
  );
}

export function SubjectsClient({ me, allSubjects }: Props) {
  const [mySubjects, setMySubjects] = useState<TutorSubject[]>(me.subjects);
  const [addOpen, setAddOpen]       = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2400); }

  async function handleAdd(ts: TutorSubject) {
    const res = await fetch('/api/tutor-subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_id: ts.id, qualification_note: ts.qualificationNote }),
    });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to add subject'}`);
      return;
    }
    const row = await res.json() as { id: string; subject_id: string };
    setMySubjects(prev => [...prev, { ...ts, rowId: row.id }]);
    setAddOpen(false);
    showToast(`${allSubjects.find(s => s.id === ts.id)?.name ?? 'Subject'} added · pending coordinator review`);
  }

  async function handleRemove(ts: TutorSubject) {
    if (!ts.rowId) {
      showToast('Cannot remove: subject has no row ID');
      return;
    }
    const res = await fetch(`/api/tutor-subjects/${ts.rowId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json() as { error?: string };
      showToast(`Error: ${body.error ?? 'Failed to remove subject'}`);
      return;
    }
    setMySubjects(prev => prev.filter(x => x.id !== ts.id));
    showToast('Subject removed');
  }

  const totalStudents = mySubjects.reduce((a, s) => a + statsFor(s.id, me.id).studentsAllTime, 0);
  const totalHours    = mySubjects.reduce((a, s) => a + statsFor(s.id, me.id).hoursLogged, 0);
  const totalReviews  = mySubjects.reduce((a, s) => a + statsFor(s.id, me.id).reviewCount, 0);
  const overallRating = totalReviews === 0 ? 0 :
    mySubjects.reduce((a, s) => {
      const st = statsFor(s.id, me.id);
      return a + st.avgRating * st.reviewCount;
    }, 0) / totalReviews;

  // Sort: HIGH → MEDIUM → LOW
  const ORDER: SubjectConf[] = ['HIGH', 'MEDIUM', 'LOW'];
  const sorted = [...mySubjects].sort((a, b) => ORDER.indexOf(a.conf) - ORDER.indexOf(b.conf));

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#FAFAFA' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 32px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.015em' }}>My subjects</h1>
            <p style={{ fontSize: 13, color: '#71717A', margin: 0, lineHeight: 1.5 }}>
              The subjects you teach, as rated by students. Coordinator confidence reflects how often we&apos;ll match you.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          >
            <svg width={13} height={13} viewBox="0 0 13 13" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" aria-hidden><path d="M6.5 2v9M2 6.5h9" /></svg>
            Add a subject
          </button>
        </div>

        {/* Hero */}
        <div style={{ background: 'linear-gradient(135deg, #18181B 0%, #27272A 100%)', borderRadius: 16, padding: '22px 26px', marginBottom: 20, color: '#fff', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 28, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A1A1AA', marginBottom: 8 }}>Student rating</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{overallRating.toFixed(1)}</span>
              <Stars rating={overallRating} size={15} color="#FBBF24" muted="#3F3F46" />
            </div>
            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 6 }}>From {totalReviews} student reviews across all subjects</div>
          </div>
          <HeroStat label="Subjects" value={mySubjects.length} hint="you teach" />
          <HeroStat label="Students" value={totalStudents} hint="all-time" />
          <HeroStat label="Hours" value={totalHours} hint="delivered" />
        </div>

        {/* Confidence legend (read-only) */}
        <div style={{ padding: '12px 16px', background: '#fff', border: '1px solid #E4E4E7', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coordinator confidence</span>
          {ORDER.map(k => {
            const m = CONF_META[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: m.bar }} />
                <span style={{ fontSize: 11, color: '#52525B', fontWeight: 600 }}>{m.label}</span>
              </div>
            );
          })}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: '#A1A1AA', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="#A1A1AA" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
              <rect x={2} y={4} width={6} height={5} rx={1} /><path d="M3.5 4V3a2.5 2.5 0 015 0v1" />
            </svg>
            Set by your coordinator
          </div>
        </div>

        {/* Cards grid */}
        {mySubjects.length === 0 ? (
          <div style={{ padding: '48px 32px', background: '#fff', border: '2px dashed #E4E4E7', borderRadius: 14, textAlign: 'center' }}>
            <svg width={28} height={28} viewBox="0 0 28 28" fill="none" stroke="#D4D4D8" strokeWidth={1.5} strokeLinecap="round" style={{ marginBottom: 12 }} aria-hidden>
              <rect x={4} y={3} width={20} height={22} rx={3} /><path d="M9 9h10M9 13h10M9 17h6" />
            </svg>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>No subjects yet</div>
            <p style={{ fontSize: 12, color: '#71717A', margin: '6px 0 16px' }}>Add the subjects you&apos;re comfortable teaching.</p>
            <button onClick={() => setAddOpen(true)} style={{ height: 36, padding: '0 16px', borderRadius: 8, border: 'none', background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
              Add a subject
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {sorted.map(ts => {
              const subject = allSubjects.find(s => s.id === ts.id);
              if (!subject) return null;
              return (
                <SubjectCard
                  key={ts.id}
                  ts={ts}
                  subject={subject}
                  tutorId={me.id}
                  expanded={expandedId === ts.id}
                  onToggle={() => setExpandedId(expandedId === ts.id ? null : ts.id)}
                  onRemove={() => handleRemove(ts)}
                />
              );
            })}
          </div>
        )}
      </div>

      {addOpen && (
        <AddSubjectModal
          allSubjects={allSubjects}
          existing={mySubjects.map(s => s.id)}
          onClose={() => setAddOpen(false)}
          onAdd={handleAdd}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 60, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#18181B', color: '#fff', borderRadius: 10, boxShadow: '0 10px 24px rgba(22,32,51,0.18)', fontSize: 13, fontWeight: 500 }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: '#22C55E', flexShrink: 0 }} />
          {toast}
        </div>
      )}
    </div>
  );
}
