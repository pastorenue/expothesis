import React from 'react';
import type { ActivityEvent, ReplayEvent, Session } from '../types';
import { trackApi } from '../services/api';
import { DebugReplayPanel } from './session-replay/DebugReplayPanel';
import { ReplayPanel } from './session-replay/ReplayPanel';
import { SessionListPanel } from './session-replay/SessionListPanel';
import { useAccount } from '../contexts/AccountContext';

export function SessionReplayPanel() {
    const { activeAccountId } = useAccount();
    type HeatmapEvent = {
        x?: number;
        y?: number;
        metadata?: { screenWidth?: number; screenHeight?: number };
        [key: string]: unknown;
    };

    const replayLimit = 200;
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = React.useState<string | null>(null);
    const [replayEvents, setReplayEvents] = React.useState<ReplayEvent[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<'replay' | 'heatmap'>('replay');
    const [heatmapEvents, setHeatmapEvents] = React.useState<HeatmapEvent[]>([]);
    const [isLoadingHeatmap, setIsLoadingHeatmap] = React.useState(false);
    const [hasMoreReplay, setHasMoreReplay] = React.useState(true);
    const [hasMoreSessions, setHasMoreSessions] = React.useState(true);
    const [sessionsOffset, setSessionsOffset] = React.useState(0);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const [debugSessionId, setDebugSessionId] = React.useState('');
    const [debugInfo, setDebugInfo] = React.useState<string>('');
    const [copiedSessionId, setCopiedSessionId] = React.useState<string | null>(null);
    const replayAbortRef = React.useRef<AbortController | null>(null);
    const replayOffsetRef = React.useRef(0);
    const heatmapCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const heatmapContainerRef = React.useRef<HTMLDivElement | null>(null);
    const [filterText, setFilterText] = React.useState('');
    const [filterStatus, setFilterStatus] = React.useState<'all' | 'live' | 'completed'>('all');
    const [showFilterMenu, setShowFilterMenu] = React.useState(false);
    const [userIdFilter, setUserIdFilter] = React.useState('');
    const [featureGateFilter, setFeatureGateFilter] = React.useState('');
    const [activeFilters, setActiveFilters] = React.useState<Array<'userId' | 'featureGate' | 'status' | 'sessionId'>>([]);

    const handleMissingSnapshot = React.useCallback(() => {
        setErrorMessage('Replay missing full snapshot. Start a new session to capture a snapshot.');
    }, []);

    const loadReplay = React.useCallback(
        async (sessionId: string, reset = false) => {
            setIsLoading(true);
            setErrorMessage(null);
            replayAbortRef.current?.abort();
            const controller = new AbortController();
            replayAbortRef.current = controller;
            try {
                const offset = reset ? 0 : replayOffsetRef.current;
                const replayResponse = await trackApi.getReplay(sessionId, replayLimit, offset, controller.signal);
                const replayData = replayResponse.data as ReplayEvent[];
                setReplayEvents((prev) => (reset ? replayData : [...prev, ...replayData]));
                const nextOffset = offset + replayData.length;
                replayOffsetRef.current = nextOffset;
                setHasMoreReplay(replayData.length === replayLimit);
            } catch (error) {
                const err = error as { name?: string };
                if (err?.name !== 'CanceledError') {
                    setErrorMessage('Replay data failed to load. Try refreshing or reduce the session size.');
                }
            } finally {
                setIsLoading(false);
            }
        },
        [replayLimit],
    );

    const loadSessions = React.useCallback(async (reset = false) => {
        if (isLoadingSessions) {
            return;
        }
        setIsLoadingSessions(true);
        try {
            const nextOffset = reset ? 0 : sessionsOffset;
            const response = await trackApi.listSessions(20, nextOffset);
            const payload = response.data;
            setSessions((prev) => (reset ? payload.sessions : [...prev, ...payload.sessions]));
            const updatedOffset = nextOffset + payload.sessions.length;
            setSessionsOffset(updatedOffset);
            setHasMoreSessions(updatedOffset < payload.total);
        } catch (error) {
            setErrorMessage('Failed to load sessions.');
        } finally {
            setIsLoadingSessions(false);
        }
    }, [isLoadingSessions, sessionsOffset]);

    React.useEffect(() => {
        loadSessions(true);
    }, [loadSessions, activeAccountId]);

    React.useEffect(() => {
        if (selectedSession) {
            setReplayEvents([]);
            replayOffsetRef.current = 0;
            setHasMoreReplay(true);
            loadReplay(selectedSession, true);
        }
    }, [selectedSession, loadReplay]);

    React.useEffect(() => {
        if (!selectedSession || viewMode !== 'heatmap') {
            return;
        }
        const loadHeatmap = async () => {
            setIsLoadingHeatmap(true);
            try {
                const response = await trackApi.listEvents(selectedSession, 'click', 2000);
                setHeatmapEvents(
                    response.data.map((event: ActivityEvent): HeatmapEvent => ({
                        x: event.x,
                        y: event.y,
                        metadata: event.metadata as HeatmapEvent['metadata'],
                    })),
                );
            } catch (error) {
                setErrorMessage('Failed to load heatmap data.');
            } finally {
                setIsLoadingHeatmap(false);
            }
        };
        loadHeatmap();
    }, [selectedSession, viewMode]);

    React.useEffect(() => {
        if (!heatmapCanvasRef.current || !heatmapContainerRef.current || !heatmapEvents.length) {
            return;
        }
        const canvas = heatmapCanvasRef.current;
        const container = heatmapContainerRef.current;

        const renderHeatmap = () => {
            const rect = container.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }
            canvas.width = Math.floor(rect.width);
            canvas.height = Math.floor(rect.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            heatmapEvents.forEach((event) => {
                const x = event.x ?? 0;
                const y = event.y ?? 0;
                const meta = event.metadata || {};
                const sw = meta.screenWidth || canvas.width;
                const sh = meta.screenHeight || canvas.height;
                const px = (x / sw) * canvas.width;
                const py = (y / sh) * canvas.height;
                const radius = 18;
                const gradient = ctx.createRadialGradient(px, py, 0, px, py, radius);
                gradient.addColorStop(0, 'rgba(45, 212, 191, 0.35)');
                gradient.addColorStop(1, 'rgba(45, 212, 191, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fill();
            });
        };

        renderHeatmap();
        const resizeObserver = new ResizeObserver(renderHeatmap);
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [heatmapEvents]);

    const getFeatureGate = (session: Session): string | undefined => {
        const meta = session.metadata as Record<string, unknown> | undefined;
        const value =
            meta?.feature_gate ??
            meta?.featureGate ??
            meta?.feature_gate_id ??
            meta?.gate ??
            undefined
            ;
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        return undefined;
    };

    const userIdOptions = React.useMemo(
        () =>
            Array.from(
                new Set(
                    sessions
                        .map((session) => session.user_id)
                        .filter((value): value is string => Boolean(value)),
                ),
            ),
        [sessions],
    );

    const featureGateOptions = React.useMemo(
        () =>
            Array.from(
                new Set(
                    sessions
                        .map((session) => getFeatureGate(session))
                        .filter((value): value is string => Boolean(value)),
                ),
            ),
        [sessions],
    );

    const filteredSessions = sessions.filter((session) => {
        const matchesText = activeFilters.includes('sessionId')
            ? session.session_id.toLowerCase().includes(filterText.toLowerCase())
            : true;
        const isLive = !session.ended_at;
        const matchesStatus = activeFilters.includes('status')
            ? filterStatus === 'all'
                ? true
                : filterStatus === 'live'
                    ? isLive
                    : !isLive
            : true;
        const matchesUserId = activeFilters.includes('userId')
            ? (session.user_id || '').toLowerCase().includes(userIdFilter.toLowerCase())
            : true;
        const featureGateValue = getFeatureGate(session);
        const matchesFeatureGate = activeFilters.includes('featureGate')
            ? (featureGateValue || '').toLowerCase().includes(featureGateFilter.toLowerCase())
            : true;
        return matchesText && matchesStatus && matchesUserId && matchesFeatureGate;
    });

    const replayRenderKey = `${selectedSession ?? 'none'}`;
    const selected = sessions.find((session) => session.session_id === selectedSession);
    const getUrl = (url?: string) => (url && url.trim().length > 0 ? url : 'unknown');
    const handleCopySessionId = async (sessionId: string, event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        try {
            await navigator.clipboard.writeText(sessionId);
            setCopiedSessionId(sessionId);
            window.setTimeout(() => {
                setCopiedSessionId((prev) => (prev === sessionId ? null : prev));
            }, 1200);
        } catch (error) {
            console.warn('Failed to copy session id', error);
        }
    };
    const handleRemoveFilter = (filter: 'userId' | 'featureGate' | 'status' | 'sessionId') => {
        setActiveFilters((prev) => prev.filter((item) => item !== filter));
        if (filter === 'status') {
            setFilterStatus('all');
        }
        if (filter === 'sessionId') {
            setFilterText('');
        }
        if (filter === 'userId') {
            setUserIdFilter('');
        }
        if (filter === 'featureGate') {
            setFeatureGateFilter('');
        }
    };

    const handleDebugReplay = async () => {
        if (!debugSessionId.trim()) {
            return;
        }
        setDebugInfo('Loading replay events...');
        try {
            const response = await trackApi.getReplay(debugSessionId.trim(), 5000, 0);
            const events = response.data as ReplayEvent[];
            const hasFullSnapshot = events.some((event) => event?.type === 2);
            const types = events.slice(0, 8).map((event) => event?.type).join(', ');
            setDebugInfo(
                `Session ${debugSessionId}: ${events.length} events. FullSnapshot: ${hasFullSnapshot}. First types: ${types || 'none'}.`,
            );
        } catch (error) {
            setDebugInfo('Failed to load replay events for that session.');
        }
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <SessionListPanel
                filteredSessions={filteredSessions}
                selectedSession={selectedSession}
                onSelectSession={setSelectedSession}
                onRefreshSessions={() => loadSessions(true)}
                onLoadMoreSessions={() => loadSessions(false)}
                hasMoreSessions={hasMoreSessions}
                isLoadingSessions={isLoadingSessions}
                copiedSessionId={copiedSessionId}
                onCopySessionId={handleCopySessionId}
                getUrl={getUrl}
                activeFilters={activeFilters}
                filterStatus={filterStatus}
                filterText={filterText}
                userIdFilter={userIdFilter}
                featureGateFilter={featureGateFilter}
                showFilterMenu={showFilterMenu}
                userIdOptions={userIdOptions}
                featureGateOptions={featureGateOptions}
                onToggleFilterMenu={() => setShowFilterMenu((prev) => !prev)}
                onAddFilter={(filter) => {
                    setActiveFilters((prev) => [...prev, filter]);
                    setShowFilterMenu(false);
                }}
                onRemoveFilter={handleRemoveFilter}
                onFilterStatusChange={setFilterStatus}
                onFilterTextChange={setFilterText}
                onUserIdFilterChange={setUserIdFilter}
                onFeatureGateFilterChange={setFeatureGateFilter}
            />

            <div className="session-replay-column">
                <DebugReplayPanel
                    debugSessionId={debugSessionId}
                    onChangeSessionId={setDebugSessionId}
                    onInspect={handleDebugReplay}
                    debugInfo={debugInfo}
                />

                <ReplayPanel
                    selectedSession={selected}
                    selectedSessionId={selectedSession}
                    replayEvents={replayEvents}
                    viewMode={viewMode}
                    onToggleViewMode={() => setViewMode(viewMode === 'replay' ? 'heatmap' : 'replay')}
                    isLoading={isLoading}
                    hasMoreReplay={hasMoreReplay}
                    onLoadMoreReplay={() => loadReplay(selectedSession!, false)}
                    replayRenderKey={replayRenderKey}
                    onMissingSnapshot={handleMissingSnapshot}
                    heatmapContainerRef={heatmapContainerRef}
                    heatmapCanvasRef={heatmapCanvasRef}
                    heatmapEvents={heatmapEvents}
                    isLoadingHeatmap={isLoadingHeatmap}
                    errorMessage={errorMessage}
                />
            </div>
        </div>
    );
}
