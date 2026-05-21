-- Migration: tutor availability requests + activity log
-- Run in Supabase SQL editor.

-- ── users table additions ─────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_availability_hours numeric NOT NULL DEFAULT 0;

-- ── tutor_availability_requests ───────────────────────────────────────────────
-- Items that require coordinator approval before taking effect.
-- request_type:
--   PAUSE                   → tutor wants to hide availability from coordinators
--   LOW_MAX_HOURS           → tutor wants max_weekly_hours set to ≤ 5
--   LOW_AVAILABILITY_WINDOWS → tutor's proposed scheduling prefs total < 10 hrs/week
--                              (pending prefs stored in details.prefs)

CREATE TABLE IF NOT EXISTS tutor_availability_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type    text        NOT NULL CHECK (request_type IN ('PAUSE', 'LOW_MAX_HOURS', 'LOW_AVAILABILITY_WINDOWS')),
  reason          text        NOT NULL,
  details         jsonb,
  status          text        NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),
  reviewed_by     uuid        REFERENCES users(id),
  reviewed_at     timestamptz,
  decline_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- One pending request per tutor per type at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tutor_availability_requests_pending
  ON tutor_availability_requests (tutor_id, request_type)
  WHERE status = 'PENDING';

-- ── tutor_availability_activity ───────────────────────────────────────────────
-- Informational feed of availability-related changes (no approval needed).
-- event_type values: scheduling_prefs_updated | timezone_changed | hours_changed
--                    paused | resumed

CREATE TABLE IF NOT EXISTS tutor_availability_activity (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  text        NOT NULL,
  summary     text        NOT NULL,
  details     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
