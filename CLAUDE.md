# CLAUDE.md — Simplifi EDU Tutor Scheduling System

## Project Overview

This project is a scheduling system for **Simplifi EDU**, an online tutoring company. It is built around **Nylas Scheduler** as the scheduling brain, **Supabase** as a thin user directory, a **Claude Skill** for coordinator workflows, and a **Next.js app** as the tutor self-service dashboard.

> **Note on scope evolution:** The original V1 spec described the tutor hub as a single static HTML page. The project has since evolved into a full Next.js prototype with a rich tutor dashboard (calendar, proposals, subjects, settings). The static-HTML and no-framework constraints no longer apply. What remains constant is the core principle below.

The two user roles, and how they interact with the system:

- **Coordinators** use Claude. They run commands (`/invite`, `/book`, `/available`) to invite new people, query availability, and book sessions on tutors' calendars.
- **Tutors** do **not** use Claude. They interact with the system through the Next.js tutor dashboard.

The design principle driving this architecture: **don't rebuild what Nylas already provides.** Nylas Scheduler already handles calendar OAuth, working hours, day overrides, break duration, max meetings per day, availability computation, and public booking pages. Our job is to orchestrate Nylas, not replace it. Any settings the tutor configures in our UI that affect scheduling (working hours, breaks, max meetings, availability windows) **must sync to Nylas** — the UI can display and edit these values, but Nylas is the source of truth.

---

## System Components

```
┌──────────────────────┐        ┌──────────────────────┐
│  Claude Skill        │        │  Tutor Dashboard     │
│  (coordinator-facing)│        │  (Next.js app)       │
│                      │        │                      │
│  /invite /book       │        │  Magic-link login    │
│  /available          │        │  Calendar, proposals │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           │        ┌──────────────┐       │
           └───────▶│   Supabase   │◀──────┘
                    │              │
                    │  users table │
                    │  Supabase    │
                    │  Auth        │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │    Nylas     │
                    │              │
                    │  Scheduler   │
                    │  Events API  │
                    │  Hosted Auth │
                    └──────────────┘
```

### 1. Claude Skill (coordinator tool)
A skill folder loaded into Claude. Coordinators invoke it through `/invite`, `/book`, and `/available`. The skill reads/writes Supabase to resolve users and their Nylas identifiers, and calls Nylas APIs for everything scheduling-related.

### 2. Tutor Dashboard (tutor self-service)
A Next.js app that tutors log into via magic link. It provides a full self-service dashboard: calendar view, incoming proposals, subjects, and settings. Settings that affect scheduling (working hours, breaks, availability) are displayed and editable in the UI but must be synced to Nylas — Nylas remains the authoritative source for all scheduling state.

### 3. Supabase (shared data + auth)
The single source of truth for *who* the users are. Stores user records and handles magic-link auth for the tutor hub page. Contains no scheduling state — no working hours, no overrides, no event cache. All scheduling state lives in Nylas.

### 4. Nylas (scheduling brain)
Owns: calendar OAuth, Scheduler configuration (working hours, day overrides, break duration, max meetings per day), availability computation, public booking pages, and event creation. The tutor configures all scheduling preferences directly in Nylas Scheduler's hosted UI.

---

## Scope — V1

V1 delivers three Claude commands and a minimal tutor hub page.

### `/invite`
Invites a new tutor or coordinator to join Simplifi. Inputs: email, role (`TUTOR` or `COORDINATOR`, default `TUTOR`), and optional name.

**Steps:**
1. Caller must be a `COORDINATOR` or `SUPER_ADMIN`. Tutors cannot invite.
2. Insert a row into Supabase `users` with `status = 'PENDING'`, role, email, name.
3. Use **Supabase Auth `inviteUserByEmail()`** to send a magic-link invite email containing a link to the tutor hub page. Supabase handles the email delivery and token lifecycle — we do not build a custom email system.
4. The hub page greets the pending user and walks them through: (a) a Nylas hosted-auth button to connect their calendar, (b) a link to configure their Nylas Scheduler page (created automatically after OAuth completes), (c) a link to copy their public booking page URL.
5. Once OAuth completes, a Supabase Edge Function (or the hub page itself) creates a default Nylas Scheduler config via the Nylas API, stores `nylas_grant_id`, `nylas_scheduler_config_id`, and `booking_page_url` on the user record, and flips `status` to `'ACTIVE'`.

### `/book`
Books a slot on a target user's calendar. Inputs: target email, desired time (specific or "earliest available"), booker name + email, optional title and notes.

