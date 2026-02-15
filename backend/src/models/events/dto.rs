use chrono::{DateTime, Utc};
use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct IngestEventRequest {
    pub experiment_id: Uuid,
    pub user_id: String,
    pub variant: String,
    pub metric_name: String,
    pub metric_value: f64,
    pub attributes: Option<serde_json::Value>,
    pub timestamp: Option<DateTime<Utc>>,
}
