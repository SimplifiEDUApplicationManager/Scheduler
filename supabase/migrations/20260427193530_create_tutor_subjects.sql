-- Migration: create_tutor_subjects
-- Junction table: which tutors teach which subjects, with coordinator confidence grades.

DO $$ BEGIN
  CREATE TYPE public.confidence_level AS ENUM ('HIGH', 'MEDIUM', 'UNPROVEN', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.tutor_subjects (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id           uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  subject_id         uuid NOT NULL REFERENCES public.subjects (id) ON DELETE CASCADE,
  confidence         public.confidence_level NOT NULL DEFAULT 'UNPROVEN',
  qualification_note text,                   -- tutor's explanation when adding the subject
  graded_by          uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- A tutor can only appear once per subject
  CONSTRAINT tutor_subjects_unique UNIQUE (tutor_id, subject_id)
);

CREATE INDEX IF NOT EXISTS tutor_subjects_tutor_idx      ON public.tutor_subjects (tutor_id);
CREATE INDEX IF NOT EXISTS tutor_subjects_subject_idx    ON public.tutor_subjects (subject_id);
CREATE INDEX IF NOT EXISTS tutor_subjects_confidence_idx ON public.tutor_subjects (confidence);

CREATE TRIGGER tutor_subjects_updated_at
  BEFORE UPDATE ON public.tutor_subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