**Steps:**
1. Look up the target in Supabase. Refuse if not `ACTIVE`.
2. Call Nylas availability to verify the requested time is open (Nylas applies all the target's Scheduler rules server-side — hours, overrides, break, max-meetings — so we don't re-check them). For "earliest available," ask Nylas for the first open slot in a configurable horizon (default: next 14 days).
3. Present the proposed slot to the coordinator and wait for explicit confirmation.
4. On confirmation, create the event via Nylas Events API with the booker as an attendee (Nylas sends the calendar invite). Default title: `"Tutoring — {booker_name}"`.
5. Report the result plainly. If Nylas refuses the booking (e.g. the slot filled between availability check and create), surface the error verbatim and do not retry silently.

### `/available`
Lists availability for a target user over a date range. Inputs: target email, optional date range (default: next 7 days), optional filter tuples (up to 4 day-of-week + start-time + end-time, OR-matched), optional booker timezone.

**Steps:**
1. Look up the target in Supabase. Refuse if not `ACTIVE`.
2. Call Nylas availability API for the range using the target's `grant_id` and `scheduler_config_id`. Nylas returns open slots honoring all of the tutor's preferences.
3. If tuple filters are provided, intersect Nylas' open slots with the tuples (this is the only scheduling computation we do on our side — a simple set intersection, not a reimplementation of Nylas' rules).
4. Convert times to the booker's timezone if provided, otherwise the target's timezone. Always display timezone abbreviation.
5. Render grouped by day. If nothing is available, say so and suggest the next date Nylas reports openings.

### Tutor Dashboard
A Next.js app (deployed at e.g. `tutors.simplifiedu.com`) that tutors log into via magic link. It includes:

- Calendar view with week/month toggle and incoming proposal review
- Proposals inbox with accept/decline workflows
- Subjects editor
- Settings page (profile, capacity, working hours, notifications, pause)

Settings that affect scheduling (working hours, breaks, max meetings, availability windows) must be written through to Nylas when saved — the dashboard UI can display and edit these values, but all actual scheduling logic and availability computation runs in Nylas. Do not recompute availability or enforce scheduling rules locally; always defer to Nylas APIs for ground truth.

---

## Out of Scope (current)

- Custom availability-computation logic that duplicates Nylas' rules. Display and edit scheduling preferences in the UI, but defer all availability math to the Nylas API.
- Event caching on our side. Every `/available` and `/book` call hits Nylas live.
- Automated reminders, post-booking follow-ups, billing.
- A coordinator web UI. Coordinators only use Claude.

---

## Data Model — Supabase

