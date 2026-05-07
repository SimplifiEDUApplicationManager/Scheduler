-- Migration: add_proposal_expired
-- Adds EXPIRED to the proposal_status enum.
-- EXPIRED is distinct from DECLINED: EXPIRED means the tutor did not respond within 24 hours;
-- DECLINED means the tutor explicitly rejected the proposal.

ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Add expires_at column so the cron can find proposals past their TTL.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours');

-- Index for fast cron lookup: PENDING proposals past TTL.
CREATE INDEX IF NOT EXISTS proposals_expires_idx ON public.proposals (expires_at)
  WHERE status = 'PENDING';
