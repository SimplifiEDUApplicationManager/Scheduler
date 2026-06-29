-- TUTOR_ACCEPTED: tutor accepted, awaiting client approval via coordinator
-- CLIENT_DECLINED: coordinator rejected after client did not approve the tutor
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'TUTOR_ACCEPTED';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'CLIENT_DECLINED';

-- Store the tutor's chosen placements so the coordinator-approve endpoint can
-- create calendar events with the exact times the tutor picked.
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS placements jsonb;
