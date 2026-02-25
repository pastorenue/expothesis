use crate::models::*;
use crate::services::targeting::TargetingEngine;
use anyhow::{Context, Result};
use chrono::Utc;
use log::info;
use sqlx::PgPool;
use uuid::Uuid;

pub struct FeatureGateService {
    pg: PgPool,
}

#[derive(sqlx::FromRow)]
struct FeatureGateRow {
    id: Uuid,
    flag_id: Option<Uuid>,
    name: String,
    description: String,
    status: String,
    rule: String,
    default_value: bool,
    pass_value: bool,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}

impl FeatureGateService {
    pub fn new(pg: PgPool) -> Self {
        Self { pg }
    }

    pub async fn create_gate(
        &self,
        req: CreateFeatureGateRequest,
        account_id: Uuid,
    ) -> Result<FeatureGate> {
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

        self.upsert_gate(&gate, account_id).await?;
        Ok(gate)
    }

    pub async fn list_gates(
        &self,
        account_id: Uuid,
        flag_id: Option<Uuid>,
    ) -> Result<Vec<FeatureGate>> {
        let rows = if let Some(fid) = flag_id {
            sqlx::query_as::<_, FeatureGateRow>(
                r#"SELECT id, flag_id, name, description, status, rule,
                          default_value, pass_value, created_at, updated_at
                   FROM feature_gates
                   WHERE account_id = $1 AND flag_id = $2
                   ORDER BY updated_at DESC"#,
            )
            .bind(account_id)
            .bind(fid)
            .fetch_all(&self.pg)
            .await
            .context("Failed to fetch feature gates")?
        } else {
            sqlx::query_as::<_, FeatureGateRow>(
                r#"SELECT id, flag_id, name, description, status, rule,
                          default_value, pass_value, created_at, updated_at
                   FROM feature_gates
                   WHERE account_id = $1
                   ORDER BY updated_at DESC"#,
            )
            .bind(account_id)
            .fetch_all(&self.pg)
            .await
            .context("Failed to fetch feature gates")?
        };

        rows.into_iter().map(row_to_gate).collect()
    }

    pub async fn get_gate(&self, account_id: Uuid, gate_id: Uuid) -> Result<FeatureGate> {
        let r = sqlx::query_as::<_, FeatureGateRow>(
            r#"SELECT id, flag_id, name, description, status, rule,
                      default_value, pass_value, created_at, updated_at
               FROM feature_gates
               WHERE id = $1 AND account_id = $2"#,
        )
        .bind(gate_id)
        .bind(account_id)
        .fetch_one(&self.pg)
        .await
        .context("Failed to fetch feature gate")?;

        row_to_gate(r)
    }

    pub async fn evaluate_gate(
        &self,
        gate_id: Uuid,
        account_id: Uuid,
        req: EvaluateFeatureGateRequest,
    ) -> Result<FeatureGateEvaluationResponse> {
        let gate = self.get_gate(account_id, gate_id).await?;
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
        let pass = if matches {
            gate.pass_value
        } else {
            gate.default_value
        };

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

    pub async fn update_gate(
        &self,
        account_id: Uuid,
        gate_id: Uuid,
        req: UpdateFeatureGateRequest,
    ) -> Result<FeatureGate> {
        let mut gate = self.get_gate(account_id, gate_id).await?;

        if let Some(name) = req.name {
            gate.name = name;
        }
        if let Some(description) = req.description {
            gate.description = description;
        }
        if let Some(status) = req.status {
            gate.status = status;
        }
        if let Some(rule) = req.rule {
            gate.rule = rule;
        }
        if let Some(default_value) = req.default_value {
            gate.default_value = default_value;
        }
        if let Some(pass_value) = req.pass_value {
            gate.pass_value = pass_value;
        }

        gate.updated_at = Utc::now();
        self.upsert_gate(&gate, account_id).await?;
        Ok(gate)
    }

    pub async fn delete_gate(&self, account_id: Uuid, gate_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM feature_gates WHERE id = $1 AND account_id = $2")
            .bind(gate_id)
            .bind(account_id)
            .execute(&self.pg)
            .await
            .context("Failed to delete feature gate")?;

        Ok(())
    }

    async fn upsert_gate(&self, gate: &FeatureGate, account_id: Uuid) -> Result<()> {
        let status = format!("{:?}", gate.status).to_lowercase();
        let flag_id = if gate.flag_id == Uuid::nil() {
            None
        } else {
            Some(gate.flag_id)
        };

        sqlx::query(
            r#"INSERT INTO feature_gates
                (id, account_id, flag_id, name, description, status, rule, default_value, pass_value, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
                 flag_id       = EXCLUDED.flag_id,
                 name          = EXCLUDED.name,
                 description   = EXCLUDED.description,
                 status        = EXCLUDED.status,
                 rule          = EXCLUDED.rule,
                 default_value = EXCLUDED.default_value,
                 pass_value    = EXCLUDED.pass_value,
                 updated_at    = EXCLUDED.updated_at"#,
        )
        .bind(gate.id)
        .bind(account_id)
        .bind(flag_id)
        .bind(&gate.name)
        .bind(&gate.description)
        .bind(status)
        .bind(&gate.rule)
        .bind(gate.default_value)
        .bind(gate.pass_value)
        .bind(gate.created_at)
        .bind(gate.updated_at)
        .execute(&self.pg)
        .await
        .context("Failed to upsert feature gate")?;

        Ok(())
    }
}

fn row_to_gate(r: FeatureGateRow) -> Result<FeatureGate> {
    Ok(FeatureGate {
        id: r.id,
        flag_id: r.flag_id.unwrap_or(Uuid::nil()),
        name: r.name,
        description: r.description,
        status: match r.status.as_str() {
            "active" => FeatureGateStatus::Active,
            "paused" => FeatureGateStatus::Paused,
            _ => FeatureGateStatus::Draft,
        },
        rule: r.rule,
        default_value: r.default_value,
        pass_value: r.pass_value,
        created_at: r.created_at,
        updated_at: r.updated_at,
    })
}
