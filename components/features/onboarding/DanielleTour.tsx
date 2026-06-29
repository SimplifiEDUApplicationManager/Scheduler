'use client';

// Danielle — animated onboarding tour for new tutors.
//
// Mounts in the tutor layout so it persists across route changes.
// Auto-shows on first visit (localStorage key "sim_intro_seen" !== "1").
// Navigates between /tutor/calendar, /tutor/proposals, /tutor/settings
// via next/navigation router.
//
// Target elements are marked with data-tour="<key>" attributes.

import { useState, useEffect, useRef } from 'react';
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
  waitForEvent?: boolean; // hide the Next button — step only advances via a window event
}

interface Spot { x: number; y: number; w: number; h: number }

// ─── Tour steps (adapted to the real 3-tab tutor UI) ─────────────────────────

const STEPS: Step[] = [
  {
    key: 'welcome',
    pose: 'wave',
    title: "Hi, I'm Danielle 👋",
    body: "Welcome to Simplifi EDU! In this quick tour, we'll walk through the three pages on your account — Calendar, Proposals, and Settings. Let's start with your Calendar.",
    cta: 'Start the tour',
    placement: 'center',
  },
  // ── Calendar page ──────────────────────────────────────────────────────
  {
    key: 'cal-grid',
    path: '/tutor/calendar',
    target: '[data-tour="tutor-calendar-grid"]',
    pose: 'point',
    title: 'Your calendar',
    body: "This is where you'll see all your tutoring sessions. I've placed some sample sessions so you can see what it looks like once you're up and running. Each teal block is a confirmed session with a student.",
    cta: 'Next',
  },
  {
    key: 'cal-capacity',
    target: '[data-tour="tutor-capacity"]',
    pose: 'point',
    title: 'Weekly capacity',
    body: "This shows how many hours you've booked this week out of your maximum. Coordinators use this to know how much room you have for new students. You can adjust your max hours in Settings anytime.",
    cta: 'Next',
  },
  {
    key: 'cal-response',
    target: '[data-tour="tutor-response-time"]',
    pose: 'point',
    title: 'Response time & rank',
    body: "This tracks how quickly you respond to proposals. Faster responses earn a higher rank — coordinators see this when deciding who to send a student to. Respond within 24 hours or the proposal expires automatically.",
    cta: 'Next',
  },
  // ── Proposals page ─────────────────────────────────────────────────────
  {
    key: 'prop-tab',
    path: '/tutor/proposals',
    target: '[data-tour="proposals-filters"]',
    pose: 'point',
    title: 'Proposals',
    body: "This is your inbox for student matches. Use the filter tabs to see proposals by status — \"Needs response\" for ones waiting on you, \"Awaiting client\" for ones the family is reviewing, and more.",
    cta: 'Next',
  },
  {
    key: 'prop-practice-intro',
    path: '/tutor/proposals',
    pose: 'wave',
    title: 'Try it out!',
    body: "I've added a sample proposal — Alex Chen — to your inbox. Click \"Review\" on the row to open it, then walk through the accept flow — pick a time slot and confirm.",
    cta: "Let's go",
    placement: 'center',
  },
  {
    key: 'prop-practice-wait',
    path: '/tutor/proposals',
    target: '[data-tour="proposals-first-row"]',
    pose: 'point',
    title: 'Accept Alex Chen\'s proposal',
    body: "Click \"Review\" on the Alex Chen row, then accept and schedule the session. I'll advance automatically once you've completed the accept flow.",
    cta: 'Next',
    waitForEvent: true,
  },
  {
    key: 'prop-practice-done',
    pose: 'wave',
    title: 'Nice work! 🎉',
    body: "You just accepted your first proposal! In a real scenario, the student's family would be notified and the session would appear on your calendar. Let's continue to Settings.",
    cta: 'Continue',
  },
  // ── Settings page ──────────────────────────────────────────────────────
  {
    key: 'set-tab',
    path: '/tutor/settings',
    target: '[data-tour="tab-Settings"]',
    pose: 'point',
    title: 'Settings',
    body: "This is where you manage your profile, capacity, subjects, working hours, and calendar connection. Changes save automatically.",
    cta: 'Next',
  },
  {
    key: 'set-subjects',
    target: '[data-tour="settings-subjects"]',
    pose: 'point',
    title: 'Your subjects',
    body: "Add the subjects you teach and rate your confidence level. Coordinators use this to match you with the right students.",
    cta: 'Next',
  },
  {
    key: 'finish',
    pose: 'wave',
    title: "You're all set! 🎉",
    body: "That's everything you need to know. I'll stay tucked in the bottom corner — tap me anytime to replay this tour. Happy tutoring!",
    cta: 'Start tutoring',
    placement: 'center',
  },
];

