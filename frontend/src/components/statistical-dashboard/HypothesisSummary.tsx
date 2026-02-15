import React from 'react';
import type { ExperimentAnalysis } from '../../types';

type HypothesisSummaryProps = {
    hypothesis: ExperimentAnalysis['experiment']['hypothesis'];
    formatNumber: (value: number | null | undefined, decimals?: number, suffix?: string) => string;
    formatPercent: (value: number | null | undefined, decimals?: number) => string;
};

export const HypothesisSummary: React.FC<HypothesisSummaryProps> = ({
    hypothesis,
    formatNumber,
    formatPercent,
}) => {
    if (!hypothesis) return null;

    return (
        <div className="experiment-hypothesis card">
            <h3 className="mb-3">Hypothesis</h3>
            <div className="space-y-2">
                <div>
                    <p className="text-sm font-medium text-slate-300">Null Hypothesis (H₀)</p>
                    <p className="text-slate-100">{hypothesis.null_hypothesis}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-slate-300">Alternative Hypothesis (H₁)</p>
                    <p className="text-slate-100">{hypothesis.alternative_hypothesis}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2">
                    <div>
                        <p className="text-sm text-slate-400">Expected Effect</p>
                        <p className="font-semibold text-slate-100">
                            {formatPercent(hypothesis.expected_effect_size, 1)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">Significance Level (α)</p>
                        <p className="font-semibold text-slate-100">
                            {formatNumber(hypothesis.significance_level, 2)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-slate-400">Power (1-β)</p>
                        <p className="font-semibold text-slate-100">
                            {formatNumber(hypothesis.power, 2)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
