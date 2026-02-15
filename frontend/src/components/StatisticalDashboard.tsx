import React from 'react';
import type { CupedAdjustedResult, ExperimentAnalysis, StatisticalResult } from '../types';
import { CupedConfigurationModal } from './CupedConfigurationModal';
import { CupedImpactAnalysis } from './statistical-dashboard/CupedImpactAnalysis';
import { EffectSizeChart } from './statistical-dashboard/EffectSizeChart';
import { EventIngestionCard } from './statistical-dashboard/EventIngestionCard';
import { HealthChecksPanel } from './statistical-dashboard/HealthChecksPanel';
import { HypothesisSummary } from './statistical-dashboard/HypothesisSummary';
import { InsightsCard } from './statistical-dashboard/InsightsCard';
import { KeyMetricsGrid } from './statistical-dashboard/KeyMetricsGrid';
import { SampleSizeProgressCard } from './statistical-dashboard/SampleSizeProgressCard';
import { StatisticalHeader } from './statistical-dashboard/StatisticalHeader';
import { StatisticalResultsCard } from './statistical-dashboard/StatisticalResultsCard';
import { VarianceReductionGrid } from './statistical-dashboard/VarianceReductionGrid';
import { VariantComparisonChart } from './statistical-dashboard/VariantComparisonChart';

interface StatisticalDashboardProps {
    analysis: ExperimentAnalysis;
    isPolling?: boolean;
    useCuped?: boolean;
    onToggleCuped?: (enabled: boolean) => void;
}

