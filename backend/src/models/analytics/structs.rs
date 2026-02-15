use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct AnalyticsSummary {
    pub active_experiments: u64,
    pub active_experiments_delta: i64,
    pub daily_exposures: u64,
    pub exposures_delta_percent: f64,
    pub primary_conversion_rate: f64,
    pub primary_conversion_delta_pp: f64,
    pub guardrail_breaches: u64,
    pub guardrail_breaches_detail: String,
    pub environment: String,
    pub data_freshness_seconds: u64,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsThroughputPoint {
    pub time: String,
    pub exposures: u64,
    pub assignments: u64,
    pub conversions: u64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsMetricCoverageSlice {
    pub name: String,
    pub value: u64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsMetricCoverageTotals {
    pub total_metrics: u64,
    pub guardrails: u64,
    pub diagnostics: u64,
    pub holdout_metrics: u64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsPrimaryMetricPoint {
    pub day: String,
    pub conversion: f64,
    pub revenue: f64,
    pub retention: f64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsGuardrailPoint {
    pub day: String,
    pub latency: f64,
    pub error_rate: f64,
    pub crash_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsSrmVariant {
    pub variant: String,
    pub expected: f64,
    pub observed: f64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsSrmSummary {
    pub p_value: f64,
    pub allocation_drift: f64,
    pub experiment_id: Option<Uuid>,
    pub experiment_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsSrmResponse {
    pub variants: Vec<AnalyticsSrmVariant>,
    pub summary: AnalyticsSrmSummary,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsFunnelStep {
    pub step: String,
    pub users: u64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsAnomalyPoint {
    pub day: String,
    pub critical: u64,
    pub warning: u64,
    pub info: u64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsSegmentLiftPoint {
    pub segment: String,
    pub lift: f64,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsMetricInventoryItem {
    pub name: String,
    pub category: String,
    pub freshness_seconds: u64,
    pub owner: String,
    pub status: String,
    pub guardrail: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsAlertItem {
    pub title: String,
    pub time: String,
    pub severity: String,
    pub detail: String,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsSystemHealth {
    pub data_freshness_seconds: u64,
    pub sdk_error_rate: f64,
    pub evaluation_latency_ms: f64,
}
