use anyhow::{Context, Result};
use clickhouse::Client;
use log::info;

#[derive(Clone)]
pub struct ClickHouseClient {
    client: Client,
}

impl ClickHouseClient {
    pub fn new(url: &str) -> Result<Self> {
        let client = Client::default().with_url(url);

        Ok(Self { client })
    }

    pub fn with_database(self, database: &str) -> Self {
        Self {
            client: self.client.with_database(database),
        }
    }

    pub async fn init_schema(&self) -> Result<()> {
        info!("Initializing ClickHouse schema...");

        // Create database
        self.client
            .query("CREATE DATABASE IF NOT EXISTS expothesis")
            .execute()
            .await
            .context("Failed to create database")?;

        // Experiments table
        self.client
            .query(
                "CREATE TABLE IF NOT EXISTS expothesis.experiments (
                    id String,
                    name String,
                    description String,
                    status String,
                    experiment_type String,
                    sampling_method String,
                    analysis_engine String,
                    sampling_seed UInt64,
                    feature_flag_id Nullable(String),
                    feature_gate_id Nullable(String),
                    health_checks String,
                    hypothesis_null String,
                    hypothesis_alternative String,
                    expected_effect_size Float64,
                    metric_type String,
                    significance_level Float64,
                    power Float64,
                    minimum_sample_size Nullable(UInt64),
                    primary_metric String,
                    variants String,
                    user_groups String,
                    start_date Nullable(DateTime),
                    end_date Nullable(DateTime),
                    created_at DateTime,
                    updated_at DateTime
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY id",
            )
            .execute()
            .await
            .context("Failed to create experiments table")?;

        let experiment_alters = [
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS experiment_type String",
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS sampling_method String",
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS analysis_engine String",
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS sampling_seed UInt64",
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS feature_flag_id Nullable(String)",
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS feature_gate_id Nullable(String)",
            "ALTER TABLE expothesis.experiments ADD COLUMN IF NOT EXISTS health_checks String",
        ];

        for alter in experiment_alters {
            self.client.query(alter).execute().await?;
        }

        // User assignments table
        self.client
            .query(
                "CREATE TABLE IF NOT EXISTS expothesis.user_assignments (
                    user_id String,
                    experiment_id String,
                    variant String,
                    group_id String,
                    assigned_at DateTime
                ) ENGINE = ReplacingMergeTree(assigned_at)
                ORDER BY (user_id, experiment_id)
                PARTITION BY toYYYYMM(assigned_at)",
            )
            .execute()
            .await
            .context("Failed to create user_assignments table")?;

        // Metric events table
        self.client
            .query(
                "CREATE TABLE IF NOT EXISTS expothesis.metric_events (
                    event_id String,
                    experiment_id String,
                    user_id String,
                    variant String,
                    metric_name String,
                    metric_value Float64,
                    timestamp DateTime
                ) ENGINE = MergeTree()
                PARTITION BY toYYYYMM(timestamp)
                ORDER BY (experiment_id, metric_name, timestamp)",
            )
            .execute()
            .await
            .context("Failed to create metric_events table")?;

        // User groups table
        self.client
            .query(
                "CREATE TABLE IF NOT EXISTS expothesis.user_groups (
                    id String,
                    name String,
                    description String,
                    assignment_rule String,
                    size UInt64,
                    created_at DateTime,
                    updated_at DateTime
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY id",
            )
            .execute()
            .await
            .context("Failed to create user_groups table")?;

        // Feature flags table
        self.client
            .query(
                "CREATE TABLE IF NOT EXISTS expothesis.feature_flags (
                    id String,
                    name String,
                    description String,
                    status String,
                    tags String,
                    created_at DateTime,
                    updated_at DateTime
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY id",
            )
            .execute()
            .await
            .context("Failed to create feature_flags table")?;

        // Feature gates table
        self.client
            .query(
                "CREATE TABLE IF NOT EXISTS expothesis.feature_gates (
                    id String,
                    flag_id String,
                    name String,
                    description String,
                    status String,
                    rule String,
                    default_value UInt8,
                    pass_value UInt8,
                    created_at DateTime,
                    updated_at DateTime
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY id",
            )
            .execute()
            .await
            .context("Failed to create feature_gates table")?;

        info!("Schema initialization complete");
        Ok(())
    }

    pub fn client(&self) -> &Client {
        &self.client
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_client_creation() {
        let client = ClickHouseClient::new("http://localhost:8123");
        assert!(client.is_ok());
    }
}