export const StatisticalDashboard: React.FC<StatisticalDashboardProps> = ({
    analysis,
    isPolling,
    useCuped = false,
    onToggleCuped,
}) => {
    const tooltipStyles = {
        backgroundColor: 'var(--chart-tooltip-bg)',
        border: '1px solid var(--chart-tooltip-border)',
        borderRadius: '12px',
        color: 'var(--chart-tooltip-text)',
    };

    const { experiment, results, sample_sizes, cuped_adjusted_results, cuped_error } = analysis;
    const [showConfigModal, setShowConfigModal] = React.useState(false);

    // Determine which results to display
    const activeResults: Array<StatisticalResult | CupedAdjustedResult> =
        useCuped && cuped_adjusted_results ? cuped_adjusted_results : results;

    // Helper to map CupedAdjustedResult to shape compatible with display logic if needed,
    // or just use directly if properties align.
    // CupedAdjustedResult has adjusted_mean_a/b instead of mean_a/b.
    // Let's normalize for display.
    type DisplayResult = StatisticalResult & {
        n_matched_users_a?: number;
        n_matched_users_b?: number;
        variance_reduction?: number;
    };

    const displayResults: DisplayResult[] = activeResults.map((result) => {
        if ('adjusted_mean_a' in result) {
            const cuped = result as CupedAdjustedResult;
            return {
                experiment_id: experiment.id,
                variant_a: cuped.variant_a,
                variant_b: cuped.variant_b,
                metric_name: cuped.metric_name,
                sample_size_a: cuped.n_matched_users_a,
                sample_size_b: cuped.n_matched_users_b,
                mean_a: cuped.adjusted_mean_a,
                mean_b: cuped.adjusted_mean_b,
                std_dev_a: undefined,
                std_dev_b: undefined,
                effect_size: cuped.adjusted_effect_size,
                p_value: cuped.adjusted_p_value,
                confidence_interval_lower: cuped.adjusted_ci_lower,
                confidence_interval_upper: cuped.adjusted_ci_upper,
                is_significant: cuped.is_significant,
                test_type: experiment.analysis_engine,
                analysis_engine: experiment.analysis_engine,
                calculated_at: experiment.updated_at,
                n_matched_users_a: cuped.n_matched_users_a,
                n_matched_users_b: cuped.n_matched_users_b,
                variance_reduction: cuped.variance_reduction_percent,
            };
        }

        const standard = result as StatisticalResult;
        return {
            ...standard,
            mean_a: standard.mean_a,
            mean_b: standard.mean_b,
            std_dev_a: standard.std_dev_a,
            std_dev_b: standard.std_dev_b,
            effect_size: standard.effect_size,
            p_value: standard.p_value,
            confidence_interval_lower: standard.confidence_interval_lower,
            confidence_interval_upper: standard.confidence_interval_upper,
        };
    });

    const formatNumber = (value: number | null | undefined, decimals: number = 2, suffix: string = '') => {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return `${value.toFixed(decimals)}${suffix}`;
    };

    const formatPercent = (value: number | null | undefined, decimals: number = 2) => {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return `${(value * 100).toFixed(decimals)}%`;
    };

    const insights = React.useMemo(() => {
        if (!displayResults.length) return null;

        const withSignificance = displayResults.map((result) => {
            const significant = result.bayes_probability !== undefined
                ? result.bayes_probability >= 0.95
                : result.p_value < 0.05;
            return { ...result, significant };
        });

        const best = [...withSignificance].sort((a, b) => b.effect_size - a.effect_size)[0];
        const sampleProgress = sample_sizes.length
            ? sample_sizes.reduce((sum, size) => sum + Math.min(1, size.current_size / size.required_size), 0) /
              sample_sizes.length
            : 0;

        const lift = best ? formatPercent(best.effect_size) : '—';
        const headline = best?.significant
            ? `${best.variant_b} is leading with ${lift} lift`
            : `No statistically significant winner yet`;

        const bullets: string[] = [];
        if (best) {
            bullets.push(
                best.significant
                    ? `Signal is significant (${best.bayes_probability !== undefined ? `posterior ${formatNumber(best.bayes_probability, 3)}` : `p=${formatNumber(best.p_value, 4)}`}).`
                    : `Signal is trending (${best.bayes_probability !== undefined ? `posterior ${formatNumber(best.bayes_probability, 3)}` : `p=${formatNumber(best.p_value, 4)}`}).`,
            );
        }
        if (sampleProgress < 0.5) {
            bullets.push(`Sample progress is ${(sampleProgress * 100).toFixed(0)}% — keep running to increase power.`);
        } else if (sampleProgress < 1) {
            bullets.push(`Sample progress is ${(sampleProgress * 100).toFixed(0)}% — nearing target sample size.`);
        } else {
            bullets.push(`Sample target reached — safe to make a decision if guardrails are stable.`);
        }

        return { headline, bullets };
    }, [displayResults, sample_sizes]);

    // Prepare data for charts
    const variantComparison = displayResults.map((result) => ({
        name: `${result.variant_b} vs ${result.variant_a}`,
        control: result.mean_a,
        treatment: result.mean_b,
        effectSize: result.effect_size,
        ciLower: result.confidence_interval_lower,
        ciUpper: result.confidence_interval_upper,
    }));

    return (
        <div className="space-y-6 animate-fade-in">
            <StatisticalHeader
                experiment={experiment}
                isPolling={isPolling}
                useCuped={useCuped}
                onToggleCuped={onToggleCuped}
                onOpenConfig={() => setShowConfigModal(true)}
                cupedError={cuped_error}
                hasCupedResults={Boolean(cuped_adjusted_results)}
            />

            <CupedConfigurationModal
                experimentId={experiment.id}
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
            />

            {insights && <InsightsCard headline={insights.headline} bullets={insights.bullets} />}

            {/* Key Metrics Grid */}
            <KeyMetricsGrid results={displayResults} formatNumber={formatNumber} />

            {/* CUPED Variance Reduction Stats */}
            {useCuped && cuped_adjusted_results && (
                <VarianceReductionGrid results={displayResults} formatPercent={formatPercent} />
            )}

            {/* Statistical Results */}
            <StatisticalResultsCard
                results={displayResults}
                formatNumber={formatNumber}
                formatPercent={formatPercent}
            />

            {/* Conversion Rate Comparison Chart */}
            <VariantComparisonChart data={variantComparison} tooltipStyles={tooltipStyles} />

            {/* CUPED Impact Analysis Graphs */}
            {useCuped && cuped_adjusted_results && (
                <CupedImpactAnalysis
                    analysisResults={analysis.results}
                    cupedResults={cuped_adjusted_results}
                    formatNumber={formatNumber}
                />
            )}

            {/* Effect Size with CI */}
            <EffectSizeChart data={variantComparison} tooltipStyles={tooltipStyles} />

            {/* Sample Size Progress */}
            <SampleSizeProgressCard sampleSizes={sample_sizes} />

            <HealthChecksPanel checks={analysis.health_checks} formatNumber={formatNumber} />

            {/* Event Ingestion (Debug/Test) */}
            <EventIngestionCard experiment={experiment} />

            {/* Hypothesis Summary */}
            <HypothesisSummary
                hypothesis={experiment.hypothesis}
                formatNumber={formatNumber}
                formatPercent={formatPercent}
            />
        </div>
    );
};
