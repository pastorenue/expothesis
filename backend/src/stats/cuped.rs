use anyhow::{anyhow, Result};
use statrs::statistics::Statistics;

/// Minimum number of matched users required for CUPED analysis
const MIN_CUPED_SAMPLE_SIZE: usize = 100;

/// CUPED (Controlled-experiment Using Pre-Experiment Data) calculator.
///
/// Uses pre-experiment metric data as covariates to reduce variance
/// of treatment effect estimates, enabling faster experiment conclusions.
///
/// The key formula is:
///   Y_adj = Y - θ * (X - mean(X))
///
/// where:
///   Y = post-experiment metric values
///   X = pre-experiment covariate values
///   θ = Cov(Y, X) / Var(X)
#[derive(Debug)]
pub struct CupedCalculator {
    /// Pre-experiment covariate values (X) per user
    pre_values: Vec<f64>,
    /// Post-experiment metric values (Y) per user
    post_values: Vec<f64>,
}

/// Result of a CUPED adjustment for a single group/variant
#[derive(Debug, Clone)]
pub struct CupedAdjustment {
    pub theta: f64,
    pub adjusted_mean: f64,
    pub adjusted_std_dev: f64,
    pub original_mean: f64,
    pub original_std_dev: f64,
    pub variance_reduction_percent: f64,
    pub n_matched_users: usize,
}

impl CupedCalculator {
    /// Create a new CupedCalculator with matched pre/post experiment data.
    ///
    /// `pre_values` and `post_values` must be the same length, with each index
    /// corresponding to the same user (i.e., user-level matched pairs).
    pub fn new(pre_values: Vec<f64>, post_values: Vec<f64>) -> Result<Self> {
        if pre_values.len() != post_values.len() {
            return Err(anyhow!(
                "Pre and post experiment data must have the same length (got {} and {})",
                pre_values.len(),
                post_values.len()
            ));
        }

        if pre_values.is_empty() {
            return Err(anyhow!(
                "No pre-experiment data available for CUPED analysis"
            ));
        }

        if pre_values.len() < MIN_CUPED_SAMPLE_SIZE {
            return Err(anyhow!(
                "Insufficient sample size for CUPED analysis: {} users (minimum {})",
                pre_values.len(),
                MIN_CUPED_SAMPLE_SIZE
            ));
        }

        Ok(Self {
            pre_values,
            post_values,
        })
    }

    /// Calculate theta (θ), the regression coefficient.
    ///
    /// θ = Cov(Y, X) / Var(X)
    ///
    /// If variance of X is zero (constant covariate), returns 0.0
    /// since the covariate provides no information.
    pub fn calculate_theta(&self) -> f64 {
        let pre = &self.pre_values[..];
        let post = &self.post_values[..];
        let var_x = pre.variance();

        // If pre-experiment values have zero variance, the covariate
        // provides no information — theta is 0, no adjustment occurs
        if var_x < 1e-12 {
            return 0.0;
        }

        let mean_x = pre.mean();
        let mean_y = post.mean();
        let n = pre.len() as f64;

        let cov_xy: f64 = pre
            .iter()
            .zip(post.iter())
            .map(|(x, y)| (x - mean_x) * (y - mean_y))
            .sum::<f64>()
            / (n - 1.0);

        cov_xy / var_x
    }

    /// Apply CUPED adjustment to the post-experiment values.
    ///
    /// Y_adj_i = Y_i - θ * (X_i - mean(X))
    ///
    /// Returns the CUPED-adjusted values.
    pub fn adjust_metrics(&self) -> Vec<f64> {
        let theta = self.calculate_theta();
        let pre = &self.pre_values[..];
        let mean_x = pre.mean();

        self.post_values
            .iter()
            .zip(self.pre_values.iter())
            .map(|(y, x)| y - theta * (x - mean_x))
            .collect()
    }

    /// Compute the variance reduction achieved by CUPED.
    ///
    /// Returns a percentage: 1 - Var(Y_adj) / Var(Y)
    ///
    /// A higher value means more variance was removed by the covariate.
    /// Typical values are 30-60% for well-correlated covariates.
    pub fn compute_variance_reduction(&self) -> f64 {
        let post = &self.post_values[..];
        let var_original = post.variance();
        if var_original < 1e-12 {
            return 0.0;
        }

        let adjusted = self.adjust_metrics();
        let var_adjusted = (&adjusted[..]).variance();

        ((1.0 - var_adjusted / var_original) * 100.0).max(0.0)
    }

