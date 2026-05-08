# CLAUDE.md — Simplifi EDU Tutor Scheduling Platform (V2)

## Project Overview

This is the tutor scheduling platform for **Simplifi EDU**, an online tutoring company. It replaces the V1 MVP (minimal skill + static hub page) with a full-featured web application, expanded Claude skills, and Asana integration.

The platform serves three audiences through two interfaces:

- **Tutors** use the **web app** to manage their calendar, set working hours, edit their subject list, receive proposed client assignments, and view their schedule.
- **Coordinators** use both the **web app** (for filtering, calendar views, Asana requests, and tutor management) and **Claude Cowork skills** (for quick queries, invites, proposals, blocking, and AI-assisted filtering).
- **Super Admins** have full access to everything plus user management.

The design principles:

1. **Don't rebuild what Nylas provides.** Tutor scheduling preferences (working hours, exceptions, break duration, capacity) are configured via Nylas Scheduler's hosted config page. We build a custom calendar *view*, but Nylas owns the scheduling *logic*.
2. **Asana is the source of tutoring requests.** Coordinators connect their Asana project; new requests flow into the coordinator dashboard automatically.
3. **Claude skills are power-user shortcuts**, not the only interface. Everything a skill can do, the web app can also do. Skills exist because coordinators are faster in Claude for repetitive tasks.
4. **Form before function.** UI prototypes and visual design inform the implementation, not the other way around. The tutor experience must feel like a real product, not a developer tool.
5. **Code stability over speed.** Modular architecture, tested code, no monoliths. Adding a feature should never require rebuilding from scratch.

---

## System Architecture

```
┌─────────────────────────────────┐     ┌──────────────────────────┐
│  Next.js Web App                │     │  Claude Cowork Skills    │
│                                 │     │                          │
│  Tutor Dashboard                │     │  /invite  /available     │
│  Coordinator Dashboard          │     │  /propose /block         │
│  Super Admin Panel              │     │  /filter                 │
└──────────┬──────────────────────┘     └────────────┬─────────────┘
           │                                         │
           ▼                                         ▼
    ┌──────────────┐         ┌──────────────┐  ┌──────────────┐
    │   Supabase   │◀────────│   Nylas      │  │   Asana      │
    │              │         │              │  │              │
    │  Users       │         │  Calendar    │  │  Tutoring    │
    │  Subjects    │         │  Scheduler   │  │  requests    │
    │  Proposals   │         │  Events API  │  │              │
    │  Tutor       │         │  Hosted Auth │  │              │
    │  Context     │         │  Hosted      │  │              │
    │  Holds       │         │  Config      │  │              │
    └──────────────┘         └──────────────┘  └──────────────┘
```

---

## Tech Stack

- **Frontend:** React / Next.js (App Router)
- **Styling:** Tailwind CSS
- **Language:** TypeScript throughout — no plain JavaScript files
- **Backend:** Next.js API routes (no separate backend service)
- **Database:** Supabase (PostgreSQL) with row-level security
- **Auth:** Supabase Auth — magic links for tutors, email/password optional for coordinators
- **Deployment:** Vercel — deploy from GitHub
- **External integrations:**
  - **Nylas API** — calendar sync, Scheduler hosted config, availability, events
  - **Asana API** — tutoring request ingestion (+ MCP for Claude skills)

---

## User Roles

### `SUPER_ADMIN` — Austin Rubinger
Full access to everything. Can invite coordinators, manage all tutors, and access admin-only settings.

### `COORDINATOR`
Invited by super admin or another coordinator. Uses both the web app and Claude skills. Can:
- View and filter all tutors by availability and subject
- View shared calendar with all tutor availabilities
- Invite new tutors
- Edit tutor subject lists and grade confidence levels
- Connect Asana project and view incoming tutoring requests
- Propose clients to tutors
- Block/hold time on tutor calendars
- Use AI-assisted matching via `/filter`

