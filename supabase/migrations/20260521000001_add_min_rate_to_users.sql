-- Add minimum hourly rate to tutor profiles.
-- Range: $20–$40 in $5 increments. Default $20.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS min_rate smallint NOT NULL DEFAULT 20
    CHECK (min_rate IN (20, 25, 30, 35, 40));
