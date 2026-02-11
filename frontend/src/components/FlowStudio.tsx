import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventApi, experimentApi, userGroupApi } from '../services/api';
import type { ExperimentAnalysis } from '../types';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
} from 'recharts';

const pillClass =
    'rounded-full border border-slate-800/80 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300';

const nodeColorByKind: Record<FlowNode['kind'], { border: string; badge: string }> = {
    'trigger-start': { border: 'border-cyan-400/70', badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50' },
    'trigger-run': { border: 'border-emerald-400/70', badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50' },
    experiment: { border: 'border-indigo-400/70', badge: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/50' },
    'user-group': { border: 'border-amber-400/70', badge: 'bg-amber-500/20 text-amber-200 border-amber-400/50' },
    hypothesis: { border: 'border-fuchsia-400/70', badge: 'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/50' },
    metric: { border: 'border-sky-400/70', badge: 'bg-sky-500/20 text-sky-200 border-sky-400/50' },
};

const nodeBadgeClass = (kind: FlowNode['kind']) =>
    `inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.18em] ${nodeColorByKind[kind].badge}`;

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

const NODE_WIDTH = 176;
const NODE_HEIGHT = 72;
const HANDLE_CENTER_OFFSET = 10;

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
    const [isPaused, setIsPaused] = React.useState(false);
    const simulationRef = React.useRef<number | null>(null);
    const [simulationSeries, setSimulationSeries] = React.useState<
        { time: string; ts: number; [key: string]: string | number }[]
    >([]);
    const eventCounter = React.useRef<Record<string, number>>({});
    const variantCounter = React.useRef<Record<string, number>>({});
    const groupVariantCounter = React.useRef<Record<string, number>>({});
    const groupRateRef = React.useRef<Record<string, number>>({});
    const currentExperimentIdRef = React.useRef<string | null>(null);
    const groupIdsRef = React.useRef<string[]>([]);
    const simulationKeyRef = React.useRef<string | null>(null);
    const [nodes, setNodes] = React.useState<FlowNode[]>([]);
    const [edges, setEdges] = React.useState<FlowEdge[]>([]);
    const [pendingFrom, setPendingFrom] = React.useState<string | null>(null);
    const [hoverTarget, setHoverTarget] = React.useState<string | null>(null);
    const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
    const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
    const [errorTooltip, setErrorTooltip] = React.useState<{ x: number; y: number; message: string } | null>(null);
    const draggingRef = React.useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
    const panningRef = React.useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
    const reconnectRef = React.useRef<FlowEdge | null>(null);
    const canvasRef = React.useRef<HTMLDivElement | null>(null);
    const [zoom, setZoom] = React.useState(1);
    const zoomRef = React.useRef(1);
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const panRef = React.useRef(pan);
    const [rangeStart, setRangeStart] = React.useState('');
    const [rangeEnd, setRangeEnd] = React.useState('');
    const [pickerOpen, setPickerOpen] = React.useState<'start' | 'end' | null>(null);
    const [pickerMonth, setPickerMonth] = React.useState(() => new Date());
    const [pickerPos, setPickerPos] = React.useState<{ top: number; left: number } | null>(null);
    const [importText, setImportText] = React.useState('');
    const [importError, setImportError] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const pickerRef = React.useRef<HTMLDivElement | null>(null);
    const startRef = React.useRef<HTMLButtonElement | null>(null);
    const endRef = React.useRef<HTMLButtonElement | null>(null);

    const experimentNode = nodes.find((node) => node.kind === 'experiment' && node.data?.experimentId);
    const metricNodes = nodes.filter((node) => node.kind === 'metric');
    const groupNodes = nodes.filter((node) => node.kind === 'user-group' && node.data?.groupId);
    const hypothesisNodes = nodes.filter((node) => node.kind === 'hypothesis');
    const startNode = nodes.find((node) => node.kind === 'trigger-start');
    const runNode = nodes.find((node) => node.kind === 'trigger-run');

    const selectedExperiment = experiments.find((exp) => exp.id === experimentNode?.data?.experimentId) || null;
    const selectedGroupIds = nodes
        .filter((node) => node.kind === 'user-group' && node.data?.groupId)
        .map((node) => node.data!.groupId!) as string[];
    const selectedGroups = userGroups.filter((group) => selectedGroupIds.includes(group.id));

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
    const formatDateTime = (date: Date) => {
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const parseDateTime = (value: string) => {
        if (!value) return null;
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return null;
        return parsed;
    };

const [pickerValue, setPickerValue] = React.useState<Date>(() => new Date());
    const applyPickerValue = React.useCallback(
        (next: Date, target: 'start' | 'end' | null = pickerOpen) => {
            if (!target) return;
            const formatted = formatDateTime(next);
            if (target === 'start') {
                setRangeStart(formatted);
            } else {
                setRangeEnd(formatted);
            }
        },
        [formatDateTime, pickerOpen]
    );

    React.useEffect(() => {
        if (!pickerOpen) return;
        const currentValue = pickerOpen === 'start' ? rangeStart : rangeEnd;
        const parsed = parseDateTime(currentValue);
        const next = parsed || new Date();
        setPickerValue(next);
        setPickerMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    }, [pickerOpen, rangeStart, rangeEnd]);

    React.useEffect(() => {
        if (!pickerOpen) return;
        const handleClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (pickerRef.current?.contains(target)) return;
            if (startRef.current?.contains(target)) return;
            if (endRef.current?.contains(target)) return;
            setPickerOpen(null);
        };
        window.addEventListener('mousedown', handleClick);
        return () => window.removeEventListener('mousedown', handleClick);
    }, [pickerOpen]);
    const getGroupVariantKey = (groupId: string, variant: string) => `${groupId}::${variant}`;

    const filteredSeries = React.useMemo(() => {
        if (!rangeStart && !rangeEnd) return simulationSeries;
        const startMs = rangeStart ? new Date(rangeStart).getTime() : null;
        const endMs = rangeEnd ? new Date(rangeEnd).getTime() : null;
        return simulationSeries.filter((point) => {
            if (startMs !== null && point.ts < startMs) return false;
            if (endMs !== null && point.ts > endMs) return false;
            return true;
        });
    }, [simulationSeries, rangeStart, rangeEnd]);


    const renderCalendar = () => {
        const year = pickerMonth.getFullYear();
        const month = pickerMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const startWeekday = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: Array<{ day: number; current: boolean }> = [];
        for (let i = 0; i < startWeekday; i += 1) {
            days.push({ day: 0, current: false });
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            days.push({ day, current: true });
        }
        const activeDay = pickerValue.getDate();
        const activeMonth = pickerValue.getMonth();
        const activeYear = pickerValue.getFullYear();
        return (
            <div className="grid grid-cols-7 gap-1 text-xs text-slate-300">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
                    <div key={label} className="text-center text-[0.55rem] uppercase tracking-[0.2em] text-slate-500">
                        {label}
                    </div>
                ))}
                {days.map((item, idx) => {
                    if (!item.current) {
                        return <div key={`empty-${idx}`} className="h-7"></div>;
                    }
                    const isActive =
                        item.day === activeDay && month === activeMonth && year === activeYear;
                    return (
                        <button
                            key={`day-${item.day}`}
                            className={`h-7 rounded-md text-xs font-semibold ${
                                isActive ? 'bg-emerald-500/30 text-emerald-100' : 'hover:bg-slate-800/80'
                            }`}
                            onClick={() => {
                                const next = new Date(pickerValue);
                                next.setFullYear(year, month, item.day);
                                setPickerValue(next);
                                applyPickerValue(next);
                            }}
                        >
                            {item.day}
                        </button>
                    );
                })}
            </div>
        );
    };

    const hours = Array.from({ length: 24 }, (_, i) => i);
    const minutes = Array.from({ length: 20 }, (_, i) => i * 3);

    React.useEffect(() => {
        return () => {
            if (simulationRef.current) {
                window.clearInterval(simulationRef.current);
            }
        };
    }, []);

    React.useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    React.useEffect(() => {
        panRef.current = pan;
    }, [pan]);

    React.useEffect(() => {
        const handleMove = (event: MouseEvent) => {
            if (!draggingRef.current || !canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            const grid = 20;
            const nextXRaw =
                (event.clientX - rect.left - panRef.current.x) / zoomRef.current - draggingRef.current.offsetX;
            const nextYRaw =
                (event.clientY - rect.top - panRef.current.y) / zoomRef.current - draggingRef.current.offsetY;
            const nextX = Math.round(nextXRaw / grid) * grid;
            const nextY = Math.round(nextYRaw / grid) * grid;
            const panOffsetX = panRef.current.x / zoomRef.current;
            const panOffsetY = panRef.current.y / zoomRef.current;
            const maxX = Math.max(20, rect.width / zoomRef.current - NODE_WIDTH - panOffsetX);
            const maxY = Math.max(20, rect.height / zoomRef.current - NODE_HEIGHT - panOffsetY);
            const minX = Math.min(20, 20 - panOffsetX);
            const minY = Math.min(20, 20 - panOffsetY);

            setNodes((prev) =>
                prev.map((node) =>
                    node.id === draggingRef.current?.id
                        ? {
                              ...node,
                              x: Math.max(minX, Math.min(nextX, maxX)),
                              y: Math.max(minY, Math.min(nextY, maxY)),
                          }
                        : node
                )
            );
        };

        const handleUp = () => {
            draggingRef.current = null;
            panningRef.current = null;
            if (pendingFrom && hoverTarget) {
                setEdges((prev) => {
                    const exists = prev.some((edge) => edge.from === pendingFrom && edge.to === hoverTarget);
                    return exists ? prev : [...prev, { from: pendingFrom, to: hoverTarget }];
                });
                reconnectRef.current = null;
                setPendingFrom(null);
                setHoverTarget(null);
            }
        };

        const handlePanMove = (event: MouseEvent) => {
            if (!panningRef.current) return;
            const dx = event.clientX - panningRef.current.startX;
            const dy = event.clientY - panningRef.current.startY;
            setPan({ x: panningRef.current.panX + dx, y: panningRef.current.panY + dy });
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mousemove', handlePanMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mousemove', handlePanMove);
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
            offsetX: (event.clientX - rect.left - panRef.current.x) / zoomRef.current - node.x,
            offsetY: (event.clientY - rect.top - panRef.current.y) / zoomRef.current - node.y,
        };
    };

    const getNodeById = (nodeId?: string) => nodes.find((node) => node.id === nodeId);
    const hasIncoming = (nodeId?: string) => (nodeId ? edges.some((edge) => edge.to === nodeId) : false);
    const hasOutgoing = (nodeId?: string) => (nodeId ? edges.some((edge) => edge.from === nodeId) : false);
    const flowConnected = nodes.some((node) => node.kind === 'trigger-run' && hasIncoming(node.id));
    const runIds = nodes.filter((node) => node.kind === 'trigger-run').map((node) => node.id);

    const hasPath = React.useCallback(
        (fromId: string, toId: string) => {
            const visited = new Set<string>();
            const stack = [fromId];
            while (stack.length > 0) {
                const current = stack.pop()!;
                if (current === toId) return true;
                if (visited.has(current)) continue;
                visited.add(current);
                edges
                    .filter((edge) => edge.from === current)
                    .forEach((edge) => {
                        if (!visited.has(edge.to)) stack.push(edge.to);
                    });
            }
            return false;
        },
        [edges]
    );

    const isValidConnection = (fromId: string, toId: string) => {
        const fromNode = getNodeById(fromId);
        const toNode = getNodeById(toId);
        if (!fromNode || !toNode) return false;
        if (fromNode.kind === 'trigger-start' && toNode.kind === 'experiment') return true;
        if (fromNode.kind === 'experiment' && toNode.kind === 'user-group') return true;
        if (fromNode.kind === 'user-group' && (toNode.kind === 'metric' || toNode.kind === 'hypothesis')) return true;
        if (fromNode.kind === 'hypothesis' && toNode.kind === 'metric') return true;
        if (fromNode.kind === 'metric' && toNode.kind === 'trigger-run') return true;
        return false;
    };

    const reachableToRun = React.useMemo(() => {
        const runIds = nodes.filter((node) => node.kind === 'trigger-run').map((node) => node.id);
        if (runIds.length === 0) return new Set<string>();
        const reverse: Record<string, string[]> = {};
        edges.forEach((edge) => {
            if (!reverse[edge.to]) reverse[edge.to] = [];
            reverse[edge.to].push(edge.from);
        });
        const visited = new Set<string>();
        const stack = [...runIds];
        while (stack.length > 0) {
            const current = stack.pop()!;
            if (visited.has(current)) continue;
            visited.add(current);
            const parents = reverse[current] || [];
            parents.forEach((parent) => {
                if (!visited.has(parent)) stack.push(parent);
            });
        }
        return visited;
    }, [nodes, edges]);

    const reachableFromStart = React.useMemo(() => {
        if (!startNode) return new Set<string>();
        const forward: Record<string, string[]> = {};
        edges.forEach((edge) => {
            if (!forward[edge.from]) forward[edge.from] = [];
            forward[edge.from].push(edge.to);
        });
        const visited = new Set<string>();
        const stack = [startNode.id];
        while (stack.length > 0) {
            const current = stack.pop()!;
            if (visited.has(current)) continue;
            visited.add(current);
            const children = forward[current] || [];
            children.forEach((child) => {
                if (!visited.has(child)) stack.push(child);
            });
        }
        return visited;
    }, [edges, startNode?.id]);

    const showError = (x: number, y: number, message: string) => {
        setErrorTooltip({ x, y, message });
        window.setTimeout(() => setErrorTooltip(null), 1600);
    };

    const isDuplicateNode = (node: Omit<FlowNode, 'id' | 'x' | 'y'>) => {
        if (node.kind === 'trigger-start' || node.kind === 'trigger-run') {
            return nodes.some((existing) => existing.kind === node.kind);
        }
        if (node.kind === 'experiment') {
            return nodes.some(
                (existing) => existing.kind === node.kind && existing.data?.experimentId === node.data?.experimentId
            );
        }
        if (node.kind === 'user-group') {
            return nodes.some(
                (existing) => existing.kind === node.kind && existing.data?.groupId === node.data?.groupId
            );
        }
        if (node.kind === 'metric') {
            return nodes.some(
                (existing) => existing.kind === node.kind && existing.data?.metric === node.data?.metric
            );
        }
        if (node.kind === 'hypothesis') {
            return nodes.some(
                (existing) => existing.kind === node.kind && existing.data?.hypothesis === node.data?.hypothesis
            );
        }
        return false;
    };

    const adjustZoom = (next: number) => {
        setZoom(Math.max(0.6, Math.min(1.6, Number(next.toFixed(2)))));
    };

    const toYaml = (flow: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
        const indent = (level: number) => '  '.repeat(level);
        const lines: string[] = [];
        const writeObj = (obj: Record<string, any>, level: number) => {
            Object.entries(obj).forEach(([key, value]) => {
                if (value === undefined || value === null) return;
                if (typeof value === 'object' && !Array.isArray(value)) {
                    lines.push(`${indent(level)}${key}:`);
                    writeObj(value, level + 1);
                } else {
                    lines.push(`${indent(level)}${key}: ${String(value)}`);
                }
            });
        };
        lines.push('nodes:');
        flow.nodes.forEach((node) => {
            lines.push(`${indent(1)}-`);
            writeObj(
                {
                    id: node.id,
                    label: node.label,
                    kind: node.kind,
                    x: node.x,
                    y: node.y,
                    data: node.data,
                },
                2
            );
        });
        lines.push('edges:');
        flow.edges.forEach((edge) => {
            lines.push(`${indent(1)}- from: ${edge.from}`);
            lines.push(`${indent(2)}to: ${edge.to}`);
        });
        return lines.join('\n');
    };

    const parseYaml = (input: string) => {
        const lines = input.split('\n');
        const result: { nodes: FlowNode[]; edges: FlowEdge[] } = { nodes: [], edges: [] };
        let section: 'nodes' | 'edges' | null = null;
        let current: any = null;
        let inData = false;

        const pushCurrent = () => {
            if (!current) return;
            if (section === 'nodes') result.nodes.push(current as FlowNode);
            if (section === 'edges') result.edges.push(current as FlowEdge);
            current = null;
        };

        const parseValue = (value: string) => {
            const trimmed = value.replace(/^['"]|['"]$/g, '');
            const num = Number(trimmed);
            return Number.isNaN(num) || trimmed === '' ? trimmed : num;
        };

        lines.forEach((raw) => {
            const line = raw.trim();
            if (!line) return;
            const leading = raw.length - raw.trimStart().length;
            if (line.startsWith('nodes:')) {
                pushCurrent();
                section = 'nodes';
                return;
            }
            if (line.startsWith('edges:')) {
                pushCurrent();
                section = 'edges';
                return;
            }
            if (line.startsWith('-')) {
                pushCurrent();
                current = {};
                inData = false;
                const rest = line.replace(/^-+\s*/, '');
                if (rest.includes(':')) {
                    const [key, ...valueParts] = rest.split(':');
                    current[key.trim()] = parseValue(valueParts.join(':').trim());
                }
                return;
            }
            if (!current || !section) return;
            if (inData && leading < 4) {
                inData = false;
            }
            const dataMatch = line.match(/^data:\s*$/);
            if (dataMatch) {
                current.data = current.data ?? {};
                inData = true;
                return;
            }
            const [key, ...valueParts] = line.split(':');
            const value = parseValue(valueParts.join(':').trim());
            if (inData) {
                current.data = current.data ?? {};
                current.data[key.trim()] = value;
            } else {
                current[key.trim()] = value;
            }
        });
        pushCurrent();
        return result;
    };

    const normalizeFlow = (flow: any) => {
        if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
            throw new Error('Invalid flow format. Expected nodes and edges arrays.');
        }
        const nodes = flow.nodes.map((node: FlowNode, index: number) => {
            const id = node.id ? String(node.id) : `imported-${node.kind}-${Date.now()}-${index}`;
            const x = Number.isFinite(Number(node.x)) ? Number(node.x) : 40 + (index % 3) * 220;
            const y = Number.isFinite(Number(node.y)) ? Number(node.y) : 60 + Math.floor(index / 3) * 120;
            return {
                id,
                label: String(node.label ?? node.kind ?? 'Node'),
                kind: node.kind,
                x,
                y,
                data: node.data ?? {},
            } as FlowNode;
        });
        const edges = flow.edges.map((edge: FlowEdge) => ({
            from: String(edge.from),
            to: String(edge.to),
        }));
        return { nodes, edges };
    };

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleInputClick = (nodeId: string) => {
        if (!pendingFrom || pendingFrom === nodeId) return;
        if (!isValidConnection(pendingFrom, nodeId)) {
            if (!reconnectRef.current) {
                showError(cursor?.x ?? 0, cursor?.y ?? 0, 'Invalid connection for this flow.');
            }
            reconnectRef.current = null;
            setPendingFrom(null);
            setHoverTarget(null);
            return;
        }
        setEdges((prev) => {
            const exists = prev.some((edge) => edge.from === pendingFrom && edge.to === nodeId);
            return exists ? prev : [...prev, { from: pendingFrom, to: nodeId }];
        });
        reconnectRef.current = null;
        setPendingFrom(null);
    };

    const connectedGroupIds = edges
        .filter((edge) => {
            const from = getNodeById(edge.from);
            const to = getNodeById(edge.to);
            if (!from || !to || from.kind !== 'experiment' || to.kind !== 'user-group') return false;
            if (experimentNode && from.id !== experimentNode.id) return false;
            return true;
        })
        .map((edge) => getNodeById(edge.to)?.data?.groupId)
        .filter(Boolean) as string[];

    const connectedMetricIds = edges
        .filter((edge) => {
            const from = getNodeById(edge.from);
            const to = getNodeById(edge.to);
            return from?.kind === 'metric' && to?.kind === 'trigger-run';
        })
        .map((edge) => edge.from);

    const connectedGroupNodeIds = groupNodes
        .filter((node) => connectedGroupIds.includes(node.data!.groupId!))
        .map((node) => node.id);
    const fullyConnectedGroupIds = connectedGroupNodeIds
        .filter((nodeId) => reachableToRun.has(nodeId))
        .map((nodeId) => getNodeById(nodeId)?.data?.groupId)
        .filter(Boolean) as string[];
    const connectedGroups = userGroups.filter((group) => fullyConnectedGroupIds.includes(group.id));

    const aggregatedSeries = React.useMemo(() => {
        if (!selectedExperiment) return [];
        const variants = selectedExperiment.variants.map((variant) => variant.name);
        return filteredSeries.map((point) => {
            const next: { time: string; ts: number; [key: string]: string | number } = {
                time: String(point.time ?? ''),
                ts: Number(point.ts ?? 0),
            };
            variants.forEach((variant) => {
                let sum = 0;
                fullyConnectedGroupIds.forEach((groupId) => {
                    const key = getGroupVariantKey(groupId, variant);
                    const value = point[key];
                    if (typeof value === 'number') sum += value;
                });
                next[variant] = sum;
            });
            return next;
        });
    }, [filteredSeries, fullyConnectedGroupIds.join(','), selectedExperiment?.id]);

    const metricNodesForCharts = metricNodes.filter((node) => {
        const incoming = edges.some((edge) => {
            if (edge.to !== node.id) return false;
            const from = getNodeById(edge.from);
            return from?.kind === 'user-group' || from?.kind === 'hypothesis';
        });
        return incoming && reachableFromStart.has(node.id) && reachableToRun.has(node.id);
    });

    const startSatisfied = !startNode || hasOutgoing(startNode.id);
    const canAutoStart =
        selectedExperiment?.status === 'draft' || selectedExperiment?.status === 'paused';
    const canSimulate =
        !!selectedExperiment && (selectedExperiment.status === 'running' || canAutoStart);
    const startToRunConnected =
        !!startNode && runIds.length > 0 && runIds.some((runId) => hasPath(startNode.id, runId));
    const isFlowReady =
        !!selectedExperiment &&
        canSimulate &&
        fullyConnectedGroupIds.length > 0 &&
        connectedMetricIds.length > 0 &&
        !!runNode &&
        startSatisfied &&
        flowConnected &&
        startToRunConnected;

    const startSimulation = async (reset = true) => {
        if (!selectedExperiment || !isFlowReady) return;

        if (selectedExperiment.status === 'stopped') {
            showError(24, 24, 'Cannot start a stopped experiment. Duplicate or create a new one.');
            return;
        }

        if (canAutoStart) {
            await experimentApi.start(selectedExperiment.id);
        }

        const groupIds = groupIdsRef.current;
        if (groupIds.length === 0) return;

        if (simulationRef.current && reset) {
            window.clearInterval(simulationRef.current);
            simulationRef.current = null;
        }

        if (reset) {
            setIsSimulating(true);
            setIsPaused(false);
            eventCounter.current = {};
            variantCounter.current = {};
            groupVariantCounter.current = {};
            groupRateRef.current = {};
            setSimulationSeries([]);
        } else {
            setIsSimulating(true);
            setIsPaused(false);
        }
        currentExperimentIdRef.current = selectedExperiment.id;
        const variants = selectedExperiment.variants.map((variant) => variant.name);
        const metricName = selectedExperiment.primary_metric || 'conversion';

        simulationRef.current = window.setInterval(() => {
            const run = async () => {
                try {
                    const now = new Date();
                    const timeLabel = now.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
                    const updates: Record<string, number> = {};
                    const activeGroupIds = groupIdsRef.current;
                    for (const groupId of activeGroupIds) {
                        if (!groupRateRef.current[groupId]) {
                            groupRateRef.current[groupId] = 0.6 + Math.random() * 1.4;
                        }
                        const rate = groupRateRef.current[groupId];
                        const batchSize = Math.max(1, Math.round(rate * (0.7 + Math.random() * 0.8)));
                        for (let i = 0; i < batchSize; i += 1) {
                            const userId = `flow_user_${Math.floor(Math.random() * 999999)}`;
                            const variant = variants[Math.floor(Math.random() * variants.length)];
                            try {
                                await userGroupApi.assign({
                                    user_id: userId,
                                    experiment_id: selectedExperiment.id,
                                    group_id: groupId,
                                });
                            } catch (error) {
                                console.warn('Flow simulation assign failed', error);
                            }
                            eventCounter.current[groupId] = (eventCounter.current[groupId] || 0) + 1;
                            const gvKey = getGroupVariantKey(groupId, variant);
                            groupVariantCounter.current[gvKey] = (groupVariantCounter.current[gvKey] || 0) + 1;
                            const baselineRate = variant.toLowerCase().includes('control') ? 0.1 : 0.12;
                            if (Math.random() < baselineRate) {
                                try {
                                    await eventApi.ingest({
                                        experiment_id: selectedExperiment.id,
                                        user_id: userId,
                                        variant,
                                        metric_name: metricName,
                                        metric_value: 1.0,
                                        attributes: undefined,
                                    });
                                } catch (error) {
                                    console.warn('Flow simulation ingest failed', error);
                                }
                            }
                        }
                        updates[groupId] = eventCounter.current[groupId] || 0;
                    }
                    setSimulationSeries((prev) => {
                        const last = prev[prev.length - 1] || {};
                        const nextPoint: { time: string; ts: number; [key: string]: string | number } = {
                            time: timeLabel,
                            ts: now.getTime(),
                        };
                    for (const groupId of activeGroupIds) {
                        for (const variant of variants) {
                            const key = getGroupVariantKey(groupId, variant);
                            const lastValue = typeof last[key] === 'number' ? (last[key] as number) : 0;
                            nextPoint[key] = groupVariantCounter.current[key] ?? lastValue;
                        }
                    }
                    return [...prev, nextPoint];
                });
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
        setIsPaused(false);
        currentExperimentIdRef.current = null;
    };

    const pauseSimulation = () => {
        if (simulationRef.current) {
            window.clearInterval(simulationRef.current);
        }
        simulationRef.current = null;
        setIsSimulating(false);
        setIsPaused(true);
    };

    React.useEffect(() => {
        groupIdsRef.current = fullyConnectedGroupIds;
        if (flowConnected && isFlowReady && selectedExperiment) {
            if (isPaused) return;
            if (!simulationRef.current) {
                simulationKeyRef.current = selectedExperiment.id;
                void startSimulation(true);
                return;
            }
            if (currentExperimentIdRef.current && currentExperimentIdRef.current !== selectedExperiment.id) {
                stopSimulation();
                simulationKeyRef.current = selectedExperiment.id;
                void startSimulation(true);
                return;
            }
            return;
        }
        if ((!flowConnected || !isFlowReady) && (isSimulating || isPaused)) {
            simulationKeyRef.current = null;
            stopSimulation();
        }
    }, [
        flowConnected,
        isFlowReady,
        isPaused,
        selectedExperiment?.id,
        fullyConnectedGroupIds.join(','),
        connectedMetricIds.join(','),
    ]);

    React.useEffect(() => {
        if (!isSimulating || !selectedExperiment) return;
        const variants = selectedExperiment.variants.map((variant) => variant.name);
        const last = simulationSeries[simulationSeries.length - 1] || {};
        fullyConnectedGroupIds.forEach((groupId) => {
            if (!groupRateRef.current[groupId]) {
                groupRateRef.current[groupId] = 0.6 + Math.random() * 1.4;
            }
            if (!eventCounter.current[groupId]) {
                eventCounter.current[groupId] = 0;
            }
            variants.forEach((variant) => {
                const key = getGroupVariantKey(groupId, variant);
                if (groupVariantCounter.current[key] == null) {
                    groupVariantCounter.current[key] =
                        typeof last[key] === 'number' ? (last[key] as number) : 0;
                }
            });
        });
    }, [isSimulating, selectedExperiment?.id, fullyConnectedGroupIds.join(','), simulationSeries.length]);

    const autoLayout = () => {
        setNodes((prev) =>
            prev.map((node, index) => ({
                ...node,
                x: 40 + (index % 2) * 240,
                y: 60 + Math.floor(index / 2) * 120,
            }))
        );
    };

    const clearCanvas = () => {
        setNodes([]);
        setEdges([]);
        setPendingFrom(null);
        setHoverTarget(null);
        setCursor(null);
        setSelectedNodeId(null);
        reconnectRef.current = null;
    };

    const addNode = (node: FlowNode) => {
        setNodes((prev) => [...prev, node]);
    };

    const createNode = (partial: Omit<FlowNode, 'id' | 'x' | 'y'>) => {
        if (isDuplicateNode(partial)) {
            showError(24, 24, `Only one "${partial.label}" node can be added.`);
            return;
        }
        const id = `${partial.kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const x = 40 + (nodes.length % 3) * 220;
        const y = 60 + Math.floor(nodes.length / 3) * 120;
        addNode({ id, x, y, ...partial });
    };

    const removeNode = (nodeId: string) => {
        setNodes((prev) => prev.filter((node) => node.id !== nodeId));
        setEdges((prev) => prev.filter((edge) => edge.from !== nodeId && edge.to !== nodeId));
        if (pendingFrom === nodeId) {
            setPendingFrom(null);
            setHoverTarget(null);
            setCursor(null);
        }
        if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
        }
    };

    const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;

    return (
        <div className="flow-studio space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1>Flow Studio</h1>
                    <p className="mt-1 text-slate-400">
                        Orchestrate experiments, audiences, and hypotheses in a connected action canvas.
                    </p>
                </div>
            </div>

            <div className="card relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15)_0,transparent_45%)] opacity-60"></div>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(16,185,129,0.15)_0,transparent_40%)]"></div>
                <div className="relative">
                    <div className="flow-surface mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
                        <div className="flex items-center gap-3">
                            <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-500">Flow Config</span>
                            <button
                                className="btn-secondary"
                                onClick={() =>
                                    downloadFile(
                                        JSON.stringify({ nodes, edges }, null, 2),
                                        'flowstudio.json',
                                        'application/json'
                                    )
                                }
                            >
                                Export JSON
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() =>
                                    downloadFile(
                                        toYaml({ nodes, edges }),
                                        'flowstudio.yaml',
                                        'text/yaml'
                                    )
                                }
                            >
                                Export YAML
                            </button>
                            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                Import File
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,.yaml,.yml"
                                className="hidden"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                        const content = String(reader.result || '');
                                        setImportText(content);
                                        try {
                                            const parsed = content.trim().startsWith('{')
                                                ? JSON.parse(content)
                                                : parseYaml(content);
                                            const normalized = normalizeFlow(parsed);
                                            setNodes(normalized.nodes);
                                            setEdges(normalized.edges);
                                            setImportError(null);
                                        } catch (error: any) {
                                            setImportError(error?.message || 'Failed to load flow configuration.');
                                        }
                                    };
                                    reader.readAsText(file);
                                    event.target.value = '';
                                }}
                            />
                        </div>
                        <div className="flex flex-1 items-center gap-3">
                            <textarea
                                value={importText}
                                onChange={(event) => setImportText(event.target.value)}
                                placeholder="Paste JSON or YAML flow here..."
                                className="min-h-[56px] flex-1 rounded-xl border border-slate-800/80 bg-slate-950/80 p-2 text-xs text-slate-200"
                            />
                            <button
                                className="btn-primary"
                                onClick={() => {
                                    try {
                                        const parsed = importText.trim().startsWith('{')
                                            ? JSON.parse(importText)
                                            : parseYaml(importText);
                                        const normalized = normalizeFlow(parsed);
                                        setNodes(normalized.nodes);
                                        setEdges(normalized.edges);
                                        setImportError(null);
                                    } catch (error: any) {
                                        setImportError(error?.message || 'Failed to load flow configuration.');
                                    }
                                }}
                            >
                                Load
                            </button>
                        </div>
                        {importError && <div className="text-xs text-rose-300">{importError}</div>}
                    </div>

                    <div className="flow-surface mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.2fr_1.2fr_1.2fr_1.2fr]">
                                <details className="panel" open>
                                    <summary className="cursor-pointer text-[0.75rem] font-bold text-slate-400">
                                        Triggers
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
                                    <summary className="cursor-pointer text-[0.75rem] font-bold text-slate-400">
                                        Experiments
                                    </summary>
                                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                                        {experiments.length === 0 && (
                                            <p className="text-xs text-slate-500">No experiments available.</p>
                                        )}
                                        {experiments.map((exp) => (
                                            <button
                                                key={exp.id}
                                                className={`${nodeBadgeClass('experiment')} w-full text-left`}
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
                                    <summary className="cursor-pointer text-[0.75rem] font-bold text-slate-400">
                                        User Groups
                                    </summary>
                                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                                        {userGroups.length === 0 && (
                                            <p className="text-xs text-slate-500">No user groups available.</p>
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
                                    <summary className="cursor-pointer text-[0.75rem] font-bold text-slate-400">
                                        Hypothesis
                                    </summary>
                                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                                        {experiments.map((exp) =>
                                            exp.hypothesis?.alternative_hypothesis ? (
                                                <button
                                                    key={`hyp-${exp.id}`}
                                                    className={`${nodeBadgeClass('hypothesis')} w-full text-left`}
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
                                    <summary className="cursor-pointer text-[0.75rem] font-bold text-slate-400">
                                        Metrics
                                    </summary>
                                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                                        {[...new Set(experiments.map((exp) => exp.primary_metric).filter(Boolean))].map((metric) => (
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

                            <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                            <span>Drag nodes. Drag from right handles to connect. Click line to remove.</span>
                            <div className="flex items-center gap-2">
                                <button className="btn-secondary" onClick={autoLayout}>
                                    Auto Layout
                                </button>
                                <button className="btn-secondary" onClick={clearCanvas}>
                                    Clear Canvas
                                </button>
                                <span className={isFlowReady ? 'text-emerald-300' : 'text-amber-300'}>
                                    {isFlowReady ? 'Flow Ready' : 'Connect required inputs'}
                                </span>
                            </div>
                        </div>
                        <div
                            ref={canvasRef}
                            onWheel={(event) => {
                                if (!event.ctrlKey && !event.metaKey) return;
                                event.preventDefault();
                                const direction = event.deltaY > 0 ? -0.1 : 0.1;
                                adjustZoom(zoomRef.current + direction);
                            }}
                            onMouseDown={(event) => {
                                if (event.button !== 0 || pendingFrom) return;
                                const target = event.target as HTMLElement;
                                if (target.closest('.flow-node') || target.closest('button') || target.closest('input')) {
                                    return;
                                }
                                event.preventDefault();
                                panningRef.current = {
                                    startX: event.clientX,
                                    startY: event.clientY,
                                    panX: panRef.current.x,
                                    panY: panRef.current.y,
                                };
                            }}
                            onMouseMove={(event) => {
                                if (!canvasRef.current || !pendingFrom) return;
                                const rect = canvasRef.current.getBoundingClientRect();
                                const next = {
                                    x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
                                    y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
                                };
                                const target = nodes
                                    .filter((node) => node.id !== pendingFrom)
                                    .map((node) => {
                                        const handleX = node.x - HANDLE_CENTER_OFFSET;
                                        const handleY = node.y + NODE_HEIGHT / 2;
                                        const dx = next.x - handleX;
                                        const dy = next.y - handleY;
                                        return { node, distance: Math.hypot(dx, dy), handleX, handleY };
                                    })
                                    .sort((a, b) => a.distance - b.distance)[0];

                                if (target && target.distance < 20 && isValidConnection(pendingFrom, target.node.id)) {
                                    setHoverTarget(target.node.id);
                                    setCursor({ x: target.handleX, y: target.handleY });
                                } else {
                                    setHoverTarget(null);
                                    setCursor(next);
                                }
                            }}
                            onClick={() => {
                                if (pendingFrom) {
                                    reconnectRef.current = null;
                                    setPendingFrom(null);
                                    setHoverTarget(null);
                                    setCursor(null);
                                    return;
                                }
                                setSelectedNodeId(null);
                            }}
                            className="flow-canvas relative mt-4 min-h-[520px] overflow-hidden rounded-2xl border border-slate-800/70 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.5),rgba(2,6,23,0.9))] p-6"
                        >
                            <div className="absolute right-6 top-6 z-20 flex items-center gap-3 rounded-full border border-slate-700/60 bg-slate-950/80 px-4 py-2 text-xs text-slate-200 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.7)]">
                                <span className="text-[0.5rem] uppercase tracking-[0.3em] text-slate-400">Zoom</span>
                                <input
                                    type="range"
                                    min={0.6}
                                    max={1.6}
                                    step={0.05}
                                    value={zoom}
                                    onChange={(event) => adjustZoom(Number(event.target.value))}
                                    className="h-1 w-24 accent-emerald-300"
                                />
                                <span className="min-w-[2.5rem] text-center text-emerald-200">
                                    {Math.round(zoom * 100)}%
                                </span>
                            </div>
                            <div
                                className="absolute inset-0 origin-top-left overflow-visible"
                                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                            >
                                <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px]"></div>

                                <svg className="absolute inset-0 h-full w-full pointer-events-none overflow-visible">
                                {edges.map((edge) => {
                                    const fromNode = nodes.find((node) => node.id === edge.from);
                                    const toNode = nodes.find((node) => node.id === edge.to);
                                    if (!fromNode || !toNode) return null;
                                    const startX = fromNode.x + NODE_WIDTH - HANDLE_CENTER_OFFSET;
                                    const startY = fromNode.y + NODE_HEIGHT / 2;
                                    const endX = toNode.x - HANDLE_CENTER_OFFSET;
                                    const endY = toNode.y + NODE_HEIGHT / 2;
                                    const midX = (startX + endX) / 2;
                                    const isActiveEdge =
                                        isSimulating &&
                                        reachableToRun.has(edge.from) &&
                                        reachableToRun.has(edge.to) &&
                                        (!startNode || (reachableFromStart.has(edge.from) && reachableFromStart.has(edge.to)));
                                    return (
                                        <path
                                            key={`${edge.from}-${edge.to}`}
                                            d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                                            stroke="rgba(16,185,129,0.6)"
                                            strokeWidth="2.5"
                                            vectorEffect="non-scaling-stroke"
                                            fill="none"
                                            className={isActiveEdge ? 'flow-line' : ''}
                                        />
                                    );
                                })}
                                {pendingFrom && cursor ? (
                                    (() => {
                                        const fromNode = nodes.find((node) => node.id === pendingFrom);
                                        if (!fromNode) return null;
                                        const startX = fromNode.x + NODE_WIDTH - HANDLE_CENTER_OFFSET;
                                        const startY = fromNode.y + NODE_HEIGHT / 2;
                                        const midX = (startX + cursor.x) / 2;
                                        return (
                                            <path
                                                d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${cursor.y}, ${cursor.x} ${cursor.y}`}
                                                stroke="rgba(56,189,248,0.6)"
                                                strokeWidth="2.5"
                                                vectorEffect="non-scaling-stroke"
                                                fill="none"
                                                strokeDasharray="6 6"
                                            />
                                        );
                                    })()
                                ) : null}
                                </svg>
                                <svg className="absolute inset-0 h-full w-full overflow-visible">
                                {edges.map((edge) => {
                                    const fromNode = nodes.find((node) => node.id === edge.from);
                                    const toNode = nodes.find((node) => node.id === edge.to);
                                    if (!fromNode || !toNode) return null;
                                    const startX = fromNode.x + NODE_WIDTH - HANDLE_CENTER_OFFSET;
                                    const startY = fromNode.y + NODE_HEIGHT / 2;
                                    const endX = toNode.x - HANDLE_CENTER_OFFSET;
                                    const endY = toNode.y + NODE_HEIGHT / 2;
                                    const midX = (startX + endX) / 2;
                                    return (
                                        <path
                                            key={`hit-${edge.from}-${edge.to}`}
                                            d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
                                            stroke="transparent"
                                            strokeWidth="12"
                                            vectorEffect="non-scaling-stroke"
                                            fill="none"
                                            className="cursor-pointer"
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                if (!canvasRef.current) return;
                                                const rect = canvasRef.current.getBoundingClientRect();
                                                const next = {
                                                    x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
                                                    y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
                                                };
                                                reconnectRef.current = edge;
                                                setEdges((prev) => prev.filter((item) => !(item.from === edge.from && item.to === edge.to)));
                                                setPendingFrom(edge.from);
                                                setCursor(next);
                                            }}
                                            onDoubleClick={() => {
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
                                    const isRunNode = node.kind === 'trigger-run';
                                    return (
                                <div
                                    key={node.id}
                                    className={`flow-node absolute h-[72px] w-44 cursor-grab select-none rounded-2xl border bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-200 shadow-[0_20px_30px_-25px_rgba(15,23,42,0.9)] ${nodeColorByKind[node.kind].border}`}
                                    style={{ left: node.x, top: node.y }}
                                    onMouseDown={(event) => startDrag(event, node.id)}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedNodeId(node.id);
                                    }}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="truncate">{node.label}</span>
                                        <button
                                            className="absolute -right-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full border border-slate-700/70 bg-slate-950 text-slate-400 hover:text-rose-400"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                removeNode(node.id);
                                            }}
                                            aria-label="Remove node"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    {isRunNode && (
                                        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1">
                                            <div
                                                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[0.6rem] ${
                                                    isSimulating
                                                        ? 'border-emerald-400/60 text-emerald-200 run-pulse'
                                                        : isPaused
                                                        ? 'border-amber-400/60 text-amber-200'
                                                        : 'border-slate-700/70 text-slate-400'
                                                }`}
                                                aria-label={isSimulating ? 'Simulation running' : isPaused ? 'Simulation paused' : 'Simulation idle'}
                                            >
                                                ●
                                            </div>
                                            <button
                                                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[0.65rem] font-semibold ${
                                                    isSimulating
                                                        ? 'border-emerald-400/60 text-emerald-200'
                                                        : isPaused
                                                        ? 'border-amber-400/60 text-amber-200'
                                                        : 'border-slate-700/70 text-slate-400'
                                                }`}
                                                aria-label={isSimulating ? 'Pause simulation' : isPaused ? 'Resume simulation' : 'Run simulation'}
                                                onMouseDown={(event) => event.stopPropagation()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    if (!selectedExperiment || !isFlowReady) return;
                                                    if (isSimulating) {
                                                        pauseSimulation();
                                                    } else {
                                                        void startSimulation(!isPaused);
                                                    }
                                                }}
                                            >
                                                {isSimulating ? '⏸' : '▶'}
                                            </button>
                                        </div>
                                    )}
                                    <div className="mt-2 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                                        <span>{node.kind.replace('-', ' ')}</span>
                                        <span>{pendingFrom === node.id ? 'link' : ''}</span>
                                    </div>
                                    {canOutput && (
                                        <button
                                            className={`absolute -right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border bg-slate-950 ${
                                                pendingFrom === node.id
                                                    ? 'border-amber-400/70 text-amber-300'
                                                    : outgoing
                                                        ? 'border-emerald-400/70 text-emerald-300'
                                                        : 'border-emerald-400/40 text-emerald-200'
                                            }`}
                                            onMouseDown={(event) => {
                                                event.stopPropagation();
                                                setPendingFrom(node.id);
                                                setCursor({ x: node.x + NODE_WIDTH - HANDLE_CENTER_OFFSET, y: node.y + NODE_HEIGHT / 2 });
                                            }}
                                            aria-label="Start connection"
                                        >
                                            {pendingFrom === node.id || outgoing ? '●' : '→'}
                                        </button>
                                    )}
                                    {canInput && (
                                        <button
                                            className={`absolute -left-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border bg-slate-950 ${
                                                hoverTarget === node.id
                                                    ? 'border-amber-400/70 text-amber-300'
                                                    : incoming
                                                        ? 'border-emerald-400/70 text-emerald-300'
                                                        : 'border-cyan-400/40 text-cyan-200'
                                            }`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleInputClick(node.id);
                                            }}
                                            onMouseDown={(event) => event.stopPropagation()}
                                            onMouseEnter={() => setHoverTarget(node.id)}
                                            onMouseLeave={() => setHoverTarget(null)}
                                            aria-label="Complete connection"
                                        >
                                            {incoming || hoverTarget === node.id ? '●' : '+'}
                                        </button>
                                    )}
                                </div>
                                );
                                })}
                                {errorTooltip && (
                                    <div
                                        className="absolute z-20 rounded-lg border border-amber-400/60 bg-amber-100/90 px-3 py-2 text-xs text-amber-900 shadow-[0_12px_30px_-20px_rgba(251,191,36,0.6)]"
                                        style={{ left: errorTooltip.x + 12, top: errorTooltip.y + 12 }}
                                    >
                                        {errorTooltip.message}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="simulation-output flow-surface mt-6 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4">
                            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-500">
                                <span>Simulation Output</span>
                                <span
                                    className={
                                        isSimulating ? 'text-emerald-300' : isPaused ? 'text-amber-300' : 'text-slate-500'
                                    }
                                >
                                    {isSimulating ? 'Running' : isPaused ? 'Paused' : 'Idle'}
                                </span>
                            </div>
                            <div className="relative mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                                <div className="flex items-center gap-2">
                                    <span className="uppercase tracking-[0.2em] text-slate-500">From</span>
                                    <button
                                        ref={startRef}
                                        className="flow-pill rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
                                        onClick={(event) => {
                                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            setPickerPos({ top: rect.bottom + 8, left: rect.left });
                                            setPickerOpen('start');
                                        }}
                                    >
                                        {rangeStart ? rangeStart.replace('T', ' ') : 'Select datetime'}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="uppercase tracking-[0.2em] text-slate-500">To</span>
                                    <button
                                        ref={endRef}
                                        className="flow-pill rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-1 text-xs text-slate-200"
                                        onClick={(event) => {
                                            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                            setPickerPos({ top: rect.bottom + 8, left: rect.left });
                                            setPickerOpen('end');
                                        }}
                                    >
                                        {rangeEnd ? rangeEnd.replace('T', ' ') : 'Select datetime'}
                                    </button>
                                </div>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setRangeStart('');
                                        setRangeEnd('');
                                    }}
                                >
                                    Clear
                                </button>

                                {pickerOpen && pickerPos && (
                                    <div
                                        ref={pickerRef}
                                        className="flow-surface fixed z-50 w-[320px] rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.9)]"
                                        style={{ top: pickerPos.top, left: pickerPos.left }}
                                    >
                                        <div className="mb-3 flex items-center justify-between text-xs text-slate-300">
                                            <button
                                                className="btn-secondary"
                                                onClick={() =>
                                                    setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1))
                                                }
                                            >
                                                ◀
                                            </button>
                                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                                {pickerMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                                            </span>
                                            <button
                                                className="btn-secondary"
                                                onClick={() =>
                                                    setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1))
                                                }
                                            >
                                                ▶
                                            </button>
                                        </div>
                                        {renderCalendar()}
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <div className="text-[0.55rem] uppercase tracking-[0.2em] text-slate-500">Hour</div>
                                                <select
                                                    value={pickerValue.getHours()}
                                                    onChange={(event) => {
                                                        const next = new Date(pickerValue);
                                                        next.setHours(Number(event.target.value));
                                                        setPickerValue(next);
                                                        applyPickerValue(next);
                                                    }}
                                                    className="w-full rounded-lg border border-slate-800/70 bg-slate-950/70 px-2 py-1 text-xs text-slate-200"
                                                >
                                                    {hours.map((hour) => (
                                                        <option key={hour} value={hour}>
                                                            {String(hour).padStart(2, '0')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-[0.55rem] uppercase tracking-[0.2em] text-slate-500">Minute</div>
                                                <select
                                                    value={pickerValue.getMinutes() - (pickerValue.getMinutes() % 3)}
                                                    onChange={(event) => {
                                                        const next = new Date(pickerValue);
                                                        next.setMinutes(Number(event.target.value));
                                                        setPickerValue(next);
                                                        applyPickerValue(next);
                                                    }}
                                                    className="w-full rounded-lg border border-slate-800/70 bg-slate-950/70 px-2 py-1 text-xs text-slate-200"
                                                >
                                                    {minutes.map((minute) => (
                                                        <option key={minute} value={minute}>
                                                            {String(minute).padStart(2, '0')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <button
                                                className="btn-secondary"
                                                onClick={() => {
                                                    if (pickerOpen === 'start') {
                                                        setRangeStart('');
                                                    } else {
                                                        setRangeEnd('');
                                                    }
                                                    setPickerOpen(null);
                                                }}
                                            >
                                                Clear
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <button className="btn-secondary" onClick={() => setPickerOpen(null)}>
                                                    Cancel
                                                </button>
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => {
                                                        applyPickerValue(pickerValue);
                                                        setPickerOpen(null);
                                                    }}
                                                >
                                                    Apply
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {simulationSeries.length === 0 ? (
                                <p className="text-sm text-slate-400">
                                    {selectedExperiment?.status === 'stopped'
                                        ? 'Selected experiment is stopped. Duplicate or create a new experiment to simulate.'
                                        : flowConnected && !isFlowReady
                                        ? 'Complete Start → Experiment → User Group → Metric → Run to start streaming.'
                                        : 'Connect the Run trigger to start streaming results.'}
                                </p>
                            ) : (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        {connectedGroups.map((group) => (
                                            <div key={group.id} className="flow-surface rounded-xl border border-slate-800/70 bg-slate-950/70 p-3">
                                                <div className="mb-2 text-[0.65rem] font-semibold text-slate-400">
                                                    {group.name}
                                                </div>
                                                <div className="h-40">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={filteredSeries}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                            <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                                            <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                                    border: '1px solid rgba(148, 163, 184, 0.2)',
                                                                    borderRadius: '12px',
                                                                    color: '#e2e8f0',
                                                                    fontSize: '11px',
                                                                }}
                                                            />
                                                            {selectedExperiment?.variants?.map((variant, variantIdx) => (
                                                                <Line
                                                                    key={`${group.id}-${variant.name}`}
                                                                    type="monotone"
                                                                    dataKey={getGroupVariantKey(group.id, variant.name)}
                                                                    stroke={variantIdx % 2 === 0 ? '#38bdf8' : '#34d399'}
                                                                    strokeWidth={2}
                                                                    name={variant.name}
                                                                    dot={false}
                                                                />
                                                            )) ||
                                                                null}
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {(hypothesisNodes.length > 0 || metricNodesForCharts.length > 0) &&
                                        isFlowReady &&
                                        (isSimulating || isPaused) && (
                                        <div>
                                            <div className="mb-3 text-[0.65rem] font-semibold text-slate-500">
                                                Hypotheses & Metrics
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                {hypothesisNodes.map((node) => (
                                                    <div
                                                        key={`hypothesis-${node.id}`}
                                                        className="flow-surface rounded-xl border border-slate-800/70 bg-slate-950/70 p-3"
                                                    >
                                                        <div className="mb-2 text-[0.65rem] font-semibold text-slate-400">
                                                            {node.data?.hypothesis || node.label}
                                                        </div>
                                                        <div className="h-40">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <LineChart data={aggregatedSeries}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                                    <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                                                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                                                    <Tooltip
                                                                        contentStyle={{
                                                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                                                            borderRadius: '12px',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '11px',
                                                                        }}
                                                                    />
                                                                    {selectedExperiment?.variants?.map((variant, variantIdx) => (
                                                                        <Line
                                                                            key={`${node.id}-${variant.name}`}
                                                                            type="monotone"
                                                                            dataKey={variant.name}
                                                                            stroke={variantIdx % 2 === 0 ? '#38bdf8' : '#34d399'}
                                                                            strokeWidth={2}
                                                                            name={variant.name}
                                                                            dot={false}
                                                                        />
                                                                    )) ||
                                                                        null}
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                ))}
                                                {metricNodesForCharts.map((node) => (
                                                    <div
                                                        key={`metric-${node.id}`}
                                                        className="flow-surface rounded-xl border border-slate-800/70 bg-slate-950/70 p-3"
                                                    >
                                                        <div className="mb-2 text-[0.65rem] font-semibold text-slate-400">
                                                            {node.data?.metric || node.label}
                                                        </div>
                                                        <div className="h-40">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <LineChart data={aggregatedSeries}>
                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                                                                    <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                                                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                                                                    <Tooltip
                                                                        contentStyle={{
                                                                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                                                            border: '1px solid rgba(148, 163, 184, 0.2)',
                                                                            borderRadius: '12px',
                                                                            color: '#e2e8f0',
                                                                            fontSize: '11px',
                                                                        }}
                                                                    />
                                                                    {selectedExperiment?.variants?.map((variant, variantIdx) => (
                                                                        <Line
                                                                            key={`${node.id}-${variant.name}`}
                                                                            type="monotone"
                                                                            dataKey={variant.name}
                                                                            stroke={variantIdx % 2 === 0 ? '#38bdf8' : '#34d399'}
                                                                            strokeWidth={2}
                                                                            name={variant.name}
                                                                            dot={false}
                                                                        />
                                                                    )) ||
                                                                        null}
                                                                </LineChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-px w-full bg-slate-800/70"></div>
            <details className="panel" open>
                <summary className="cursor-pointer text-base font-bold text-slate-200">Simulation Details</summary>
                <div className="mt-4 grid grid-cols-1 gap-6 text-[0.85rem] lg:grid-cols-[1.4fr_1fr_1fr]">
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
        </div>
    );
};