    /// Run full CUPED analysis and return a complete adjustment result.
    pub fn run(&self) -> CupedAdjustment {
        let adjusted = self.adjust_metrics();
        let theta = self.calculate_theta();

        let post = &self.post_values[..];
        let adj = &adjusted[..];
        let original_mean = post.mean();
        let original_std = post.std_dev();
        let adjusted_mean = adj.mean();
        let adjusted_std = adj.std_dev();

        let var_reduction = self.compute_variance_reduction();

        CupedAdjustment {
            theta,
            adjusted_mean,
            adjusted_std_dev: adjusted_std,
            original_mean,
            original_std_dev: original_std,
            variance_reduction_percent: var_reduction,
            n_matched_users: self.pre_values.len(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generate_correlated_data(n: usize, correlation: f64) -> (Vec<f64>, Vec<f64>) {
        // Generate deterministic pseudo-correlated data for testing
        let pre: Vec<f64> = (0..n).map(|i| 10.0 + (i as f64 * 0.1)).collect();
        let post: Vec<f64> = pre
            .iter()
            .enumerate()
            .map(|(i, x)| {
                let noise = ((i * 7 + 3) % 13) as f64 * 0.1 - 0.6;
                correlation * x + (1.0 - correlation) * 5.0 + noise
            })
            .collect();
        (pre, post)
    }

    #[test]
    fn test_calculate_theta_with_known_data() {
        let (pre, post) = generate_correlated_data(200, 0.8);
        let calc = CupedCalculator::new(pre, post).unwrap();
        let theta = calc.calculate_theta();

        // Theta should be close to the correlation factor
        assert!(theta > 0.0, "Theta should be positive for correlated data");
        assert!(
            (theta - 0.8).abs() < 0.2,
            "Theta {} should be near 0.8",
            theta
        );
    }

    #[test]
    fn test_adjust_metrics_reduces_variance() {
        let (pre, post) = generate_correlated_data(200, 0.8);
        let calc = CupedCalculator::new(pre, post.clone()).unwrap();

        let adjusted = calc.adjust_metrics();
        let var_original = (&post[..]).variance();
        let var_adjusted = (&adjusted[..]).variance();

        assert!(
            var_adjusted < var_original,
            "Adjusted variance ({}) should be less than original ({})",
            var_adjusted,
            var_original
        );
    }

    #[test]
    fn test_compute_variance_reduction_percentage() {
        let (pre, post) = generate_correlated_data(200, 0.8);
        let calc = CupedCalculator::new(pre, post).unwrap();

        let reduction = calc.compute_variance_reduction();
        assert!(
            reduction > 0.0,
            "Variance reduction should be positive: {}",
            reduction
        );
        assert!(
            reduction <= 100.0,
            "Variance reduction should not exceed 100%: {}",
            reduction
        );
    }

    #[test]
    fn test_insufficient_sample_size() {
        let pre: Vec<f64> = (0..50).map(|i| i as f64).collect();
        let post: Vec<f64> = (0..50).map(|i| i as f64 + 1.0).collect();

        let result = CupedCalculator::new(pre, post);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Insufficient sample size"));
    }

    #[test]
    fn test_empty_pre_experiment_data() {
        let result = CupedCalculator::new(vec![], vec![]);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("No pre-experiment data"));
    }

    #[test]
    fn test_mismatched_lengths() {
        let pre = vec![1.0, 2.0, 3.0];
        let post = vec![1.0, 2.0];

        let result = CupedCalculator::new(pre, post);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("same length"));
    }

    #[test]
    fn test_zero_variance_covariate() {
        // All pre-experiment values are identical
        let pre: Vec<f64> = vec![5.0; 150];
        let post: Vec<f64> = (0..150).map(|i| i as f64 * 0.1).collect();

        let calc = CupedCalculator::new(pre, post).unwrap();
        let theta = calc.calculate_theta();

        assert!(
            theta.abs() < 1e-10,
            "Theta should be ~0 when covariate has zero variance: {}",
            theta
        );

        let reduction = calc.compute_variance_reduction();
        assert!(
            reduction.abs() < 1e-6,
            "No variance reduction expected with constant covariate: {}",
            reduction
        );
    }

    #[test]
    fn test_run_full_analysis() {
        let (pre, post) = generate_correlated_data(200, 0.8);
        let calc = CupedCalculator::new(pre, post).unwrap();

        let result = calc.run();
        assert_eq!(result.n_matched_users, 200);
        assert!(result.theta > 0.0);
        assert!(result.variance_reduction_percent > 0.0);
        assert!(result.adjusted_std_dev < result.original_std_dev);
    }

    #[test]
    fn test_adjusted_mean_preserves_average() {
        // CUPED adjustment should preserve the overall mean
        // because mean(X - mean(X)) = 0, so mean(Y_adj) ≈ mean(Y)
        let (pre, post) = generate_correlated_data(200, 0.5);
        let calc = CupedCalculator::new(pre, post.clone()).unwrap();

        let adjusted = calc.adjust_metrics();
        let original_mean = (&post[..]).mean();
        let adjusted_mean = (&adjusted[..]).mean();

        assert!(
            (original_mean - adjusted_mean).abs() < 1e-10,
            "Adjusted mean ({}) should equal original mean ({})",
            adjusted_mean,
            original_mean
        );
    }
}
