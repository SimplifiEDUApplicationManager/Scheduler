-- Add FINISHED to proposal_status enum.
-- FINISHED means the tutor has completed the engagement and marked it done.
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'FINISHED';
