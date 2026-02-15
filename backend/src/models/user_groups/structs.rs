use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
