import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

type VariantComparisonDatum = {
    name: string;
    control: number;
    treatment: number;
};

type VariantComparisonChartProps = {
    data: VariantComparisonDatum[];
    tooltipStyles: React.CSSProperties;
};

export const VariantComparisonChart: React.FC<VariantComparisonChartProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <h3 className="mb-4">Variant Performance Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={tooltipStyles} />
                    <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                    <Bar dataKey="control" fill="#64748b" name="Control" />
                    <Bar dataKey="treatment" fill="#38bdf8" name="Treatment" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
