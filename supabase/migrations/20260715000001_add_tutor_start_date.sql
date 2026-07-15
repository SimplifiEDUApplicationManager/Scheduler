-- Migration: add_tutor_start_date
-- Stores which week the tutor chose when painting their availability.
-- The coordinator's scheduling view opens on this date.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS tutor_start_date date;
