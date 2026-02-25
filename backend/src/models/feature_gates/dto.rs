use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::enums::FeatureGateStatus;

#[derive(Debug, Deserialize)]
pub struct CreateFeatureGateRequest {
    pub flag_id: Uuid,
    pub name: String,
    pub description: String,
    pub status: Option<FeatureGateStatus>,
    pub rule: String,
    pub default_value: bool,
    pub pass_value: bool,
}

#[derive(Debug, Deserialize)]
pub struct EvaluateFeatureGateRequest {
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct FeatureGateEvaluationResponse {
    pub gate_id: Uuid,
    pub flag_id: Uuid,
    pub pass: bool,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFeatureGateRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<FeatureGateStatus>,
    pub rule: Option<String>,
    pub default_value: Option<bool>,
    pub pass_value: Option<bool>,
}
