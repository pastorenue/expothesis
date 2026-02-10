use crate::db::ClickHouseClient;
use crate::models::*;
use crate::stats;
use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use log::info;
use uuid::Uuid;

pub struct ExperimentService {
    db: ClickHouseClient,
}

impl ExperimentService {
    pub fn new(db: ClickHouseClient) -> Self {
        Self { db }
    }

    pub async fn create_experiment(&self, req: CreateExperimentRequest) -> Result<Experiment> {
        info!("Creating experiment: {}", req.name);

        // Validate variants total allocation
        let total_allocation: f64 = req.variants.iter().map(|v| v.allocation_percent).sum();
        if (total_allocation - 100.0).abs() > 0.01 {
            return Err(anyhow!("Variant allocations must sum to 100%"));
        }

        // Ensure one control variant
        let control_count = req.variants.iter().filter(|v| v.is_control).count();
        if control_count != 1 {
            return Err(anyhow!("Exactly one variant must be marked as control"));
        }

        // Calculate required sample size based on hypothesis
        let required_sample = match req.hypothesis.metric_type {
            MetricType::Proportion => stats::sample_size_proportion(
                0.10, // Default baseline - should be configurable
                req.hypothesis.expected_effect_size,
                req.hypothesis.significance_level,
                req.hypothesis.power,
            ),
            MetricType::Continuous => stats::sample_size_continuous(
                1.0, // Default std dev - should be measured
                req.hypothesis.expected_effect_size,
                req.hypothesis.significance_level,
                req.hypothesis.power,
            ),
            MetricType::Count => stats::sample_size_continuous(
                1.0,
                req.hypothesis.expected_effect_size,
                req.hypothesis.significance_level,
                req.hypothesis.power,
            ),
        };

        let mut hypothesis = req.hypothesis;
        hypothesis.minimum_sample_size = Some(required_sample);

        let experiment = Experiment {
            id: Uuid::new_v4(),
            name: req.name,
            description: req.description,
            status: ExperimentStatus::Draft,
            hypothesis: Some(hypothesis),
            variants: req.variants,
            user_groups: req.user_groups,
            primary_metric: req.primary_metric,
            start_date: None,
            end_date: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        // Save to ClickHouse
        self.save_experiment(&experiment).await?;

        Ok(experiment)
    }

    pub async fn start_experiment(&self, experiment_id: Uuid) -> Result<Experiment> {
        info!("Starting experiment: {}", experiment_id);

        let mut experiment = self.get_experiment(experiment_id).await.map_err(|e| {
            log::error!("Failed to get experiment {}: {:?}", experiment_id, e);
            e
        })?;

        info!(
            "Experiment {} current status: {:?}",
            experiment_id, experiment.status
        );

        if !matches!(
            experiment.status,
            ExperimentStatus::Draft | ExperimentStatus::Paused
        ) {
            log::warn!(
                "Invalid status transition for experiment {}: cannot start from {:?}",
                experiment_id,
                experiment.status
            );
            return Err(anyhow!(
                "Can only start experiments in Draft or Paused status"
            ));
        }

        experiment.status = ExperimentStatus::Running;
        experiment.start_date = Some(Utc::now());
        experiment.updated_at = Utc::now();

        self.save_experiment(&experiment).await?;

        Ok(experiment)
    }

    pub async fn pause_experiment(&self, experiment_id: Uuid) -> Result<Experiment> {
        info!("Pausing experiment: {}", experiment_id);

        let mut experiment = self.get_experiment(experiment_id).await?;

        if !matches!(experiment.status, ExperimentStatus::Running) {
            return Err(anyhow!("Can only pause running experiments"));
        }

        experiment.status = ExperimentStatus::Paused;
        experiment.updated_at = Utc::now();

        self.save_experiment(&experiment).await?;

        Ok(experiment)
    }

    pub async fn stop_experiment(&self, experiment_id: Uuid) -> Result<Experiment> {
        info!("Stopping experiment: {}", experiment_id);

        let mut experiment = self.get_experiment(experiment_id).await?;

        if matches!(experiment.status, ExperimentStatus::Stopped) {
            return Err(anyhow!("Experiment already stopped"));
        }

        experiment.status = ExperimentStatus::Stopped;
        experiment.end_date = Some(Utc::now());
        experiment.updated_at = Utc::now();

        self.save_experiment(&experiment).await?;

        Ok(experiment)
    }

    pub async fn get_experiment(&self, experiment_id: Uuid) -> Result<Experiment> {
        let row = self
            .db
            .client()
            .query("SELECT ?fields FROM experiments FINAL WHERE id = ?")
            .bind(experiment_id.to_string())
            .fetch_one::<ExperimentRow>()
            .await
            .map_err(|e| {
                log::error!(
                    "Database error fetching experiment {}: {:?}",
                    experiment_id,
                    e
                );
                e
            })
            .context("Failed to fetch experiment")?;

        self.row_to_experiment(row)
    }

    pub async fn list_experiments(&self) -> Result<Vec<Experiment>> {
        let rows = self
            .db
            .client()
            .query("SELECT ?fields FROM experiments FINAL ORDER BY updated_at DESC")
            .fetch_all::<ExperimentRow>()
            .await
            .context("Failed to fetch experiments")?;

        let mut experiments = Vec::new();
        for row in rows {
            experiments.push(self.row_to_experiment(row)?);
        }

        Ok(experiments)
    }

    pub async fn analyze_experiment(
        &self,
        experiment_id: Uuid,
    ) -> Result<ExperimentAnalysisResponse> {
        info!("Analyzing experiment: {}", experiment_id);

        let experiment = self.get_experiment(experiment_id).await?;

        // Get metric data for all variants
        let variant_data = self.get_variant_metrics(experiment_id).await?;

        let mut results = Vec::new();
        let mut sample_sizes = Vec::new();

        // Find control variant
        let control_variant = experiment
            .variants
            .iter()
            .find(|v| v.is_control)
            .ok_or_else(|| anyhow!("No control variant found"))?;

        // Compare each treatment variant to control
        for variant in experiment.variants.iter().filter(|v| !v.is_control) {
            let control_data = variant_data
                .get(&control_variant.name)
                .ok_or_else(|| anyhow!("No data for control variant"))?;

            let treatment_data = variant_data
                .get(&variant.name)
                .ok_or_else(|| anyhow!("No data for treatment variant"))?;

            let result = match experiment.hypothesis.as_ref().unwrap().metric_type {
                MetricType::Proportion => {
                    let (effect, p_value, ci_low, ci_high) = stats::z_test_proportions(
                        control_data.successes as usize,
                        control_data.total as usize,
                        treatment_data.successes as usize,
                        treatment_data.total as usize,
                    )?;

                    StatisticalResult {
                        experiment_id,
                        variant_a: control_variant.name.clone(),
                        variant_b: variant.name.clone(),
                        metric_name: experiment.primary_metric.clone(),
                        sample_size_a: control_data.total as usize,
                        sample_size_b: treatment_data.total as usize,
                        mean_a: control_data.mean,
                        mean_b: treatment_data.mean,
                        std_dev_a: None,
                        std_dev_b: None,
                        effect_size: effect,
                        p_value,
                        confidence_interval_lower: ci_low,
                        confidence_interval_upper: ci_high,
                        is_significant: p_value < 0.05,
                        test_type: "Z-test for proportions".to_string(),
                        calculated_at: Utc::now(),
                    }
                }
                MetricType::Continuous | MetricType::Count => {
                    let (effect, p_value, ci_low, ci_high) =
                        stats::t_test_two_sample(&control_data.values, &treatment_data.values)?;

                    StatisticalResult {
                        experiment_id,
                        variant_a: control_variant.name.clone(),
                        variant_b: variant.name.clone(),
                        metric_name: experiment.primary_metric.clone(),
                        sample_size_a: control_data.total as usize,
                        sample_size_b: treatment_data.total as usize,
                        mean_a: control_data.mean,
                        mean_b: treatment_data.mean,
                        std_dev_a: Some(control_data.std_dev),
                        std_dev_b: Some(treatment_data.std_dev),
                        effect_size: effect,
                        p_value,
                        confidence_interval_lower: ci_low,
                        confidence_interval_upper: ci_high,
                        is_significant: p_value < 0.05,
                        test_type: "Welch's t-test".to_string(),
                        calculated_at: Utc::now(),
                    }
                }
            };

            results.push(result);

            sample_sizes.push(VariantSampleSize {
                variant: variant.name.clone(),
                current_size: treatment_data.total as usize,
                required_size: experiment
                    .hypothesis
                    .as_ref()
                    .unwrap()
                    .minimum_sample_size
                    .unwrap_or(0),
            });
        }

        Ok(ExperimentAnalysisResponse {
            experiment,
            results,
            sample_sizes,
        })
    }

    async fn save_experiment(&self, experiment: &Experiment) -> Result<()> {
        let variants_json = serde_json::to_string(&experiment.variants)?;
        let user_groups_json = serde_json::to_string(&experiment.user_groups)?;
        let h = experiment.hypothesis.clone().unwrap_or(Hypothesis {
            null_hypothesis: "".to_string(),
            alternative_hypothesis: "".to_string(),
            expected_effect_size: 0.0,
            metric_type: MetricType::Proportion,
            significance_level: 0.05,
            power: 0.8,
            minimum_sample_size: None,
        });

        let row = ExperimentRow {
            id: experiment.id.to_string(),
            name: experiment.name.clone(),
            description: experiment.description.clone(),
            status: format!("{:?}", experiment.status).to_lowercase(),
            hypothesis_null: h.null_hypothesis,
            hypothesis_alternative: h.alternative_hypothesis,
            expected_effect_size: h.expected_effect_size,
            metric_type: format!("{:?}", h.metric_type).to_lowercase(),
            significance_level: h.significance_level,
            power: h.power,
            minimum_sample_size: h.minimum_sample_size.map(|n| n as u64),
            primary_metric: experiment.primary_metric.clone(),
            variants: variants_json,
            user_groups: user_groups_json,
            start_date: experiment.start_date.map(|dt| dt.timestamp() as u32),
            end_date: experiment.end_date.map(|dt| dt.timestamp() as u32),
            created_at: experiment.created_at.timestamp() as u32,
            updated_at: experiment.updated_at.timestamp() as u32,
        };

        let mut insert = self.db.client().insert("experiments")?;
        insert.write(&row).await?;
        insert.end().await?;

        Ok(())
    }

    async fn get_variant_metrics(
        &self,
        experiment_id: Uuid,
    ) -> Result<std::collections::HashMap<String, VariantMetrics>> {
        info!(
            "Fetching real-time metrics for experiment: {}",
            experiment_id
        );
        // 1. Get total assignments per variant from user_assignments
        let assignments_query = "
            SELECT
                variant,
                toUInt64(uniq(user_id)) as total,
                toUInt64(0) as successes,
                toFloat64(0.0) as mean,
                toFloat64(0.0) as std_dev
            FROM user_assignments FINAL
            WHERE experiment_id = ?
            GROUP BY variant
        ";

        let assignment_rows = self
            .db
            .client()
            .query(assignments_query)
            .bind(experiment_id.to_string())
            .fetch_all::<VariantMetricsRow>()
            .await
            .map_err(|e| {
                log::error!("ClickHouse assignment query failed: {:?}", e);
                e
            })
            .context("Failed to fetch assignment counts from ClickHouse")?;

        // 2. Get event metrics per variant from metric_events
        let events_query = "
            SELECT
                variant,
                toUInt64(uniq(user_id)) as total,
                toUInt64(uniqIf(user_id, metric_value > 0)) as successes,
                toFloat64(avg(metric_value)) as mean,
                toFloat64(stddevPop(metric_value)) as std_dev
            FROM metric_events
            WHERE experiment_id = ?
            GROUP BY variant
        ";

        let event_rows = self
            .db
            .client()
            .query(events_query)
            .bind(experiment_id.to_string())
            .fetch_all::<VariantMetricsRow>()
            .await
            .context("Failed to fetch event metrics from ClickHouse")?;

        let mut map = std::collections::HashMap::new();

        // Initialize with assignments for total denominator
        for row in assignment_rows {
            map.insert(
                row.variant,
                VariantMetrics {
                    total: row.total as usize,
                    successes: 0,
                    mean: 0.0,
                    std_dev: 0.0,
                    values: vec![],
                },
            );
        }

        // Update with event data for mean, std_dev, and successes
        for row in event_rows {
            let metrics = map.entry(row.variant).or_insert(VariantMetrics {
                total: 0,
                successes: 0,
                mean: 0.0,
                std_dev: 0.0,
                values: vec![],
            });
            metrics.successes = row.successes as usize;
            metrics.mean = row.mean;
            metrics.std_dev = row.std_dev;
        }

        // Add variants with zero data if they are missing from query results
        let experiment = self.get_experiment(experiment_id).await?;
        for variant in experiment.variants {
            map.entry(variant.name.clone()).or_insert(VariantMetrics {
                total: 0,
                successes: 0,
                mean: 0.0,
                std_dev: 0.0,
                values: vec![],
            });
        }

        Ok(map)
    }

    fn row_to_experiment(&self, row: ExperimentRow) -> Result<Experiment> {
        let variants: Vec<Variant> = serde_json::from_str(&row.variants)?;
        let user_groups: Vec<Uuid> = serde_json::from_str(&row.user_groups)?;

        let status = match row.status.as_str() {
            "running" => ExperimentStatus::Running,
            "paused" => ExperimentStatus::Paused,
            "stopped" => ExperimentStatus::Stopped,
            _ => ExperimentStatus::Draft,
        };

        let metric_type = match row.metric_type.as_str() {
            "continuous" => MetricType::Continuous,
            "count" => MetricType::Count,
            _ => MetricType::Proportion,
        };

        let hypothesis = Some(Hypothesis {
            null_hypothesis: row.hypothesis_null,
            alternative_hypothesis: row.hypothesis_alternative,
            expected_effect_size: row.expected_effect_size,
            metric_type,
            significance_level: row.significance_level,
            power: row.power,
            minimum_sample_size: row.minimum_sample_size.map(|n| n as usize),
        });

        Ok(Experiment {
            id: Uuid::parse_str(&row.id)?,
            name: row.name,
            description: row.description,
            status,
            hypothesis,
            variants,
            user_groups,
            primary_metric: row.primary_metric,
            start_date: row
                .start_date
                .and_then(|ts| DateTime::from_timestamp(ts as i64, 0)),
            end_date: row
                .end_date
                .and_then(|ts| DateTime::from_timestamp(ts as i64, 0)),
            created_at: DateTime::from_timestamp(row.created_at as i64, 0).unwrap_or_default(),
            updated_at: DateTime::from_timestamp(row.updated_at as i64, 0).unwrap_or_default(),
        })
    }
}

#[derive(Debug)]
struct VariantMetrics {
    total: usize,
    successes: usize,
    mean: f64,
    std_dev: f64,
    values: Vec<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_variants() {
        let variants = vec![
            Variant {
                name: "Control".to_string(),
                description: "".to_string(),
                allocation_percent: 50.0,
                is_control: true,
            },
            Variant {
                name: "Treatment".to_string(),
                description: "".to_string(),
                allocation_percent: 50.0,
                is_control: false,
            },
        ];

        let total: f64 = variants.iter().map(|v| v.allocation_percent).sum();
        assert!((total - 100.0).abs() < 0.01);
    }
}
