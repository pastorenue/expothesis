import React from 'react';
import { Replayer } from 'rrweb';
import type { Session } from '../types';
import { trackApi } from '../services/api';

const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

type ReplayViewportProps = {
    replayEvents: any[];
    onMissingSnapshot: () => void;
};

function ReplayViewport({ replayEvents, onMissingSnapshot }: ReplayViewportProps) {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const replayerRef = React.useRef<Replayer | null>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [duration, setDuration] = React.useState(0);

    React.useEffect(() => {
        if (!containerRef.current || replayEvents.length < 2) {
            return;
        }
        if (replayEvents[0]?.type !== 2) {
            onMissingSnapshot();
            return;
        }

        const config = {
            speed: 1,
            skipInactive: true,
            mouseTail: false,
        };

        try {
            const replayer = new Replayer(replayEvents, config);
            replayerRef.current = replayer;

            const wrapper = document.createElement('div');
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            containerRef.current.innerHTML = '';
            containerRef.current.appendChild(wrapper);
            wrapper.appendChild(replayer.wrapper);

            const iframe = replayer.wrapper.querySelector('iframe');
            if (iframe) {
                iframe.setAttribute('scrolling', 'yes');
                iframe.style.overflow = 'auto';
            }

            const applyScale = () => {
                if (!containerRef.current || !replayer.wrapper) return;
                const containerRect = containerRef.current.getBoundingClientRect();
                const wrapperRect = replayer.wrapper.getBoundingClientRect();
                if (!containerRect.width || !containerRect.height || !wrapperRect.width || !wrapperRect.height) {
                    return;
                }
                const scale = Math.min(
                    containerRect.width / wrapperRect.width,
                    containerRect.height / wrapperRect.height,
                    1,
                );
                replayer.wrapper.style.transformOrigin = 'top left';
                replayer.wrapper.style.transform = `scale(${scale})`;
            };

            const resizeObserver = new ResizeObserver(() => applyScale());
            resizeObserver.observe(containerRef.current);
            resizeObserver.observe(replayer.wrapper);
            requestAnimationFrame(() => applyScale());

            const meta = replayer.getMetaData();
            setDuration(meta.totalTime);
            setCurrentTime(0);
            setIsPlaying(false);
            replayer.pause();

            const interval = window.setInterval(() => {
                if (replayerRef.current) {
                    const time = replayerRef.current.getCurrentTime();
                    setCurrentTime(time);
                    if (time >= meta.totalTime) {
                        setIsPlaying(false);
                        replayerRef.current.pause();
                    }
                }
            }, 250);

            return () => {
                window.clearInterval(interval);
                resizeObserver.disconnect();
                if (replayerRef.current) {
                    replayerRef.current.pause();
                    replayerRef.current = null;
                }
            };
        } catch (error) {
            console.error('Failed to initialize rrweb replayer:', error);
        }
    }, [replayEvents, onMissingSnapshot]);

    const handlePlayPause = () => {
        if (!replayerRef.current) return;
        if (isPlaying) {
            replayerRef.current.pause();
            setIsPlaying(false);
        } else {
            if (currentTime === 0) {
                replayerRef.current.play(0);
            } else {
                replayerRef.current.play();
            }
            setIsPlaying(true);
        }
    };

    const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!replayerRef.current) return;
        const time = Number(event.target.value);
        replayerRef.current.pause();
        replayerRef.current.play(time);
        setCurrentTime(time);
        if (!isPlaying) {
            setTimeout(() => replayerRef.current?.play(), 0);
            setIsPlaying(true);
        }
    };

    const handleRestart = () => {
        if (!replayerRef.current) return;
        replayerRef.current.pause();
        replayerRef.current.play(0);
        setCurrentTime(0);
        setIsPlaying(true);
    };

    return (
        <div className="custom-replay-container">
            <div className="custom-replay-viewport" ref={containerRef} />
            <div className="custom-replay-controls">
                <button onClick={handleRestart} className="replay-btn" title="Restart">
                    ⟲
                </button>
                <button onClick={handlePlayPause} className="replay-btn replay-btn-main" title={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? '❚❚' : '▶'}
                </button>
                <span className="replay-time">{formatTime(currentTime)}</span>
                <input
                    type="range"
                    min={0}
                    max={Math.max(duration, 1)}
                    value={currentTime}
                    onChange={handleSeek}
                    className="replay-slider"
                />
                <span className="replay-time">{formatTime(duration)}</span>
            </div>
        </div>
    );
}

