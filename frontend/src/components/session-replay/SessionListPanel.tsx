import React from 'react';
import type { Session } from '../../types';
import { SessionFilters } from './SessionFilters';

type FilterKey = 'userId' | 'featureGate' | 'status' | 'sessionId';

type SessionListPanelProps = {
    filteredSessions: Session[];
    selectedSession: string | null;
    onSelectSession: (sessionId: string) => void;
    onRefreshSessions: () => void;
    onLoadMoreSessions: () => void;
    hasMoreSessions: boolean;
    isLoadingSessions: boolean;
    copiedSessionId: string | null;
    onCopySessionId: (sessionId: string, event: React.MouseEvent<HTMLButtonElement>) => void;
    getUrl: (value?: string) => string;
    activeFilters: FilterKey[];
    filterStatus: 'all' | 'live' | 'completed';
    filterText: string;
    userIdFilter: string;
    featureGateFilter: string;
    showFilterMenu: boolean;
    userIdOptions: string[];
    featureGateOptions: string[];
    onToggleFilterMenu: () => void;
    onAddFilter: (filter: FilterKey) => void;
    onRemoveFilter: (filter: FilterKey) => void;
    onFilterStatusChange: (value: 'all' | 'live' | 'completed') => void;
    onFilterTextChange: (value: string) => void;
    onUserIdFilterChange: (value: string) => void;
    onFeatureGateFilterChange: (value: string) => void;
};

export const SessionListPanel: React.FC<SessionListPanelProps> = ({
    filteredSessions,
    selectedSession,
    onSelectSession,
    onRefreshSessions,
    onLoadMoreSessions,
    hasMoreSessions,
    isLoadingSessions,
    copiedSessionId,
    onCopySessionId,
    getUrl,
    activeFilters,
    filterStatus,
    filterText,
    userIdFilter,
    featureGateFilter,
    showFilterMenu,
    userIdOptions,
    featureGateOptions,
    onToggleFilterMenu,
    onAddFilter,
    onRemoveFilter,
    onFilterStatusChange,
    onFilterTextChange,
    onUserIdFilterChange,
    onFeatureGateFilterChange,
}) => {
    return (
        <div className="card session-panel session-panel--list">
            <div className="session-panel-header">
                <div>
                    <h3>Sessions</h3>
                    <p>Pick a session to replay and inspect activity.</p>
                </div>
                <div className="session-actions">
                    <button
                        className="btn-secondary icon-btn"
                        onClick={onRefreshSessions}
                        title="Refresh sessions"
                        aria-label="Refresh sessions"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-6h-6" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 10a8 8 0 0 0-14-4" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 14a8 8 0 0 0 14 4" />
                        </svg>
                    </button>
                </div>
            </div>

            <SessionFilters
                activeFilters={activeFilters}
                filterStatus={filterStatus}
                filterText={filterText}
                userIdFilter={userIdFilter}
                featureGateFilter={featureGateFilter}
                showFilterMenu={showFilterMenu}
                userIdOptions={userIdOptions}
                featureGateOptions={featureGateOptions}
                onToggleFilterMenu={onToggleFilterMenu}
                onAddFilter={onAddFilter}
                onRemoveFilter={onRemoveFilter}
                onFilterStatusChange={onFilterStatusChange}
                onFilterTextChange={onFilterTextChange}
                onUserIdFilterChange={onUserIdFilterChange}
                onFeatureGateFilterChange={onFeatureGateFilterChange}
            />

            <div className="session-filter-divider" />
            <div className="session-list space-y-2">
                {filteredSessions.map((session) => (
                    <button
                        key={session.session_id}
                        className={`session-row ${session.session_id === selectedSession ? 'is-active' : ''}`}
                        onClick={() => onSelectSession(session.session_id)}
                    >
                        <div className="session-row-main">
                            <div className="session-row-id">{session.session_id}</div>
                            <button
                                type="button"
                                className={`session-copy ${copiedSessionId === session.session_id ? 'is-copied' : ''}`}
                                onClick={(event) => onCopySessionId(session.session_id, event)}
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
                    onClick={onLoadMoreSessions}
                    disabled={isLoadingSessions}
                    aria-busy={isLoadingSessions}
                >
                    Load more sessions
                </button>
            )}
        </div>
    );
};
