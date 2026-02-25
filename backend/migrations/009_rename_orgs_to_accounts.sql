-- Migration 009: Rename Organizations to Accounts

-- 1. Rename tables
ALTER TABLE organizations RENAME TO accounts;
ALTER TABLE organization_invites RENAME TO account_invites;
ALTER TABLE organization_memberships RENAME TO account_memberships;

-- 2. Rename columns in the new accounts table (none needed, id is just id)

-- 3. Rename org_id to account_id in all tables
ALTER TABLE experiments RENAME COLUMN org_id TO account_id;
ALTER TABLE user_groups RENAME COLUMN org_id TO account_id;
ALTER TABLE feature_flags RENAME COLUMN org_id TO account_id;
ALTER TABLE feature_gates RENAME COLUMN org_id TO account_id;
ALTER TABLE sdk_tokens RENAME COLUMN org_id TO account_id;
ALTER TABLE sessions RENAME COLUMN org_id TO account_id;
ALTER TABLE otp_codes RENAME COLUMN org_id TO account_id;
ALTER TABLE account_invites RENAME COLUMN org_id TO account_id;
ALTER TABLE account_memberships RENAME COLUMN org_id TO account_id;

-- 4. Update index names for consistency
ALTER INDEX idx_experiments_org_id RENAME TO idx_experiments_account_id;
ALTER INDEX idx_user_groups_org_id RENAME TO idx_user_groups_account_id;
ALTER INDEX idx_feature_flags_org_id RENAME TO idx_feature_flags_account_id;
ALTER INDEX idx_feature_gates_org_id RENAME TO idx_feature_gates_account_id;
ALTER INDEX idx_organization_invites_token RENAME TO idx_account_invites_token;
ALTER INDEX idx_organization_invites_email RENAME TO idx_account_invites_email;
