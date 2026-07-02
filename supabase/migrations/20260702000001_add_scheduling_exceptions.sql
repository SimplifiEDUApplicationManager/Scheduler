-- Cache scheduling exceptions (date-specific overrides) in the users table
-- so the coordinator calendar can read them without calling Nylas per tutor.
-- Format: [{ "date": "2026-07-04", "windows": [] }] (empty windows = unavailable all day)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scheduling_exceptions jsonb DEFAULT '[]'::jsonb;
