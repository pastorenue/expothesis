CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id)
);

-- Seed a default org and backfill memberships for existing users
INSERT INTO organizations (id, name)
SELECT uuid_generate_v4(), 'Default Org'
WHERE NOT EXISTS (SELECT 1 FROM organizations);

INSERT INTO organization_memberships (org_id, user_id, role)
SELECT o.id, u.id, 'owner'
FROM organizations o
JOIN users u ON TRUE
LEFT JOIN organization_memberships m ON m.org_id = o.id AND m.user_id = u.id
WHERE m.id IS NULL;
