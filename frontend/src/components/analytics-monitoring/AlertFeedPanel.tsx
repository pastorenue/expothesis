import React from 'react';

type AlertItem = {
    title: string;
    severity: string;
    time: string;
    detail: string;
};

type AlertTriage = {
    counts: Record<string, number>;
    recommendations: string[];
};

type SystemHealth = {
    data_freshness_seconds: number;
    sdk_error_rate: number;
    evaluation_latency_ms: number;
};

type AlertFeedPanelProps = {
    alertTriage: AlertTriage | null;
    alertFeed: AlertItem[];
    systemHealth?: SystemHealth;
    severityBadge: (severity: string) => string;
    formatSeconds: (value: number) => string;
    formatPercent: (value: number, decimals?: number) => string;
};

export const AlertFeedPanel: React.FC<AlertFeedPanelProps> = ({
    alertTriage,
    alertFeed,
    systemHealth,
    severityBadge,
    formatSeconds,
    formatPercent,
}) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>Alert Feed</h3>
                <span className="badge-gray">Realtime ops</span>
            </div>
            {alertTriage && (
                <div className="insights-card mt-4 rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-100">AI Triage Summary</p>
                        <span className="badge-gray">
                            {(alertTriage.counts.critical ?? 0)} critical · {(alertTriage.counts.warning ?? 0)} warning
                        </span>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                        {alertTriage.recommendations.map((item, idx) => (
                            <li key={idx}>• {item}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="mt-4 space-y-3">
                {alertFeed.map((alert) => (
                    <div key={alert.title} className="insights-card rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
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
                <div className="insights-tile rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Data freshness</span>
                        <span className="text-emerald-300">
                            {systemHealth ? formatSeconds(systemHealth.data_freshness_seconds) : '—'}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-slate-400">SDK error rate</span>
                        <span className="text-amber-200">
                            {systemHealth ? formatPercent(systemHealth.sdk_error_rate, 2) : '—'}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-slate-400">Evaluation latency</span>
                        <span className="text-slate-100">
                            {systemHealth ? `${systemHealth.evaluation_latency_ms.toFixed(1)}ms` : '—'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
