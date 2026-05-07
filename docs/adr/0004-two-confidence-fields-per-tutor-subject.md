# Two confidence fields per tutor-subject pair

Each `tutor_subjects` row carries two separate confidence values:

- **`tutor_confidence`** (HIGH | MEDIUM | LOW) — the tutor's self-assessment. Set by the tutor. Used by coordinator filtering.
- **`coordinator_confidence`** (UNPROVEN | HIGH | MEDIUM | LOW) — the coordinator's track-record rating based on observed teaching history. Defaults to UNPROVEN. Updated by coordinators; does not affect filtering.

The current schema has a single `confidence` field with a `graded_by` column — this conflates both ratings into one. A migration is needed to split them into `tutor_confidence` and `coordinator_confidence`.

## Why separate

Filtering on the tutor's self-rating lets coordinators find tutors who are willing and confident to teach a subject. The coordinator's track-record rating is internal intelligence (e.g. flagging a tutor as LOW after repeated failures) that informs coordinator judgment without automatically excluding tutors from search results.
