import React from 'react';
import type { FlowNode } from './types';

type NodePaletteProps = {
    experiments: Array<{ id: string; name: string; hypothesis?: { alternative_hypothesis?: string | null } | null; primary_metric?: string | null }>;
    userGroups: Array<{ id: string; name: string }>;
    createNode: (partial: Omit<FlowNode, 'id' | 'x' | 'y'>) => void;
    nodeBadgeClass: (kind: FlowNode['kind']) => string;
};

export const NodePalette: React.FC<NodePaletteProps> = ({
    experiments,
    userGroups,
    createNode,
    nodeBadgeClass,
}) => {
    const metrics = [...new Set(experiments.map((exp) => exp.primary_metric).filter((metric): metric is string => Boolean(metric)))];

    return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.2fr_1.2fr_1.2fr_1.2fr]">
            <details className="panel" open>
                <summary className="cursor-pointer text-[0.85rem] font-bold text-slate-300">
                    Anchors
                </summary>
                <div className="mt-3 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1">
                    <button
                        className={nodeBadgeClass('trigger-start')}
                        onClick={() => createNode({ kind: 'trigger-start', label: 'Start' })}
                    >
                        Start
                    </button>
                    <button
                        className={nodeBadgeClass('trigger-run')}
                        onClick={() => createNode({ kind: 'trigger-run', label: 'Run' })}
                    >
                        Run
                    </button>
                </div>
            </details>
            <details className="panel">
                <summary className="cursor-pointer text-sm font-bold text-slate-300">
                    Experiments
                </summary>
                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {experiments.length === 0 && (
                        <p className="text-sm text-slate-500">No experiments available.</p>
                    )}
                    {experiments.map((exp) => (
                        <button
                            key={exp.id}
                            className={`${nodeBadgeClass('experiment')} w-full text-center`}
                            onClick={() =>
                                createNode({
                                    kind: 'experiment',
                                    label: exp.name,
                                    data: { experimentId: exp.id },
                                })
                            }
                        >
                            {exp.name}
                        </button>
                    ))}
                </div>
            </details>
            <details className="panel">
                <summary className="cursor-pointer text-sm font-bold text-slate-300">
                    User Groups
                </summary>
                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {userGroups.length === 0 && (
                        <p className="text-sm text-slate-500">No user groups available.</p>
                    )}
                    {userGroups.map((group) => (
                        <button
                            key={group.id}
                            className={`${nodeBadgeClass('user-group')} w-full text-left`}
                            onClick={() =>
                                createNode({
                                    kind: 'user-group',
                                    label: group.name,
                                    data: { groupId: group.id },
                                })
                            }
                        >
                            {group.name}
                        </button>
                    ))}
                </div>
            </details>
            <details className="panel">
                <summary className="cursor-pointer text-sm font-bold text-slate-300">
                    Hypothesis
                </summary>
                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {experiments.map((exp) => {
                        const hypothesis = exp.hypothesis?.alternative_hypothesis;
                        if (!hypothesis) return null;
                        return (
                            <button
                                key={`hyp-${exp.id}`}
                                className={`${nodeBadgeClass('hypothesis')} w-full text-left`}
                                onClick={() =>
                                    createNode({
                                        kind: 'hypothesis',
                                        label: `H₁: ${exp.name}`,
                                        data: { hypothesis },
                                    })
                                }
                            >
                                {hypothesis}
                            </button>
                        );
                    })}
                    {experiments.every((exp) => !exp.hypothesis) && (
                        <p className="text-sm text-slate-500">No hypotheses configured.</p>
                    )}
                </div>
            </details>
            <details className="panel">
                <summary className="cursor-pointer text-[0.85rem] font-bold text-slate-300">
                    Metrics
                </summary>
                <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                    {metrics.map((metric) => (
                        <button
                            key={metric}
                            className={`${nodeBadgeClass('metric')} w-full text-left`}
                            onClick={() =>
                                createNode({
                                    kind: 'metric',
                                    label: metric,
                                    data: { metric },
                                })
                            }
                        >
                            {metric}
                        </button>
                    ))}
                    {experiments.length === 0 && (
                        <p className="text-xs text-slate-500">No metrics available.</p>
                    )}
                </div>
            </details>
        </div>
    );
};
