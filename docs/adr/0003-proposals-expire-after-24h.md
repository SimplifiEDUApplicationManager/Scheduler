# Proposals expire automatically after 24 hours

A tutor has 24 hours to respond to a Proposal. If they do not accept or decline within that window, the Proposal moves to EXPIRED status and the Request returns to the coordinator's queue as unmatched. The tutor cannot accept an expired Proposal.

This mirrors the old hold TTL mechanism but applies to Proposals. The existing `/api/cron/expire-holds/` route should be repurposed (or replaced) to expire Proposals.

## Consequence

The `proposal_status` enum must include an `EXPIRED` value in addition to `PENDING`, `ACCEPTED`, and `DECLINED`. A DB migration is required. `EXPIRED` and `DECLINED` are intentionally separate — coordinators can distinguish a tutor who consciously said no from one who did not respond, which may affect how they route the request next.

## Why 24 hours

Coordinators are managing multiple open requests; a tutor sitting on a proposal indefinitely blocks the coordinator from re-routing. 24 hours gives the tutor enough time to check their dashboard without holding up the student's placement.
