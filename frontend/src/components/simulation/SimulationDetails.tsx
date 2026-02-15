import React from 'react';
import type { FlowNode } from './types';

type Experiment = {
    id: string;
    name: string;
    status: string;
    primary_metric?: string | null;
    hypothesis?: { alternative_hypothesis?: string | null } | null;
};

type Group = { id: string; name: string };

type Result = {
    variant_a: string;
    variant_b: string;
    effect_size: number;
    p_value: number;
};

type SimulationDetailsProps = {
    experiments: Experiment[];
    userGroups: Group[];
    selectedExperiment: Experiment | null;
    selectedGroups: Group[];
    hypothesisNodes: FlowNode[];
    metricNodes: FlowNode[];
    signalCount: number;
    topResults: Result[];
    selectedNode: FlowNode | null;
    removeNode: (nodeId: string) => void;
};

export const SimulationDetails: React.FC<SimulationDetailsProps> = ({
    experiments,
    userGroups,
    selectedExperiment,
    selectedGroups,
    hypothesisNodes,
    metricNodes,
    signalCount,
    topResults,
    selectedNode,
    removeNode,
}) => {
    return (
        <>
            <div className="h-px w-full bg-slate-300/70"></div>
            <details className="panel" open>
                <summary className="cursor-pointer text-base font-bold text-slate-200">Simulation Details</summary>
                <div className="mt-4 grid grid-cols-1 gap-6 text-[0.85rem] lg:grid-cols-[1.4fr_1fr_1fr]">
                    <div className="card">
                        <h3 className="mb-4">Live Simulation Results</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {[
                                {
                                    label: 'Active Experiments',
                                    value: experiments.filter((exp) => exp.status === 'running').length.toString(),
                                },
                                { label: 'Audience Segments', value: userGroups.length.toString() },
                                { label: 'Signals Processed', value: signalCount.toLocaleString() || '0' },
                            ].map((item) => (
                                <div key={item.label} className="panel">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                                    <p className="mt-3 text-2xl font-semibold text-slate-100">{item.value}</p>
                                </div>
                            ))}
                        </div>
                        <div className="flow-surface mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                                <span>Latest Signals</span>
                                <span className="text-emerald-300">Streaming</span>
                            </div>
                            <div className="mt-4 space-y-3">
                                {topResults.length > 0 ? topResults.map((result) => (
                                    <div key={`${result.variant_a}-${result.variant_b}`} className="flex items-center gap-3 text-sm text-slate-200">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                                        {result.variant_b} vs {result.variant_a}: {(result.effect_size * 100).toFixed(2)}% lift (p={result.p_value.toFixed(4)})
                                    </div>
                                )) : (
                                    <div className="flex items-center gap-3 text-sm text-slate-200">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                                        {selectedExperiment?.status === 'running'
                                            ? 'Streaming analysis in progress.'
                                            : 'Start an experiment to generate live results.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="mb-4">Action Inputs</h3>
                        <div className="space-y-4">
                            <div className="panel">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Experiment</p>
                                <p className="mt-2 text-sm font-semibold text-slate-100">
                                    {selectedExperiment?.name || 'Add an experiment node'}
                                </p>
                            </div>
                            <div className="panel">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Audience</p>
                                <p className="mt-2 text-sm font-semibold text-slate-100">
                                    {selectedGroups[0]?.name || 'Add a user group node'}
                                </p>
                            </div>
                            <div className="panel">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hypothesis</p>
                                <p className="mt-2 text-sm font-semibold text-slate-100">
                                    {hypothesisNodes[0]?.data?.hypothesis || selectedExperiment?.hypothesis?.alternative_hypothesis || 'No hypothesis configured.'}
                                </p>
                            </div>
                            <div className="panel">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Primary Metric</p>
                                <p className="mt-2 text-sm font-semibold text-slate-100">
                                    {metricNodes[0]?.data?.metric || selectedExperiment?.primary_metric || 'Not set'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="mb-4">Component Details</h3>
                        {selectedNode ? (
                            <div className="space-y-4">
                                <div className="panel">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Node</p>
                                    <p className="mt-2 text-sm font-semibold text-slate-100">{selectedNode.label}</p>
                                    <p className="mt-1 text-xs text-slate-500">{selectedNode.kind.replace('-', ' ')}</p>
                                </div>
                                {selectedNode.data?.experimentId && (
                                    <div className="panel">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Experiment</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-100">
                                            {experiments.find((exp) => exp.id === selectedNode.data?.experimentId)?.name}
                                        </p>
                                    </div>
                                )}
                                {selectedNode.data?.groupId && (
                                    <div className="panel">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">User Group</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-100">
                                            {userGroups.find((group) => group.id === selectedNode.data?.groupId)?.name}
                                        </p>
                                    </div>
                                )}
                                {selectedNode.data?.hypothesis && (
                                    <div className="panel">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hypothesis</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-100">{selectedNode.data.hypothesis}</p>
                                    </div>
                                )}
                                {selectedNode.data?.metric && (
                                    <div className="panel">
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Metric</p>
                                        <p className="mt-2 text-sm font-semibold text-slate-100">{selectedNode.data.metric}</p>
                                    </div>
                                )}
                                <button className="btn-danger w-full" onClick={() => removeNode(selectedNode.id)}>
                                    Delete Node
                                </button>
                            </div>
                        ) : (
                            <div className="panel">
                                <p className="text-sm text-slate-400">Select a node on the canvas to view details.</p>
                            </div>
                        )}
                    </div>
                </div>
            </details>
        </>
    );
};
