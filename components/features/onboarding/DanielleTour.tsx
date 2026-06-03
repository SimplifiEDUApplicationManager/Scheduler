'use client';

// Danielle — animated onboarding tour for new tutors.
//
// Mounts in the tutor layout so it persists across route changes.
// Auto-shows on first visit (localStorage key "sim_intro_seen" !== "1").
// Navigates between /tutor/calendar, /tutor/proposals, /tutor/settings
// via next/navigation router.
//
// Target elements are marked with data-tour="<key>" attributes.

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

type Pose = 'wave' | 'idle' | 'point';

interface Step {
  key: string;
  path?: string;          // navigate here when entering this step
  target?: string;        // CSS selector for spotlight / bubble anchor
  pose: Pose;
  title: string;
  body: string;
  cta: string;
  placement?: 'center';  // default: fixed bottom-right corner
}

interface Spot { x: number; y: number; w: number; h: number }

// ─── Tour steps (adapted to the real 3-tab tutor UI) ─────────────────────────

const STEPS: Step[] = [
  {
    key: 'welcome',
    pose: 'wave',
    title: "Hi, I'm Danielle 👋",
    body: "I'll walk you through every part of your tutor dashboard so you know exactly what each piece does. It only takes a minute.",
    cta: 'Start the tour',
    placement: 'center',
  },
  {
    key: 'tabs',
    path: '/tutor/calendar',
    target: '[data-tour="tab-Calendar"]',
    pose: 'point',
    title: 'These tabs are your home base',
    body: 'Calendar, Proposals, and Settings — that\'s the whole app. I\'ll show you each one in turn.',
    cta: 'Show me Calendar',
  },
  {
    key: 'cal-profile',
    target: '[data-tour="tutor-profile-card"]',
    pose: 'point',
    title: 'Your profile card',
    body: 'A quick snapshot of your week — capacity, hours booked, and your response-time ranking. Coordinators see a version of this when matching.',
    cta: 'Got it',
  },
  {
    key: 'cal-proposals',
    target: '[data-tour="tutor-proposals-sidebar"]',
    pose: 'point',
    title: 'Incoming proposals',
    body: 'Pending requests live here on the left. Hover one to preview where it\'d fit on your calendar; click "Consider" to open the full review.',
    cta: 'Next',
  },
  {
    key: 'cal-grid',
    target: '[data-tour="tutor-calendar-grid"]',
    pose: 'point',
    title: 'Your calendar grid',
    body: 'Every confirmed session is a teal block. Click any one to see student info, the meeting link, and options to cancel or reschedule.',
    cta: 'Next',
  },
  {
    key: 'cal-toggle',
    target: '[data-tour="tutor-cal-toggle"]',
    pose: 'point',
    title: 'Switch week or month view',
    body: 'Swap between a week-at-a-glance and a fuller month overview when you\'re planning further out.',
    cta: 'Onward',
  },
  {
    key: 'prop-tab',
    path: '/tutor/proposals',
    target: '[data-tour="tab-Proposals"]',
    pose: 'point',
    title: 'The Proposals inbox',
    body: 'A dedicated page for every match a coordinator has sent you — past and present.',
    cta: 'Show me',
  },
  {
    key: 'prop-filters',
    target: '[data-tour="proposals-filters"]',
    pose: 'point',
    title: 'Filter by status',
    body: '"Needs response" is what you\'ll usually want — proposals still waiting on you. Toggle to see ones you\'ve accepted, declined, or all of them.',
    cta: 'Next',
  },
  {
    key: 'prop-row',
    target: '[data-tour="proposals-first-row"]',
    pose: 'point',
    title: 'The proposals list',
    body: 'Each row is a match a coordinator sent you. Click any row to open the full detail — student context, a calendar preview, and the Accept / Decline buttons.',
    cta: 'Next',
  },
  {
    key: 'prop-practice-intro',
    path: '/tutor/proposals',
    pose: 'wave',
    title: 'Time to practice!',
    body: "I've added a practice proposal from a student named Alex Chen. Go ahead and open it — click the row, then hit Accept to see the full accept flow, including a real calendar event.",
    cta: "Let's do it",
    placement: 'center',
  },
  {
    key: 'prop-practice-wait',
    path: '/tutor/proposals',
    pose: 'idle',
    title: 'Go accept it!',
    body: "Click the Alex Chen row, review the details, and hit Accept. I'll jump to the next step automatically once you do.",
    cta: 'Skip practice',
  },
  {
    key: 'prop-practice-done',
    pose: 'wave',
    title: "You accepted your first job! 🎉",
    body: "A real calendar event was added to your connected calendar and the family got a notification. That's exactly how it works for real students.",
    cta: 'Keep going',
    placement: 'center',
  },
  {
    key: 'set-tab',
    path: '/tutor/settings',
    target: '[data-tour="tab-Settings"]',
    pose: 'point',
    title: 'Last stop: Settings',
    body: 'Profile, capacity, subjects, calendar connection, and your personal booking page all live here.',
    cta: 'Show me',
  },
  {
    key: 'set-subnav',
    target: '[data-tour="settings-subnav"]',
    pose: 'point',
    title: 'Quick-jump sub-nav',
    body: 'Jump straight to any section without scrolling. The sticky save bar at the bottom applies your changes.',
    cta: 'Next',
  },
  {
    key: 'set-subjects',
    target: '[data-tour="settings-subjects"]',
    pose: 'point',
    title: 'Your subjects',
    body: 'Add the subjects you teach and self-rate your confidence — coordinators use that signal to send you matches you\'ll feel great about.',
    cta: 'Next',
  },
  {
    key: 'set-booking',
    target: '[data-tour="settings-booking-preview"]',
    pose: 'point',
    title: 'Your personal booking page',
    body: 'A live preview of the Nylas-hosted page students use to book time directly with you. Copy the link or open it in a new tab.',
    cta: 'Wrap up',
  },
  {
    key: 'finish',
    pose: 'wave',
    title: "You're all set!",
    body: "I'll stay tucked in the bottom corner — tap me anytime to replay this tour. Happy tutoring 💛",
    cta: 'Start tutoring',
    placement: 'center',
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function DanielleTour() {
  const router   = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(true); // optimistic: don't flash on SSR
  const [step, setStep] = useState(0);
  const [pose, setPose] = useState<Pose>('wave');
  const [spot, setSpot] = useState<Spot | null>(null);

  // ── Check localStorage on mount ───────────────────────────────────────────
  useEffect(() => {
    const alreadySeen = localStorage.getItem('sim_intro_seen') === '1';
    setSeen(alreadySeen);
    if (!alreadySeen) setOpen(true);
  }, []);

  // ── Dispatch sim:show-demo when the practice-intro step is entered ─────────
  useEffect(() => {
    if (!open) return;
    if (STEPS[step]?.key === 'prop-practice-intro') {
      window.dispatchEvent(new CustomEvent('sim:show-demo'));
    }
  }, [step, open]);

  // ── Auto-advance past prop-practice-wait when the tutor accepts the demo ──
  useEffect(() => {
    if (!open || STEPS[step]?.key !== 'prop-practice-wait') return;
    const handler = () => { setSpot(null); setStep(s => s + 1); };
    window.addEventListener('sim:demo-accepted', handler);
    return () => window.removeEventListener('sim:demo-accepted', handler);
  }, [step, open]);

  // ── Measure target element whenever step or pathname changes ──────────────
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s) return;

    setPose(s.pose);

    // If this step needs a different route, navigate first.
    // The effect will re-fire when pathname updates.
    if (s.path && pathname !== s.path) {
      router.push(s.path);
      return;
    }

    if (!s.target) { setSpot(null); return; }

    // Retry until the element is in the DOM (tab transitions mount async).
    let cancelled  = false;
    let attempts   = 0;
    let scrolled   = false;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(s.target!);
      if (!el) {
        if (++attempts < 40) setTimeout(measure, 50);
        else setSpot(null);
        return;
      }
      if (!scrolled) {
        scrolled = true;
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* noop */ }
        setTimeout(measure, 320);
        return;
      }
      const r = el.getBoundingClientRect();
      setSpot({ x: r.left, y: r.top, w: r.width, h: r.height });
    };

    const t = setTimeout(measure, 30);
    window.addEventListener('resize', measure);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener('resize', measure); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pathname, open]);

  function close() {
    setOpen(false);
    localStorage.setItem('sim_intro_seen', '1');
    setSeen(true);
  }

  function next() {
    if (step >= STEPS.length - 1) { close(); return; }
    setSpot(null);
    setStep(s => s + 1);
  }

  function back() {
    setSpot(null);
    setStep(s => Math.max(0, s - 1));
  }

  function replay() {
    setStep(0);
    setSpot(null);
    setOpen(true);
  }

  const current    = STEPS[step]!;
  const isCenter   = current.placement === 'center';
  const totalSteps = STEPS.length;

  // ── Positioning ───────────────────────────────────────────────────────────
  const danielleStyle: React.CSSProperties = isCenter
    ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%) translateY(40px)', zIndex: 1002 }
    : { position: 'fixed', right: 24, bottom: 24, zIndex: 1002 };

  const bubbleStyle: React.CSSProperties = isCenter
    ? { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -100%) translateY(-60px)', width: 380, zIndex: 1002 }
    : { position: 'fixed', right: 200, bottom: 80, width: 360, zIndex: 1002 };

  const tailSide = isCenter ? 'bottom' : 'right';

  if (!open) {
    return seen ? <DanielleFABButton onOpen={replay} /> : null;
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <Backdrop spot={spot} dim={isCenter ? 0.55 : 0.35} />

      <div style={danielleStyle}>
        <DanielleChar pose={pose} size={isCenter ? 220 : 160} />
      </div>

      <div style={bubbleStyle}>
        <SpeechBubble
          title={current.title}
          body={current.body}
          tail={tailSide}
          step={step + 1}
          total={totalSteps}
          canBack={step > 0}
          ctaLabel={current.cta}
          onNext={next}
          onBack={back}
        />
      </div>
    </>
  );
}

