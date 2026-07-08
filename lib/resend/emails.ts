// lib/resend/emails.ts
// Server-side only. All transactional email functions.

import { formatInTimeZone } from 'date-fns-tz';
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

/**
 * Wrap `content` in the Simplifi EDU branded email shell.
 * Matches the web app's color palette: #18181B text, #2B7265 teal accent,
 * #E4E4E7 borders, #FAFAFA background.
 */
function brandedHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181B;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FAFAFA;padding:40px 0 56px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;margin:0 auto">

          <!-- Logo / wordmark -->
          <tr>
            <td style="padding:0 0 24px">
              <span style="font-size:17px;font-weight:800;color:#18181B;letter-spacing:-0.015em">Simplifi EDU</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #E4E4E7;border-radius:12px;overflow:hidden">
              <!-- Teal accent bar -->
              <div style="height:3px;background:#2B7265;line-height:3px;font-size:3px">&nbsp;</div>
              <!-- Card body -->
              <div style="padding:28px 32px 32px">
                ${content}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center">
              <p style="font-size:11px;color:#A1A1AA;margin:0;line-height:1.5">
                Simplifi EDU &middot; You&rsquo;re receiving this because you&rsquo;re a tutor on our platform.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#18181B;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:-0.01em">${label}</a>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;font-weight:600;color:#71717A;white-space:nowrap;vertical-align:top;padding-right:16px">${label}</td>
    <td style="padding:6px 0;font-size:13px;color:#18181B;vertical-align:top">${value}</td>
  </tr>`;
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
  const content = `
<h2 style="font-size:20px;font-weight:800;margin:0 0 16px;letter-spacing:-0.015em">Welcome to Simplifi EDU</h2>
<p style="font-size:14px;color:#52525B;margin:0 0 8px;line-height:1.6">Hi ${recipientName},</p>
<p style="font-size:14px;color:#52525B;margin:0 0 24px;line-height:1.6">You've been invited to join Simplifi EDU as a tutor. Click below to set up your account and connect your calendar.</p>
<p style="margin:0 0 28px">${ctaButton(actionLink, 'Accept invitation')}</p>
<p style="font-size:12px;color:#A1A1AA;margin:0;line-height:1.6">This link expires in 24 hours. If you didn't expect this invitation, you can safely ignore this email.</p>
`;

  return send({
    to: recipientEmail,
    toName: recipientName,
    subject: "You're invited to Simplifi EDU",
    html: brandedHtml(content),
  });
}

// ── Magic link email (Supabase Auth Hook) ────────────────────────────────────

export async function sendMagicLinkEmail(
  recipientEmail: string,
  actionLink: string,
): Promise<EmailResult> {
  const content = `
<h2 style="font-size:20px;font-weight:800;margin:0 0 16px;letter-spacing:-0.015em">Sign in to Simplifi EDU</h2>
<p style="font-size:14px;color:#52525B;margin:0 0 24px;line-height:1.6">Click the button below to sign in. This link expires in 1 hour.</p>
<p style="margin:0 0 28px">${ctaButton(actionLink, 'Sign in')}</p>
<p style="font-size:12px;color:#A1A1AA;margin:0;line-height:1.6">If you didn't request this, you can safely ignore this email.</p>
`;

  return send({
    to: recipientEmail,
    subject: 'Your Simplifi EDU sign-in link',
    html: brandedHtml(content),
  });
}

// ── Password reset email (Supabase Auth Hook — recovery) ─────────────────────

export async function sendPasswordResetEmail(
  recipientEmail: string,
  actionLink: string,
): Promise<EmailResult> {
  const content = `
<h2 style="font-size:20px;font-weight:800;margin:0 0 16px;letter-spacing:-0.015em">Reset your password</h2>
<p style="font-size:14px;color:#52525B;margin:0 0 24px;line-height:1.6">We received a request to reset the password for your Simplifi EDU account. Click below to choose a new password.</p>
<p style="margin:0 0 28px">${ctaButton(actionLink, 'Reset password')}</p>
<p style="font-size:12px;color:#A1A1AA;margin:0;line-height:1.6">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
`;

  return send({
    to: recipientEmail,
    subject: 'Reset your Simplifi EDU password',
    html: brandedHtml(content),
  });
}

// ── Proposal updated email ───────────────────────────────────────────────────

export async function sendProposalUpdatedEmail(
  recipientEmail: string,
  recipientName: string,
  studentName: string,
  subject: string,
  appUrl: string,
): Promise<EmailResult> {
  const content = `
