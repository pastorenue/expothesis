// ExperimentRow is now defined inside experiment_service.rs (not pub-exported from here)
// This file retains only the ClickHouse-specific rows for tables that remain in ClickHouse.

use serde::{Deserialize, Serialize};

/// VariantMetricsRow - used in ClickHouse metric aggregation queries
/// (internal to experiment_service.rs — kept here only if shared across modules)
#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct VariantMetricsRow {
    pub variant: String,
    pub total: u64,
    pub successes: u64,
    pub mean: f64,
    pub std_dev: f64,
}
