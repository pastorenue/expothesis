import React from 'react';
import type { Experiment } from '../../types';

type MetaGridProps = {
    experiment: Experiment;
    formatDate: (value?: string) => string;
};

export const MetaGrid: React.FC<MetaGridProps> = ({ experiment, formatDate }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 soft-divider pt-4">
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Created</p>
                <p className="text-slate-100 font-medium">{formatDate(experiment.created_at)}</p>
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Targeting</p>
                <p className="text-slate-100 font-medium">
                    {experiment.user_groups.length > 0 ? `${experiment.user_groups.length} Groups` : 'All Users'}
                </p>
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Type</p>
                <p className="text-slate-100 font-medium">{experiment.experiment_type}</p>
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Engine</p>
                <p className="text-slate-100 font-medium">{experiment.analysis_engine}</p>
            </div>
            {experiment.start_date && (
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Started</p>
                    <p className="text-slate-100 font-medium">{formatDate(experiment.start_date)}</p>
                </div>
            )}
            {experiment.end_date && (
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Ended</p>
                    <p className="text-slate-100 font-medium">{formatDate(experiment.end_date)}</p>
                </div>
            )}
        </div>
    );
};