<h2 style="font-size:20px;font-weight:800;margin:0 0 16px;letter-spacing:-0.015em">Proposal updated</h2>
<p style="font-size:14px;color:#52525B;margin:0 0 8px;line-height:1.6">Hi ${recipientName},</p>
<p style="font-size:14px;color:#52525B;margin:0 0 24px;line-height:1.6">The proposal for <strong>${studentName}</strong> — ${subject} has been updated by your coordinator. Please review the changes and respond within 24 hours.</p>
<p style="margin:0 0 28px">${ctaButton(`${appUrl}/tutor/proposals`, 'Review updated proposal')}</p>
<p style="font-size:12px;color:#A1A1AA;margin:0;line-height:1.6">If you don't respond within 24 hours, this proposal will expire automatically.</p>
`;

  return send({
    to: recipientEmail,
    toName: recipientName,
    subject: `Proposal updated — ${studentName} · ${subject}`,
    html: brandedHtml(content),
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
  coordinatorName: string,
  proposal: ProposalEmailData,
  appUrl: string,
): Promise<EmailResult> {
  const scheduleStr = formatSchedule(proposal.schedule, proposal.timezone);

  const rows = [
    detailRow('Student', proposal.studentName),
    detailRow('Subject', proposal.subject),
    detailRow('Schedule', scheduleStr),
    ...(proposal.startDate ? [detailRow('Start date', proposal.startDate)] : []),
    ...(proposal.offeredRate ? [detailRow('Rate', `$${proposal.offeredRate}/hr`)] : []),
  ].join('');

  const notesBlock = proposal.notes
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px solid #F4F4F5">
        <div style="font-size:12px;font-weight:600;color:#71717A;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Notes</div>
        <p style="font-size:13px;color:#3F3F46;margin:0;line-height:1.6;white-space:pre-wrap">${proposal.notes}</p>
       </div>`
    : '';

  const content = `
<h2 style="font-size:20px;font-weight:800;margin:0 0 16px;letter-spacing:-0.015em">New tutoring proposal</h2>
<p style="font-size:14px;color:#52525B;margin:0 0 6px;line-height:1.6">Hi ${tutorName}, it&rsquo;s ${coordinatorName}.</p>
<p style="font-size:14px;color:#52525B;margin:0 0 24px;line-height:1.6">I've sent you a new tutoring proposal. Here are the details:</p>
<div style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:10px;padding:16px 20px;margin-bottom:24px">
  <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
    ${rows}
  </table>
  ${notesBlock}
</div>
<p style="margin:0 0 24px">${ctaButton(`${appUrl}/tutor/proposals`, 'View proposal')}</p>
<p style="font-size:12px;color:#A1A1AA;margin:0;line-height:1.6">Log in to accept or decline. The proposal will expire if not acted on within 48 hours.</p>
`;

  return send({
    to: tutorEmail,
    toName: tutorName,
    subject: `New proposal — ${proposal.studentName} · ${proposal.subject}`,
    html: brandedHtml(content),
  });
}

// ── Weekly summary email ──────────────────────────────────────────────────────

export interface WeeklySession {
  /** Display title — e.g. "John Smith · Algebra II" or raw event title */
  title: string;
  startTimeSec: number;
  endTimeSec: number;
}

interface WeeklySummaryData {
  hoursThisWeek: number;
  maxWeeklyHours: number;
  upcomingCount: number;
  proposalsPending: number;
  /** Sessions for the upcoming Mon–Sun to render in the week grid. */
  weekSessions: WeeklySession[];
  /** Monday 00:00:00 UTC (ms) of the upcoming week. */
  weekStartMs: number;
  tutorTimezone: string;
}

// ── Week calendar renderer ────────────────────────────────────────────────────