### `TUTOR`
Invited by a coordinator. Uses the web app only (not Claude). Can:
- Connect calendar via Nylas
- Configure scheduling preferences via Nylas Scheduler hosted page
- Edit their own subject/class list
- View incoming client proposals and accept/decline
- View their own calendar with existing clients
- Set a permanent meeting link

Role checks happen server-side (middleware or server components). Tutors must never access coordinator views or other tutors' data.

---

## Tutor Dashboard

### Calendar View
A calendar (week or month view, toggleable) showing the tutor's existing schedule. Events pulled from Nylas in real time. Proposed (pending) clients are shown as a distinct visual state (e.g. striped or dashed border) so tutors can see how a new client would fit alongside existing commitments.

### Scheduling Preferences
A card or section that links out to the **Nylas Scheduler hosted config page**. The tutor clicks "Edit Scheduling Preferences" and is redirected to Nylas' hosted editor (via the `scheduler-edit-link` Edge Function that mints a short-lived session URL). No custom working-hours UI is built — Nylas owns this.

The web app *displays* a read-only summary of the tutor's current settings (pulled from the Nylas Scheduler config API): working hours, exceptions, break duration, and capacity. This gives the tutor an at-a-glance view without needing to click into Nylas every time.

**Naming conventions (per Jake):**
- "Day overrides" → **"Exceptions to my availability"** or **"Exceptions to my upcoming availability"**
- Break times use **fixed denominations: 5, 10, 15, 20 minutes** (Calendly pattern)

### Subject / Class List
The tutor can view and edit the list of subjects they feel comfortable teaching. Adding a new subject opens a dialog where they explain their qualifications (free text) and choose their own confidence level (HIGH, MEDIUM, or LOW). The entry is created with `coordinator_confidence: UNPROVEN`; the coordinator grades over time.

Tutors set and see their own self-reported confidence (`conf`). They cannot see the coordinator confidence (`coordConf`) at all.

### Incoming Proposals
When a coordinator proposes a new client (via `/propose` or the coordinator dashboard), it appears here as a card showing:
- Student name, subject, requested schedule
- A visual overlay on the tutor's calendar showing where this client would slot in
- How it affects their remaining capacity (e.g. "This would bring you to 18 of 20 hours/week")
- **Accept** / **Decline** buttons (decline requires a short reason)

On accept: the booking is created on the tutor's Nylas calendar automatically.
On decline: the coordinator is notified and the request returns to the unassigned pool.

### Profile Settings
- **Name**, **timezone** (IANA dropdown)
- **Permanent meeting link** — video-conferencing agnostic (Zoom, Google Meet, etc.). Auto-populates in all calendar invites to students.
- **Bio** — read-only for the tutor. Admin-controlled. Displayed on the tutor's personal booking page.
- **Calendar connection status** — connected provider, reconnect button
- **Personal booking page URL** — the Nylas-hosted booking link. Copy button.

### Capacity
- **Maximum weekly hours** — required field, 6–40 range with form validation. Cannot be blank or "unlimited." Exceeding 40 shows an error dialog.
- **Minimum weekly hours** — 6 hours (approximately one hour per weekday plus one weekend hour). Enforced as a floor.
- **Current usage** — calculated from Nylas events tagged as tutoring sessions. Shows "X of Y hours this week" with a progress bar.
- **At capacity indicator** — when current ≥ max, the tutor is shown as "At Capacity" throughout the system. They remain visible to coordinators (not hidden) but with a clear badge.

---

## Coordinator Dashboard

### Tutor Filter Panel
The primary coordinator tool. A panel (sidebar or top bar) with filters:

