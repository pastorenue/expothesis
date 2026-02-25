-- Migration 006: Move config tables from ClickHouse to Postgres
-- Tables: experiments, user_groups, feature_flags, feature_gates, cuped_configs
-- Also adds is_super_admin to users

-- ============================================================
-- 1. Super Admin column on users
-- ============================================================
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark the seeded admin user as super admin (if DEFAULT_ADMIN_EMAIL is set)
-- This is also handled at runtime in auth_service ensure_admin
UPDATE users
SET is_super_admin = TRUE
WHERE email = current_setting('app.admin_email', true);

-- ============================================================
-- 2. Experiments
-- ============================================================
CREATE TABLE IF NOT EXISTS experiments (
    id              UUID PRIMARY KEY,
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'draft',
    experiment_type TEXT NOT NULL DEFAULT 'a_b',
    sampling_method TEXT NOT NULL DEFAULT 'random',
    analysis_engine TEXT NOT NULL DEFAULT 'frequentist',
    sampling_seed   BIGINT NOT NULL DEFAULT 0,
    feature_flag_id UUID,
    feature_gate_id UUID,
    health_checks   JSONB NOT NULL DEFAULT '[]',
    hypothesis      JSONB,
    variants        JSONB NOT NULL DEFAULT '[]',
    user_groups     JSONB NOT NULL DEFAULT '[]',
    primary_metric  TEXT NOT NULL DEFAULT '',
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiments_org_id ON experiments(org_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

-- ============================================================
-- 3. User Groups
-- ============================================================
CREATE TABLE IF NOT EXISTS user_groups (
    id              UUID PRIMARY KEY,
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    assignment_rule TEXT NOT NULL DEFAULT '',
    size            INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_groups_org_id ON user_groups(org_id);

-- ============================================================
-- 4. Feature Flags
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    id          UUID PRIMARY KEY,
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'inactive',
    tags        JSONB NOT NULL DEFAULT '[]',
    environment TEXT NOT NULL DEFAULT '',
    owner       TEXT NOT NULL DEFAULT '',
    user_groups JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org_id ON feature_flags(org_id);

-- ============================================================
-- 5. Feature Gates
-- ============================================================
CREATE TABLE IF NOT EXISTS feature_gates (
    id            UUID PRIMARY KEY,
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    flag_id       UUID REFERENCES feature_flags(id) ON DELETE SET NULL,
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'inactive',
    rule          TEXT NOT NULL DEFAULT '',
    default_value BOOLEAN NOT NULL DEFAULT FALSE,
    pass_value    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_gates_org_id ON feature_gates(org_id);
CREATE INDEX IF NOT EXISTS idx_feature_gates_flag_id ON feature_gates(flag_id);

-- ============================================================
-- 6. CUPED Configs
-- ============================================================
CREATE TABLE IF NOT EXISTS cuped_configs (
    experiment_id       UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    covariate_metric    TEXT NOT NULL,
    lookback_days       INTEGER NOT NULL DEFAULT 14,
    min_sample_size     BIGINT NOT NULL DEFAULT 100,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (experiment_id)
);
