import React from 'react';
import { StatCard } from '../Common';

type DisplayResult = {
    variance_reduction?: number;
    variant_b: string;
};

type VarianceReductionGridProps = {
    results: DisplayResult[];
    formatPercent: (value: number | null | undefined, decimals?: number) => string;
};

export const VarianceReductionGrid: React.FC<VarianceReductionGridProps> = ({ results, formatPercent }) => {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 animate-fade-in">
            {results
                .filter((result) => result.variance_reduction !== undefined)
                .map((result, idx) => (
                    <StatCard
                        key={`vr-${idx}`}
                        title={`Variance Reduction (${result.variant_b})`}
                        value={formatPercent((result.variance_reduction ?? 0) / 100, 1)}
                        subtitle="Less noise = Faster results"
                    />
                ))}
        </div>
    );
};
