use crate::db::ClickHouseClient;
use crate::models::*;
use crate::services::targeting::TargetingEngine;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use log::info;
use uuid::Uuid;

pub struct FeatureGateService {
    db: ClickHouseClient,
}

impl FeatureGateService {
    pub fn new(db: ClickHouseClient) -> Self {
        Self { db }
    }

    pub async fn create_gate(&self, req: CreateFeatureGateRequest) -> Result<FeatureGate> {
        info!("Creating feature gate: {}", req.name);

        let gate = FeatureGate {
            id: Uuid::new_v4(),
            flag_id: req.flag_id,
            name: req.name,
            description: req.description,
            status: req.status.unwrap_or(FeatureGateStatus::Active),
            rule: req.rule,
            default_value: req.default_value,
            pass_value: req.pass_value,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.save_gate(&gate).await?;
        Ok(gate)
    }

    pub async fn list_gates(&self, flag_id: Option<Uuid>) -> Result<Vec<FeatureGate>> {
        let mut query = String::from("SELECT ?fields FROM feature_gates FINAL");
        if flag_id.is_some() {
            query.push_str(" WHERE flag_id = ?");
        }
        query.push_str(" ORDER BY updated_at DESC");

        let mut request = self.db.client().query(&query);
        if let Some(flag_id) = flag_id {
            request = request.bind(flag_id.to_string());
        }

        let rows = request
            .fetch_all::<FeatureGateRow>()
            .await
            .context("Failed to fetch feature gates")?;

        let mut gates = Vec::new();
        for row in rows {
            gates.push(self.row_to_gate(row)?);
        }

        Ok(gates)
    }

    pub async fn get_gate(&self, gate_id: Uuid) -> Result<FeatureGate> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM feature_gates FINAL WHERE id = ?")
            .bind(gate_id.to_string())
            .fetch_one::<FeatureGateRow>()
            .await
            .context("Failed to fetch feature gate")?;

        self.row_to_gate(row)
    }

    pub async fn evaluate_gate(
        &self,
        gate_id: Uuid,
        req: EvaluateFeatureGateRequest,
    ) -> Result<FeatureGateEvaluationResponse> {
        let gate = self.get_gate(gate_id).await?;
        let attrs = req.attributes.unwrap_or(serde_json::json!({}));

        if matches!(gate.status, FeatureGateStatus::Inactive) {
            return Ok(FeatureGateEvaluationResponse {
                gate_id: gate.id,
                flag_id: gate.flag_id,
                pass: gate.default_value,
                reason: "Gate inactive".to_string(),
            });
        }

        if gate.rule.trim().is_empty() {
            return Ok(FeatureGateEvaluationResponse {
                gate_id: gate.id,
                flag_id: gate.flag_id,
                pass: gate.default_value,
                reason: "No targeting rule".to_string(),
            });
        }

        let matches = TargetingEngine::evaluate(&gate.rule, &attrs);
        let pass = if matches { gate.pass_value } else { gate.default_value };

        Ok(FeatureGateEvaluationResponse {
            gate_id: gate.id,
            flag_id: gate.flag_id,
            pass,
            reason: if matches {
                "Rule matched".to_string()
            } else {
                "Rule not matched".to_string()
            },
        })
    }

    async fn save_gate(&self, gate: &FeatureGate) -> Result<()> {
        let row = FeatureGateRow {
            id: gate.id.to_string(),
            flag_id: gate.flag_id.to_string(),
            name: gate.name.clone(),
            description: gate.description.clone(),
            status: format!("{:?}", gate.status).to_lowercase(),
            rule: gate.rule.clone(),
            default_value: gate.default_value as u8,
            pass_value: gate.pass_value as u8,
            created_at: gate.created_at.timestamp() as u32,
            updated_at: gate.updated_at.timestamp() as u32,
        };

        let mut insert = self.db.client().insert("feature_gates")?;
        insert.write(&row).await?;
        insert.end().await?;

        Ok(())
    }

    fn row_to_gate(&self, row: FeatureGateRow) -> Result<FeatureGate> {
        let status = match row.status.as_str() {
            "inactive" => FeatureGateStatus::Inactive,
            _ => FeatureGateStatus::Active,
        };

        Ok(FeatureGate {
            id: Uuid::parse_str(&row.id)?,
            flag_id: Uuid::parse_str(&row.flag_id)?,
            name: row.name,
            description: row.description,
            status,
            rule: row.rule,
            default_value: row.default_value > 0,
            pass_value: row.pass_value > 0,
            created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
        })
    }
}
