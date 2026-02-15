use serde::{Deserialize, Serialize};

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
