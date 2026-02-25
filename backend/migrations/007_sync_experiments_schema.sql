-- Migration 007: Sync experiments schema
-- Add missing columns to experiments table that were skipped in 006 due to IF NOT EXISTS

ALTER TABLE experiments
    ADD COLUMN IF NOT EXISTS experiment_type TEXT NOT NULL DEFAULT 'a_b',
    ADD COLUMN IF NOT EXISTS sampling_method TEXT NOT NULL DEFAULT 'random',
    ADD COLUMN IF NOT EXISTS analysis_engine TEXT NOT NULL DEFAULT 'frequentist',
    ADD COLUMN IF NOT EXISTS sampling_seed   BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS feature_flag_id UUID,
    ADD COLUMN IF NOT EXISTS feature_gate_id UUID,
    ADD COLUMN IF NOT EXISTS health_checks   JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS hypothesis      JSONB,
    ADD COLUMN IF NOT EXISTS primary_metric  TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS start_date      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_date        TIMESTAMPTZ;