const DAY_ABBR = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function renderWeekCalendar(
  sessions: WeeklySession[],
  weekStartMs: number,
  tz: string,
): string {
  // Group sessions by day-of-week in the tutor's timezone (0=Mon … 6=Sun).
  // 'e' from date-fns-tz: 1=Mon … 7=Sun (ISO), so subtract 1 to get 0-indexed.
  const byDay: WeeklySession[][] = Array.from({ length: 7 }, () => []);
  for (const s of sessions) {
    const dow = parseInt(formatInTimeZone(new Date(s.startTimeSec * 1000), tz, 'e'), 10) - 1;
    if (dow >= 0 && dow < 7) byDay[dow].push(s);
  }

  // Header row: day abbreviation + date
  const headers = DAY_ABBR.map((abbr, i) => {
    // Use noon UTC (+12 h) so formatting in any UTC±12 timezone still shows the correct local date.
    const dayMs = weekStartMs + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000;
    const dateLabel = formatInTimeZone(new Date(dayMs), tz, 'M/d');
    return `<td width="14%" style="padding:0 2px 6px;text-align:center;vertical-align:top">
      <div style="font-size:9px;font-weight:700;color:#A1A1AA;letter-spacing:0.06em">${abbr}</div>
      <div style="font-size:11px;font-weight:600;color:#52525B;margin-top:1px">${dateLabel}</div>
    </td>`;
  }).join('');

  // Cell row: sessions or free
  const cells = byDay.map((daySessions) => {
    if (daySessions.length === 0) {
      return `<td width="14%" style="padding:0 2px">
        <div style="background:#FAFAFA;border:1px solid #F4F4F5;border-radius:6px;padding:8px 6px;min-height:40px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:10px;color:#D4D4D8">&mdash;</span>
        </div>
      </td>`;
    }
    const items = daySessions.map(s => {
      const start = formatInTimeZone(new Date(s.startTimeSec * 1000), tz, 'h:mm a');
      const end   = formatInTimeZone(new Date(s.endTimeSec   * 1000), tz, 'h:mm a');
      // Trim title to keep cells compact: use first segment before " · " if present
      const shortTitle = s.title.split(' · ')[0] ?? s.title;
      return `<div style="background:#EEF9F6;border-left:2px solid #2B7265;border-radius:4px;padding:4px 5px;margin-bottom:3px">
        <div style="font-size:10px;font-weight:700;color:#18181B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${shortTitle}</div>
        <div style="font-size:9px;color:#2B7265;margin-top:1px;white-space:nowrap">${start}–${end}</div>
      </div>`;
    }).join('');
    return `<td width="14%" style="padding:0 2px;vertical-align:top">
      <div style="background:#FAFAFA;border:1px solid #F4F4F5;border-radius:6px;padding:5px 4px">
        ${items}
      </div>
    </td>`;
  }).join('');

  return `
<div style="margin-bottom:24px">
  <div style="font-size:11px;font-weight:700;color:#52525B;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Upcoming week</div>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>${headers}</tr>
    <tr>${cells}</tr>
  </table>
</div>`;
}

export async function sendWeeklySummaryEmail(
  tutorEmail: string,
  tutorName: string,
  data: WeeklySummaryData,
  appUrl: string,
): Promise<EmailResult> {
  const pct = data.maxWeeklyHours > 0
    ? Math.round((data.hoursThisWeek / data.maxWeeklyHours) * 100)
    : 0;

  const pendingLine = data.proposalsPending > 0
    ? `<tr><td style="padding:6px 0;font-size:12px;font-weight:600;color:#71717A;white-space:nowrap;padding-right:16px">Proposals pending</td><td style="padding:6px 0;font-size:13px;color:#18181B;font-weight:600">${data.proposalsPending}</td></tr>`
    : '';

  const calendarBlock = data.weekSessions.length > 0
    ? renderWeekCalendar(data.weekSessions, data.weekStartMs, data.tutorTimezone)
    : '';

  const content = `
<h2 style="font-size:20px;font-weight:800;margin:0 0 6px;letter-spacing:-0.015em">Your weekly summary</h2>
<p style="font-size:14px;color:#52525B;margin:0 0 20px;line-height:1.6">Hi ${tutorName}, here&rsquo;s a quick look at your week.</p>
${calendarBlock}
<div style="background:#FAFAFA;border:1px solid #E4E4E7;border-radius:10px;padding:16px 20px;margin-bottom:24px">
  <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
    <tr>
      <td style="padding:6px 0;font-size:12px;font-weight:600;color:#71717A;white-space:nowrap;padding-right:16px">Hours this week</td>
      <td style="padding:6px 0;font-size:13px;color:#18181B;font-weight:600">${data.hoursThisWeek} of ${data.maxWeeklyHours} hrs (${pct}%)</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:12px;font-weight:600;color:#71717A;white-space:nowrap;padding-right:16px">Upcoming sessions</td>
      <td style="padding:6px 0;font-size:13px;color:#18181B;font-weight:600">${data.upcomingCount}</td>
    </tr>
    ${pendingLine}
  </table>
</div>
<p style="margin:0 0 24px">${ctaButton(`${appUrl}/tutor/calendar`, 'View your calendar')}</p>
<p style="font-size:12px;color:#A1A1AA;margin:0;line-height:1.6">This summary is sent every Sunday evening. Head to your calendar for the full picture.</p>
`;

  return send({
    to: tutorEmail,
    toName: tutorName,
    subject: `Your Simplifi EDU weekly summary`,
    html: brandedHtml(content),
  });
}