- **Subject area** — one or more subjects (e.g. "AP Physics C", "AP Calculus BC"). Filters against the *coordinator-approved* subject list, not the tutor's self-reported list.
- **Confidence level** — filter by coordinator-graded confidence. The filter UI shows **HIGH, MEDIUM, LOW only** — UNPROVEN is a coordinator-internal state and is never exposed as a filter option. Default: HIGH + MEDIUM.
- **Availability** — up to 4 day-of-week / start-time / end-time tuples (OR logic). Mirrors how client requests come in.
- **Start date** — when the student wants to begin. "Start ASAP" toggle sets to today.
- **Request timezone** — the student's timezone. Tuples are interpreted in this timezone.
- **Capacity** — toggle to hide tutors at or near capacity.

Filters are applied client-side for speed. Active filter state reflected in URL query params (shareable/bookmarkable).

### Shared Calendar View
A month or week view showing availability blocks for all currently-filtered tutors. Each tutor's slots are color-coded or labeled with initials. **Held/blocked time** (from `/block`) is shown as a distinct state (e.g. hatched pattern with the coordinator's name who placed the hold).

When hovering over a tutor's availability block, only the **overlapping portion** with the active tuple filters is highlighted.

### Tutor Cards
A scrollable list (left panel in a two-panel layout) showing tutor profile cards. Each card shows:
- Name, photo (if available)
- Subjects taught (with confidence badges)
- Capacity status ("Available — 12 of 20 hrs" or "At Capacity")
- Quick action buttons: View Calendar, Propose Client, Block Time

Cards update in real time as filters are applied.

### Asana Integration
Coordinators can connect a specific **Asana project** (or section within a project) as the source of tutoring requests. Connection options:

- **Connect Asana project** — OAuth or API token. The app reads tasks from the connected project.
- **Manual entry** — for coordinators who prefer not to connect Asana, or for one-off requests. A form that captures: student name, email, subject, requested schedule (day/time tuples), timezone, start date, notes.

Asana tasks appear as a request queue in the coordinator dashboard. Each request card shows the student details and has actions: **Filter Tutors** (auto-populates the filter panel from the request), **Propose to Tutor**, **Mark Complete**.

When a proposal is accepted by a tutor, the Asana task is updated with the assignment details (tutor name, scheduled time) and moved to a "Matched" section.

### Invite Tutors
Same as V1: email + name + role → Supabase Auth `inviteUserByEmail()`. Pending tutors appear in the tutor list with a "Pending" badge.

### Subject Management
Coordinators can:
- **Add new subjects** to the system (name + category, e.g. "STEM", "Humanities", "Languages")
- **Remove subjects** (with warning if tutors are assigned)
- **Grade tutor confidence** for any subject on a tutor's list: `HIGH`, `MEDIUM`, `UNPROVEN`, `LOW` — done via the `/dashboard/subjects` page
- **View subjects pending review** — all subjects where `coordinator_confidence = UNPROVEN`, shown at `/dashboard/subjects`. This includes newly added subjects and any subjects where the tutor has updated their self-reported confidence. Coordinators set their assessment from this queue.

### AI Mode (Future — documented but not V2 launch)
An assistant panel in the coordinator dashboard that uses tutor personality context + current filters to suggest the best match. This is the web-app equivalent of `/filter`'s AI ranking step. Documented in the spec for architectural planning but not required for V2 launch.

---

## Claude Cowork Skills

Six skills, each in its own folder under `.claude/skills/`:

### `/invite`
Invite a new tutor or coordinator. Same as V1.

### `/available`
Check a tutor's availability. **V2 additions:**
- Output includes **capacity info**: current hours booked this week, max hours, and hours remaining.
- Output notes if the tutor is "At Capacity" or "Near Capacity" (≥80% of max).

### `/propose` (NEW)
Propose a potential client to a tutor. Inputs: tutor email, student name, student email, subject, requested schedule (day/time tuples), timezone, notes.

Steps:
1. Look up the tutor. Refuse if not ACTIVE.
2. Check availability against the requested schedule (via Nylas).
3. Create a `proposal` record in Supabase with status `PENDING`.
4. Tutor sees it on their dashboard with a calendar overlay.
5. Report to the coordinator that the proposal was sent.

