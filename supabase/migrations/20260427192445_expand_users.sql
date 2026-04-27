-- Migration: expand_users
-- Adds V2 columns to the existing `users` table.
-- Safe to run on both fresh DBs and the existing one (all changes are additive).

-- ── New columns ──────────────────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS meeting_link       text,
  ADD COLUMN IF NOT EXISTS bio                text,
  ADD COLUMN IF NOT EXISTS photo_url          text,
  ADD COLUMN IF NOT EXISTS max_weekly_hours   integer,
  ADD COLUMN IF NOT EXISTS min_weekly_hours   integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS asana_project_id   text;

-- ── NOT NULL + CHECK on max_weekly_hours ─────────────────────────────────────
-- Applied after ADD COLUMN so existing rows can be backfilled first.
-- Existing rows get a safe default (20h) before the constraint is enforced.

UPDATE public.users
  SET max_weekly_hours = 20
  WHERE max_weekly_hours IS NULL;

ALTER TABLE public.users
  ALTER COLUMN max_weekly_hours SET NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_max_weekly_hours_range,
  ADD CONSTRAINT users_max_weekly_hours_range
    CHECK (max_weekly_hours >= 6 AND max_weekly_hours <= 40);

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_min_weekly_hours_range,
  ADD CONSTRAINT users_min_weekly_hours_range
    CHECK (min_weekly_hours >= 6);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- email already has a UNIQUE constraint; add index if not present.

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx  ON public.users (email);
CREATE INDEX IF NOT EXISTS        users_role_idx   ON public.users (role);
CREATE INDEX IF NOT EXISTS        users_status_idx ON public.users (status);
