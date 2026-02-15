import React from 'react';
import {
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

type PrimaryMetricsChartProps = {
    data: Array<{ day: string; conversion: number; revenue: number; retention: number }>;
    tooltipStyles: React.CSSProperties;
};

export const PrimaryMetricsChart: React.FC<PrimaryMetricsChartProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>Primary Metrics Trend</h3>
                <span className="badge-gray">7-day performance</span>
            </div>
            <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="day" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={tooltipStyles} />
                        <Legend wrapperStyle={{ color: 'var(--chart-legend-text)' }} />
                        <Line type="monotone" dataKey="conversion" stroke="#38bdf8" strokeWidth={2} />
                        <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
                        <Line type="monotone" dataKey="retention" stroke="#fbbf24" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