The tutor accepts or declines on the web app (not in Claude). The coordinator can check proposal status via `/available` or on the coordinator dashboard.

### `/block` (NEW)
Temporarily block time on a tutor's calendar. Creates a hold event visible to other coordinators. Inputs: tutor email, date/time, duration, reason.

Steps:
1. Look up the tutor. Refuse if not ACTIVE.
2. Create a `hold` record in Supabase (coordinator_id, tutor_id, start, end, reason).
3. Optionally create a Nylas event on the tutor's calendar with title `[HOLD] {coordinator name} — {reason}`.
4. Report the hold to the coordinator. Holds expire after a configurable TTL (default: 48 hours) if not converted to a real booking.

### `/filter` (NEW — highest priority)
The core matching command. Two-phase: hard filter, then AI ranking.

**Phase 1 — Hard filter (Python script):**
Inputs: subject, availability tuples, timezone, optional start date, optional capacity threshold.

The script queries Supabase for tutors matching:
- Subject is in their approved list at the required confidence level
- Available during at least one of the requested tuples (via Nylas availability API)
- Not at or over capacity (unless the coordinator explicitly includes at-capacity tutors)

Returns a filtered list with availability details and capacity status.

**Phase 2 — AI ranking:**
Claude takes the filtered list + each tutor's personality context (from `tutor_context` in Supabase) and proposes a **top 3** with reasoning. The reasoning considers:
- Personality fit (from context JSON)
- Schedule fit (how cleanly the student's needs fit the tutor's open windows)
- Current load (prefer tutors with more capacity headroom)
- Historical success with similar subjects

The coordinator can then `/propose` any of the top 3 directly.

---

## Data Model — Supabase

### `users` (existing, expanded)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | Matches `auth.users.id` |
| `email` | text unique | |
| `name` | text | |
| `role` | enum: `SUPER_ADMIN` \| `COORDINATOR` \| `TUTOR` | |
| `status` | enum: `PENDING` \| `ACTIVE` \| `DISABLED` | |
| `timezone` | text (IANA) | |
| `nylas_grant_id` | text nullable | |
| `nylas_scheduler_config_id` | text nullable | |
| `booking_page_url` | text nullable | Nylas hosted booking page |
| `meeting_link` | text nullable | Permanent video conferencing link (Zoom, Meet, etc.) |
| `bio` | text nullable | Admin-controlled. Displayed on personal booking page. |
| `photo_url` | text nullable | |
| `max_weekly_hours` | integer | Required. Range: 6–40. |
| `min_weekly_hours` | integer default 6 | Floor. |
| `invited_by` | uuid FK → users.id nullable | |
| `asana_project_id` | text nullable | Coordinator only. Connected Asana project. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `subjects`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text unique | e.g. "AP Physics C" |
| `category` | text | e.g. "STEM", "Humanities", "Languages" |
| `created_at` | timestamptz | |

