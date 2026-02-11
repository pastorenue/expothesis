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

    async fn save_flag(&self, flag: &FeatureFlag) -> Result<()> {
        let row = FeatureFlagRow {
            id: flag.id.to_string(),
            name: flag.name.clone(),
            description: flag.description.clone(),
            status: format!("{:?}", flag.status).to_lowercase(),
            tags: serde_json::to_string(&flag.tags)?,
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

        Ok(FeatureFlag {
            id: Uuid::parse_str(&row.id)?,
            name: row.name,
            description: row.description,
            status,
            tags,
            created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
        })
    }
}
