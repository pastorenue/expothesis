import React from 'react';
import type { Experiment } from '../../types';

type TrafficDistributionProps = {
    experiment: Experiment;
};

export const TrafficDistribution: React.FC<TrafficDistributionProps> = ({ experiment }) => {
    return (
        <div className="mt-4 soft-divider pt-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-200">Traffic Distribution</h3>
            <div className="space-y-2">
                {experiment.variants.map((variant, idx) => (
                    <div key={idx}>
                        <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium text-slate-200">
                                {variant.name}
                                {variant.is_control && <span className="ml-2 badge-info text-xs">Control</span>}
                            </span>
                            <span className="text-slate-400">{variant.allocation_percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                            <div
                                className={`h-full ${variant.is_control ? 'bg-slate-600' : 'bg-cyan-400'}`}
                                style={{ width: `${variant.allocation_percent}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
