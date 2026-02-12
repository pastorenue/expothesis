use crate::db::ClickHouseClient;
use crate::models::*;
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use log::info;
use uuid::Uuid;

pub struct FeatureFlagService {
    db: ClickHouseClient,
}

impl FeatureFlagService {
    pub fn new(db: ClickHouseClient) -> Self {
        Self { db }
    }

    pub async fn create_flag(&self, req: CreateFeatureFlagRequest) -> Result<FeatureFlag> {
        info!("Creating feature flag: {}", req.name);

        let flag = FeatureFlag {
            id: Uuid::new_v4(),
            name: req.name,
            description: req.description,
            status: req.status.unwrap_or(FeatureFlagStatus::Active),
            tags: req.tags.unwrap_or_default(),
            environment: req.environment.unwrap_or_default(),
            owner: req.owner.unwrap_or_default(),
            user_groups: req.user_groups.unwrap_or_default(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.save_flag(&flag).await?;
        Ok(flag)
    }

    pub async fn list_flags(&self) -> Result<Vec<FeatureFlag>> {
        let rows = self
            .db
            .client()
            .query("SELECT ?fields FROM feature_flags FINAL ORDER BY updated_at DESC")
            .fetch_all::<FeatureFlagRow>()
            .await
            .context("Failed to fetch feature flags")?;

        let mut flags = Vec::new();
        for row in rows {
            flags.push(self.row_to_flag(row)?);
        }

        Ok(flags)
    }

    pub async fn get_flag(&self, flag_id: Uuid) -> Result<FeatureFlag> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM feature_flags FINAL WHERE id = ?")
            .bind(flag_id.to_string())
            .fetch_one::<FeatureFlagRow>()
            .await
            .context("Failed to fetch feature flag")?;

        self.row_to_flag(row)
    }

    pub async fn update_flag(&self, flag_id: Uuid, req: UpdateFeatureFlagRequest) -> Result<FeatureFlag> {
        let mut flag = self.get_flag(flag_id).await?;

        if let Some(name) = req.name {
            flag.name = name;
        }
        if let Some(description) = req.description {
            flag.description = description;
        }
        if let Some(status) = req.status {
            flag.status = status;
        }
        if let Some(tags) = req.tags {
            flag.tags = tags;
        }
        if let Some(environment) = req.environment {
            flag.environment = environment;
        }
        if let Some(owner) = req.owner {
            flag.owner = owner;
        }
        if let Some(user_groups) = req.user_groups {
            flag.user_groups = user_groups;
        }

        flag.updated_at = Utc::now();
        self.save_flag(&flag).await?;
        Ok(flag)
    }

    pub async fn delete_flag(&self, flag_id: Uuid) -> Result<()> {
        self.db
            .client()
            .query("ALTER TABLE feature_flags DELETE WHERE id = ?")
            .bind(flag_id.to_string())
            .execute()
            .await
            .context("Failed to delete feature flag")?;

        Ok(())
    }

    async fn save_flag(&self, flag: &FeatureFlag) -> Result<()> {
        let row = FeatureFlagRow {
            id: flag.id.to_string(),
            name: flag.name.clone(),
            description: flag.description.clone(),
            status: format!("{:?}", flag.status).to_lowercase(),
            tags: serde_json::to_string(&flag.tags)?,
            environment: flag.environment.clone(),
            owner: flag.owner.clone(),
            user_groups: serde_json::to_string(&flag.user_groups)?,
            created_at: flag.created_at.timestamp() as u32,
            updated_at: flag.updated_at.timestamp() as u32,
        };

        let mut insert = self.db.client().insert("feature_flags")?;
        insert.write(&row).await?;
        insert.end().await?;

        Ok(())
    }

    fn row_to_flag(&self, row: FeatureFlagRow) -> Result<FeatureFlag> {
        let status = match row.status.as_str() {
            "inactive" => FeatureFlagStatus::Inactive,
            _ => FeatureFlagStatus::Active,
        };
        let tags: Vec<String> = serde_json::from_str(&row.tags).unwrap_or_default();
        let user_groups: Vec<Uuid> = serde_json::from_str(&row.user_groups).unwrap_or_default();

        Ok(FeatureFlag {
            id: Uuid::parse_str(&row.id)?,
            name: row.name,
            description: row.description,
            status,
            tags,
            environment: row.environment,
            owner: row.owner,
            user_groups,
            created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
        })
    }
}