export function SessionReplayPanel() {
    const replayLimit = 200;
    const [sessions, setSessions] = React.useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = React.useState<string | null>(null);
    const [replayEvents, setReplayEvents] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = React.useState(false);
    const [viewMode, setViewMode] = React.useState<'replay' | 'heatmap'>('replay');
    const [heatmapEvents, setHeatmapEvents] = React.useState<any[]>([]);
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
    const replayContainerRef = React.useRef<HTMLDivElement | null>(null);
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
                const replayData = replayResponse.data as any[];
                setReplayEvents((prev) => (reset ? replayData : [...prev, ...replayData]));
                const nextOffset = offset + replayData.length;
                replayOffsetRef.current = nextOffset;
                setHasMoreReplay(replayData.length === replayLimit);
            } catch (error) {
                if ((error as any)?.name !== 'CanceledError') {
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
    }, [loadSessions]);

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
                setHeatmapEvents(response.data as any[]);
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

    const getFeatureGate = (session: Session) => {
        const meta = session.metadata as Record<string, any> | undefined;
        return (
            meta?.feature_gate ??
            meta?.featureGate ??
            meta?.feature_gate_id ??
            meta?.gate ??
            undefined
        );
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
            const events = response.data as any[];
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
            <div className="card session-panel session-panel--list">
                <div className="session-panel-header">
                    <div>
                        <h3>Sessions</h3>
                        <p>Pick a session to replay and inspect activity.</p>
                    </div>
                    <div className="session-actions">
                        <button className="btn-secondary icon-btn" onClick={() => loadSessions(true)} title="Refresh sessions" aria-label="Refresh sessions">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-6h-6" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 10a8 8 0 0 0-14-4" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 14a8 8 0 0 0 14 4" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="session-filters">
                    <div className="session-filter-header">
                        <span className="session-filter-title">Filter</span>
                        <div className="filter-add">
                            <button
                                type="button"
                                className="filter-chip filter-chip-add"
                                onClick={() => setShowFilterMenu((prev) => !prev)}
                                aria-haspopup="listbox"
                                aria-expanded={showFilterMenu}
                                title="Add filter"
                            >
                                +
                            </button>
                            {showFilterMenu && (
                                <div className="filter-menu" role="listbox">
                                    {!activeFilters.includes('status') && (
                                        <button
                                            type="button"
                                            className="filter-menu-item"
                                            onClick={() => {
                                                setActiveFilters((prev) => [...prev, 'status']);
                                                setShowFilterMenu(false);
                                            }}
                                        >
                                            Status
                                        </button>
                                    )}
                                    {!activeFilters.includes('sessionId') && (
                                        <button
                                            type="button"
                                            className="filter-menu-item"
                                            onClick={() => {
                                                setActiveFilters((prev) => [...prev, 'sessionId']);
                                                setShowFilterMenu(false);
                                            }}
                                        >
                                            Session ID
                                        </button>
                                    )}
                                    {!activeFilters.includes('userId') && (
                                        <button
                                            type="button"
                                            className="filter-menu-item"
                                            onClick={() => {
                                                setActiveFilters((prev) => [...prev, 'userId']);
                                                setShowFilterMenu(false);
                                            }}
                                        >
                                            User ID
                                        </button>
                                    )}
                                    {!activeFilters.includes('featureGate') && (
                                        <button
                                            type="button"
                                            className="filter-menu-item"
                                            onClick={() => {
                                                setActiveFilters((prev) => [...prev, 'featureGate']);
                                                setShowFilterMenu(false);
                                            }}
                                        >
                                            Feature Gate
                                        </button>
                                    )}
                                    {activeFilters.length >= 4 && (
                                        <div className="filter-menu-empty">All filters added</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    {activeFilters.includes('status') && (
                        <div className="filter-block">
                            <div className="filter-block-label">Status</div>
                            <div className="filter-block-row">
                                <div className="session-filter-group">
                                    {(['all', 'live', 'completed'] as const).map((value) => (
                                        <button
                                            key={value}
                                            className={`filter-chip ${filterStatus === value ? 'is-active' : ''}`}
                                            onClick={() => setFilterStatus(value)}
                                            type="button"
                                        >
                                            {value === 'all' ? 'All' : value === 'live' ? 'Live' : 'Completed'}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="filter-remove"
                                    onClick={() => handleRemoveFilter('status')}
                                    aria-label="Remove status filter"
                                    title="Remove filter"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                    {activeFilters.includes('sessionId') && (
                        <div className="filter-block">
                            <div className="filter-block-label">Session ID</div>
                            <div className="filter-block-row">
                                <input
                                    className="input"
                                    placeholder="Filter by session id"
                                    value={filterText}
                                    onChange={(event) => setFilterText(event.target.value)}
                                />
                                <button
                                    type="button"
                                    className="filter-remove"
                                    onClick={() => handleRemoveFilter('sessionId')}
                                    aria-label="Remove session id filter"
                                    title="Remove filter"
                                >
                                    ×
                                </button>
                            </div>
                        </div>
                    )}
                    {activeFilters.includes('userId') && (
                        <div className="filter-block">
                            <div className="filter-block-label">User ID</div>
                            <div className="filter-block-row">
                                <input
                                    className="input"
                                    list="session-user-ids"
                                    placeholder="Filter by user id"
                                    value={userIdFilter}
                                    onChange={(event) => setUserIdFilter(event.target.value)}
                                />
                                <button
                                    type="button"
                                    className="filter-remove"
                                    onClick={() => handleRemoveFilter('userId')}
                                    aria-label="Remove user id filter"
                                    title="Remove filter"
                                >
                                    ×
                                </button>
                            </div>
                            <datalist id="session-user-ids">
                                {userIdOptions.map((value) => (
                                    <option key={value} value={value} />
                                ))}
                            </datalist>
                        </div>
                    )}
                    {activeFilters.includes('featureGate') && (
                        <div className="filter-block">
                            <div className="filter-block-label">Feature Gate</div>
                            <div className="filter-block-row">
                                <input
                                    className="input"
                                    list="session-feature-gates"
                                    placeholder="Filter by feature gate"
                                    value={featureGateFilter}
                                    onChange={(event) => setFeatureGateFilter(event.target.value)}
                                />
                                <button
                                    type="button"
                                    className="filter-remove"
                                    onClick={() => handleRemoveFilter('featureGate')}
                                    aria-label="Remove feature gate filter"
                                    title="Remove filter"
                                >
                                    ×
                                </button>
                            </div>
                            <datalist id="session-feature-gates">
                                {featureGateOptions.map((value) => (
                                    <option key={value} value={value} />
                                ))}
                            </datalist>
                        </div>
                    )}
                </div>
                <div className="session-filter-divider" />
                <div className="session-list space-y-2">
                    {filteredSessions.map((session) => (
                        <button
                            key={session.session_id}
                            className={`session-row ${session.session_id === selectedSession ? 'is-active' : ''}`}
                            onClick={() => setSelectedSession(session.session_id)}
                        >
                            <div className="session-row-main">
                                <div className="session-row-id">{session.session_id}</div>
                                <button
                                    type="button"
                                    className={`session-copy ${copiedSessionId === session.session_id ? 'is-copied' : ''}`}
                                    onClick={(event) => handleCopySessionId(session.session_id, event)}
                                    aria-label="Copy session id"
                                    title="Copy session id"
                                >
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h10v10H9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                                    </svg>
                                </button>
                            </div>
                            <div className="session-row-url">
                                <span>{getUrl(session.entry_url)}</span>
                                <span className="session-row-status">
                                    {session.ended_at ? (
                                        <span className="session-status-dot session-status-complete" aria-label="Completed session" />
                                    ) : (
                                        <span className="session-status-dot session-status-live" aria-label="Live session" />
                                    )}
                                </span>
                            </div>
                            <div className="session-row-meta">
                                <span>{new Date(session.started_at).toLocaleTimeString()}</span>
                                <span className="session-divider">•</span>
                                <span>{session.replay_events_count ?? 0} events</span>
                                <span className="session-divider">•</span>
                                <span className="session-meta-icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 4a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V8a4 4 0 0 1 4-4z"
                                        />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v3" />
                                    </svg>
                                </span>
                                <span>{session.clicks_count ?? 0} clicks</span>
                                <span className="session-divider">•</span>
                                <span>{session.duration_seconds ? `${session.duration_seconds}s` : 'Live'}</span>
                            </div>
                        </button>
                    ))}
                    {!filteredSessions.length && <div className="session-empty">No sessions yet.</div>}
                </div>
                {hasMoreSessions && (
                    <button
                        className="btn-secondary session-load-more"
                        onClick={() => loadSessions(false)}
                        disabled={isLoadingSessions}
                        aria-busy={isLoadingSessions}
                    >
                        Load more sessions
                    </button>
                )}
            </div>

            <div className="session-replay-column">
                <div className="card session-panel" ref={replayContainerRef}>
                    <div className="session-panel-header">
                        <div>
                            <h3>Debug replay</h3>
                            <p>Inspect stored replay events for a specific session id.</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <input
                            className="input flex-1"
                            placeholder="Session id (e.g., ff270994)"
                            value={debugSessionId}
                            onChange={(event) => setDebugSessionId(event.target.value)}
                        />
                        <button className="btn-secondary" onClick={handleDebugReplay}>
                            Inspect replay
                        </button>
                    </div>
                    {debugInfo && <div className="session-debug text-slate-300">{debugInfo}</div>}
                </div>

                <div className="card session-panel session-panel--replay">
                    <div className="session-panel-header">
                        <div>
                            <h3>Replay</h3>
                            <p>
                                {selected ? `Session ${selected.session_id.slice(0, 8)}` : 'Pick a session'}
                                {replayEvents.length > 0 ? ` · ${replayEvents.length} events` : ''}
                            </p>
                        </div>
                        <div className="session-status-row">
                            <div
                                className={`session-status ${
                                    viewMode === 'replay' ? 'session-status--replay' : 'session-status--heatmap'
                                }`}
                            >
                                {isLoading ? 'Loading' : viewMode === 'replay' ? 'Live capture' : 'Heatmap'}
                            </div>
                            <button
                                type="button"
                                className={`session-toggle ${viewMode === 'replay' ? 'is-replay' : 'is-heatmap'}`}
                                onClick={() => setViewMode(viewMode === 'replay' ? 'heatmap' : 'replay')}
                                aria-pressed={viewMode === 'replay'}
                                title={viewMode === 'replay' ? 'Switch to heatmap' : 'Switch to replay'}
                            >
                                <span className="session-toggle-thumb" />
                            </button>
                        </div>
                    </div>
                    <div className="session-replay is-ready">
                        {viewMode === 'replay' && (
                            <>
                                {replayEvents.length > 0 && replayEvents[0]?.type === 2 && (
                                    <ReplayViewport
                                        key={replayRenderKey}
                                        replayEvents={replayEvents}
                                        onMissingSnapshot={handleMissingSnapshot}
                                    />
                                )}
                                {replayEvents.length === 0 && !isLoading && (
                                    <div className="session-empty session-empty--center">No replay data yet.</div>
                                )}
                            </>
                        )}
                        {viewMode === 'heatmap' && (
                            <div className="custom-display-container" ref={heatmapContainerRef}>
                                <canvas ref={heatmapCanvasRef} />
                                {!heatmapEvents.length && !isLoadingHeatmap && (
                                    <div className="session-empty session-empty--center">No heatmap data yet.</div>
                                )}
                                {isLoadingHeatmap && <div className="session-empty">Loading heatmap...</div>}
                            </div>
                        )}
                    </div>
                    {hasMoreReplay && replayEvents.length > 0 && (
                        <button className="btn-secondary session-load-more" onClick={() => loadReplay(selectedSession!, false)}>
                            Load more replay events
                        </button>
                    )}
                    {errorMessage && <div className="session-error">{errorMessage}</div>}
                </div>
            </div>
        </div>
    );
}
