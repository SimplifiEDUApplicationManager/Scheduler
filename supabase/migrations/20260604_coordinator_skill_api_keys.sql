-- Add per-coordinator skill API keys.
-- Each coordinator/super-admin gets a unique bearer token stored in this column.
-- The MCP skill server looks up the caller by matching the incoming bearer token
-- against this column, replacing the old SKILL_API_KEY + SKILL_COORDINATOR_ID env vars.

ALTER TABLE users ADD COLUMN IF NOT EXISTS skill_api_key text UNIQUE;

-- Generate keys for all existing active coordinators and super admins.
UPDATE users
SET skill_api_key = 'sk_coord_' || encode(gen_random_bytes(24), 'hex')
WHERE role IN ('COORDINATOR', 'SUPER_ADMIN')
  AND skill_api_key IS NULL;
