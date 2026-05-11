-- Migration: create requests table for Phase 8 Asana integration
-- Run this in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id      uuid NOT NULL REFERENCES users(id),
  asana_task_id       text UNIQUE,        -- null for manual entry
  asana_task_url      text,
  source              text NOT NULL DEFAULT 'manual',  -- 'asana' | 'manual'
  status              text NOT NULL DEFAULT 'open',    -- 'open' | 'matched'
  student_name        text NOT NULL,
  student_email       text NOT NULL DEFAULT '',
  subject             text,
  requested_schedule  jsonb,
  timezone            text,
  start_date          text,
  notes               text,
  matched_proposal_id uuid REFERENCES proposals(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS requests_coordinator_id_idx ON requests (coordinator_id);
CREATE INDEX IF NOT EXISTS requests_status_idx         ON requests (status);
CREATE INDEX IF NOT EXISTS requests_asana_task_id_idx  ON requests (asana_task_id);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

-- Coordinators see their own requests; SUPER_ADMINs see all.
CREATE POLICY "Coordinators can manage their requests"
  ON requests FOR ALL
  USING (
    coordinator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
    )
  );

-- Auto-update updated_at on every row change.
CREATE OR REPLACE FUNCTION set_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS requests_set_updated_at ON requests;
CREATE TRIGGER requests_set_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION set_requests_updated_at();