// Walk backwards from stepIdx to find the nearest step that declared a path.
// This lets back-navigation route correctly even for steps that don't set path.
function effectivePath(stepIdx: number): string | undefined {
  for (let i = stepIdx; i >= 0; i--) {
    if (STEPS[i]?.path) return STEPS[i]!.path;
  }
  return undefined;
}

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
    // If replay() triggered a hard reload, start the tour automatically.
    const replayPending = localStorage.getItem('sim_tour_replay') === '1';
    if (replayPending) {
      localStorage.removeItem('sim_tour_replay');
      setSeen(true);
      setOpen(true);
      window.dispatchEvent(new CustomEvent('sim:tour-start'));
      return;
    }

    const alreadySeen = localStorage.getItem('sim_intro_seen') === '1';
    setSeen(alreadySeen);
    if (!alreadySeen) {
      setOpen(true);
      window.dispatchEvent(new CustomEvent('sim:tour-start'));
    } else {
      // Tour was already completed — sync the server-side cookie so the server
      // knows not to inject the demo proposal on this and future page loads.
      document.cookie = 'sim_tour_done=1;path=/;max-age=31536000;SameSite=Lax';
    }
  }, []);

  // ── Ensure demo proposal is visible when entering practice steps ─────────
  // router.push may serve a cached render of /tutor/proposals without Alex
  // Chen, so we fire sim:inject-demo at the client level. ProposalsClient
  // adds the demo to its local state if it's not already present.
  useEffect(() => {
    if (!open) return;
    const key = STEPS[step]?.key;
    if (key === 'prop-practice-intro' || key === 'prop-practice-wait') {
      window.dispatchEvent(new CustomEvent('sim:inject-demo'));
    }
  }, [step, open]);

  // ── Auto-advance past prop-practice-wait when the tutor accepts the demo ──
  const demoAccepted = useRef(false);
  useEffect(() => {
    if (!open || STEPS[step]?.key !== 'prop-practice-wait') return;
    // If they already accepted (e.g., navigated back), skip immediately
    if (demoAccepted.current) { setSpot(null); setStep(s => s + 1); return; }
    const handler = () => { demoAccepted.current = true; setSpot(null); setStep(s => s + 1); };
    window.addEventListener('sim:demo-accepted', handler);
    return () => window.removeEventListener('sim:demo-accepted', handler);
  }, [step, open]);

  // ── Measure target element whenever step or pathname changes ──────────────
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s) return;

    setPose(s.pose);

    // Navigate to the correct page for this step — walk backwards to find the
    // nearest step that declared a path (fixes back-navigation across routes).
    const targetPath = effectivePath(step);
    if (targetPath && pathname !== targetPath) {
      router.push(targetPath);
      return;
    }

    if (!s.target) { setSpot(null); return; }

    // Retry until the element is in the DOM (tab transitions mount async).
    let cancelled = false;
    let attempts  = 0;
    let scrolled  = false;
    let ro: ResizeObserver | null = null;

    const snap = (el: HTMLElement) => {
      if (cancelled) return;
      const r = el.getBoundingClientRect();
      setSpot({ x: r.left, y: r.top, w: r.width, h: r.height });
    };

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
        // Use instant scroll so the position is stable on the very next frame —
        // smooth scroll + a hardcoded delay races against variable-height sections.
        try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch { /* noop */ }
        requestAnimationFrame(() => snap(el));
        // Watch for height changes (e.g. subjects list expanding) and re-snap.
        if (typeof ResizeObserver !== 'undefined') {
          ro = new ResizeObserver(() => snap(el));
          ro.observe(el);
        }
        return;
      }
      snap(el);
    };

    // Re-snap on any scroll — capture phase catches inner overflow containers
    // (the settings page scrolls via an inner div, not window).
    const onScroll = () => {
      const el = document.querySelector<HTMLElement>(s.target!);
      if (el) snap(el);
    };

    const t = setTimeout(measure, 30);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll, true);
      ro?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pathname, open]);

  function close() {
    setOpen(false);
    localStorage.setItem('sim_intro_seen', '1');
    document.cookie = 'sim_tour_done=1;path=/;max-age=31536000;SameSite=Lax';
    document.cookie = 'sim_tour_replay=;path=/;max-age=0;SameSite=Lax';
    setSeen(true);
    window.dispatchEvent(new CustomEvent('sim:tour-stop'));
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
    // Hard-reload to the calendar page (where the tour begins) so the mount
    // useEffect picks up the localStorage flag and auto-starts the tour.
    // Demo proposal injection is handled client-side via sim:inject-demo, so
    // we no longer need to hard-reload /tutor/proposals for a fresh server render.
    document.cookie = 'sim_tour_replay=1;path=/;SameSite=Lax';
    localStorage.setItem('sim_tour_replay', '1');
    window.location.href = '/tutor/calendar';
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
          canSkip={seen}
          ctaLabel={current.cta}
          hideCta={!!current.waitForEvent}
          onNext={next}
          onBack={back}
          onSkip={close}
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
        pointerEvents: 'none',
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

function SpeechBubble({ title, body, tail, step, total, canBack, canSkip, ctaLabel, hideCta, onNext, onBack, onSkip }: {
  title: string; body: string; tail: 'bottom' | 'right' | 'none';
  step: number; total: number; canBack: boolean; canSkip: boolean; ctaLabel: string; hideCta: boolean;
  onNext: () => void; onBack: () => void; onSkip: () => void;
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {canSkip ? (
          <button onClick={onSkip} style={{ height: 36, padding: '0 10px', background: 'none', border: 'none', fontSize: 12, color: '#A1A1AA', cursor: 'pointer', fontFamily: 'inherit' }}>
            Skip tour
          </button>
        ) : <div />}
        <div style={{ display: 'flex', gap: 8 }}>
          {canBack && (
            <button onClick={onBack} style={{ height: 36, padding: '0 14px', borderRadius: 9, background: '#fff', color: '#3F3F46', border: '1px solid #E4E4E7', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {!hideCta && (
            <button onClick={onNext} style={{ height: 36, padding: '0 18px', borderRadius: 9, background: 'var(--brand-teal-600)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 4px 12px rgba(43,114,101,0.30)' }}>
              {ctaLabel} →
            </button>
          )}
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
