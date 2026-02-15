import React from 'react';
import { StatCard } from '../Common';

type DisplayResult = {
    variant_a: string;
    variant_b: string;
    mean_a: number;
    mean_b: number;
    variance_reduction?: number;
    n_matched_users_a?: number;
    n_matched_users_b?: number;
    sample_size_a?: number;
    sample_size_b?: number;
};

type KeyMetricsGridProps = {
    results: DisplayResult[];
    formatNumber: (value: number | null | undefined, decimals?: number, suffix?: string) => string;
};

export const KeyMetricsGrid: React.FC<KeyMetricsGridProps> = ({ results, formatNumber }) => {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {results.map((result, idx) => (
                <React.Fragment key={idx}>
                    <StatCard
                        title={`${result.variant_a} (Control)`}
                        value={formatNumber(result.mean_a, 3)}
                        subtitle={
                            <span className={result.variance_reduction ? 'text-indigo-300' : ''}>
                                {result.variance_reduction ? (
                                    <>Using Adjusted Mean</>
                                ) : (
                                    `n = ${result.n_matched_users_a ?? result.sample_size_a?.toLocaleString()}`
                                )}
                            </span>
                        }
                    />
                    <StatCard
                        title={`${result.variant_b} (Treatment)`}
                        value={formatNumber(result.mean_b, 3)}
                        subtitle={
                            <span className={result.variance_reduction ? 'text-indigo-300' : ''}>
                                {result.variance_reduction ? (
                                    <>Using Adjusted Mean</>
                                ) : (
                                    `n = ${result.n_matched_users_b ?? result.sample_size_b?.toLocaleString()}`
                                )}
                            </span>
                        }
                    />
                </React.Fragment>
            ))}
        </div>
    );
};
