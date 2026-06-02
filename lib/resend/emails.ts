// lib/resend/emails.ts
// Server-side only. All transactional email functions.

import { getResend, FROM } from './client';

type EmailResult = { ok: true } | { ok: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHour(h: number): string {
  const hour = Math.floor(h);
  const min = Math.round((h - hour) * 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return min > 0
    ? `${display}:${String(min).padStart(2, '0')} ${period}`
    : `${display} ${period}`;
}

interface ScheduleTuple { day: number; start: number; end: number; }

function formatSchedule(schedule: ScheduleTuple[], timezone: string): string {
  return schedule
    .map(s => `${DAYS[s.day]} ${formatHour(s.start)}–${formatHour(s.end)}`)
    .join(', ') + ` (${timezone})`;
}

async function send(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  try {
    const resend = getResend();
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Invite email ──────────────────────────────────────────────────────────────

export async function sendInviteEmail(
  recipientEmail: string,
  recipientName: string,
  actionLink: string,
): Promise<EmailResult> {
  const html = `
<html>
<body style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:8px">Welcome to Simplifi EDU</h2>
  <p>Hi ${recipientName},</p>
  <p>You've been invited to join Simplifi EDU. Click the button below to set up your account:</p>
  <p style="margin:32px 0">
    <a href="${actionLink}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      Accept invitation
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    This link expires in 24 hours. If you didn't expect this invitation, you can ignore this email.
  </p>
  <p style="color:#666;font-size:13px">— The Simplifi EDU team</p>
</body>
</html>`.trim();

  return send({
    to: recipientEmail,
    toName: recipientName,
    subject: "You're invited to Simplifi EDU",
    html,
  });
}

// ── Magic link email (Supabase Auth Hook) ────────────────────────────────────

export async function sendMagicLinkEmail(
  recipientEmail: string,
  actionLink: string,
): Promise<EmailResult> {
  const html = `
<html>
<body style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:8px">Sign in to Simplifi EDU</h2>
  <p>Click the button below to sign in. This link expires in 1 hour.</p>
  <p style="margin:32px 0">
    <a href="${actionLink}"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      Sign in
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    If you didn't request this, you can safely ignore this email.
  </p>
  <p style="color:#666;font-size:13px">— The Simplifi EDU team</p>
</body>
</html>`.trim();

  return send({
    to: recipientEmail,
    subject: 'Your Simplifi EDU sign-in link',
    html,
  });
}

// ── Proposal notification email ───────────────────────────────────────────────

interface ProposalEmailData {
  studentName: string;
  subject: string;
  schedule: ScheduleTuple[];
  timezone: string;
  startDate?: string | null;
  notes?: string | null;
  offeredRate?: number | null;
}

export async function sendProposalEmail(
  tutorEmail: string,
  tutorName: string,
  proposal: ProposalEmailData,
  appUrl: string,
): Promise<EmailResult> {
  const scheduleStr = formatSchedule(proposal.schedule, proposal.timezone);
  const startDateStr = proposal.startDate
    ? `<p><strong>Start date:</strong> ${proposal.startDate}</p>`
    : '';
  const rateStr = proposal.offeredRate
    ? `<p><strong>Rate:</strong> $${proposal.offeredRate}/hr</p>`
    : '';
  const notesStr = proposal.notes
    ? `<p><strong>Notes:</strong></p><p style="white-space:pre-wrap;color:#444">${proposal.notes}</p>`
    : '';

  const html = `
<html>
<body style="font-family:sans-serif;color:#111;max-width:560px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:8px">New client proposal</h2>
  <p>Hi ${tutorName},</p>
  <p>A coordinator has sent you a new tutoring proposal. Here are the details:</p>
  <div style="background:#f5f5f5;border-radius:8px;padding:16px 20px;margin:24px 0">
    <p><strong>Student:</strong> ${proposal.studentName}</p>
    <p><strong>Subject:</strong> ${proposal.subject}</p>
    <p><strong>Schedule:</strong> ${scheduleStr}</p>
    ${startDateStr}
    ${rateStr}
    ${notesStr}
  </div>
  <p style="margin:32px 0">
    <a href="${appUrl}/tutor/proposals"
       style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">
      View proposal
    </a>
  </p>
  <p style="color:#666;font-size:13px">
    Log in to accept or decline. The proposal will expire if not acted on.
  </p>
  <p style="color:#666;font-size:13px">— The Simplifi EDU team</p>
</body>
</html>`.trim();

  return send({
    to: tutorEmail,
    toName: tutorName,
    subject: `New tutoring proposal — ${proposal.studentName} (${proposal.subject})`,
    html,
  });
}
