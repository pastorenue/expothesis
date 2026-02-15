import React from 'react';
import { StatCard } from '../Common';

type StatTrend = 'up' | 'down' | 'neutral';

type OverviewStat = {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: StatTrend;
    icon?: React.ReactNode;
};

type OverviewStatsProps = {
    stats: OverviewStat[];
};

export const OverviewStats: React.FC<OverviewStatsProps> = ({ stats }) => {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
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
    );
};
