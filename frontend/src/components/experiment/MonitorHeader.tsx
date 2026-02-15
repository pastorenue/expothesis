import React from 'react';
import type { Experiment } from '../../types';
import { StatusBadge } from '../Common';

type MonitorHeaderProps = {
    experiment: Experiment;
};

export const MonitorHeader: React.FC<MonitorHeaderProps> = ({ experiment }) => {
    return (
        <div className="mb-4 flex items-start justify-between">
            <div>
                <h2 className="mb-1">{experiment.name}</h2>
                <p className="text-slate-400">{experiment.description}</p>
            </div>
            <StatusBadge status={experiment.status} />
        </div>
    );
};
