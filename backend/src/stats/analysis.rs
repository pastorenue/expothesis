use anyhow::Result;
use statrs::distribution::{ContinuousCDF, Normal, StudentsT};
use statrs::statistics::Statistics;

/// Calculate z-test for proportions (conversion rates)
pub fn z_test_proportions(
    successes_a: usize,
    total_a: usize,
    successes_b: usize,
    total_b: usize,
) -> Result<(f64, f64, f64, f64)> {
    let p1 = successes_a as f64 / total_a as f64;
    let p2 = successes_b as f64 / total_b as f64;

    let p_pooled = (successes_a + successes_b) as f64 / (total_a + total_b) as f64;
    let se = (p_pooled * (1.0 - p_pooled) * (1.0 / total_a as f64 + 1.0 / total_b as f64)).sqrt();

    let z = (p1 - p2) / se;
    let normal = Normal::new(0.0, 1.0)?;
    let p_value = 2.0 * (1.0 - normal.cdf(z.abs()));

    let effect_size = p1 - p2;
    let ci_margin = 1.96 * se; // 95% CI

    Ok((
        effect_size,
        p_value,
        effect_size - ci_margin,
        effect_size + ci_margin,
    ))
}

/// Calculate two-sample t-test for continuous metrics
pub fn t_test_two_sample(values_a: &[f64], values_b: &[f64]) -> Result<(f64, f64, f64, f64)> {
    let mean_a = values_a.mean();
    let mean_b = values_b.mean();
    let var_a = values_a.variance();
    let var_b = values_b.variance();
    let n_a = values_a.len() as f64;
    let n_b = values_b.len() as f64;

    // Welch's t-test (unequal variances)
    let se = (var_a / n_a + var_b / n_b).sqrt();
    let t_stat = (mean_a - mean_b) / se;

    // Welch-Satterthwaite degrees of freedom
    let df = (var_a / n_a + var_b / n_b).powi(2)
        / ((var_a / n_a).powi(2) / (n_a - 1.0) + (var_b / n_b).powi(2) / (n_b - 1.0));

    let students_t = StudentsT::new(0.0, 1.0, df)?;
    let p_value = 2.0 * (1.0 - students_t.cdf(t_stat.abs()));

    let effect_size = mean_a - mean_b;
    let ci_margin = students_t.inverse_cdf(0.975) * se;

    Ok((
        effect_size,
        p_value,
        effect_size - ci_margin,
        effect_size + ci_margin,
    ))
}

/// Calculate required sample size for proportion test
pub fn sample_size_proportion(
    baseline_conversion: f64,
    mde: f64, // Minimum detectable effect
    alpha: f64,
    power: f64,
) -> usize {
    let normal = Normal::new(0.0, 1.0).unwrap();
    let z_alpha = normal.inverse_cdf(1.0 - alpha / 2.0); // Two-tailed
    let z_beta = normal.inverse_cdf(power);

    let p1 = baseline_conversion;
    let p2 = baseline_conversion + mde;
    let p_avg = (p1 + p2) / 2.0;

    let numerator = (z_alpha * (2.0 * p_avg * (1.0 - p_avg)).sqrt()
        + z_beta * (p1 * (1.0 - p1) + p2 * (1.0 - p2)).sqrt())
    .powi(2);
    let denominator = (p2 - p1).powi(2);

    (numerator / denominator).ceil() as usize
}

/// Calculate required sample size for continuous metric
pub fn sample_size_continuous(std_dev: f64, mde: f64, alpha: f64, power: f64) -> usize {
    let normal = Normal::new(0.0, 1.0).unwrap();
    let z_alpha = normal.inverse_cdf(1.0 - alpha / 2.0); // Two-tailed
    let z_beta = normal.inverse_cdf(power);

    let n = (2.0 * std_dev.powi(2) * (z_alpha + z_beta).powi(2)) / mde.powi(2);
    n.ceil() as usize
}

/// Calculate Cohen's d effect size
pub fn cohens_d(mean_a: f64, mean_b: f64, std_pooled: f64) -> f64 {
    (mean_a - mean_b) / std_pooled
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_z_test_proportions() {
        let result = z_test_proportions(100, 1000, 120, 1000);
        assert!(result.is_ok());
        let (effect, p_value, ci_low, ci_high) = result.unwrap();
        assert!(effect < 0.0); // A is worse than B
        assert!(p_value > 0.05); // Not significant
    }

    #[test]
    fn test_sample_size_proportion() {
        let n = sample_size_proportion(0.10, 0.02, 0.05, 0.8);
        assert!(n > 0);
        assert!(n < 10000); // Sanity check
    }

    #[test]
    fn test_cohens_d() {
        let d = cohens_d(10.0, 8.0, 2.0);
        assert!((d - 1.0).abs() < 0.01);
    }
}
