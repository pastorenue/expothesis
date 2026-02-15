use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::enums::FeatureGateStatus;

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
