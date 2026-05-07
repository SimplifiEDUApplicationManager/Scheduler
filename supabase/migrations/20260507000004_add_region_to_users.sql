-- Add region column to users for coordinator territory tracking.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region text;
