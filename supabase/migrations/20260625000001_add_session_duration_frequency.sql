-- Add session duration and frequency to requests and proposals.
-- Defaults: 60-minute sessions, 1 per week (the most common case).
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS session_duration_minutes int4 NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS sessions_per_week int4 NOT NULL DEFAULT 1;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS session_duration_minutes int4 NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS sessions_per_week int4 NOT NULL DEFAULT 1;