### `tutor_subjects`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tutor_id` | uuid FK → users.id | |
| `subject_id` | uuid FK → subjects.id | |
| `confidence` | enum: `HIGH` \| `MEDIUM` \| `UNPROVEN` \| `LOW` | Set by coordinator. Default: `UNPROVEN`. |
| `qualification_note` | text nullable | Tutor's explanation when adding the subject. |
| `graded_by` | uuid FK → users.id nullable | Coordinator who set the confidence. |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `tutor_context`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tutor_id` | uuid FK → users.id unique | |
| `context` | jsonb | Personality notes, teaching style, strengths, student feedback themes, etc. |
| `updated_by` | uuid FK → users.id | Last coordinator to update. |
| `updated_at` | timestamptz | |

The `context` JSONB has no enforced schema — coordinators can store whatever is useful. A recommended structure:

```json
{
  "personality": "Patient, methodical. Good with anxious students.",
  "teaching_style": "Socratic — asks leading questions rather than lecturing.",
  "strengths": ["SAT Math", "building confidence", "test anxiety"],
  "weaknesses": ["sometimes runs over time"],
  "student_feedback_themes": ["very encouraging", "explains things multiple ways"],
  "notes": "Prefers morning sessions. Has a dog that occasionally barks."
}
```

### `proposals`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tutor_id` | uuid FK → users.id | |
| `coordinator_id` | uuid FK → users.id | Who proposed |
| `student_name` | text | |
| `student_email` | text | |
| `subject` | text | |
| `requested_schedule` | jsonb | Array of day/time tuples |
| `timezone` | text (IANA) | Student's timezone |
| `start_date` | date nullable | |
| `notes` | text nullable | |
| `status` | enum: `PENDING` \| `ACCEPTED` \| `DECLINED` | |
| `decline_reason` | text nullable | Tutor's reason if declined |
| `asana_task_id` | text nullable | Link back to Asana if originated there |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz nullable | |

### `holds`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tutor_id` | uuid FK → users.id | |
| `coordinator_id` | uuid FK → users.id | Who placed the hold |
| `start_utc` | timestamptz | |
| `end_utc` | timestamptz | |
| `reason` | text | |
| `nylas_event_id` | text nullable | If a calendar event was created |
| `expires_at` | timestamptz | Default: created_at + 48 hours |
| `status` | enum: `ACTIVE` \| `CONVERTED` \| `EXPIRED` \| `RELEASED` | |
| `created_at` | timestamptz | |

---

## Nylas Integration

**What Nylas owns (unchanged from V1):**
- Calendar OAuth (hosted auth)
- Scheduler configuration (working hours, exceptions, break duration, capacity per day)
- Availability computation (server-side, honors all Scheduler rules)
- Hosted booking pages (public URLs per tutor)
- Event creation with attendee invites

**What the web app adds on top:**
- **Calendar views** — fetches events from Nylas (`GET /v3/grants/{grant_id}/events`) and renders them in a custom calendar component. Nylas is the data source; we build the UI.
- **Capacity tracking** — counts events with a specific title pattern or metadata tag (e.g. `[Tutoring]` prefix) to calculate weekly hours. This is application-level logic on top of Nylas event data.
- **Hold events** — created via Nylas Events API with a `[HOLD]` prefix. Treated as real busy time by Nylas' availability computation, which is the desired behavior.

**Booking page URL format (confirmed from V1 spike):**
```
https://book.nylas.com/<REGION>/<NYLAS_CLIENT_ID>/<SLUG>
```
Slugs must be human-readable, unique per client ID, and explicitly set when creating the Scheduler config.

**Scheduler edit links:**
Nylas does not return a persistent edit URL. The `scheduler-edit-link` Supabase Edge Function mints a short-lived session via `POST /v3/scheduling/sessions` and returns an edit URL. This is called when the tutor clicks "Edit Scheduling Preferences" on their dashboard.

All Nylas credentials and per-user `grant_id`s are server-side only.

---

## Asana Integration

Coordinators can connect an Asana project as the source of tutoring requests.

**Connection:**
- OAuth or personal access token, stored per coordinator on their `users` row (`asana_project_id`).
- The web app reads tasks from the connected project via the Asana REST API.
- Claude skills use the Asana MCP tools when available, or fall back to the REST API.

**Request flow:**
1. New tutoring request appears as an Asana task (created by intake team, parents, etc.).
2. Coordinator sees it in their dashboard request queue.
3. Coordinator clicks "Filter Tutors" — the request's subject + schedule auto-populate the filter panel.
4. Coordinator selects a tutor and clicks "Propose" (or uses `/propose` in Claude).
5. Tutor accepts on their dashboard.
6. Asana task is updated: assigned tutor, scheduled time, status moved to "Matched."

