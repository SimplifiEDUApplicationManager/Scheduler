-- Migration: create_tutor_context
-- One row per tutor: coordinator-managed personality/teaching notes used by /filter AI ranking.
-- No enforced JSONB schema — coordinators store whatever is useful.

CREATE TABLE IF NOT EXISTS public.tutor_context (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  context     jsonb NOT NULL DEFAULT '{}',
  updated_by  uuid REFERENCES public.users (id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_context_tutor_idx ON public.tutor_context (tutor_id);

CREATE TRIGGER tutor_context_updated_at
  BEFORE UPDATE ON public.tutor_context
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
