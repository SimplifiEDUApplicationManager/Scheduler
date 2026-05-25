-- Add availability JSONB column to users.
-- Stores a denormalized cache of the tutor's weekly working windows
-- (Record<dayNumber, [startHour, endHour][]>) so the coordinator matcher
-- can filter by availability client-side without hitting the Nylas API.
-- Written by PUT /api/nylas/scheduler whenever a tutor saves preferences.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb;
