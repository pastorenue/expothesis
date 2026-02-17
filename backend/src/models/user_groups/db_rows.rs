use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct UserGroupRow {
    pub org_id: String,
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
    pub org_id: String,
    pub user_id: String,
    pub experiment_id: String,
    pub variant: String,
    pub group_id: String,
    pub assigned_at: u32,
}
