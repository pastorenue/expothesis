import React from 'react';

type FilterKey = 'userId' | 'featureGate' | 'status' | 'sessionId';

type SessionFiltersProps = {
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

export const SessionFilters: React.FC<SessionFiltersProps> = ({
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
        <div className="session-filters">
            <div className="session-filter-header">
                <span className="session-filter-title">Filter</span>
                <div className="filter-add">
                    <button
                        type="button"
                        className="filter-chip filter-chip-add"
                        onClick={onToggleFilterMenu}
                        aria-haspopup="listbox"
                        aria-expanded={showFilterMenu}
                        title="Add filter"
                    >
                        +
                    </button>
                    {showFilterMenu && (
                        <div className="filter-menu" role="listbox">
                            {!activeFilters.includes('status') && (
                                <button type="button" className="filter-menu-item" onClick={() => onAddFilter('status')}>
                                    Status
                                </button>
                            )}
                            {!activeFilters.includes('sessionId') && (
                                <button
                                    type="button"
                                    className="filter-menu-item"
                                    onClick={() => onAddFilter('sessionId')}
                                >
                                    Session ID
                                </button>
                            )}
                            {!activeFilters.includes('userId') && (
                                <button type="button" className="filter-menu-item" onClick={() => onAddFilter('userId')}>
                                    User ID
                                </button>
                            )}
                            {!activeFilters.includes('featureGate') && (
                                <button
                                    type="button"
                                    className="filter-menu-item"
                                    onClick={() => onAddFilter('featureGate')}
                                >
                                    Feature Gate
                                </button>
                            )}
                            {activeFilters.length >= 4 && <div className="filter-menu-empty">All filters added</div>}
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
                                    onClick={() => onFilterStatusChange(value)}
                                    type="button"
                                >
                                    {value === 'all' ? 'All' : value === 'live' ? 'Live' : 'Completed'}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="filter-remove"
                            onClick={() => onRemoveFilter('status')}
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
                            onChange={(event) => onFilterTextChange(event.target.value)}
                        />
                        <button
                            type="button"
                            className="filter-remove"
                            onClick={() => onRemoveFilter('sessionId')}
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
                            onChange={(event) => onUserIdFilterChange(event.target.value)}
                        />
                        <button
                            type="button"
                            className="filter-remove"
                            onClick={() => onRemoveFilter('userId')}
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
                            onChange={(event) => onFeatureGateFilterChange(event.target.value)}
                        />
                        <button
                            type="button"
                            className="filter-remove"
                            onClick={() => onRemoveFilter('featureGate')}
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
    );
};
