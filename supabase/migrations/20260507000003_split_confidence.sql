-- Migration: split_confidence
-- Splits the single `confidence` column on tutor_subjects into two separate columns:
--   tutor_confidence     (HIGH | MEDIUM | LOW)        — set by the tutor; drives filtering
--   coordinator_confidence (UNPROVEN | HIGH | MEDIUM | LOW) — set by coordinator; internal reference

-- Step 1: add the new columns
ALTER TABLE public.tutor_subjects
  ADD COLUMN IF NOT EXISTS tutor_confidence text NOT NULL DEFAULT 'MEDIUM'
    CHECK (tutor_confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  ADD COLUMN IF NOT EXISTS coordinator_confidence text NOT NULL DEFAULT 'UNPROVEN'
    CHECK (coordinator_confidence IN ('HIGH', 'MEDIUM', 'UNPROVEN', 'LOW'));

-- Step 2: migrate existing data
-- Rows that were UNPROVEN stay UNPROVEN on the coordinator side; tutor side defaults to MEDIUM.
-- Rows that were HIGH/MEDIUM/LOW are treated as coordinator ratings → coordinator_confidence.
-- tutor_confidence is left at default MEDIUM (unknown) for existing rows.
UPDATE public.tutor_subjects
  SET coordinator_confidence = confidence::text
  WHERE confidence IN ('HIGH', 'MEDIUM', 'LOW');

-- Step 3: drop the old column and its index
DROP INDEX IF EXISTS tutor_subjects_confidence_idx;
ALTER TABLE public.tutor_subjects DROP COLUMN IF EXISTS confidence;
ALTER TABLE public.tutor_subjects DROP COLUMN IF EXISTS graded_by;

-- Step 4: add graded_by back scoped to coordinator_confidence
ALTER TABLE public.tutor_subjects
  ADD COLUMN IF NOT EXISTS graded_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

-- Step 5: indexes
CREATE INDEX IF NOT EXISTS tutor_subjects_tutor_conf_idx       ON public.tutor_subjects (tutor_confidence);
CREATE INDEX IF NOT EXISTS tutor_subjects_coordinator_conf_idx ON public.tutor_subjects (coordinator_confidence);
