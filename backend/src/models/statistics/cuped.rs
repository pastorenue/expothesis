use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Persisted CUPED configuration for an experiment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CupedConfig {
    pub experiment_id: Uuid,
    pub covariate_metric: String,
    pub lookback_days: u32,
    pub min_sample_size: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// ClickHouse row for cuped_configs table
#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct CupedConfigRow {
    pub experiment_id: String,
    pub covariate_metric: String,
    pub lookback_days: u32,
    pub min_sample_size: u64,
    pub created_at: u32,
    pub updated_at: u32,
}

/// Request DTO for creating/updating CUPED config
#[derive(Debug, Deserialize)]
pub struct CupedConfigRequest {
    pub covariate_metric: String,
    pub lookback_days: Option<u32>,
    pub min_sample_size: Option<usize>,
}

/// Query parameter for the analysis endpoint
#[derive(Debug, Deserialize)]
pub struct AnalysisQuery {
    pub use_cuped: Option<bool>,
}

/// CUPED-adjusted result for a variant comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CupedAdjustedResult {
    pub variant_a: String,
    pub variant_b: String,
    pub metric_name: String,
    pub theta: f64,
    pub adjusted_mean_a: f64,
    pub adjusted_mean_b: f64,
    pub adjusted_effect_size: f64,
    pub adjusted_p_value: f64,
    pub adjusted_ci_lower: f64,
    pub adjusted_ci_upper: f64,
    pub variance_reduction_percent: f64,
    pub original_variance_a: f64,
    pub original_variance_b: f64,
    pub adjusted_variance_a: f64,
    pub adjusted_variance_b: f64,
    pub is_significant: bool,
    pub n_matched_users_a: usize,
    pub n_matched_users_b: usize,
}

/// ClickHouse row for fetching per-user metric values
#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct UserMetricRow {
    pub user_id: String,
    pub metric_value: f64,
}
