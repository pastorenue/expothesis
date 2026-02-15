use anyhow::{Context, Result};
use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct SdkTokens {
    pub tracking_api_key: String,
    pub feature_flags_api_key: String,
}

pub struct SdkTokenService {
    db: PgPool,
}

impl SdkTokenService {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub async fn ensure_tokens(
        &self,
        default_tracking: Option<String>,
        default_feature_flags: Option<String>,
    ) -> Result<SdkTokens> {
        if let Some(tokens) = self.fetch_tokens().await? {
            return Ok(tokens);
        }

        let tracking_api_key =
            default_tracking.unwrap_or_else(|| format!("track_{}", Uuid::new_v4()));
        let feature_flags_api_key =
            default_feature_flags.unwrap_or_else(|| format!("flags_{}", Uuid::new_v4()));

        sqlx::query(
            "INSERT INTO sdk_tokens (id, tracking_api_key, feature_flags_api_key) VALUES ($1, $2, $3)",
        )
        .bind(Uuid::new_v4())
        .bind(&tracking_api_key)
        .bind(&feature_flags_api_key)
        .execute(&self.db)
        .await
        .context("Failed to create SDK tokens")?;

        Ok(SdkTokens {
            tracking_api_key,
            feature_flags_api_key,
        })
    }

    pub async fn get_tokens(&self) -> Result<SdkTokens> {
        if let Some(tokens) = self.fetch_tokens().await? {
            return Ok(tokens);
        }
        self.ensure_tokens(None, None).await
    }

    pub async fn rotate_tracking(&self) -> Result<SdkTokens> {
        let new_tracking = format!("track_{}", Uuid::new_v4());
        let tokens = self.get_tokens().await?;
        self.update_tokens(new_tracking, tokens.feature_flags_api_key)
            .await
    }

    pub async fn rotate_feature_flags(&self) -> Result<SdkTokens> {
        let new_feature_flags = format!("flags_{}", Uuid::new_v4());
        let tokens = self.get_tokens().await?;
        self.update_tokens(tokens.tracking_api_key, new_feature_flags)
            .await
    }

    pub async fn rotate_all(&self) -> Result<SdkTokens> {
        let new_tracking = format!("track_{}", Uuid::new_v4());
        let new_feature_flags = format!("flags_{}", Uuid::new_v4());
        self.update_tokens(new_tracking, new_feature_flags).await
    }

    async fn fetch_tokens(&self) -> Result<Option<SdkTokens>> {
        let row = sqlx::query("SELECT tracking_api_key, feature_flags_api_key FROM sdk_tokens LIMIT 1")
            .fetch_optional(&self.db)
            .await
            .context("Failed to fetch SDK tokens")?;

        Ok(row.map(|record| SdkTokens {
            tracking_api_key: record.get("tracking_api_key"),
            feature_flags_api_key: record.get("feature_flags_api_key"),
        }))
    }

    async fn update_tokens(
        &self,
        tracking_api_key: String,
        feature_flags_api_key: String,
    ) -> Result<SdkTokens> {
        let existing = sqlx::query("SELECT id FROM sdk_tokens LIMIT 1")
            .fetch_optional(&self.db)
            .await
            .context("Failed to fetch SDK token row")?;

        if let Some(row) = existing {
            let id: Uuid = row.get("id");
            sqlx::query(
                "UPDATE sdk_tokens SET tracking_api_key = $1, feature_flags_api_key = $2, updated_at = NOW() WHERE id = $3",
            )
            .bind(&tracking_api_key)
            .bind(&feature_flags_api_key)
            .bind(id)
            .execute(&self.db)
            .await
            .context("Failed to update SDK tokens")?;
        } else {
            sqlx::query(
                "INSERT INTO sdk_tokens (id, tracking_api_key, feature_flags_api_key) VALUES ($1, $2, $3)",
            )
            .bind(Uuid::new_v4())
            .bind(&tracking_api_key)
            .bind(&feature_flags_api_key)
            .execute(&self.db)
            .await
            .context("Failed to insert SDK tokens")?;
        }

        Ok(SdkTokens {
            tracking_api_key,
            feature_flags_api_key,
        })
    }
}
