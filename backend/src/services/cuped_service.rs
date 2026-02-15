use crate::db::ClickHouseClient;
use crate::models::*;
use crate::stats;
use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use log::info;
use std::collections::HashMap;
use uuid::Uuid;

pub struct CupedService {
    db: ClickHouseClient,
}

impl CupedService {
    pub fn new(db: ClickHouseClient) -> Self {
        Self { db }
    }

    /// Save or update CUPED configuration for an experiment
    pub async fn save_config(
        &self,
        experiment_id: Uuid,
        req: CupedConfigRequest,
    ) -> Result<CupedConfig> {
        let now = Utc::now();
        let config = CupedConfig {
            experiment_id,
            covariate_metric: req.covariate_metric,
            lookback_days: req.lookback_days.unwrap_or(30),
            min_sample_size: req.min_sample_size.unwrap_or(100).max(100),
            created_at: now,
            updated_at: now,
        };

        let row = CupedConfigRow {
            experiment_id: config.experiment_id.to_string(),
            covariate_metric: config.covariate_metric.clone(),
            lookback_days: config.lookback_days,
            min_sample_size: config.min_sample_size as u64,
            created_at: config.created_at.timestamp() as u32,
            updated_at: config.updated_at.timestamp() as u32,
        };

        let mut insert = self.db.client().insert("cuped_configs")?;
        insert.write(&row).await?;
        insert.end().await?;

        info!(
            "Saved CUPED config for experiment {}: covariate={}, lookback={}d",
            experiment_id, config.covariate_metric, config.lookback_days
        );

        Ok(config)
    }

    /// Get CUPED configuration for an experiment
    pub async fn get_config(&self, experiment_id: Uuid) -> Result<CupedConfig> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM cuped_configs FINAL WHERE experiment_id = ?")
            .bind(experiment_id.to_string())
            .fetch_one::<CupedConfigRow>()
            .await
            .context("No CUPED configuration found for this experiment")?;

