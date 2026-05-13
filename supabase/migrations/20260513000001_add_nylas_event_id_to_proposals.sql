-- Add nylas_event_id to proposals so the accept route can record the
-- created Nylas event ID back to the proposal row.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS nylas_event_id text;
