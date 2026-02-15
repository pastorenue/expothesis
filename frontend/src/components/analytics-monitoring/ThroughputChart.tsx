import React from 'react';
import {
    AreaChart,
    Area,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

type ThroughputChartProps = {
    data: Array<{ time: string; assignments: number; exposures: number; conversions: number }>;
    tooltipStyles: React.CSSProperties;
};

export const ThroughputChart: React.FC<ThroughputChartProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>Experiment Throughput</h3>
                <span className="badge-gray">Assignments vs exposures</span>
            </div>
            <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
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
                        <Legend wrapperStyle={{ color: 'var(--chart-legend-text)' }} />
                        <Area type="monotone" dataKey="assignments" stroke="#22c55e" fill="url(#assignFill)" />
                        <Area type="monotone" dataKey="exposures" stroke="#38bdf8" fill="url(#exposureFill)" />
                        <Line type="monotone" dataKey="conversions" stroke="#fbbf24" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
