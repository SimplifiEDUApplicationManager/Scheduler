-- Add offered hourly rate to tutoring requests.
-- Set by coordinator when creating a request. Nullable — not all requests have a rate.
-- Range: $20–$40 in $5 increments when set.
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS offered_rate smallint
    CHECK (offered_rate IS NULL OR offered_rate IN (20, 25, 30, 35, 40));
