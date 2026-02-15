import React from 'react';
import {
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ReferenceLine,
    ResponsiveContainer,
} from 'recharts';

type GuardrailHealthChartProps = {
    data: Array<{ day: string; latency: number; errorRate: number; crashRate: number }>;
    tooltipStyles: React.CSSProperties;
};

export const GuardrailHealthChart: React.FC<GuardrailHealthChartProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>Guardrail Health</h3>
                <span className="badge-warning">2 breaches</span>
            </div>
            <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="day" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={tooltipStyles} />
                        <Legend wrapperStyle={{ color: 'var(--chart-legend-text)' }} />
                        <ReferenceLine y={250} stroke="#f59e0b" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} />
                        <Line type="monotone" dataKey="errorRate" stroke="#f87171" strokeWidth={2} />
                        <Line type="monotone" dataKey="crashRate" stroke="#38bdf8" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