**Manual entry fallback:**
Coordinators can also enter a request manually (student name, email, subject, schedule, timezone, notes) without Asana. This creates a `proposal` directly without an `asana_task_id`.

---

## Subject / Skill Management

**Two-tier system:**

1. **Tutor's claimed subjects** — the tutor adds subjects they feel comfortable teaching. Each addition includes a qualification note and the tutor's self-reported confidence level (HIGH, MEDIUM, or LOW). The `coordinator_confidence` defaults to `UNPROVEN` on creation — tutors never see this field.

2. **Editing confidence** — tutors can edit their self-reported confidence on any existing subject. They must provide a new explanation note (10+ chars) describing what changed. On save, `coordinator_confidence` resets to `UNPROVEN` so the coordinator sees the change in their subjects review queue. The API endpoint is `PATCH /api/tutor-subjects/[id]`.

3. **Coordinator confidence grading** — coordinators grade each tutor-subject pair on the subjects page (`/dashboard/subjects`):
   - **HIGH** — proven, reliable, would recommend without hesitation
   - **MEDIUM** — capable but less experienced or less consistent
   - **UNPROVEN** — tutor claims the subject but hasn't been tested/observed; also the state after a tutor edits their confidence
   - **LOW** — not recommended for this subject

4. **Filtering uses tutor self-reported confidence** (`conf` on `TutorSubject`). The coordinator confidence (`coordConf`) is displayed in the coordinator UI but is not used for filter matching. A tutor with self-reported confidence `LOW` on AP Physics won't appear when a coordinator filters for HIGH/MEDIUM (unless they explicitly include LOW).

5. **Subject confidence flow:** When a tutor adds or edits a subject, `coordinator_confidence` is set to `UNPROVEN`. There is no "pending" state — the subject is active immediately. The coordinator reviews UNPROVEN subjects at `/dashboard/subjects` and sets their assessment over time.

The `subjects` table is the master list — tutors select from it, they don't create free-text entries. Coordinators can add new subjects to the master list.

---

## Capacity System

**Weekly hours tracking:**
- Every tutor sets `max_weekly_hours` (6–40, required) and the system enforces `min_weekly_hours` (6, floor).
- Current weekly hours are calculated from Nylas events that match a tutoring session pattern. The pattern is configurable: events with `[Tutoring]` in the title, or events created through the platform (tracked via a metadata field or a `bookings` table).
- **"At Capacity"** = current hours ≥ max. Tutor is shown with a badge, not hidden.
- **"Near Capacity"** = current hours ≥ 80% of max. Shown as a yellow indicator.
- **Available hours remaining** = max - current. Surfaced in `/available` output and on tutor cards.

**Coordinator override:**
Coordinators can still propose to at-capacity tutors — the system warns but doesn't block. This allows exceptions for high-priority students or schedule changes.

---

## App Folder Structure

```
/app
  /dashboard                → Coordinator views
    /calendar               → Shared calendar view
    /tutors                 → Tutor list + filter panel
    /requests               → Asana request queue + manual entry
    /subjects               → Subject management + pending reviews
  /tutor                    → Tutor views
    /calendar               → Personal calendar view
    /proposals              → Incoming client proposals
    /subjects               → Subject list editor
    /settings               → Profile settings
  /admin                    → Super admin (invite coordinators, system settings)
  /onboarding               → Tutor onboarding flow (post-invite)
  /api
    /nylas                  → Nylas webhook handlers, availability endpoints
    /asana                  → Asana task reader, status updater
    /proposals              → Create, accept, decline proposals
    /holds                  → Create, release, expire holds
    /subjects               → CRUD + confidence grading
    /tutor-context          → Read/write tutor personality context
/components
  /ui                       → Reusable, stateless UI components
  /features                 → Feature-specific (TutorCard, CalendarView, FilterPanel, ProposalCard)
/lib
  /utils
    /availability.ts        → Thin wrapper over Nylas availability (no custom computation)
    /capacity.ts            → Weekly hours calculation from events
    /timezone.ts            → Timezone conversion (date-fns-tz only, no moment.js)
  /hooks                    → Custom React hooks
  /types                    → Shared TypeScript types and interfaces
  /nylas                    → Nylas API client
  /asana                    → Asana API client
/styles                     → Global styles
```

