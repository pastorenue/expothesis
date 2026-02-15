import React from 'react';
import {
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

type EffectSizeDatum = {
    name: string;
    effectSize: number;
    ciLower: number;
    ciUpper: number;
};

type EffectSizeChartProps = {
    data: EffectSizeDatum[];
    tooltipStyles: React.CSSProperties;
};

export const EffectSizeChart: React.FC<EffectSizeChartProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <h3 className="mb-4">Effect Size with Confidence Intervals</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyles} />
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
                    <Line type="monotone" dataKey="effectSize" stroke="#38bdf8" strokeWidth={2} name="Effect Size" />
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
    );
};
