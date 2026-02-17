-- Add org_id to core tables
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE sdk_tokens ADD COLUMN IF NOT EXISTS org_id UUID;

-- Backfill with default org
WITH default_org AS (
    SELECT id FROM organizations LIMIT 1
)
UPDATE sessions SET org_id = (SELECT id FROM default_org) WHERE org_id IS NULL;

WITH default_org AS (
    SELECT id FROM organizations LIMIT 1
)
UPDATE otp_codes SET org_id = (SELECT id FROM default_org) WHERE org_id IS NULL;

WITH default_org AS (
    SELECT id FROM organizations LIMIT 1
)
UPDATE sdk_tokens SET org_id = (SELECT id FROM default_org) WHERE org_id IS NULL;

-- Enforce not null after backfill
ALTER TABLE sessions ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE otp_codes ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE sdk_tokens ALTER COLUMN org_id SET NOT NULL;
