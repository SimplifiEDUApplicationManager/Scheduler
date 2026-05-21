-- Carry the coordinator's offered rate onto the proposal so the tutor can
-- see what rate is being offered when reviewing the request on their side.
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS offered_rate smallint
    CHECK (offered_rate IS NULL OR offered_rate IN (20, 25, 30, 35, 40));
