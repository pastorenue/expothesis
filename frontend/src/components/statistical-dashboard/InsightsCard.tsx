import React from 'react';

type InsightsCardProps = {
    headline: string;
    bullets: string[];
};

export const InsightsCard: React.FC<InsightsCardProps> = ({ headline, bullets }) => {
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <h3>AI Insights</h3>
                <span className="badge-gray">Auto-summary</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-100">{headline}</div>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {bullets.map((bullet, idx) => (
                    <li key={idx}>• {bullet}</li>
                ))}
            </ul>
        </div>
    );
};
