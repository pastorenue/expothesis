import React from 'react';
import { ProgressBar } from '../Common';
import type { ExperimentAnalysis } from '../../types';

type SampleSizeProgressCardProps = {
    sampleSizes: ExperimentAnalysis['sample_sizes'];
};

export const SampleSizeProgressCard: React.FC<SampleSizeProgressCardProps> = ({ sampleSizes }) => {
    return (
        <div className="card">
            <h3 className="mb-4">Sample Size Progress</h3>
            <div className="space-y-4">
                {sampleSizes.map((size, idx) => (
                    <ProgressBar
                        key={idx}
                        current={size.current_size}
                        total={size.required_size}
                        label={size.variant}
                    />
                ))}
            </div>
        </div>
    );
};
