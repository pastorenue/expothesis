import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventApi, experimentApi, userGroupApi } from '../services/api';
import type { ExperimentAnalysis } from '../types';

const pillClass =
    'rounded-full border border-slate-800/80 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300';

type FlowNode = {
    id: string;
    label: string;
    kind: 'trigger-start' | 'trigger-run' | 'experiment' | 'user-group' | 'hypothesis' | 'metric';
    x: number;
    y: number;
    data?: {
        experimentId?: string;
        groupId?: string;
        hypothesis?: string;
        metric?: string;
    };
};

type FlowEdge = {
    from: string;
    to: string;
};

export const FlowStudio: React.FC = () => {
    const { data: experiments = [] } = useQuery({
        queryKey: ['experiments'],
        queryFn: async () => {
            const response = await experimentApi.list();
            return response.data;
        },
    });

    const { data: userGroups = [] } = useQuery({
        queryKey: ['userGroups'],
        queryFn: async () => {
            const response = await userGroupApi.list();
            return response.data;
        },
    });

    const [isSimulating, setIsSimulating] = React.useState(false);
    const simulationRef = React.useRef<number | null>(null);
    const [nodes, setNodes] = React.useState<FlowNode[]>([]);
    const [edges, setEdges] = React.useState<FlowEdge[]>([]);
    const [pendingFrom, setPendingFrom] = React.useState<string | null>(null);
    const [hoverTarget, setHoverTarget] = React.useState<string | null>(null);
    const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
    const draggingRef = React.useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const canvasRef = React.useRef<HTMLDivElement | null>(null);

    const experimentNode = nodes.find((node) => node.kind === 'experiment' && node.data?.experimentId);
    const groupNode = nodes.find((node) => node.kind === 'user-group' && node.data?.groupId);
    const metricNode = nodes.find((node) => node.kind === 'metric');
    const hypothesisNode = nodes.find((node) => node.kind === 'hypothesis');
    const startNode = nodes.find((node) => node.kind === 'trigger-start');
    const runNode = nodes.find((node) => node.kind === 'trigger-run');

    const selectedExperiment = experiments.find((exp) => exp.id === experimentNode?.data?.experimentId) || null;
    const selectedGroup = userGroups.find((group) => group.id === groupNode?.data?.groupId) || null;

    const { data: analysis } = useQuery({
        queryKey: ['analysis', selectedExperiment?.id],
        queryFn: async () => {
            const response = await experimentApi.getAnalysis(selectedExperiment!.id);
            return response.data as ExperimentAnalysis;
        },
        enabled: !!selectedExperiment && selectedExperiment?.status === 'running',
        refetchInterval: 5000,
    });

    const signalCount = analysis?.sample_sizes?.reduce((sum, item) => sum + item.current_size, 0) ?? 0;
    const topResults = analysis?.results?.slice(0, 3) ?? [];

    React.useEffect(() => {
        return () => {
            if (simulationRef.current) {
                window.clearInterval(simulationRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        const handleMove = (event: MouseEvent) => {
            if (!draggingRef.current || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const grid = 20;
            const nextXRaw = event.clientX - rect.left - draggingRef.current.offsetX;
            const nextYRaw = event.clientY - rect.top - draggingRef.current.offsetY;
            const nextX = Math.round(nextXRaw / grid) * grid;
            const nextY = Math.round(nextYRaw / grid) * grid;

            setNodes((prev) =>
                prev.map((node) =>
                    node.id === draggingRef.current?.id
                        ? { ...node, x: Math.max(20, Math.min(nextX, rect.width - 160)), y: Math.max(20, Math.min(nextY, rect.height - 80)) }
                        : node
                )
            );
        };

        const handleUp = () => {
            draggingRef.current = null;
            if (pendingFrom && hoverTarget) {
                setEdges((prev) => {
                    const exists = prev.some((edge) => edge.from === pendingFrom && edge.to === hoverTarget);
                    return exists ? prev : [...prev, { from: pendingFrom, to: hoverTarget }];
                });
                setPendingFrom(null);
                setHoverTarget(null);
            }
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, []);

    const startDrag = (event: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const node = nodes.find((item) => item.id === nodeId);
        if (!node) return;
        draggingRef.current = {
            id: nodeId,
            offsetX: event.clientX - rect.left - node.x,
            offsetY: event.clientY - rect.top - node.y,
        };
    };

    const handleInputClick = (nodeId: string) => {
        if (!pendingFrom || pendingFrom === nodeId) return;
        setEdges((prev) => {
            const exists = prev.some((edge) => edge.from === pendingFrom && edge.to === nodeId);
            return exists ? prev : [...prev, { from: pendingFrom, to: nodeId }];
        });
        setPendingFrom(null);
    };

    const hasIncoming = (nodeId?: string) => (nodeId ? edges.some((edge) => edge.to === nodeId) : false);
    const hasOutgoing = (nodeId?: string) => (nodeId ? edges.some((edge) => edge.from === nodeId) : false);
    const flowActive = !!runNode && hasIncoming(runNode.id);

    const isFlowReady =
        !!selectedExperiment &&
        !!selectedGroup &&
        !!startNode &&
        !!runNode &&
        hasOutgoing(startNode.id) &&
        hasIncoming(runNode.id) &&
        (metricNode || hypothesisNode);

    const startSimulation = async () => {
        if (!selectedExperiment || !isFlowReady) return;

        if (selectedExperiment.status !== 'running') {
            await experimentApi.start(selectedExperiment.id);
        }

        const groupId = selectedGroup?.id;
        if (!groupId) return;

        if (simulationRef.current) {
            window.clearInterval(simulationRef.current);
        }

        setIsSimulating(true);
        const variants = selectedExperiment.variants.map((variant) => variant.name);
        const metricName = selectedExperiment.primary_metric || 'conversion';

        simulationRef.current = window.setInterval(() => {
            const run = async () => {
                try {
                    const userId = `flow_user_${Math.floor(Math.random() * 999999)}`;
                    const variant = variants[Math.floor(Math.random() * variants.length)];

                    await userGroupApi.assign({
                        user_id: userId,
                        experiment_id: selectedExperiment.id,
                        group_id: groupId!,
                    });

                    const baselineRate = variant.toLowerCase().includes('control') ? 0.1 : 0.12;
                    if (Math.random() < baselineRate) {
                        await eventApi.ingest({
                            experiment_id: selectedExperiment.id,
                            user_id: userId,
                            variant,
                            metric_name: metricName,
                            metric_value: 1.0,
                            attributes: undefined,
                        });
                    }
                } catch (error) {
                    console.error('Flow simulation error', error);
                }
            };
            void run();
        }, 800);
    };

    const stopSimulation = () => {
        if (simulationRef.current) {
            window.clearInterval(simulationRef.current);
        }
        simulationRef.current = null;
        setIsSimulating(false);
    };

    const autoLayout = () => {
        setNodes((prev) =>
            prev.map((node, index) => ({
                ...node,
                x: 40 + (index % 2) * 240,
                y: 60 + Math.floor(index / 2) * 120,
            }))
        );
    };

    const addNode = (node: FlowNode) => {
        setNodes((prev) => [...prev, node]);
    };

    const createNode = (partial: Omit<FlowNode, 'id' | 'x' | 'y'>) => {
        const id = `${partial.kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const x = 40 + (nodes.length % 3) * 220;
        const y = 60 + Math.floor(nodes.length / 3) * 120;
        addNode({ id, x, y, ...partial });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1>Flow Studio</h1>
                    <p className="mt-1 text-slate-400">
                        Orchestrate experiments, audiences, and hypotheses in a connected action canvas.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                        <button className="btn-secondary">Save Draft</button>
                        <button className="btn-primary">Publish Flow</button>
                    </div>
                </div>

            <div className="card relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0,transparent_45%)] opacity-60"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15)_0,transparent_40%)]"></div>
                <div className="relative">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Enable</span>
                            <button className="relative h-7 w-12 rounded-full bg-slate-800/80">
                                <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.7)]"></span>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={pillClass}>Tools</span>
                            <span className={pillClass}>Executions</span>
                        </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_2.8fr]">
                            <div className="space-y-4">
                                <details className="panel" open>
                                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-500">
                                        Triggers
                                    </summary>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                            className="btn-secondary w-full"
                                            onClick={() => createNode({ kind: 'trigger-start', label: 'Start' })}
                                        >
                                            Start
                                        </button>
                                        <button
                                            className="btn-secondary w-full"
                                            onClick={() => createNode({ kind: 'trigger-run', label: 'Run' })}
                                        >
                                            Run
                                        </button>
                                    </div>
                                </details>
                                <details className="panel">
                                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-500">
                                        Experiments
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                        {experiments.length === 0 && (
                                            <p className="text-xs text-slate-500">No experiments available.</p>
                                        )}
                                        {experiments.map((exp) => (
                                            <button
                                                key={exp.id}
                                                className="btn-secondary w-full text-left"
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
                                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-500">
                                        User Groups
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                        {userGroups.length === 0 && (
                                            <p className="text-xs text-slate-500">No user groups available.</p>
                                        )}
                                        {userGroups.map((group) => (
                                            <button
                                                key={group.id}
                                                className="btn-secondary w-full text-left"
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
                                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-500">
                                        Hypothesis
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                        {experiments.map((exp) =>
                                            exp.hypothesis?.alternative_hypothesis ? (
                                                <button
                                                    key={`hyp-${exp.id}`}
                                                    className="btn-secondary w-full text-left"
                                                    onClick={() =>
                                                        createNode({
                                                            kind: 'hypothesis',
                                                            label: `H₁: ${exp.name}`,
                                                            data: { hypothesis: exp.hypothesis!.alternative_hypothesis },
                                                        })
                                                    }
                                                >
                                                    {exp.hypothesis.alternative_hypothesis}
                                                </button>
                                            ) : null
                                        )}
                                        {experiments.every((exp) => !exp.hypothesis) && (
                                            <p className="text-xs text-slate-500">No hypotheses configured.</p>
                                        )}
                                    </div>
                                </details>
                                <details className="panel">
                                    <summary className="cursor-pointer text-xs uppercase tracking-[0.2em] text-slate-500">
                                        Metrics
                                    </summary>
                                    <div className="mt-3 space-y-2">
                                        {[...new Set(experiments.map((exp) => exp.primary_metric).filter(Boolean))].map((metric) => (
                                            <button
                                                key={metric}
                                                className="btn-secondary w-full text-left"
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

                            <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                            <span>Drag nodes. Drag from right handles to connect. Click line to remove.</span>
                            <div className="flex items-center gap-3">
                                <button className="btn-secondary" onClick={autoLayout}>
                                    Auto Layout
                                </button>
                                <span className={isFlowReady ? 'text-emerald-300' : 'text-amber-300'}>
                                    {isFlowReady ? 'Flow Ready' : 'Connect required inputs'}
                                </span>
                            </div>
                        </div>
                        <div
                            ref={canvasRef}
                            onMouseMove={(event) => {
                                if (!canvasRef.current || !pendingFrom) return;
                                const rect = canvasRef.current.getBoundingClientRect();
                                setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
                            }}
                            className="flow-canvas relative mt-4 min-h-[420px] overflow-hidden rounded-2xl border border-slate-800/70 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.5),rgba(2,6,23,0.9))] p-6"
                        >
                            <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px]"></div>

                            <svg className="absolute inset-0 h-full w-full pointer-events-none">
                                <defs>
                                    <marker
                                        id="flow-arrow"
                                        markerWidth="10"
                                        markerHeight="10"
                                        refX="8"
                                        refY="5"
                                        orient="auto"
                                        markerUnits="strokeWidth"
                                    >
                                        <path d="M0 0L10 5L0 10Z" fill="rgba(16,185,129,0.9)" />
                                    </marker>
                                </defs>
                                {edges.map((edge) => {
                                    const fromNode = nodes.find((node) => node.id === edge.from);
                                    const toNode = nodes.find((node) => node.id === edge.to);
                                    if (!fromNode || !toNode) return null;
                                    const startX = fromNode.x + 180;
                                    const startY = fromNode.y + 32;
                                    const endX = toNode.x;
                                    const endY = toNode.y + 32;
                                    return (
                                        <path
                                            key={`${edge.from}-${edge.to}`}
                                            d={`M ${startX} ${startY} C ${startX + 60} ${startY}, ${endX - 60} ${endY}, ${endX} ${endY}`}
                                            stroke="rgba(16,185,129,0.6)"
                                            strokeWidth="2"
                                            fill="none"
                                            markerEnd="url(#flow-arrow)"
                                            className={flowActive ? 'flow-line' : ''}
                                        />
                                    );
                                })}
                                {pendingFrom && cursor ? (
                                    (() => {
                                        const fromNode = nodes.find((node) => node.id === pendingFrom);
                                        if (!fromNode) return null;
                                        const startX = fromNode.x + 180;
                                        const startY = fromNode.y + 32;
                                        return (
                                            <path
                                                d={`M ${startX} ${startY} C ${startX + 60} ${startY}, ${cursor.x - 60} ${cursor.y}, ${cursor.x} ${cursor.y}`}
                                                stroke="rgba(56,189,248,0.6)"
                                                strokeWidth="2"
                                                fill="none"
                                                strokeDasharray="6 6"
                                            />
                                        );
                                    })()
                                ) : null}
                            </svg>
                            <svg className="absolute inset-0 h-full w-full">
                                {edges.map((edge) => {
                                    const fromNode = nodes.find((node) => node.id === edge.from);
                                    const toNode = nodes.find((node) => node.id === edge.to);
                                    if (!fromNode || !toNode) return null;
                                    const startX = fromNode.x + 180;
                                    const startY = fromNode.y + 32;
                                    const endX = toNode.x;
                                    const endY = toNode.y + 32;
                                    return (
                                        <path
                                            key={`hit-${edge.from}-${edge.to}`}
                                            d={`M ${startX} ${startY} C ${startX + 60} ${startY}, ${endX - 60} ${endY}, ${endX} ${endY}`}
                                            stroke="transparent"
                                            strokeWidth="12"
                                            fill="none"
                                            className="cursor-pointer"
                                            onClick={() => {
                                                setEdges((prev) => prev.filter((item) => !(item.from === edge.from && item.to === edge.to)));
                                            }}
                                        />
                                    );
                                })}
                            </svg>

                            {nodes.map((node) => {
                                const incoming = hasIncoming(node.id);
                                const outgoing = hasOutgoing(node.id);
                                const canOutput = node.kind !== 'trigger-run';
                                const canInput = node.kind !== 'trigger-start';
                                return (
                                <div
                                    key={node.id}
                                    className="flow-node absolute w-44 cursor-grab select-none rounded-2xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-200 shadow-[0_20px_30px_-25px_rgba(15,23,42,0.9)]"
                                    style={{ left: node.x, top: node.y }}
                                    onMouseDown={(event) => startDrag(event, node.id)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span>{node.label}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                                        <span>{node.kind.replace('-', ' ')}</span>
                                        <span>{pendingFrom === node.id ? 'link' : ''}</span>
                                    </div>
                                    {canOutput && (
                                        <button
                                            className="absolute -right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-400/40 bg-slate-950 text-emerald-200"
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                setPendingFrom(node.id);
                                                setCursor({ x: node.x + 180, y: node.y + 32 });
                                            }}
                                            aria-label="Start connection"
                                        >
                                            {outgoing ? '●' : '→'}
                                        </button>
                                    )}
                                    {canInput && (
                                        <button
                                            className="absolute -left-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950 text-cyan-200"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleInputClick(node.id);
                                            }}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onMouseEnter={() => setHoverTarget(node.id)}
                                            onMouseLeave={() => setHoverTarget(null)}
                                            aria-label="Complete connection"
                                        >
                                            {incoming ? '●' : '+'}
                                        </button>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
                <div className="card">
                    <h3 className="mb-4">Live Flow Results</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {[
                            { label: 'Active Experiments', value: experiments.filter((exp) => exp.status === 'running').length.toString() },
                            { label: 'Audience Segments', value: userGroups.length.toString() },
                            { label: 'Signals Processed', value: signalCount.toLocaleString() || '0' },
                        ].map((item) => (
                            <div key={item.label} className="panel">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                                <p className="mt-3 text-2xl font-semibold text-slate-100">{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
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
                                {selectedGroup?.name || 'Add a user group node'}
                            </p>
                        </div>
                        <div className="panel">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Hypothesis</p>
                            <p className="mt-2 text-sm font-semibold text-slate-100">
                                {hypothesisNode?.data?.hypothesis || selectedExperiment?.hypothesis?.alternative_hypothesis || 'No hypothesis configured.'}
                            </p>
                        </div>
                        <div className="panel">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Primary Metric</p>
                            <p className="mt-2 text-sm font-semibold text-slate-100">
                                {metricNode?.data?.metric || selectedExperiment?.primary_metric || 'Not set'}
                            </p>
                        </div>
                        <button
                            className="btn-primary w-full"
                            onClick={isSimulating ? stopSimulation : startSimulation}
                            disabled={!selectedExperiment || !isFlowReady}
                        >
                            {isSimulating ? 'Stop Simulation' : 'Run Simulation'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