        Ok(CupedConfig {
            experiment_id: Uuid::parse_str(&row.experiment_id)?,
            covariate_metric: row.covariate_metric,
            lookback_days: row.lookback_days,
            min_sample_size: row.min_sample_size as usize,
            created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
        })
    }

    /// Run CUPED analysis for an experiment.
    ///
    /// 1. Fetches the CUPED config (covariate metric, lookback window)
    /// 2. Queries pre-experiment covariate data per user per variant
    /// 3. Queries post-experiment metric data per user per variant
    /// 4. Matches users appearing in both datasets
    /// 5. Runs CupedCalculator per variant pair (control vs treatment)
    /// 6. Returns CUPED-adjusted results
    pub async fn run_cuped_analysis(
        &self,
        experiment_id: Uuid,
        experiment: &Experiment,
    ) -> Result<Vec<CupedAdjustedResult>> {
        let config = self.get_config(experiment_id).await.map_err(|_| {
            anyhow!(
                "CUPED is not configured for experiment {}. \
                 POST to /api/experiments/{}/cuped/config first.",
                experiment_id,
                experiment_id
            )
        })?;

        let start_date = experiment.start_date.ok_or_else(|| {
            anyhow!("Experiment has not started yet — no pre-experiment data boundary")
        })?;

        // Find control variant
        let control_variant = experiment
            .variants
            .iter()
            .find(|v| v.is_control)
            .ok_or_else(|| anyhow!("No control variant found"))?;

        let mut results = Vec::new();

        for variant in experiment.variants.iter().filter(|v| !v.is_control) {
            // Fetch pre-experiment covariate data per user for control
            let pre_control = self
                .fetch_user_metrics(
                    experiment_id,
                    &control_variant.name,
                    &config.covariate_metric,
                    None,
                    Some(start_date),
                    config.lookback_days,
                )
                .await?;

            // Fetch pre-experiment covariate data per user for treatment
            let pre_treatment = self
                .fetch_user_metrics(
                    experiment_id,
                    &variant.name,
                    &config.covariate_metric,
                    None,
                    Some(start_date),
                    config.lookback_days,
                )
                .await?;

            // Fetch post-experiment metric data per user for control
            let post_control = self
                .fetch_user_metrics(
                    experiment_id,
                    &control_variant.name,
                    &experiment.primary_metric,
                    Some(start_date),
                    None,
                    0,
                )
                .await?;

            // Fetch post-experiment metric data per user for treatment
            let post_treatment = self
                .fetch_user_metrics(
                    experiment_id,
                    &variant.name,
                    &experiment.primary_metric,
                    Some(start_date),
                    None,
                    0,
                )
                .await?;

            // Match users that appear in both pre and post datasets
            let (matched_pre_a, matched_post_a) =
                Self::match_user_data(&pre_control, &post_control);
            let (matched_pre_b, matched_post_b) =
                Self::match_user_data(&pre_treatment, &post_treatment);

            // Validate minimum sample sizes
            if matched_pre_a.len() < config.min_sample_size {
                return Err(anyhow!(
                    "Insufficient matched users for control variant '{}': {} (minimum {})",
                    control_variant.name,
                    matched_pre_a.len(),
                    config.min_sample_size
                ));
            }
            if matched_pre_b.len() < config.min_sample_size {
                return Err(anyhow!(
                    "Insufficient matched users for treatment variant '{}': {} (minimum {})",
                    variant.name,
                    matched_pre_b.len(),
                    config.min_sample_size
                ));
            }

            // Run CUPED calculator for each variant
            let calc_a = stats::CupedCalculator::new(matched_pre_a, matched_post_a.clone())?;
            let calc_b = stats::CupedCalculator::new(matched_pre_b, matched_post_b.clone())?;

            let adj_a = calc_a.run();
            let adj_b = calc_b.run();

            let engine_result = stats::analyze_continuous(
                experiment.analysis_engine.clone(),
                adj_a.adjusted_mean,
                adj_a.adjusted_std_dev,
                adj_a.n_matched_users,
                adj_b.adjusted_mean,
                adj_b.adjusted_std_dev,
                adj_b.n_matched_users,
            )?;

            let avg_variance_reduction =
                (adj_a.variance_reduction_percent + adj_b.variance_reduction_percent) / 2.0;

            results.push(CupedAdjustedResult {
                variant_a: control_variant.name.clone(),
                variant_b: variant.name.clone(),
                metric_name: experiment.primary_metric.clone(),
                theta: (adj_a.theta + adj_b.theta) / 2.0,
                adjusted_mean_a: adj_a.adjusted_mean,
                adjusted_mean_b: adj_b.adjusted_mean,
                adjusted_effect_size: engine_result.effect_size,
                adjusted_p_value: engine_result.p_value,
                adjusted_ci_lower: engine_result.ci_low,
                adjusted_ci_upper: engine_result.ci_high,
                variance_reduction_percent: avg_variance_reduction,
                original_variance_a: adj_a.original_std_dev.powi(2),
                original_variance_b: adj_b.original_std_dev.powi(2),
                adjusted_variance_a: adj_a.adjusted_std_dev.powi(2),
                adjusted_variance_b: adj_b.adjusted_std_dev.powi(2),
                is_significant: engine_result.p_value < 0.05,
                n_matched_users_a: adj_a.n_matched_users,
                n_matched_users_b: adj_b.n_matched_users,
            });
        }

        Ok(results)
    }

    /// Fetch per-user metric values from metric_events with optional time bounds.
    ///
    /// For pre-experiment data: `before` = experiment start, `lookback_days` limits how far back
    /// For post-experiment data: `after` = experiment start, `lookback_days` = 0
    async fn fetch_user_metrics(
        &self,
        experiment_id: Uuid,
        variant: &str,
        metric_name: &str,
        after: Option<DateTime<Utc>>,
        before: Option<DateTime<Utc>>,
        lookback_days: u32,
    ) -> Result<HashMap<String, f64>> {
        let mut query = String::from(
            "SELECT
                user_id,
                toFloat64(avg(metric_value)) as metric_value
            FROM metric_events
            WHERE experiment_id = ?
              AND variant = ?
              AND metric_name = ?",
        );

        if let Some(before_dt) = before {
            query.push_str(&format!(
                " AND timestamp < toDateTime({})",
                before_dt.timestamp()
            ));
            if lookback_days > 0 {
                query.push_str(&format!(
                    " AND timestamp >= toDateTime({}) - INTERVAL {} DAY",
                    before_dt.timestamp(),
                    lookback_days
                ));
            }
        }

        if let Some(after_dt) = after {
            query.push_str(&format!(
                " AND timestamp >= toDateTime({})",
                after_dt.timestamp()
            ));
        }

        query.push_str(" GROUP BY user_id");

        let rows = self
            .db
            .client()
            .query(&query)
            .bind(experiment_id.to_string())
            .bind(variant.to_string())
            .bind(metric_name.to_string())
            .fetch_all::<UserMetricRow>()
            .await
            .context("Failed to fetch user metrics for CUPED analysis")?;

        let map: HashMap<String, f64> = rows
            .into_iter()
            .map(|r| (r.user_id, r.metric_value))
            .collect();

        Ok(map)
    }

    /// Match users that appear in both pre and post datasets.
    /// Returns paired vectors of (pre_values, post_values) for matched users.
    fn match_user_data(
        pre: &HashMap<String, f64>,
        post: &HashMap<String, f64>,
    ) -> (Vec<f64>, Vec<f64>) {
        let mut pre_matched = Vec::new();
        let mut post_matched = Vec::new();

        for (user_id, pre_value) in pre {
            if let Some(post_value) = post.get(user_id) {
                pre_matched.push(*pre_value);
                post_matched.push(*post_value);
            }
        }

        (pre_matched, post_matched)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_user_data_overlap() {
        let mut pre = HashMap::new();
        pre.insert("user1".to_string(), 10.0);
        pre.insert("user2".to_string(), 20.0);
        pre.insert("user3".to_string(), 30.0);

        let mut post = HashMap::new();
        post.insert("user1".to_string(), 15.0);
        post.insert("user3".to_string(), 35.0);
        post.insert("user4".to_string(), 40.0);

        let (matched_pre, matched_post) = CupedService::match_user_data(&pre, &post);

        assert_eq!(matched_pre.len(), 2);
        assert_eq!(matched_post.len(), 2);
        // user1 and user3 should be matched
        assert!(matched_pre.contains(&10.0));
        assert!(matched_pre.contains(&30.0));
        assert!(matched_post.contains(&15.0));
        assert!(matched_post.contains(&35.0));
    }

    #[test]
    fn test_match_user_data_no_overlap() {
        let mut pre = HashMap::new();
        pre.insert("user1".to_string(), 10.0);

        let mut post = HashMap::new();
        post.insert("user2".to_string(), 20.0);

        let (matched_pre, matched_post) = CupedService::match_user_data(&pre, &post);
        assert!(matched_pre.is_empty());
        assert!(matched_post.is_empty());
    }

    #[test]
    fn test_match_user_data_empty() {
        let pre: HashMap<String, f64> = HashMap::new();
        let post: HashMap<String, f64> = HashMap::new();

        let (matched_pre, matched_post) = CupedService::match_user_data(&pre, &post);
        assert!(matched_pre.is_empty());
        assert!(matched_post.is_empty());
    }
}