One table. All timestamps in UTC.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | Supabase Auth user id |
| `email` | text (unique) | Also the lookup key used by the skill |
| `name` | text | Pre-filled from invite |
| `role` | enum: `SUPER_ADMIN` \| `COORDINATOR` \| `TUTOR` | |
| `status` | enum: `PENDING` \| `ACTIVE` \| `DISABLED` | `PENDING` until OAuth completes |
| `timezone` | text (IANA, e.g. `America/New_York`) | Captured during/after OAuth; defaults to Nylas-reported calendar timezone |
| `nylas_grant_id` | text (nullable) | Set after calendar OAuth |
| `nylas_scheduler_config_id` | text (nullable) | Set after the default Scheduler page is created |
| `booking_page_url` | text (nullable) | Public Nylas booking URL |
| `invited_by` | uuid (FK → users.id, nullable) | For audit/role-check trail |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Row-level security (RLS):**
- Tutors can `SELECT` and `UPDATE` only their own row.
- Coordinators can `SELECT` all rows and `INSERT` new rows with `role IN ('TUTOR', 'COORDINATOR')`.
- Super admins can do anything.
- The skill calls Supabase using the service role key server-side (inside the skill's helper scripts), so RLS primarily protects the tutor hub page.

**Explicitly NOT stored here:** working hours, day overrides, break duration, max meetings per day, calendar events. All live in Nylas.

---

## Role Semantics

- **`SUPER_ADMIN`** — Austin Rubinger. Invites the first coordinator(s). Can invite or manage anyone. Can run any command against any target.
- **`COORDINATOR`** — Invited by a super admin (or another coordinator). Can invite tutors and coordinators. Can run `/available` and `/book` against any tutor or coordinator. Is also bookable themselves.
- **`TUTOR`** — Invited by a coordinator. Does not use Claude. Logs into the tutor hub page to reconnect calendars or edit their Nylas Scheduler config. Cannot be used as a booker *of* anyone else.

Role checks happen server-side in the skill's helpers before every action. The skill identifies the caller via the `SIMPLIFI_CALLER_EMAIL` environment variable (V1 auth shim — replaced with proper auth later).

---

## Nylas Integration

- **Hosted Auth:** Used for calendar OAuth. Redirects back to a callback endpoint (a Supabase Edge Function) that exchanges the code for a `grant_id` and writes it to the user row.
- **Scheduler Config:** Created automatically on first successful OAuth with sensible defaults (Mon–Fri 9am–5pm in the tutor's calendar timezone, 15-min break, max 6/day). The tutor then edits this via the Nylas-hosted editor URL, accessed from the hub page.
- **Availability API:** Called by `/available` and `/book`. Nylas returns pre-filtered open slots honoring the tutor's Scheduler rules.
- **Events API:** Called by `/book` to create events. Attendees are passed in the payload; Nylas sends the calendar invite.
- **Webhooks:** Not required for V1 — everything is on-demand. V2 may add webhooks if event-cache or real-time sync becomes useful.

All Nylas credentials (`NYLAS_API_KEY`, `NYLAS_CLIENT_ID`, `NYLAS_CLIENT_SECRET`) live server-side only — in the skill's helpers and Supabase Edge Functions. Never in the hub page's client-side code.

---

## Skill Folder Structure

```
/simplifi-scheduler
  SKILL.md                  → Main instructions Claude loads
  README.md                 → Human-facing readme (setup, env vars)
  /scripts
    nylas.py                → Thin Python wrapper over the Nylas REST API
    supabase.py             → Thin Python wrapper over the Supabase REST API
    commands/
      invite.py
      book.py
      available.py
  /reference
    nylas-api-cheatsheet.md → Quick reference for Nylas endpoints we use
    commands.md             → Command specs with examples
```

And, separately:

```
/tutor-hub
  index.html                → The single-page tutor hub
  app.js                    → Small script: Supabase login, render state, link-outs
  style.css                 → Minimal styling
```

The tutor hub is deployed as static files (Netlify, Vercel static, GitHub Pages — any will do). No server, no framework.

---

## Coding Standards

- **Python 3.11+** for the skill's helpers. Use `requests` for HTTP, `zoneinfo` for timezones.
- **Each helper script is focused** — `nylas.py` only talks to Nylas, `supabase.py` only talks to Supabase, and each command lives in its own file under `commands/`.
- **No secrets in code.** Read from `os.environ` only.
- **Nylas errors are surfaced verbatim** to Claude so the coordinator sees why something failed. Never expose the `grant_id` or API key in those surfaces.
- **Tutor dashboard is a Next.js app** — React components, TypeScript, Tailwind. Standard Next.js App Router patterns apply.

---

## Environment Variables

```
# Nylas (server-side only — used by the skill and Supabase Edge Functions)
NYLAS_API_KEY=
NYLAS_CLIENT_ID=
NYLAS_CLIENT_SECRET=

# Supabase (skill uses service role; hub page uses anon key)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Skill runtime
SIMPLIFI_CALLER_EMAIL=      # email of the coordinator currently invoking the skill (V1 auth shim)
```

`SUPABASE_ANON_KEY` is the only key safe to embed in the tutor hub page. Everything else is server-side.

---

## What to Avoid

- Don't recompute availability or enforce scheduling rules locally — always use the Nylas API. The dashboard UI may display and edit scheduling settings, but Nylas is the source of truth; any edits must be synced to Nylas.
- Don't store scheduling state in Supabase. Supabase is a user directory, not a scheduling database.
- Don't expose Nylas credentials or `grant_id`s to any client-side code.
- Don't swallow Nylas errors silently — surface them to the coordinator.
- Don't add new Python dependencies without flagging them first.

---

## Open Questions

1. **Caller identity in V1.** Is `SIMPLIFI_CALLER_EMAIL` as an env-var shim acceptable, or do you want the skill to read the coordinator's identity from a more secure source (e.g. a signed token baked into the skill's config)?
2. **Nylas Scheduler edit-link authentication.** Confirm with Nylas docs that the tutor can edit their Scheduler config via a direct URL from the hub page — either by being the OAuth'd user or via a hosted management link. If not, we may need a tiny backend to generate short-lived edit tokens.
3. **OAuth callback host.** Nylas hosted auth needs a redirect URL. A Supabase Edge Function is the natural home (same stack, already auth'd to write the `users` table). Confirm that's acceptable vs. hosting a tiny Cloudflare Worker or similar.
4. **`/book` title defaulting.** Currently specced as `"Tutoring — {booker_name}"` when not provided. Is that the right default, or should it include coordinator/tutor names?
5. **Coordinator bookability.** Can a coordinator be `/book`'d like a tutor, or is `/book` tutor-only? The spec currently allows both.

---

## Notes

- Austin Rubinger (austin@simplifiedu.com) is the developer/owner of this project.
- This is deliberately an MVP. The guiding principle: **if Nylas or Supabase can do it, let them.** Our code only exists to orchestrate the two.
- V2 candidates, in rough priority order: subject-based filtering, multi-tutor availability queries ("who's free Tuesday?"), webhook-driven event caching, coordinator directory page, automated booking follow-ups.
