use serde::Deserialize;
use uuid::Uuid;

use super::enums::FeatureFlagStatus;

#[derive(Debug, Deserialize)]
pub struct CreateFeatureFlagRequest {
    pub name: String,
    pub description: String,
    pub status: Option<FeatureFlagStatus>,
    pub tags: Option<Vec<String>>,
    pub environment: Option<String>,
    pub owner: Option<String>,
    pub user_groups: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFeatureFlagRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<FeatureFlagStatus>,
    pub tags: Option<Vec<String>>,
    pub environment: Option<String>,
    pub owner: Option<String>,
    pub user_groups: Option<Vec<Uuid>>,
}
