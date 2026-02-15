use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricEvent {
    pub event_id: Uuid,
    pub experiment_id: Uuid,
    pub user_id: String,
    pub variant: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub attributes: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}
