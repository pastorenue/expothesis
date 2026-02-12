import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { analyticsApi } from '../services/api';
import { LoadingSpinner, StatCard } from './Common';

const tooltipStyles = {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '12px',
    color: '#e2e8f0',
};

const coverageColors: Record<string, string> = {
    Primary: '#38bdf8',
    Guardrail: '#f59e0b',
    Diagnostic: '#94a3b8',
    'Feature Impact': '#22c55e',
};

const statusBadge = (status: string) => {
    switch (status) {
        case 'Healthy':
            return 'badge-success';
        case 'Degraded':
            return 'badge-warning';
        case 'Delayed':
            return 'badge-danger';
        default:
            return 'badge-gray';
    }
};

const severityBadge = (severity: string) => {
    switch (severity) {
        case 'critical':
            return 'badge-danger';
        case 'warning':
            return 'badge-warning';
        default:
            return 'badge-info';
    }
};

export const AnalyticsMonitoringDashboard: React.FC = () => {
    const { data, isLoading } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: async () => {
            const response = await analyticsApi.getOverview();
            return response.data;
        },
        refetchInterval: 5000,
    });

    const formatCompact = (value: number) =>
        new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
    const formatPercent = (value: number, decimals = 2) => `${value.toFixed(decimals)}%`;
    const formatPp = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}pp`;
    const formatSeconds = (value: number) => {
        if (value < 60) return `${value}s`;
        if (value < 3600) return `${Math.round(value / 60)}m`;
        return `${Math.round(value / 3600)}h`;
    };

    type StatTrend = 'up' | 'down' | 'neutral';
    interface OverviewStat {
        title: string;
        value: string | number;
        subtitle?: string;
        trend?: StatTrend;
        icon?: React.ReactNode;
    }

    if (isLoading && !data) {
        return <LoadingSpinner />;
    }

    const summary = data?.summary;
    const coverageSlices =
        data?.metric_coverage?.map((slice) => ({
            ...slice,
            color: coverageColors[slice.name] ?? '#64748b',
        })) ?? [
            { name: 'Primary', value: 0, color: coverageColors.Primary },
            { name: 'Guardrail', value: 0, color: coverageColors.Guardrail },
            { name: 'Diagnostic', value: 0, color: coverageColors.Diagnostic },
            { name: 'Feature Impact', value: 0, color: coverageColors['Feature Impact'] },
        ];

    const guardrailData = (data?.guardrail_health ?? []).map((point) => ({
        day: point.day,
        latency: point.latency,
        errorRate: point.error_rate,
        crashRate: point.crash_rate,
    }));

    const trendFor = (value?: number) => {
        if (value === undefined || Number.isNaN(value)) return 'neutral' as const;
        if (value > 0) return 'up' as const;
        if (value < 0) return 'down' as const;
        return 'neutral' as const;
    };

    const overviewStats: OverviewStat[] = [
        {
            title: 'Active Experiments',
            value: summary ? formatCompact(summary.active_experiments) : '—',
            subtitle: summary ? `${summary.active_experiments_delta >= 0 ? '+' : ''}${summary.active_experiments_delta} launched today` : '—',
            trend: trendFor(summary?.active_experiments_delta),
            icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 18V6m5 12V9m5 9V7m5 11V11" />
                </svg>
            ),
        },
        {
            title: 'Daily Exposures',
            value: summary ? formatCompact(summary.daily_exposures) : '—',
            subtitle: summary ? `${summary.exposures_delta_percent >= 0 ? '+' : ''}${summary.exposures_delta_percent.toFixed(1)}% vs prior` : '—',
            trend: trendFor(summary?.exposures_delta_percent),
            icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h5l4 6 6-14 3 4" />
                </svg>
            ),
        },
        {
            title: 'Primary Conversion',
            value: summary ? formatPercent(summary.primary_conversion_rate * 100, 2) : '—',
            subtitle: summary ? `${formatPp(summary.primary_conversion_delta_pp)} lift` : '—',
            trend: trendFor(summary?.primary_conversion_delta_pp),
            icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
            ),
        },
        {
            title: 'Guardrail Breaches',
            value: summary ? summary.guardrail_breaches.toString() : '—',
            subtitle: summary ? summary.guardrail_breaches_detail : '—',
            trend: summary ? (summary.guardrail_breaches === 0 ? 'up' : 'down') : 'neutral',
            icon: (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M4.93 4.93 19.07 19.07M7.05 16.95 16.95 7.05" />
                </svg>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1>Analytics & Monitoring</h1>
                    <p className="mt-1 text-slate-400">
                        Live experiment observability, guardrails, and metric health across your platform.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-info">Environment: {summary?.environment ?? '—'}</span>
                    <span className="badge-gray">
                        Last updated: {summary?.last_updated ? new Date(summary.last_updated).toLocaleTimeString() : '—'}
                    </span>
                    <span className="badge-gray">
                        Freshness: {summary ? formatSeconds(summary.data_freshness_seconds) : '—'}
                    </span>
                    <span className="badge-success">Streaming: {summary ? 'Healthy' : 'Loading'}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {overviewStats.map((stat) => (
                    <StatCard
                        key={stat.title}
                        title={stat.title}
                        value={stat.value}
                        subtitle={stat.subtitle}
                        trend={stat.trend}
                        icon={stat.icon}
                    />
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Experiment Throughput</h3>
                        <span className="badge-gray">Assignments vs exposures</span>
                    </div>
                    <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.throughput ?? []}>
                                <defs>
                                    <linearGradient id="exposureFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                                    </linearGradient>
                                    <linearGradient id="assignFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="time" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={tooltipStyles} />
                                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                <Area type="monotone" dataKey="assignments" stroke="#22c55e" fill="url(#assignFill)" />
                                <Area type="monotone" dataKey="exposures" stroke="#38bdf8" fill="url(#exposureFill)" />
                                <Line type="monotone" dataKey="conversions" stroke="#fbbf24" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Metric Coverage</h3>
                        <span className="badge-gray">Tracked metrics</span>
                    </div>
                    <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={coverageSlices}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={4}
                                >
                                    {coverageSlices.map((entry) => (
                                        <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={tooltipStyles} />
                                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2">
                            <span className="text-slate-400">Total metrics</span>
                            <span className="font-semibold text-slate-100">
                                {data?.metric_coverage_totals?.total_metrics ?? 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2">
                            <span className="text-slate-400">Guardrails</span>
                            <span className="font-semibold text-slate-100">
                                {data?.metric_coverage_totals?.guardrails ?? 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2">
                            <span className="text-slate-400">Diagnostics</span>
                            <span className="font-semibold text-slate-100">
                                {data?.metric_coverage_totals?.diagnostics ?? 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2">
                            <span className="text-slate-400">Holdout metrics</span>
                            <span className="font-semibold text-slate-100">
                                {data?.metric_coverage_totals?.holdout_metrics ?? 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Primary Metrics Trend</h3>
                        <span className="badge-gray">7-day performance</span>
                    </div>
                    <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data?.primary_metric_trend ?? []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="day" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={tooltipStyles} />
                                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                <Line type="monotone" dataKey="conversion" stroke="#38bdf8" strokeWidth={2} />
                                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
                                <Line type="monotone" dataKey="retention" stroke="#fbbf24" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Guardrail Health</h3>
                        <span className="badge-warning">2 breaches</span>
                    </div>
                    <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={guardrailData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="day" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={tooltipStyles} />
                                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                <ReferenceLine y={250} stroke="#f59e0b" strokeDasharray="4 4" />
                                <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} />
                                <Line type="monotone" dataKey="errorRate" stroke="#f87171" strokeWidth={2} />
                                <Line type="monotone" dataKey="crashRate" stroke="#38bdf8" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Sample Ratio Mismatch (SRM)</h3>
                        <span className="badge-danger">1 active alert</span>
                    </div>
                    <div className="mt-4 h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.srm?.variants ?? []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="variant" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={tooltipStyles} />
                                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                <Bar dataKey="expected" fill="#38bdf8" name="Expected %" />
                                <Bar dataKey="observed" fill="#f59e0b" name="Observed %" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2">
                            <p className="text-slate-400">p-value</p>
                            <p className="text-lg font-semibold text-rose-300">
                                {data?.srm?.summary?.p_value?.toFixed(3) ?? '—'}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2">
                            <p className="text-slate-400">Allocation drift</p>
                            <p className="text-lg font-semibold text-amber-200">
                                {data?.srm?.summary ? `${data.srm.summary.allocation_drift.toFixed(2)}%` : '—'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Exposure Funnel</h3>
                        <span className="badge-gray">Last 24h</span>
                    </div>
                    <div className="mt-4 h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.funnel ?? []} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="step" type="category" stroke="#94a3b8" width={110} />
                                <Tooltip contentStyle={tooltipStyles} />
                                <Bar dataKey="users" fill="#38bdf8" radius={[0, 6, 6, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Anomaly Alerts</h3>
                        <span className="badge-gray">Last 7 days</span>
                    </div>
                    <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.anomaly_alerts ?? []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                <XAxis dataKey="day" stroke="#94a3b8" />
                                <YAxis stroke="#94a3b8" />
                                <Tooltip contentStyle={tooltipStyles} />
                                <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                                <Bar dataKey="critical" stackId="a" fill="#f87171" />
                                <Bar dataKey="warning" stackId="a" fill="#fbbf24" />
                                <Bar dataKey="info" stackId="a" fill="#38bdf8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Segment Lift Radar</h3>
                        <span className="badge-gray">Relative uplift %</span>
                    </div>
                    <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data?.segment_lift ?? []}>
                                <PolarGrid stroke="#1f2937" />
                                <PolarAngleAxis dataKey="segment" stroke="#94a3b8" />
                                <PolarRadiusAxis stroke="#94a3b8" />
                                <Radar dataKey="lift" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.25} />
                                <Tooltip contentStyle={tooltipStyles} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Metrics Inventory</h3>
                        <span className="badge-gray">Tracking + guardrails</span>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-800/70">
                        <div className="grid grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr_0.7fr] gap-3 bg-slate-950/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            <span>Metric</span>
                            <span>Category</span>
                            <span>Freshness</span>
                            <span>Owner</span>
                            <span>Status</span>
                        </div>
                        <div className="divide-y divide-slate-800/70">
                            {(data?.metric_inventory ?? []).map((metric) => (
                                <div key={metric.name} className="grid grid-cols-[1.4fr_0.8fr_0.6fr_0.6fr_0.7fr] gap-3 px-4 py-3 text-sm text-slate-200">
                                    <div>
                                        <div className="font-semibold text-slate-100">{metric.name}</div>
                                        <div className="text-xs text-slate-500">
                                            Guardrail: {metric.guardrail ?? '—'}
                                        </div>
                                    </div>
                                    <span className="text-slate-300">{metric.category}</span>
                                    <span className="text-slate-300">{formatSeconds(metric.freshness_seconds)}</span>
                                    <span className="text-slate-300">{metric.owner}</span>
                                    <span className={statusBadge(metric.status)}>{metric.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="flex items-center justify-between">
                        <h3>Alert Feed</h3>
                        <span className="badge-gray">Realtime ops</span>
                    </div>
                    <div className="mt-4 space-y-3">
                        {(data?.alert_feed ?? []).map((alert) => (
                            <div key={alert.title} className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-slate-100">{alert.title}</p>
                                    <span className={severityBadge(alert.severity)}>{alert.severity}</span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">{alert.time}</p>
                                <p className="mt-2 text-sm text-slate-300">{alert.detail}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 grid gap-3">
                        <div className="rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Data freshness</span>
                                <span className="text-emerald-300">
                                    {data?.system_health ? formatSeconds(data.system_health.data_freshness_seconds) : '—'}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-slate-400">SDK error rate</span>
                                <span className="text-amber-200">
                                    {data?.system_health ? formatPercent(data.system_health.sdk_error_rate, 2) : '—'}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-slate-400">Evaluation latency</span>
                                <span className="text-slate-100">
                                    {data?.system_health ? `${data.system_health.evaluation_latency_ms.toFixed(1)}ms` : '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
