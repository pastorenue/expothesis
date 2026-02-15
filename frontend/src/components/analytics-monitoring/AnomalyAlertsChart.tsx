import React from 'react';
import {
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

type AnomalyAlertsChartProps = {
    data: Array<{ day: string; critical: number; warning: number; info: number }>;
    tooltipStyles: React.CSSProperties;
};

export const AnomalyAlertsChart: React.FC<AnomalyAlertsChartProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>Anomaly Alerts</h3>
                <span className="badge-gray">Last 7 days</span>
            </div>
            <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="day" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={tooltipStyles} />
                        <Legend wrapperStyle={{ color: 'var(--chart-legend-text)' }} />
                        <Bar dataKey="critical" stackId="a" fill="#f87171" />
                        <Bar dataKey="warning" stackId="a" fill="#fbbf24" />
                        <Bar dataKey="info" stackId="a" fill="#38bdf8" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
