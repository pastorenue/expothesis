import React from 'react';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import type { ExperimentAnalysis } from '../types';
import { eventApi } from '../services/api';
import { StatCard, SignificanceIndicator, ProgressBar } from './Common';
import { CupedConfigurationModal } from './CupedConfigurationModal';

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
    const { experiment, results, sample_sizes, cuped_adjusted_results, cuped_error } = analysis;
    const [showConfigModal, setShowConfigModal] = React.useState(false);

    // Determine which results to display
    const activeResults = (useCuped && cuped_adjusted_results)
        ? cuped_adjusted_results
        : results;

    // Helper to map CupedAdjustedResult to shape compatible with display logic if needed,
    // or just use directly if properties align.
    // CupedAdjustedResult has adjusted_mean_a/b instead of mean_a/b.
    // Let's normalize for display.
    const displayResults = activeResults.map((r: any) => ({
        ...r,
        mean_a: r.adjusted_mean_a ?? r.mean_a,
        mean_b: r.adjusted_mean_b ?? r.mean_b,
        std_dev_a: r.adjusted_std_dev ?? r.std_dev_a,
        std_dev_b: r.adjusted_std_dev ?? r.std_dev_b,
        effect_size: r.adjusted_effect_size ?? r.effect_size,
        p_value: r.adjusted_p_value ?? r.p_value,
        confidence_interval_lower: r.adjusted_ci_lower ?? r.confidence_interval_lower,
        confidence_interval_upper: r.adjusted_ci_upper ?? r.confidence_interval_upper,
        variance_reduction: r.variance_reduction_percent,
    }));

    const formatNumber = (value: number | null | undefined, decimals: number = 2, suffix: string = '') => {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return `${value.toFixed(decimals)}${suffix}`;
    };

    const formatPercent = (value: number | null | undefined, decimals: number = 2) => {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return `${(value * 100).toFixed(decimals)}%`;
    };

    // Prepare data for charts
    const variantComparison = displayResults.map((result: any) => ({
        name: `${result.variant_b} vs ${result.variant_a}`,
        control: result.mean_a,
        treatment: result.mean_b,
        effectSize: result.effect_size,
        ciLower: result.confidence_interval_lower,
        ciUpper: result.confidence_interval_upper,
    }));

    // Custom Tooltip Component for Light/Dark Mode Support
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-950/95 border border-slate-700/50 p-3 rounded-xl shadow-xl backdrop-blur-md theme-light:bg-white/95 theme-light:border-slate-200/80 theme-light:text-slate-800">
                    <p className="font-medium mb-2 text-slate-200 theme-light:text-slate-900">{label}</p>
                    <div className="space-y-1">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                                <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-slate-400 theme-light:text-slate-500">
                                    {entry.name}:
                                </span>
                                <span className="font-mono font-medium text-slate-200 theme-light:text-slate-900">
                                    {typeof entry.value === 'number'
                                        ? formatNumber(entry.value, 3)
                                        : entry.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="mb-0">{experiment.name}</h2>
                    {isPolling && (
                        <div className="flex items-center space-x-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
                            </span>
                            <span className="text-xs font-semibold text-emerald-200 uppercase tracking-[0.3em]">Live</span>
                        </div>
                    )}
                </div>
                <p className="text-slate-400">{experiment.description}</p>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <span className="badge-info">Engine: {experiment.analysis_engine}</span>
                    <span className="badge-gray">Sampling: {experiment.sampling_method}</span>
                    <span className="badge-gray">Type: {experiment.experiment_type}</span>

                    <div className="ml-auto flex items-center gap-3">
                        {onToggleCuped && (
                            <label className="flex items-center cursor-pointer gap-2">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={useCuped}
                                        onChange={(e) => onToggleCuped(e.target.checked)}
                                    />
                                    <div className={`block w-10 h-6 rounded-full transition-colors ${useCuped ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useCuped ? 'translate-x-4' : ''}`}></div>
                                </div>
                                <span className={`text-sm font-medium ${useCuped ? 'text-indigo-300' : 'text-slate-400'}`}>
                                    CUPED Variance Reduction
                                </span>
                            </label>
                        )}
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="btn-secondary text-xs py-1 px-2 h-auto"
                        >
                            Configure CUPED
                        </button>
                    </div>
                </div>

                {useCuped && cuped_error && (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
                        ⚠️ CUPED Analysis Failed: {cuped_error}. Showing standard results.
                    </div>
                )}

                {useCuped && !cuped_error && cuped_adjusted_results && (
                    <div className="mt-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3 flex items-center gap-2">
                        <span className="text-indigo-300">⚡ CUPED Active</span>
                        <span className="text-slate-300 text-sm">
                            Results are adjusted using pre-experiment data to reduce variance and increase sensitivity.
                        </span>
                    </div>
                )}
            </div>

            <CupedConfigurationModal
                experimentId={experiment.id}
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
            />

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {displayResults.map((result: any, idx: number) => (
                    <React.Fragment key={idx}>
                        <StatCard
                            title={`${result.variant_a} (Control)`}
                            value={formatNumber(result.mean_a, 3)}
                            subtitle={
                                <span className={result.variance_reduction ? 'text-indigo-300' : ''}>
                                    {result.variance_reduction ? (
                                        <>Using Adjusted Mean</>
                                    ) : (
                                        `n = ${result.n_matched_users_a ?? result.sample_size_a?.toLocaleString()}`
                                    )}
                                </span>
                            }
                        />
                        <StatCard
                            title={`${result.variant_b} (Treatment)`}
                            value={formatNumber(result.mean_b, 3)}
                            subtitle={
                                <span className={result.variance_reduction ? 'text-indigo-300' : ''}>
                                    {result.variance_reduction ? (
                                        <>Using Adjusted Mean</>
                                    ) : (
                                        `n = ${result.n_matched_users_b ?? result.sample_size_b?.toLocaleString()}`
                                    )}
                                </span>
                            }
                        />
                    </React.Fragment>
                ))}
            </div>

            {/* CUPED Variance Reduction Stats */}
            {useCuped && cuped_adjusted_results && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
                    {displayResults.map((result: any, idx: number) => result.variance_reduction !== undefined && (
                        <StatCard
                            key={`vr-${idx}`}
                            title={`Variance Reduction (${result.variant_b})`}
                            value={formatPercent(result.variance_reduction / 100, 1)}
                            subtitle="Less noise = Faster results"
                        />
                    ))}
                </div>
            )}

            {/* Statistical Results */}
            <div className="card">
                <h3 className="mb-4">Statistical Analysis</h3>
                <div className="space-y-6">
                    {displayResults.map((result: any, idx: number) => (
                        <div key={idx} className="border-b border-slate-800/70 pb-6 last:border-0">
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-slate-100">
                                    {result.variant_b} vs {result.variant_a}
                                </h4>
                                <SignificanceIndicator pValue={result.p_value} bayesProbability={result.bayes_probability} />
                            </div>

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Effect Size</p>
                                    <p className="text-xl font-semibold text-slate-100">
                                        {result.effect_size > 0 ? '+' : ''}
                                        {formatPercent(result.effect_size)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                        {result.bayes_probability !== undefined ? 'Posterior P' : 'P-Value'}
                                    </p>
                                    <p className="text-xl font-semibold text-slate-100">
                                        {result.bayes_probability !== undefined
                                            ? formatNumber(result.bayes_probability, 3)
                                            : formatNumber(result.p_value, 4)}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                                        {result.bayes_probability !== undefined ? '95% Credible Interval' : '95% Confidence Interval'}
                                    </p>
                                    <p className="text-xl font-semibold text-slate-100">
                                        [{formatPercent(result.confidence_interval_lower)},{' '}
                                        {formatPercent(result.confidence_interval_upper)}]
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3">
                                <p className="text-xs text-slate-500">Test: {result.test_type}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Conversion Rate Comparison Chart */}
            <div className="card">
                <h3 className="mb-4">Variant Performance Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={variantComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '12px',
                                color: '#e2e8f0',
                            }}
                        />
                        <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                        <Bar dataKey="control" fill="#64748b" name="Control" />
                        <Bar dataKey="treatment" fill="#38bdf8" name="Treatment" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* CUPED Impact Analysis Graphs */}
            {useCuped && cuped_adjusted_results && (
                <div className="card animate-fade-in">
                    <h3 className="mb-4">CUPED Impact Analysis</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* 1. Metric Means Comparison */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">Metric Mean (Original vs Adjusted)</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={(() => {
                                        // Prepare data by merging original results and CUPED results per variant
                                        const variantData: Record<string, any> = {};

                                        // 1. Get Original Means
                                        analysis.results.forEach((r: any) => {
                                            if (!variantData[r.variant_a]) variantData[r.variant_a] = { name: r.variant_a };
                                            variantData[r.variant_a].Original = r.mean_a;

                                            if (!variantData[r.variant_b]) variantData[r.variant_b] = { name: r.variant_b };
                                            variantData[r.variant_b].Original = r.mean_b;
                                        });

                                        // 2. Get CUPED Means
                                        cuped_adjusted_results.forEach((r: any) => {
                                            if (variantData[r.variant_a]) variantData[r.variant_a].CUPED = r.adjusted_mean_a;
                                            if (variantData[r.variant_b]) variantData[r.variant_b].CUPED = r.adjusted_mean_b;

                                            // Ensure original mean is set if not found in results (unlikely but safe)
                                            // Note: standard results should cover all variants.
                                        });

                                        return Object.values(variantData);
                                    })()}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                    <Bar dataKey="Original" fill="#64748b" name="Original Mean" />
                                    <Bar dataKey="CUPED" fill="#818cf8" name="CUPED Mean" />
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                Adjusted means remove pre-experiment bias.
                            </p>
                        </div>

                        {/* 2. Variance Reduction */}
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-4 text-center">Variance (Lower is Better)</h4>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                    data={(() => {
                                        const variantData: Record<string, any> = {};

                                        // Get Variances from CUPED results (it has both original and adjusted)
                                        cuped_adjusted_results.forEach((r: any) => {
                                            if (!variantData[r.variant_a]) variantData[r.variant_a] = { name: r.variant_a };
                                            variantData[r.variant_a].Original = r.original_variance_a;
                                            variantData[r.variant_a].CUPED = r.adjusted_variance_a;

                                            if (!variantData[r.variant_b]) variantData[r.variant_b] = { name: r.variant_b };
                                            variantData[r.variant_b].Original = r.original_variance_b;
                                            variantData[r.variant_b].CUPED = r.adjusted_variance_b;
                                        });

                                        return Object.values(variantData);
                                    })()}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                    <XAxis dataKey="name" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                    <Bar dataKey="Original" fill="#64748b" name="Original Variance" />
                                    <Bar dataKey="CUPED" fill="#34d399" name="CUPED Variance" />
                                </BarChart>
                            </ResponsiveContainer>
                            <p className="text-xs text-slate-500 mt-2 text-center">
                                Lower variance = higher sensitivity & faster results.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Effect Size with CI */}
            <div className="card">
                <h3 className="mb-4">Effect Size with Confidence Intervals</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={variantComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '12px',
                                color: '#e2e8f0',
                            }}
                        />
                        <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                        <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                        <Line
                            type="monotone"
                            dataKey="ciLower"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            name="Lower CI"
                            dot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="effectSize"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            name="Effect Size"
                        />
                        <Line
                            type="monotone"
                            dataKey="ciUpper"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            name="Upper CI"
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Sample Size Progress */}
            <div className="card">
                <h3 className="mb-4">Sample Size Progress</h3>
                <div className="space-y-4">
                    {sample_sizes.map((size, idx) => (
                        <ProgressBar
                            key={idx}
                            current={size.current_size}
                            total={size.required_size}
                            label={size.variant}
                        />
                    ))}
                </div>
            </div>

            {analysis.health_checks?.length > 0 && (
                <div className="card">
                    <h3 className="mb-4">Health Checks</h3>
                    <div className="space-y-3">
                        {analysis.health_checks.map((check, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-800/70 bg-slate-950/50 px-4 py-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-100">{check.metric_name}</p>
                                    <p className="text-xs text-slate-500">
                                        {check.direction} {check.min ?? '—'} {check.max !== undefined ? `→ ${check.max}` : ''}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-300">
                                        {check.current_value !== undefined && check.current_value !== null
                                            ? formatNumber(check.current_value, 3)
                                            : '—'}
                                    </p>
                                    <span className={`badge ${check.is_passing ? 'badge-success' : 'badge-danger'}`}>
                                        {check.is_passing ? 'Pass' : 'Fail'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Event Ingestion (Debug/Test) */}
            <div className="card border-dashed border-2 border-slate-800/70 bg-slate-950/60">
                <h3 className="mb-4 text-slate-200">Test Event Ingestion</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="label">User ID</label>
                        <input
                            type="text"
                            className="input"
                            id="test-user-id"
                            placeholder="e.g. user123"
                        />
                    </div>
                    <div>
                        <label className="label">Variant</label>
                        <select className="input" id="test-variant">
                            {experiment.variants.map((v: any) => (
                                <option key={v.name} value={v.name}>
                                    {v.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Value</label>
                        <input
                            type="number"
                            className="input"
                            id="test-value"
                            defaultValue="1.0"
                            step="0.1"
                        />
                    </div>
                    <button
                        onClick={async () => {
                            const userId = (document.getElementById('test-user-id') as HTMLInputElement).value;
                            const variant = (document.getElementById('test-variant') as HTMLSelectElement).value;
                            const value = parseFloat((document.getElementById('test-value') as HTMLInputElement).value);

                            if (!userId) {
                                alert('Please enter a User ID');
                                return;
                            }

                            try {
                                await eventApi.ingest({
                                    experiment_id: experiment.id,
                                    user_id: userId,
                                    variant: variant,
                                    metric_name: experiment.primary_metric,
                                    metric_value: value
                                });
                                // Notification handled by browser/OS or simple alert
                            } catch (e) {
                                console.error('Failed to ingest event', e);
                            }
                        }}
                        className="btn-primary w-full"
                    >
                        Send Event
                    </button>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                    💡 This form is for manual testing. In production, events would be sent via the Ingestion SDK.
                </p>
            </div>

            {/* Hypothesis Summary */}
            {experiment.hypothesis && (
                <div className="experiment-hypothesis card">
                    <h3 className="mb-3">Hypothesis</h3>
                    <div className="space-y-2">
                        <div>
                            <p className="text-sm font-medium text-slate-300">Null Hypothesis (H₀)</p>
                            <p className="text-slate-100">{experiment.hypothesis.null_hypothesis}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-300">Alternative Hypothesis (H₁)</p>
                            <p className="text-slate-100">{experiment.hypothesis.alternative_hypothesis}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 pt-2">
                            <div>
                                <p className="text-sm text-slate-400">Expected Effect</p>
                                <p className="font-semibold text-slate-100">
                                    {formatPercent(experiment.hypothesis.expected_effect_size, 1)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Significance Level (α)</p>
                                <p className="font-semibold text-slate-100">
                                    {formatNumber(experiment.hypothesis.significance_level, 2)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-400">Power (1-β)</p>
                                <p className="font-semibold text-slate-100">
                                    {formatNumber(experiment.hypothesis.power, 2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
