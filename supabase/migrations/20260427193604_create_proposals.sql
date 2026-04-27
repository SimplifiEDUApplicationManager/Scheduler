-- Migration: create_proposals
-- A coordinator proposes a student to a tutor. The tutor accepts or declines on the web app.

DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.proposals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id           uuid REFERENCES public.users (id) ON DELETE SET NULL,
  coordinator_id     uuid REFERENCES public.users (id) ON DELETE SET NULL,
  student_name       text NOT NULL,
  student_email      text NOT NULL,
  subject            text NOT NULL,
  requested_schedule jsonb NOT NULL DEFAULT '[]',  -- array of {day, start, end} tuples
  timezone           text NOT NULL,                -- student's IANA timezone
  start_date         date,
  notes              text,
  status             public.proposal_status NOT NULL DEFAULT 'PENDING',
  decline_reason     text,
  asana_task_id      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz
);

CREATE INDEX IF NOT EXISTS proposals_tutor_idx       ON public.proposals (tutor_id);
CREATE INDEX IF NOT EXISTS proposals_coordinator_idx ON public.proposals (coordinator_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx      ON public.proposals (status);
CREATE INDEX IF NOT EXISTS proposals_asana_idx       ON public.proposals (asana_task_id)
  WHERE asana_task_id IS NOT NULL;
