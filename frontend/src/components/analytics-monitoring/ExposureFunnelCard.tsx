import React from 'react';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type ExposureFunnelCardProps = {
    data: Array<{ step: string; users: number }>;
    tooltipStyles: React.CSSProperties;
};

export const ExposureFunnelCard: React.FC<ExposureFunnelCardProps> = ({ data, tooltipStyles }) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>Exposure Funnel</h3>
                <span className="badge-gray">Last 24h</span>
            </div>
            <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis dataKey="step" type="category" stroke="#94a3b8" width={110} />
                        <Tooltip contentStyle={tooltipStyles} />
                        <Bar dataKey="users" fill="#38bdf8" radius={[0, 6, 6, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
