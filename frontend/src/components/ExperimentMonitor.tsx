import React from 'react';
import type { Experiment } from '../types';
import { ExperimentStatus } from '../types';
import { StatusBadge } from './Common';

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
        <div className={`card border-2 ${getStatusColor()} animate-fade-in`}>
            <div className="mb-4 flex items-start justify-between">
                <div>
                    <h2 className="mb-1">{experiment.name}</h2>
                    <p className="text-slate-400">{experiment.description}</p>
                </div>
                <StatusBadge status={experiment.status} />
            </div>

            {experiment.hypothesis && (
                <div className="mb-6 rounded-2xl bg-slate-950/60 p-4 border border-slate-800/70">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Hypothesis</h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase">Primary Metric</p>
                            <p className="text-lg font-semibold text-cyan-300">{experiment.primary_metric}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">Null (H₀)</p>
                                <p className="text-sm text-slate-300">{experiment.hypothesis.null_hypothesis}</p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-500 uppercase">Alternative (H₁)</p>
                                <p className="text-sm text-slate-300">{experiment.hypothesis.alternative_hypothesis}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Control Buttons */}
            <div className="mb-6 flex gap-3">
                {canStart && (
                    <button onClick={onStart} className="btn-success" disabled={isLoading}>
                        {isLoading ? 'Processing...' : '▶ Start Experiment'}
                    </button>
                )}
                {canPause && (
                    <button onClick={onPause} className="btn-warning" disabled={isLoading}>
                        {isLoading ? 'Processing...' : '⏸ Pause'}
                    </button>
                )}
                {canStop && (
                    <button onClick={onStop} className="btn-danger" disabled={isLoading}>
                        {isLoading ? 'Processing...' : '⏹ Stop Experiment'}
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 soft-divider pt-4">
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Created</p>
                    <p className="text-slate-100 font-medium">{formatDate(experiment.created_at)}</p>
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-500 uppercase">Targeting</p>
                    <p className="text-slate-100 font-medium">
                        {experiment.user_groups.length > 0
                            ? `${experiment.user_groups.length} Groups`
                            : 'All Users'}
                    </p>
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

            {/* Variants Distribution */}
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

            {/* Status Messages */}
            {experiment.status === ExperimentStatus.Draft && (
                <div className="mt-4 rounded-xl bg-cyan-500/10 p-3 border border-cyan-500/20">
                    <p className="text-sm text-cyan-200">
                        ℹ️ This experiment is in draft mode. Click "Start Experiment" to begin collecting data.
                    </p>
                </div>
            )}
            {experiment.status === ExperimentStatus.Running && (
                <div className="mt-4 rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20">
                    <p className="text-sm text-emerald-200">
                        ✓ Experiment is running. Users are being assigned to variants and metrics are being collected.
                    </p>
                </div>
            )}
            {experiment.status === ExperimentStatus.Paused && (
                <div className="mt-4 rounded-xl bg-amber-400/10 p-3 border border-amber-400/20">
                    <p className="text-sm text-amber-200">
                        ⏸ Experiment is paused. No new users are being assigned, but existing data is preserved.
                    </p>
                </div>
            )}
        </div>
    );
};
