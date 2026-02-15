use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::structs::*;

#[derive(Debug, Deserialize)]
pub struct AnalyticsAlertRequest {
    pub title: String,
    pub severity: String,
    pub detail: String,
    pub experiment_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct AnalyticsOverviewResponse {
    pub summary: AnalyticsSummary,
    pub throughput: Vec<AnalyticsThroughputPoint>,
    pub metric_coverage: Vec<AnalyticsMetricCoverageSlice>,
    pub metric_coverage_totals: AnalyticsMetricCoverageTotals,
    pub primary_metric_trend: Vec<AnalyticsPrimaryMetricPoint>,
    pub guardrail_health: Vec<AnalyticsGuardrailPoint>,
    pub srm: AnalyticsSrmResponse,
    pub funnel: Vec<AnalyticsFunnelStep>,
    pub anomaly_alerts: Vec<AnalyticsAnomalyPoint>,
    pub segment_lift: Vec<AnalyticsSegmentLiftPoint>,
    pub metric_inventory: Vec<AnalyticsMetricInventoryItem>,
    pub alert_feed: Vec<AnalyticsAlertItem>,
    pub system_health: AnalyticsSystemHealth,
}
