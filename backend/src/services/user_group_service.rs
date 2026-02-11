use crate::db::ClickHouseClient;
use crate::models::*;
use crate::services::targeting::TargetingEngine;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use log::info;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use uuid::Uuid;

pub struct UserGroupService {
    db: ClickHouseClient,
}

impl UserGroupService {
    pub fn new(db: ClickHouseClient) -> Self {
        Self { db }
    }

    pub async fn create_user_group(&self, req: CreateUserGroupRequest) -> Result<UserGroup> {
        info!("Creating user group: {}", req.name);

        let group = UserGroup {
            id: Uuid::new_v4(),
            name: req.name,
            description: req.description,
            assignment_rule: req.assignment_rule,
            size: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.save_user_group(&group).await?;

        Ok(group)
    }

    pub async fn get_user_group(&self, group_id: Uuid) -> Result<UserGroup> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM user_groups FINAL WHERE id = ?")
            .bind(group_id.to_string())
            .fetch_one::<UserGroupRow>()
            .await
            .context("Failed to fetch user group")?;

        Ok(UserGroup {
            id: Uuid::parse_str(&row.id)?,
            name: row.name,
            description: row.description,
            assignment_rule: row.assignment_rule,
            size: row.size as usize,
            created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
        })
    }

    pub async fn list_user_groups(&self) -> Result<Vec<UserGroup>> {
        let rows = self
            .db
            .client()
            .query("SELECT ?fields FROM user_groups FINAL ORDER BY updated_at DESC")
            .fetch_all::<UserGroupRow>()
            .await
            .context("Failed to fetch user groups")?;

        let mut groups = Vec::new();
        for row in rows {
            groups.push(UserGroup {
                id: Uuid::parse_str(&row.id)?,
                name: row.name,
                description: row.description,
                assignment_rule: row.assignment_rule,
                size: row.size as usize,
                created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
                updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
            });
        }

        Ok(groups)
    }

    pub async fn assign_user_to_variant(
        &self,
        user_id: &str,
        experiment_id: Uuid,
        group_id: Uuid,
        variants: &[Variant],
        sampling_method: SamplingMethod,
        sampling_seed: u64,
        attributes: Option<serde_json::Value>,
    ) -> Result<UserAssignment> {
        info!("Assigning user {} to experiment {}", user_id, experiment_id);

        let variant_name = self.select_variant(
            user_id,
            experiment_id,
            variants,
            sampling_method,
            sampling_seed,
            attributes,
        );

        let assignment = UserAssignment {
            user_id: user_id.to_string(),
            experiment_id,
            variant: variant_name,
            group_id,
            assigned_at: Utc::now(),
        };

        self.save_assignment(&assignment).await?;

        Ok(assignment)
    }

    pub async fn assign_user_auto(
        &self,
        user_id: &str,
        experiment_id: Uuid,
        group_id: Uuid,
        attributes: Option<serde_json::Value>,
    ) -> Result<UserAssignment> {
        let experiment = self.get_experiment_variants_full(experiment_id).await?;
        let group = self.get_user_group(group_id).await?;

        // Evaluate targeting rule if present
        if !group.assignment_rule.is_empty()
            && group.assignment_rule != "random"
            && group.assignment_rule != "hash"
            && group.assignment_rule != "manual"
        {
            let attrs = attributes.clone().unwrap_or(serde_json::json!({}));
            if !TargetingEngine::evaluate(&group.assignment_rule, &attrs) {
                return Err(anyhow::anyhow!(
                    "User does not meet targeting criteria for group {}",
                    group.name
                ));
            }
        }

        self.assign_user_to_variant(
            user_id,
            experiment_id,
            group_id,
            &experiment.variants,
            experiment.sampling_method,
            experiment.sampling_seed,
            attributes,
        )
        .await
    }

    async fn get_experiment_variants_full(&self, experiment_id: Uuid) -> Result<Experiment> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM experiments FINAL WHERE id = ?")
            .bind(experiment_id.to_string())
            .fetch_one::<ExperimentRow>()
            .await
            .context("Failed to fetch experiment for variants")?;