// ─── Spotlight backdrop ───────────────────────────────────────────────────────

function Backdrop({ spot, dim }: { spot: Spot | null; dim: number }) {
  const pad = 8;
  if (!spot) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: `rgba(22,32,51,${dim})`,
        animation: 'tourFade 220ms ease-out',
      }} />
    );
  }
  return (
    <svg style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none', animation: 'tourFade 220ms ease-out' }} width="100%" height="100%">
      <defs>
        <mask id="tour-spot">
          <rect width="100%" height="100%" fill="white" />
          <rect x={spot.x - pad} y={spot.y - pad} width={spot.w + pad * 2} height={spot.h + pad * 2} rx="10" ry="10" fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`rgba(22,32,51,${dim})`} mask="url(#tour-spot)" />
      <rect
        x={spot.x - pad} y={spot.y - pad}
        width={spot.w + pad * 2} height={spot.h + pad * 2}
        rx="10" ry="10"
        fill="none" stroke="rgba(255,232,188,0.95)" strokeWidth="3"
        style={{ filter: 'drop-shadow(0 0 12px rgba(255,232,188,0.6))' }}
      />
    </svg>
  );
}

// ─── Speech bubble ────────────────────────────────────────────────────────────

function SpeechBubble({ title, body, tail, step, total, canBack, ctaLabel, onNext, onBack }: {
  title: string; body: string; tail: 'bottom' | 'right' | 'none';
  step: number; total: number; canBack: boolean; ctaLabel: string;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E4E4E7', borderRadius: 18,
      padding: '20px 22px 18px', boxShadow: '0 24px 60px rgba(22,32,51,0.18)',
      position: 'relative', animation: 'tourPop 280ms cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: -14, left: -14, width: 36, height: 36,
        borderRadius: '50%', background: 'var(--brand-cream)', opacity: 0.85, zIndex: -1,
      }} />

      <BubbleTail side={tail} />

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-teal-600)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>✨</span>
        Danielle · Step {step} of {total}
      </div>

      <h3 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', fontFamily: 'var(--font-display)', letterSpacing: '-0.015em', lineHeight: 1.2 }}>{title}</h3>

      <p style={{ fontSize: 14, color: '#3F3F46', margin: '0 0 18px', lineHeight: 1.55 }}>{body}</p>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 16 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: i + 1 === step ? 18 : 6, height: 6, borderRadius: 999,
            background: i + 1 <= step ? 'var(--brand-teal-500)' : '#E4E4E7',
            transition: 'all 220ms ease',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {canBack && (
            <button onClick={onBack} style={{ height: 36, padding: '0 14px', borderRadius: 9, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          <button onClick={onNext} style={{ height: 36, padding: '0 18px', borderRadius: 9, background: 'var(--brand-teal-600)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 12px rgba(43,114,101,0.30)' }}>
            {ctaLabel} →
          </button>
        </div>
      </div>
    </div>
  );
}

function BubbleTail({ side }: { side: 'bottom' | 'right' | 'none' }) {
  if (side === 'right') {
    return (
      <div style={{
        position: 'absolute', right: -10, bottom: 36, width: 0, height: 0,
        borderTop: '10px solid transparent', borderBottom: '10px solid transparent',
        borderLeft: '12px solid #fff', filter: 'drop-shadow(1px 0 0 #E4E4E7)',
      }} />
    );
  }
  if (side === 'bottom') {
    return (
      <div style={{
        position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0,
        borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
        borderTop: '12px solid #fff', filter: 'drop-shadow(0 1px 0 #E4E4E7)',
      }} />
    );
  }
  return null;
}

// ─── Danielle character ───────────────────────────────────────────────────────

function DanielleChar({ pose, size }: { pose: Pose; size: number }) {
  // Point image shows Danielle gesturing right; she sits bottom-right,
  // so flip horizontally so her finger points toward the UI (up-left).
  const flip = pose === 'point';
  return (
    <div style={{ width: size, height: size, position: 'relative', animation: 'danielleBob 3.4s ease-in-out infinite' }}>
      <div aria-hidden style={{
        position: 'absolute', inset: '8%', borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 55%, rgba(255,232,188,0.75) 0%, rgba(255,232,188,0) 65%)',
        zIndex: 0, pointerEvents: 'none',
      }} />
      <Image
        src={`/danielle-${pose}.png`}
        alt={`Danielle ${pose}`}
        width={size}
        height={size}
        draggable={false}
        style={{
          position: 'relative', zIndex: 1,
          objectFit: 'contain', objectPosition: 'bottom',
          transform: flip ? 'scaleX(-1)' : 'none',
          filter: 'drop-shadow(0 12px 22px rgba(22,32,51,0.22))',
          transition: 'transform 320ms cubic-bezier(0.34,1.56,0.64,1)',
          userSelect: 'none',
        }}
      />
    </div>
  );
}

// ─── FAB (replay button) ──────────────────────────────────────────────────────

function DanielleFABButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      title="Tour with Danielle"
      style={{
        position: 'fixed', right: 20, bottom: 20, zIndex: 60,
        width: 56, height: 56, borderRadius: '50%',
        background: '#fff', border: '1px solid #E4E4E7',
        boxShadow: '0 8px 22px rgba(22,32,51,0.18)',
        cursor: 'pointer', padding: 0, overflow: 'hidden',
        animation: 'danielleFabIdle 4s ease-in-out infinite',
      }}
    >
      <div style={{
        position: 'absolute', top: -6, right: -6, width: 14, height: 14,
        borderRadius: '50%', background: 'var(--brand-cream)', border: '2px solid #fff',
      }} />
      <DanielleChar pose="idle" size={56} />
    </button>
  );
}

// ─── CSS keyframes (injected once via <style> tag) ────────────────────────────

const KEYFRAMES = `
  @keyframes danielleBob {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes danielleFabIdle {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-2px) rotate(-3deg); }
  }
  @keyframes tourFade {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes tourPop {
    0%   { opacity: 0; transform: translateY(8px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
`;
