use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExperimentStatus {
    Draft,
    Running,
    Paused,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExperimentType {
    AbTest,
    Multivariate,
    FeatureGate,
    Holdout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SamplingMethod {
    Hash,
    Random,
    Stratified,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnalysisEngine {
    Frequentist,
    Bayesian,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthCheckDirection {
    AtLeast,
    AtMost,
    Between,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheck {
    pub metric_name: String,
    pub direction: HealthCheckDirection,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Experiment {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub status: ExperimentStatus,
    pub experiment_type: ExperimentType,
    pub sampling_method: SamplingMethod,
    pub analysis_engine: AnalysisEngine,
    pub sampling_seed: u64,
    pub feature_flag_id: Option<Uuid>,
    pub feature_gate_id: Option<Uuid>,
    pub health_checks: Vec<HealthCheck>,
    pub hypothesis: Option<Hypothesis>,
    pub variants: Vec<Variant>,
    pub user_groups: Vec<Uuid>,
    pub primary_metric: String,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hypothesis {
    pub null_hypothesis: String,
    pub alternative_hypothesis: String,
    pub expected_effect_size: f64,
    pub metric_type: MetricType,
    pub significance_level: f64, // Alpha (typically 0.05)
    pub power: f64,              // Typically 0.8
    pub minimum_sample_size: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MetricType {
    Proportion, // For conversion rates
    Continuous, // For average values
    Count,      // For count data
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variant {
    pub name: String,
    pub description: String,
    pub allocation_percent: f64,
    pub is_control: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserGroup {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub assignment_rule: String,
    pub size: usize,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAssignment {
    pub user_id: String,
    pub experiment_id: Uuid,
    pub variant: String,
    pub group_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricEvent {
    pub event_id: Uuid,
    pub experiment_id: Uuid,
    pub user_id: String,
    pub variant: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatisticalResult {
    pub experiment_id: Uuid,
    pub variant_a: String,
    pub variant_b: String,
    pub metric_name: String,
    pub sample_size_a: usize,
    pub sample_size_b: usize,
    pub mean_a: f64,
    pub mean_b: f64,
    pub std_dev_a: Option<f64>,
    pub std_dev_b: Option<f64>,
    pub effect_size: f64,
    pub p_value: f64,
    pub bayes_probability: Option<f64>,
    pub confidence_interval_lower: f64,
    pub confidence_interval_upper: f64,
    pub is_significant: bool,
    pub test_type: String,
    pub analysis_engine: AnalysisEngine,
    pub calculated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FeatureFlagStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FeatureGateStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureFlag {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub status: FeatureFlagStatus,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureGate {
    pub id: Uuid,
    pub flag_id: Uuid,
    pub name: String,
    pub description: String,
    pub status: FeatureGateStatus,
    pub rule: String,
    pub default_value: bool,
    pub pass_value: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub metric_name: String,
    pub direction: HealthCheckDirection,
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub current_value: Option<f64>,
    pub is_passing: bool,
}

// API request/response types
#[derive(Debug, Deserialize)]
pub struct CreateExperimentRequest {
    pub name: String,
    pub description: String,
    pub experiment_type: Option<ExperimentType>,
    pub sampling_method: Option<SamplingMethod>,
    pub analysis_engine: Option<AnalysisEngine>,
    pub feature_flag_id: Option<Uuid>,
    pub feature_gate_id: Option<Uuid>,
    pub health_checks: Option<Vec<HealthCheck>>,
    pub hypothesis: Hypothesis,
    pub variants: Vec<Variant>,
    pub primary_metric: String,
    pub user_groups: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserGroupRequest {
    pub name: String,
    pub description: String,
    pub assignment_rule: String,
}

#[derive(Debug, Deserialize)]
pub struct MoveUserGroupRequest {
    pub from_experiment_id: Uuid,
    pub to_experiment_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct IngestEventRequest {
    pub experiment_id: Uuid,
    pub user_id: String,
    pub variant: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct AssignUserRequest {
    pub user_id: String,
    pub experiment_id: Uuid,
    pub group_id: Uuid,
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFeatureFlagRequest {
    pub name: String,
    pub description: String,
    pub status: Option<FeatureFlagStatus>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateFeatureGateRequest {
    pub flag_id: Uuid,
    pub name: String,
    pub description: String,
    pub status: Option<FeatureGateStatus>,
    pub rule: String,
    pub default_value: bool,
    pub pass_value: bool,
}

#[derive(Debug, Deserialize)]
pub struct EvaluateFeatureGateRequest {
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct FeatureGateEvaluationResponse {
    pub gate_id: Uuid,
    pub flag_id: Uuid,
    pub pass: bool,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct ExperimentAnalysisResponse {
    pub experiment: Experiment,
    pub results: Vec<StatisticalResult>,
    pub sample_sizes: Vec<VariantSampleSize>,
    pub health_checks: Vec<HealthCheckResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VariantSampleSize {
    pub variant: String,
    pub current_size: usize,
    pub required_size: usize,
}

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
pub struct UserGroupRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub assignment_rule: String,
    pub size: u64,
    pub created_at: u32,
    pub updated_at: u32,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct UserAssignmentRow {
    pub user_id: String,
    pub experiment_id: String,
    pub variant: String,
    pub group_id: String,
    pub assigned_at: u32,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct VariantMetricsRow {
    pub variant: String,
    pub total: u64,
    pub successes: u64,
    pub mean: f64,
    pub std_dev: f64,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct MetricEventRow {
    pub event_id: String,
    pub experiment_id: String,
    pub user_id: String,
    pub variant: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub timestamp: u32,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct FeatureFlagRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub tags: String,
    pub created_at: u32,
    pub updated_at: u32,
}

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct FeatureGateRow {
    pub id: String,
    pub flag_id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub rule: String,
    pub default_value: u8,
    pub pass_value: u8,
    pub created_at: u32,
    pub updated_at: u32,
}
