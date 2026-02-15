use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct FeatureFlagRow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub tags: String,
    pub environment: String,
    pub owner: String,
    pub user_groups: String,
    pub created_at: u32,
    pub updated_at: u32,
}
