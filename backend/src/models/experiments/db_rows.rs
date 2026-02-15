use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct ExperimentRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub experiment_type: String,
    pub sampling_method: String,
    pub analysis_engine: String,
    pub sampling_seed: u64,
    pub feature_flag_id: Option<String>,
    pub feature_gate_id: Option<String>,
    pub health_checks: String,
    pub hypothesis_null: String,
    pub hypothesis_alternative: String,
    pub expected_effect_size: f64,
    pub metric_type: String,
    pub significance_level: f64,
    pub power: f64,
    pub minimum_sample_size: Option<u64>,
    pub primary_metric: String,
    pub variants: String,    // JSON
    pub user_groups: String, // JSON
    pub start_date: Option<u32>,
    pub end_date: Option<u32>,
    pub created_at: u32,
    pub updated_at: u32,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct VariantMetricsRow {
    pub variant: String,
    pub total: u64,
    pub successes: u64,
    pub mean: f64,
    pub std_dev: f64,
}
