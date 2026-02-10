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

interface StatisticalDashboardProps {
    analysis: ExperimentAnalysis;
    isPolling?: boolean;
}

export const StatisticalDashboard: React.FC<StatisticalDashboardProps> = ({
    analysis,
    isPolling,
}) => {
    const { experiment, results, sample_sizes } = analysis;

    const formatNumber = (value: number | null | undefined, decimals: number = 2, suffix: string = '') => {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return `${value.toFixed(decimals)}${suffix}`;
    };

    const formatPercent = (value: number | null | undefined, decimals: number = 2) => {
        if (value === null || value === undefined || isNaN(value)) return '—';
        return `${(value * 100).toFixed(decimals)}%`;
    };

    // Prepare data for charts
    const variantComparison = results.map((result) => ({
        name: `${result.variant_b} vs ${result.variant_a}`,
        control: result.mean_a,
        treatment: result.mean_b,
        effectSize: result.effect_size,
        ciLower: result.confidence_interval_lower,
        ciUpper: result.confidence_interval_upper,
    }));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="mb-0">{experiment.name}</h2>
                    {isPolling && (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Live</span>
                        </div>
                    )}
                </div>
                <p className="text-gray-600">{experiment.description}</p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {results.map((result, idx) => (
                    <React.Fragment key={idx}>
                        <StatCard
                            title={`${result.variant_a} (Control)`}
                            value={formatNumber(result.mean_a, 3)}
                            subtitle={`n = ${result.sample_size_a.toLocaleString()}`}
                        />
                        <StatCard
                            title={`${result.variant_b} (Treatment)`}
                            value={formatNumber(result.mean_b, 3)}
                            subtitle={`n = ${result.sample_size_b.toLocaleString()}`}
                        />
                    </React.Fragment>
                ))}
            </div>

            {/* Statistical Results */}
            <div className="card">
                <h3 className="mb-4">Statistical Analysis</h3>
                <div className="space-y-6">
                    {results.map((result, idx) => (
                        <div key={idx} className="border-b border-gray-200 pb-6 last:border-0">
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="text-lg font-semibold text-gray-800">
                                    {result.variant_b} vs {result.variant_a}
                                </h4>
                                <SignificanceIndicator pValue={result.p_value} />
                            </div>

                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <div>
                                    <p className="text-sm text-gray-600">Effect Size</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        {result.effect_size > 0 ? '+' : ''}
                                        {formatPercent(result.effect_size)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">P-Value</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        {formatNumber(result.p_value, 4)}
                                    </p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-sm text-gray-600">95% Confidence Interval</p>
                                    <p className="text-xl font-bold text-gray-900">
                                        [{formatPercent(result.confidence_interval_lower)},{' '}
                                        {formatPercent(result.confidence_interval_upper)}]
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3">
                                <p className="text-xs text-gray-500">Test: {result.test_type}</p>
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
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                            }}
                        />
                        <Legend />
                        <Bar dataKey="control" fill="#94a3b8" name="Control" />
                        <Bar dataKey="treatment" fill="#0ea5e9" name="Treatment" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Effect Size with CI */}
            <div className="card">
                <h3 className="mb-4">Effect Size with Confidence Intervals</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={variantComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                            }}
                        />
                        <Legend />
                        <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
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
                            stroke="#0ea5e9"
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

            {/* Event Ingestion (Debug/Test) */}
            <div className="card border-dashed border-2 border-gray-200 bg-gray-50/50">
                <h3 className="mb-4 text-gray-700">Test Event Ingestion</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="label text-xs uppercase text-gray-500">User ID</label>
                        <input
                            type="text"
                            className="input bg-white"
                            id="test-user-id"
                            placeholder="e.g. user123"
                        />
                    </div>
                    <div>
                        <label className="label text-xs uppercase text-gray-500">Variant</label>
                        <select className="input bg-white" id="test-variant">
                            {experiment.variants.map((v: any) => (
                                <option key={v.name} value={v.name}>
                                    {v.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="label text-xs uppercase text-gray-500">Value</label>
                        <input
                            type="number"
                            className="input bg-white"
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
                <p className="mt-4 text-xs text-gray-500">
                    💡 This form is for manual testing. In production, events would be sent via the Ingestion SDK.
                </p>
            </div>

            {/* Hypothesis Summary */}
            {experiment.hypothesis && (
                <div className="card bg-gradient-to-r from-primary-50 to-blue-50">
                    <h3 className="mb-3">Hypothesis</h3>
                    <div className="space-y-2">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Null Hypothesis (H₀)</p>
                            <p className="text-gray-900">{experiment.hypothesis.null_hypothesis}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">Alternative Hypothesis (H₁)</p>
                            <p className="text-gray-900">{experiment.hypothesis.alternative_hypothesis}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 pt-2">
                            <div>
                                <p className="text-sm text-gray-600">Expected Effect</p>
                                <p className="font-semibold text-gray-900">
                                    {formatPercent(experiment.hypothesis.expected_effect_size, 1)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Significance Level (α)</p>
                                <p className="font-semibold text-gray-900">
                                    {formatNumber(experiment.hypothesis.significance_level, 2)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Power (1-β)</p>
                                <p className="font-semibold text-gray-900">
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
