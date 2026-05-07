-- Migration: drop_holds
-- Holds are removed. Calendar reservations are no longer tracked in the DB.
-- The holds table, its trigger, function, and enum were artefacts of an earlier design.

DROP TABLE IF EXISTS public.holds;
DROP FUNCTION IF EXISTS public.set_hold_expires_at();
DROP TYPE IF EXISTS public.hold_status;
