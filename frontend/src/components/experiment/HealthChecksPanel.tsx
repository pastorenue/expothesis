import React from 'react';
import { HealthCheckDirection, type HealthCheck } from '../../types';

type HealthChecksPanelProps = {
    healthChecks: HealthCheck[] | undefined;
    onAdd: () => void;
    onUpdate: (index: number, field: keyof HealthCheck, value: number | string | undefined) => void;
    onRemove: (index: number) => void;
};

export const HealthChecksPanel: React.FC<HealthChecksPanelProps> = ({
    healthChecks,
    onAdd,
    onUpdate,
    onRemove,
}) => {
    const checks = healthChecks || [];

    return (
        <div className="health-check-panel rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-100">Health Checks</h4>
                <button onClick={onAdd} className="btn-secondary">
                    + Add Health Check
                </button>
            </div>
            {checks.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No health checks configured.</p>
            ) : (
                <div className="mt-4 space-y-3">
                    {checks.map((check, idx) => (
                        <div
                            key={idx}
                            className="health-check-row grid grid-cols-1 gap-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 md:grid-cols-[1.2fr_1fr_1fr_80px]"
                        >
                            <input
                                className="input"
                                placeholder="Metric name"
                                value={check.metric_name}
                                onChange={(e) => onUpdate(idx, 'metric_name', e.target.value)}
                            />
                            <select
                                className="input"
                                value={check.direction}
                                onChange={(e) => onUpdate(idx, 'direction', e.target.value as HealthCheckDirection)}
                            >
                                <option value={HealthCheckDirection.AtLeast}>At least</option>
                                <option value={HealthCheckDirection.AtMost}>At most</option>
                                <option value={HealthCheckDirection.Between}>Between</option>
                            </select>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Min"
                                    value={check.min ?? ''}
                                    onChange={(e) =>
                                        onUpdate(idx, 'min', e.target.value ? Number(e.target.value) : undefined)
                                    }
                                />
                                <input
                                    type="number"
                                    className="input"
                                    placeholder="Max"
                                    value={check.max ?? ''}
                                    onChange={(e) =>
                                        onUpdate(idx, 'max', e.target.value ? Number(e.target.value) : undefined)
                                    }
                                />
                            </div>
                            <button onClick={() => onRemove(idx)} className="btn-danger">
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