        let variants: Vec<Variant> = serde_json::from_str(&row.variants)?;
        let user_groups: Vec<Uuid> = serde_json::from_str(&row.user_groups)?;

        let status = match row.status.as_str() {
            "running" => ExperimentStatus::Running,
            "paused" => ExperimentStatus::Paused,
            "stopped" => ExperimentStatus::Stopped,
            _ => ExperimentStatus::Draft,
        };

        Ok(Experiment {
            id: Uuid::parse_str(&row.id)?,
            name: row.name,
            description: row.description,
            status,
            experiment_type: ExperimentType::AbTest,
            sampling_method: sampling_method_from_row(&row.sampling_method),
            analysis_engine: AnalysisEngine::Frequentist,
            sampling_seed: row.sampling_seed,
            feature_flag_id: row
                .feature_flag_id
                .and_then(|id| Uuid::parse_str(&id).ok()),
            feature_gate_id: row
                .feature_gate_id
                .and_then(|id| Uuid::parse_str(&id).ok()),
            health_checks: vec![],
            hypothesis: None, // Not needed here
            variants,
            user_groups,
            primary_metric: row.primary_metric,
            start_date: None,
            end_date: None,
            created_at: Utc::now(), // Placeholder
            updated_at: Utc::now(), // Placeholder
        })
    }

    pub async fn move_user_group(
        &self,
        group_id: Uuid,
        from_experiment_id: Uuid,
        to_experiment_id: Uuid,
    ) -> Result<()> {
        info!(
            "Moving user group {} from experiment {} to {}",
            group_id, from_experiment_id, to_experiment_id
        );

        // Get all users in the group
        let user_ids = self.get_group_user_ids(group_id).await?;

        // Get variants for target experiment
        let to_variants = self.get_experiment_variants(to_experiment_id).await?;

        // Reassign all users
        for user_id in user_ids {
            let experiment = self.get_experiment_variants_full(to_experiment_id).await?;
            self.assign_user_to_variant(
                &user_id,
                to_experiment_id,
                group_id,
                &to_variants,
                experiment.sampling_method,
                experiment.sampling_seed,
                None,
            )
            .await?;
        }

        Ok(())
    }

    pub async fn get_group_metrics(&self, group_id: Uuid) -> Result<GroupMetrics> {
        let group = self.get_user_group(group_id).await?;

        // Mock metrics for now
        Ok(GroupMetrics {
            group_id,
            total_users: group.size,
            active_users: group.size,
            conversion_rate: 0.15,
        })
    }

    fn hash_user_to_variant(
        &self,
        user_id: &str,
        experiment_id: Uuid,
        variants: &[Variant],
    ) -> String {
        let mut hasher = DefaultHasher::new();
        user_id.hash(&mut hasher);
        experiment_id.hash(&mut hasher);
        let hash = hasher.finish();

        // Map hash to variant based on allocation percentages
        let mut cumulative = 0.0;
        let hash_percent = (hash % 10000) as f64 / 100.0;

        for variant in variants {
            cumulative += variant.allocation_percent;
            if hash_percent < cumulative {
                return variant.name.clone();
            }
        }

        // Fallback to first variant
        variants[0].name.clone()
    }

    fn hash_user_to_variant_with_salt(
        &self,
        user_id: &str,
        experiment_id: Uuid,
        variants: &[Variant],
        salt: &str,
    ) -> String {
        let mut hasher = DefaultHasher::new();
        user_id.hash(&mut hasher);
        experiment_id.hash(&mut hasher);
        salt.hash(&mut hasher);
        let hash = hasher.finish();

        let mut cumulative = 0.0;
        let hash_percent = (hash % 10000) as f64 / 100.0;

        for variant in variants {
            cumulative += variant.allocation_percent;
            if hash_percent < cumulative {
                return variant.name.clone();
            }
        }

        variants[0].name.clone()
    }

    fn select_variant(
        &self,
        user_id: &str,
        experiment_id: Uuid,
        variants: &[Variant],
        sampling_method: SamplingMethod,
        sampling_seed: u64,
        attributes: Option<serde_json::Value>,
    ) -> String {
        match sampling_method {
            SamplingMethod::Random => {
                let salt = format!("seed:{}", sampling_seed);
                self.hash_user_to_variant_with_salt(user_id, experiment_id, variants, &salt)
            }
            SamplingMethod::Stratified => {
                let salt = attributes
                    .as_ref()
                    .and_then(|attrs| {
                        attrs
                            .get("stratum")
                            .or_else(|| attrs.get("segment"))
                            .or_else(|| attrs.get("region"))
                    })
                    .and_then(|value| value.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "default".to_string());
                self.hash_user_to_variant_with_salt(user_id, experiment_id, variants, &salt)
            }
            SamplingMethod::Hash => self.hash_user_to_variant(user_id, experiment_id, variants),
        }
    }

    async fn save_user_group(&self, group: &UserGroup) -> Result<()> {
        let row = UserGroupRow {
            id: group.id.to_string(),
            name: group.name.clone(),
            description: group.description.clone(),
            assignment_rule: group.assignment_rule.clone(),
            size: group.size as u64,
            created_at: group.created_at.timestamp() as u32,
            updated_at: group.updated_at.timestamp() as u32,
        };

        let mut insert = self.db.client().insert("user_groups")?;
        insert.write(&row).await?;
        insert.end().await?;

        Ok(())
    }

    async fn save_assignment(&self, assignment: &UserAssignment) -> Result<()> {
        info!(
            "Saving user assignment: user={} experiment={} variant={}",
            assignment.user_id, assignment.experiment_id, assignment.variant
        );

        let row = UserAssignmentRow {
            user_id: assignment.user_id.clone(),
            experiment_id: assignment.experiment_id.to_string(),
            variant: assignment.variant.clone(),
            group_id: assignment.group_id.to_string(),
            assigned_at: assignment.assigned_at.timestamp() as u32,
        };

        let mut insert = self.db.client().insert("user_assignments")?;
        insert.write(&row).await?;
        insert.end().await?;

        Ok(())
    }

    async fn get_group_user_ids(&self, _group_id: Uuid) -> Result<Vec<String>> {
        // Query user_assignments for this group
        // SELECT user_id FROM user_assignments WHERE group_id = ?
        Ok(vec![])
    }

    async fn get_experiment_variants(&self, experiment_id: Uuid) -> Result<Vec<Variant>> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM experiments FINAL WHERE id = ?")
            .bind(experiment_id.to_string())
            .fetch_one::<ExperimentRow>()
            .await
            .context("Failed to fetch experiment for variants")?;

        let variants: Vec<Variant> = serde_json::from_str(&row.variants)?;
        Ok(variants)
    }
}

#[derive(Debug, serde::Serialize)]
pub struct GroupMetrics {
    pub group_id: Uuid,
    pub total_users: usize,
    pub active_users: usize,
    pub conversion_rate: f64,
}

fn sampling_method_from_row(value: &str) -> SamplingMethod {
    match value {
        "random" => SamplingMethod::Random,
        "stratified" => SamplingMethod::Stratified,
        _ => SamplingMethod::Hash,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_consistency() {
        let service = UserGroupService {
            db: ClickHouseClient::new("http://localhost:8123").unwrap(),
        };

        let variants = vec![
            Variant {
                name: "A".to_string(),
                description: "".to_string(),
                allocation_percent: 50.0,
                is_control: true,
            },
            Variant {
                name: "B".to_string(),
                description: "".to_string(),
                allocation_percent: 50.0,
                is_control: false,
            },
        ];

        let experiment_id = Uuid::new_v4();

        // Same user should get same variant
        let v1 = service.hash_user_to_variant("user123", experiment_id, &variants);
        let v2 = service.hash_user_to_variant("user123", experiment_id, &variants);
        assert_eq!(v1, v2);
    }
}
