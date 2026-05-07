# Holds removed — Proposals carry availability windows; tutors plan on their calendar

There is no Hold entity. The original design used holds to prevent coordinator double-booking, but this was abandoned in favour of a simpler model: a Proposal carries the student's requested availability windows, and the tutor resolves all pending proposals directly on their calendar view, stacking multiple proposal windows to plan across them simultaneously.

The `holds` table, `/api/holds` endpoint, and `/block` Claude skill are dead code from the earlier design and should be removed.

## Why no holds

Holds added coordinator-coordination complexity (48h TTL, convert/expire lifecycle, multi-coordinator visibility rules) without clear benefit. The tutor's calendar already surfaces pending proposals as visual overlays — coordinators can see proposal status on the dashboard without a separate hold mechanism.
