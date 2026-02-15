CREATE TABLE IF NOT EXISTS sdk_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracking_api_key TEXT NOT NULL,
    feature_flags_api_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
