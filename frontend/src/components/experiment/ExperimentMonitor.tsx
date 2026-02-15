import React from 'react';
import type { Experiment } from '../../types';
import { ExperimentStatus } from '../../types';
import { ControlButtons } from './ControlButtons';
import { HypothesisCard } from './HypothesisCard';
import { MetaGrid } from './MetaGrid';
import { MonitorHeader } from './MonitorHeader';
import { StatusBanner } from './StatusBanner';
import { TrafficDistribution } from './TrafficDistribution';

interface ExperimentMonitorProps {
    experiment: Experiment;
    onStart: () => void;
    onPause: () => void;
    onStop: () => void;
    isLoading?: boolean;
}

export const ExperimentMonitor: React.FC<ExperimentMonitorProps> = ({
    experiment,
    onStart,
    onPause,
    onStop,
    isLoading,
}) => {
    const getStatusColor = () => {
        switch (experiment.status) {
            case ExperimentStatus.Running:
                return 'border-emerald-400/40 bg-emerald-500/5';
            case ExperimentStatus.Paused:
                return 'border-amber-300/40 bg-amber-400/5';
            case ExperimentStatus.Stopped:
                return 'border-rose-400/40 bg-rose-500/5';
            default:
                return 'border-slate-700/70 bg-slate-900/40';
        }
    };

    const canStart = experiment.status === ExperimentStatus.Draft || experiment.status === ExperimentStatus.Paused;
    const canPause = experiment.status === ExperimentStatus.Running;
    const canStop = experiment.status !== ExperimentStatus.Stopped;

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString();
    };

    return (
        <div className={`experiment-monitor card border-2 ${getStatusColor()} animate-fade-in`}>
            <MonitorHeader experiment={experiment} />
            <HypothesisCard experiment={experiment} />
            <ControlButtons
                canStart={canStart}
                canPause={canPause}
                canStop={canStop}
                isLoading={isLoading}
                onStart={onStart}
                onPause={onPause}
                onStop={onStop}
            />
            <MetaGrid experiment={experiment} formatDate={formatDate} />
            <TrafficDistribution experiment={experiment} />
            <StatusBanner status={experiment.status} />
        </div>
    );
};
