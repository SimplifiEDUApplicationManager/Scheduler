-- Migration: add_tutor_availability
-- Stores the tutor's painted availability ranges on proposals.
-- Set when tutor accepts (TUTOR_ACCEPTED). Coordinator then places
-- discrete sessions within these ranges.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS tutor_availability jsonb;

COMMENT ON COLUMN public.proposals.tutor_availability IS
  'Tutor''s available time ranges within the student''s windows. Array of {day, start, end} in the proposal timezone. Set on TUTOR_ACCEPTED.';
