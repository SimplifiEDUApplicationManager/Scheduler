# Simplifi EDU — Claude Cowork Skills

This document describes the Claude skills available to coordinators for the Simplifi EDU platform. All skills are invoked by typing a slash command in a Claude Cowork conversation.

---

## `/invite` — Invite a new tutor or coordinator

Use this to onboard a new tutor or coordinator. Claude sends them an invitation to connect their calendar and create their profile.

**Say something like:**
- `/invite Jane Doe, jane@gmail.com`
- `invite a new tutor — Sarah Smith, sarah@gmail.com`
- `add a new coordinator: mike@gmail.com, Mike Johnson`

**What Claude will ask for (if not provided):**
| Field | Required |
|---|---|
| Email | Yes |
| Full name | Yes |
| Role (TUTOR or COORDINATOR) | No — defaults to TUTOR |

**What happens:** The tutor/coordinator receives a magic-link email to log in and connect their calendar. Their status will be PENDING until they complete onboarding.

---

## `/available` — Check a tutor's availability

Check when a specific tutor has open slots on their calendar over a date range, optionally filtered to a student's schedule.

**Say something like:**
- `/available austin@gmail.com next week`
- `when is Jane free on Tuesdays and Thursdays 4–7pm Eastern?`
- `check availability for meg+tutor@simplifiedu.com this week`

**What Claude will ask for (if not provided):**
| Field | Required |
|---|---|
| Tutor email | Yes |
| Date range | No — defaults to next 7 days |
| Day/time filter (student's schedule) | No |
| Timezone | No — defaults to tutor's timezone |

**What Claude returns:** A list of open time windows on the tutor's calendar, filtered to any day/time constraints you provided.

---

## `/book` — Book a session on a tutor's calendar

Create a calendar event on a tutor's Nylas calendar for a specific student. Claude confirms the details before booking.

**Say something like:**
- `/book austin@gmail.com Tuesday June 3rd at 4pm for 1 hour, student is Alex Chen, alex@gmail.com`
- `book Jane for the earliest available slot, student Mike at mike@gmail.com`

**What Claude will ask for (if not provided):**
| Field | Required |
|---|---|
| Tutor email | Yes |
| Date/time or "earliest available" | Yes |
| Student name | Yes |
| Student email | Yes |
| Title | No — defaults to "Tutoring — {student name}" |
| Notes | No |

**What happens:** Claude shows you the booking details and asks for confirmation before creating the calendar event. The student receives a calendar invite.

---

## `/sync-requests` — Sync Asana tasks into the app

Pull new tutoring requests from your connected Asana project ("New Tutoring Request" section) into the Simplifi requests queue. Safe to run multiple times — won't create duplicates.

**Say something like:**
- `/sync-requests`
- `sync my Asana requests`
- `pull in the latest requests from Asana`

**No inputs required.** Claude reads your connected Asana project automatically.

**What Claude does:**
1. Reads all incomplete tasks from the "New Tutoring Request" section of your Asana project
2. Maps each task to one request per subject (a task with 4 subjects creates 4 requests)
3. Infers schedule, timezone, and subject from the task notes
4. Submits each to the app

**What Claude returns:** A summary table showing every request submitted, with any subject mappings or notes flagged.

---

## `/send-request` — Propose a student to a tutor

Send a tutoring job proposal to a specific tutor for an open request. The tutor sees it on their dashboard and can accept or decline.

**Say something like:**
- `/send-request Maksim's Son Introduction to Computer Science to Austin Rubinger`
- `send the Algebra II request for Jane to meg+tutor@simplifiedu.com`
- `propose Fiona Wu World History to Katrina Anderson`

**What Claude needs:**
| Field | Source |
|---|---|
| Student name + subject | Looked up automatically from open requests |
| Tutor | Name looked up in tutor list, or provide email directly |

Claude looks up the open request in the app and the tutor's email automatically — **you rarely need to provide anything beyond the student name, subject, and tutor name.**

**What happens:** A proposal is created and appears on the tutor's dashboard. The tutor accepts or declines through the web app.

---

## `/show-availability` — Weekly overview of all tutor availability

Get a at-a-glance view of every active tutor's open hours over the next 7 days (working hours minus already-booked calendar events).

**Say something like:**
- `/show-availability`
- `show all tutor availability this week`
- `who's free this week in Pacific time?`

**Optional:** Specify a timezone (defaults to Eastern).

**What Claude returns:** A table of each tutor's open windows for the next 7 days.

---

## Tips for the whole team

- **You don't need exact syntax.** Claude understands natural language — just describe what you want.
- **Skills chain well.** You can `/sync-requests` to pull in new Asana tasks, then immediately `/send-request` to propose one to a tutor, all in the same conversation.
- **Proposals vs. bookings:** Use `/send-request` to *propose* a student to a tutor (tutor accepts/declines). Use `/book` to *directly* place a session on someone's calendar (no tutor confirmation step).
- **The app is the source of truth.** Everything the skills do is reflected in the Simplifi web app at simplifi-scheduler.vercel.app.
