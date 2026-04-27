-- Migration: create_subjects
-- Master list of tutoring subjects. Coordinators manage this list;
-- tutors select from it (they cannot create free-text entries).

CREATE TABLE IF NOT EXISTS public.subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL,  -- e.g. 'STEM', 'Humanities', 'Languages'
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subjects_name_unique UNIQUE (name)
);

-- Index for fast subject lookups by category in the filter panel
CREATE INDEX IF NOT EXISTS subjects_category_idx ON public.subjects (category);

-- Shared trigger function for updated_at columns (used by this and later tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
