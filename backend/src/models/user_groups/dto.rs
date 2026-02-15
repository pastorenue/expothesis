use serde::Deserialize;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateUserGroupRequest {
    pub name: String,
    pub description: String,
    pub assignment_rule: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserGroupRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub assignment_rule: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MoveUserGroupRequest {
    pub from_experiment_id: Uuid,
    pub to_experiment_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct AssignUserRequest {
    pub user_id: String,
    pub experiment_id: Uuid,
    pub group_id: Uuid,
    pub attributes: Option<serde_json::Value>,
}
