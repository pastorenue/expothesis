use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct MetricEventRow {
    pub org_id: String,
    pub event_id: String,
    pub experiment_id: String,
    pub user_id: String,
    pub variant: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub attributes: Option<String>,
    pub timestamp: u32,
}
