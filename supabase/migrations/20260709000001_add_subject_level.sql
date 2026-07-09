-- Migration: add_subject_level
-- Adds a `level` column to the subjects table so each subject+level
-- combination is a distinct row (e.g. "AP Biology" vs "High School Biology").
-- Wipes and rebuilds subjects and tutor_subjects from TutorCruncher data.

-- 1. Drop dependent data first (tutor_subject_changes references tutor_subjects)
DELETE FROM public.tutor_subject_changes;
DELETE FROM public.tutor_subjects;
DELETE FROM public.subjects;

-- 2. Add level column
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS level text;

-- 3. Drop old unique constraint on name alone, add new one on (name, level)
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_name_unique;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_name_level_unique UNIQUE (name, level);

-- 4. Add index for level filtering
CREATE INDEX IF NOT EXISTS subjects_level_idx ON public.subjects (level);
