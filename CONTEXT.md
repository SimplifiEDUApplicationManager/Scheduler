# Simplifi EDU Scheduling Platform

The coordinator-facing system for matching students to tutors, managing tutor availability and capacity, and tracking the lifecycle of a tutoring engagement from incoming request through accepted proposal.

## Language

### Core actors

**Tutor**:
A person who provides tutoring sessions. Has a calendar (via Nylas), a subject list, weekly capacity limits, and a booking page.
_Avoid_: teacher, instructor, provider

**Coordinator**:
A staff member who receives tutoring requests, filters tutors, proposes matches, and manages the tutor roster.
_Avoid_: admin (reserved for Super Admin), manager

**Student**:
The person receiving tutoring. Not a system user — referenced only by name and email on requests and proposals.
_Avoid_: client, learner

**Super Admin**:
Austin Rubinger. Full system access including coordinator management and system settings.
_Avoid_: admin (too generic)

### The matching workflow

**Request** (also: Tuition Request):
An incoming ask for tutoring — a student's subject, desired schedule (as tuples), timezone, and start date. Sourced from Asana or entered manually by a coordinator. A Request stays open (unmatched) until a Proposal is accepted; declined or expired proposals return it to the coordinator's queue. A Request is closed (matched) when a tutor accepts a Proposal.
_Avoid_: ticket, job, task

**Proposal**:
A coordinator's outreach to a specific tutor on behalf of a specific student. Contains one or more time windows (derived from the student's requested schedule) within which the tutor picks a specific time to accept, or declines entirely. A Proposal expires automatically after 24 hours if the tutor has not responded — forfeiting their ability to accept — and the Request returns to the coordinator's queue. A Request can have multiple sequential Proposals (to different tutors) until one is accepted. A Proposal is the bridge between a Request and a confirmed Session.
_Avoid_: invitation (reserved for system onboarding), booking (a booking is what happens after acceptance)

**Invitation**:
The system email sent to a new tutor or coordinator to join Simplifi EDU. Triggered by `/invite`. Not related to tutoring proposals.
_Avoid_: proposal (reserved for tutor-student matching)

**Proposal Window**:
A day-of-week + time range offered to a tutor within a Proposal. Derived from the student's requested schedule. The tutor sees all pending proposal windows overlaid on their calendar and selects a specific time within a window when accepting. Multiple proposals can be stacked on the calendar simultaneously so the tutor can plan across all of them at once.
_Avoid_: hold, block, slot (a slot is a specific time; a window is the range offered)

**Session**:
A confirmed tutoring event on a tutor's Nylas calendar. Created automatically when a tutor accepts a Proposal and selects a specific time. Identified by `[Tutoring]` in the event title or `simplifi_type=session` metadata. Sessions count toward weekly capacity. Nylas is the single source of truth — if a tutor edits or cancels a session directly in their connected calendar (Google, Outlook, etc.), that change must reflect in the app.
_Avoid_: appointment, meeting, booking

### Availability and capacity

**Tuple**:
A day-of-week + start-time + end-time window used to express a student's desired schedule or to filter tutor availability. Times are in 24h decimal (e.g. 16 = 4 PM). Up to 4 tuples, OR-matched.
_Avoid_: slot, window, time block

**Capacity**:
A tutor's weekly hours ceiling (`max_weekly_hours`). Compared against current session hours to determine availability headroom.
_Avoid_: bandwidth, availability (availability refers to open calendar slots, not hours headroom)

**At Capacity**:
When a tutor's current weekly session hours ≥ `max_weekly_hours`. Shown with a badge; tutor remains visible to coordinators.

**Near Capacity**:
When a tutor's current weekly session hours ≥ 80% of `max_weekly_hours`. Shown as a yellow indicator.

### Subjects

**Subject**:
An academic topic from the coordinator-managed master list (e.g. "AP Physics C"). Tutors select from this list; they do not create free-text entries.
_Avoid_: class, course, skill

**Tutor Confidence** (also: self-confidence):
The tutor's own rating of their ability to teach a given subject: HIGH, MEDIUM, or LOW. Set by the tutor. This is the value used in coordinator filtering — when a coordinator filters for "HIGH confidence AP Calculus tutors," they are filtering on Tutor Confidence.
_Avoid_: coordinator confidence, grade

**Coordinator Confidence** (also: track-record rating):
The coordinator's historical assessment of a tutor's performance on a given subject: UNPROVEN, HIGH, MEDIUM, or LOW. Defaults to UNPROVEN when a tutor adds a subject — meaning they have not yet taught it through Simplifi. Updated by coordinators based on observed outcomes (e.g. marking LOW after multiple failed student relationships). Does not affect filtering directly; used for internal coordinator reference.
_Avoid_: tutor confidence, self-rating

**Qualification Note**:
Free text a tutor writes when adding a subject, explaining their experience or qualifications.
_Avoid_: bio, description

### Tutor profile

**Tutor Context**:
A per-tutor JSON blob stored in the `tutor_context` Supabase table, populated from the tutor's interview transcript. Contains personality, teaching style, strengths, and other qualitative attributes. Serves as the data source for AI-assisted filtering when implemented.
_Avoid_: tutor notes, profile notes, coordinator notes

**Booking Page**:
The Nylas-hosted public URL where students or coordinators can self-book with a tutor.
_Avoid_: calendar link, scheduling link

**Meeting Link**:
A permanent video-conferencing URL (Zoom, Google Meet, etc.) set by the tutor. Auto-populated in calendar invites.
_Avoid_: video link, Zoom link

## Relationships

- A **Request** generates one or more **Proposals** (one per tutor considered)
- A **Proposal** belongs to one **Tutor** and one **Request**
- An **Invitation** onboards a new **Tutor** or **Coordinator** — it is not a **Proposal**
- A **Proposal** carries one or more **Proposal Windows**; the **Tutor** picks a specific time within a window when accepting
- A **Session** is what a **Proposal** becomes after the **Tutor** accepts and the calendar event is created
- A **Tutor** has one **Tutor Context** (from interview transcript) and many **Tutor Subjects** (each with a **Tutor Confidence** and a **Coordinator Confidence**)

## Example dialogue

> **Coordinator:** "We got a new request for AP Calc — Tuesday or Thursday 4–6 PM. Can you propose Julia?"
> **Dev:** "Is Julia at capacity this week?"
> **Coordinator:** "Near capacity but not at it. Sending the proposal with both windows."
> _[Julia sees two Proposal Windows overlaid on her calendar alongside her other pending proposals.]_
> _[Julia selects Thursday 5–6 PM and accepts. A Nylas session is created automatically.]_
> _[The Asana request is marked Matched. The coordinator sees the proposal status flip to Accepted.]_
> _[Meanwhile, Coordinator B had also proposed Julia for Monday — Julia declines that one. Coordinator B's request returns to their queue.]_

## Coordinator visibility

Coordinators see a tutor's availability based on confirmed calendar data from Nylas only. Pending proposals from other coordinators are not visible to coordinators — the tutor manages all pending proposals on their own calendar view. This means two coordinators can independently propose the same tutor for overlapping windows; the tutor resolves the conflict.

## Flagged ambiguities

- "Invitation" was used to mean both system onboarding and tutor-student proposals — resolved: **Invitation** = onboarding only, **Proposal** = tutor-student matching.
