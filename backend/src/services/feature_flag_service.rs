use crate::models::*;
use anyhow::{Context, Result};
use chrono::Utc;
use log::info;
use sqlx::PgPool;
use uuid::Uuid;

pub struct FeatureFlagService {
    pg: PgPool,
}

impl FeatureFlagService {
    pub fn new(pg: PgPool) -> Self {
        Self { pg }
    }

    pub async fn create_flag(
        &self,
        req: CreateFeatureFlagRequest,
        account_id: Uuid,
    ) -> Result<FeatureFlag> {
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

        self.upsert_flag(&flag, account_id).await?;
        Ok(flag)
    }

    pub async fn list_flags(&self, account_id: Uuid) -> Result<Vec<FeatureFlag>> {
        #[derive(sqlx::FromRow)]
        struct Row {
            id: Uuid,
            name: String,
            description: String,
            status: String,
            tags: Option<String>,
            environment: String,
            owner: String,
            user_groups: Option<String>,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        let rows = sqlx::query_as::<_, Row>(
            r#"SELECT id, name, description, status,
                      tags::text AS tags, environment, owner,
                      user_groups::text AS user_groups,
                      created_at, updated_at
               FROM feature_flags
               WHERE account_id = $1
               ORDER BY updated_at DESC"#,
        )
        .bind(account_id)
        .fetch_all(&self.pg)
        .await
        .context("Failed to fetch feature flags")?;

        rows.into_iter()
            .map(|r| {
                Ok(FeatureFlag {
                    id: r.id,
                    name: r.name,
                    description: r.description,
                    status: parse_flag_status(&r.status),
                    tags: serde_json::from_str(r.tags.as_deref().unwrap_or("[]"))
                        .unwrap_or_default(),
                    environment: r.environment,
                    owner: r.owner,
                    user_groups: serde_json::from_str(r.user_groups.as_deref().unwrap_or("[]"))
                        .unwrap_or_default(),
                    created_at: r.created_at,
                    updated_at: r.updated_at,
                })
            })
            .collect()
    }

    pub async fn get_flag(&self, flag_id: Uuid, account_id: Uuid) -> Result<FeatureFlag> {
        #[derive(sqlx::FromRow)]
        struct Row {
            id: Uuid,
            name: String,
            description: String,
            status: String,
            tags: Option<String>,
            environment: String,
            owner: String,
            user_groups: Option<String>,
            created_at: chrono::DateTime<chrono::Utc>,
            updated_at: chrono::DateTime<chrono::Utc>,
        }

        let r = sqlx::query_as::<_, Row>(
            r#"SELECT id, name, description, status,
                      tags::text AS tags, environment, owner,
                      user_groups::text AS user_groups,
                      created_at, updated_at
               FROM feature_flags
               WHERE id = $1 AND account_id = $2"#,
        )
        .bind(flag_id)
        .bind(account_id)
        .fetch_one(&self.pg)
        .await
        .context("Failed to fetch feature flag")?;

        Ok(FeatureFlag {
            id: r.id,
            name: r.name,
            description: r.description,
            status: parse_flag_status(&r.status),
            tags: serde_json::from_str(r.tags.as_deref().unwrap_or("[]")).unwrap_or_default(),
            environment: r.environment,
            owner: r.owner,
            user_groups: serde_json::from_str(r.user_groups.as_deref().unwrap_or("[]"))
                .unwrap_or_default(),
            created_at: r.created_at,
            updated_at: r.updated_at,
        })
    }

    pub async fn update_flag(
        &self,
        flag_id: Uuid,
        account_id: Uuid,
        req: UpdateFeatureFlagRequest,
    ) -> Result<FeatureFlag> {
        let mut flag = self.get_flag(flag_id, account_id).await?;

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
        self.upsert_flag(&flag, account_id).await?;
        Ok(flag)
    }

    pub async fn delete_flag(&self, flag_id: Uuid, account_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM feature_flags WHERE id = $1 AND account_id = $2")
            .bind(flag_id)
            .bind(account_id)
            .execute(&self.pg)
            .await
            .context("Failed to delete feature flag")?;
        Ok(())
    }

    async fn upsert_flag(&self, flag: &FeatureFlag, account_id: Uuid) -> Result<()> {
        let status = format!("{:?}", flag.status).to_lowercase();
        let tags = serde_json::to_value(&flag.tags)?;
        let user_groups = serde_json::to_value(&flag.user_groups)?;

        sqlx::query(
            r#"INSERT INTO feature_flags
                (id, account_id, name, description, status, tags, environment, owner, user_groups, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
                 name        = EXCLUDED.name,
                 description = EXCLUDED.description,
                 status      = EXCLUDED.status,
                 tags        = EXCLUDED.tags,
                 environment = EXCLUDED.environment,
                 owner       = EXCLUDED.owner,
                 user_groups = EXCLUDED.user_groups,
                 updated_at  = EXCLUDED.updated_at"#,
        )
        .bind(flag.id)
        .bind(account_id)
        .bind(&flag.name)
        .bind(&flag.description)
        .bind(status)
        .bind(tags)
        .bind(&flag.environment)
        .bind(&flag.owner)
        .bind(user_groups)
        .bind(flag.created_at)
        .bind(flag.updated_at)
        .execute(&self.pg)
        .await
        .context("Failed to upsert feature flag")?;

        Ok(())
    }
}

fn parse_flag_status(s: &str) -> FeatureFlagStatus {
    match s {
        "inactive" => FeatureFlagStatus::Inactive,
        _ => FeatureFlagStatus::Active,
    }
}