---

## Coding Standards

- **TypeScript everywhere** — no `any`, prefer `unknown` with type narrowing.
- **Keep business logic out of components** — use custom hooks or utility functions.
- **Server Components for data fetching** wherever possible.
- **All API routes return consistent error shapes:** `{ error: string, status: number }`.
- **No `console.log` in committed code.**
- **Unit test utility functions** — especially `capacity.ts` and any tuple-matching logic.
- **Use `date-fns-tz` for timezone conversions.** Never use `moment.js`.
- **Components under ~150 lines.** Split if larger.
- **Don't mix tutor and coordinator UI logic** in the same components.

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Nylas
NYLAS_API_KEY=
NYLAS_CLIENT_ID=
NYLAS_CLIENT_SECRET=
NYLAS_API_URI=https://api.us.nylas.com

# Asana
ASANA_ACCESS_TOKEN=              # or use OAuth per-coordinator

# Skill runtime
SIMPLIFI_CALLER_EMAIL=           # V1 auth shim for Claude skills
```

`NEXT_PUBLIC_*` variables are safe for the browser. All others are server-side only.

---

## What to Avoid

- Don't rebuild Nylas Scheduler's configuration UI. Link out to the hosted page.
- Don't store working hours, exceptions, or break duration in Supabase. Nylas owns that.
- Don't use `any` in TypeScript.
- Don't fetch data inside component render functions.
- Don't hardcode environment-specific values.
- Don't introduce new dependencies without flagging them first.
- Don't let tutors see other tutors' data.
- Don't hide at-capacity tutors from coordinators. Show them with a badge.
- Don't let the monolith grow. If a feature doesn't fit cleanly, make it a separate module.

---

## V1 → V2 Migration Notes

**What carries forward from V1:**
- Supabase `users` table (expanded with new columns)
- Nylas integration (OAuth, Scheduler, availability, events)
- `nylas-oauth-callback` Edge Function
- `scheduler-edit-link` Edge Function
- Python skill scripts (expanded, not replaced)
- Three existing skills (`/invite`, `/available`, `/book`) — updated, plus three new ones

**What changes:**
- Static tutor hub page → full Next.js tutor dashboard
- No coordinator web UI → full Next.js coordinator dashboard
- `data/users.json` (if any V1 remnants) → fully Supabase
- Single `users` table → multiple tables (subjects, tutor_subjects, tutor_context, proposals, holds)
- `/book` remains but `/propose` handles the primary assignment flow going forward

**New Supabase tables to create:**
- `subjects`
- `tutor_subjects`
- `tutor_context`
- `proposals`
- `holds`

**New columns on `users`:**
- `meeting_link`, `bio`, `photo_url`, `max_weekly_hours`, `min_weekly_hours`, `asana_project_id`

---

## Notes

- Austin Rubinger (austin@simplifiedu.com) is the developer/owner of this project.
- Jake Adams is the product owner / boss. His priorities: code stability, form before function, modular architecture, and a tutor experience that feels like a real product.
- The team will test internally first: all team members connect calendars and use the system to book on each other's calendars before rolling out to tutors.
- Availability computation stays in Nylas. Capacity computation (weekly hours tracking) is our logic.
- Timezone conversion lives in `/lib/utils/timezone.ts`. Use `date-fns-tz`. Never `moment.js`.
- Tutor bios are admin-controlled — tutors cannot edit their own bio.
- The booking URL pattern is `https://book.nylas.com/<REGION>/<NYLAS_CLIENT_ID>/<SLUG>`.

---

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`SimplifiEDUApplicationManager/Scheduler`); use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
