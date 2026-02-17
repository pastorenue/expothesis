-- Ensure experiments table exists (dev bootstrap)
CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    variants JSONB NOT NULL DEFAULT '[]',
    user_groups JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure user_groups table exists (dev bootstrap)
CREATE TABLE IF NOT EXISTS user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignment_rule TEXT NOT NULL DEFAULT 'hash',
    size INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE experiments ADD COLUMN IF NOT EXISTS org_id UUID;
ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS org_id UUID;

WITH default_org AS (SELECT id FROM organizations LIMIT 1)
UPDATE experiments SET org_id = (SELECT id FROM default_org) WHERE org_id IS NULL;

WITH default_org AS (SELECT id FROM organizations LIMIT 1)
UPDATE user_groups SET org_id = (SELECT id FROM default_org) WHERE org_id IS NULL;

ALTER TABLE experiments ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE user_groups ALTER COLUMN org_id SET NOT NULL;
