-- Migration: create_holds
-- A coordinator temporarily blocks time on a tutor's calendar.
-- Holds expire after 48 hours (TTL) if not converted to a real booking.

DO $$ BEGIN
  CREATE TYPE public.hold_status AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.holds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id        uuid REFERENCES public.users (id) ON DELETE SET NULL,
  coordinator_id  uuid REFERENCES public.users (id) ON DELETE SET NULL,
  start_utc       timestamptz NOT NULL,
  end_utc         timestamptz NOT NULL,
  reason          text NOT NULL,
  nylas_event_id  text,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  status          public.hold_status NOT NULL DEFAULT 'ACTIVE',
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT holds_end_after_start CHECK (end_utc > start_utc)
);

-- Keep expires_at in sync with created_at on insert
CREATE OR REPLACE FUNCTION public.set_hold_expires_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.expires_at = NEW.created_at + interval '48 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER holds_set_expires_at
  BEFORE INSERT ON public.holds
  FOR EACH ROW EXECUTE FUNCTION public.set_hold_expires_at();

CREATE INDEX IF NOT EXISTS holds_tutor_idx      ON public.holds (tutor_id);
CREATE INDEX IF NOT EXISTS holds_coordinator_idx ON public.holds (coordinator_id);
CREATE INDEX IF NOT EXISTS holds_status_idx     ON public.holds (status);
-- Fast lookup for expiry job: find ACTIVE holds past their TTL
CREATE INDEX IF NOT EXISTS holds_expires_idx    ON public.holds (expires_at)
  WHERE status = 'ACTIVE';
