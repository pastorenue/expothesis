use anyhow::{Context, Result};
use sqlx::{postgres::PgPoolOptions, PgPool};

pub async fn connect(database_url: &str) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await
        .context("Failed to connect to Postgres")
}
