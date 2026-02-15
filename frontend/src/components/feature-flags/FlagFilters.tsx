import React from 'react';

type FlagFiltersProps = {
    filterStatus: 'all' | 'active' | 'inactive';
    filterTags: string;
    filterEnvironment: string;
    filterOwner: string;
    tagOptions: string[];
    environmentOptions: string[];
    ownerOptions: string[];
    onFilterStatusChange: (value: 'all' | 'active' | 'inactive') => void;
    onFilterTagsChange: (value: string) => void;
    onFilterEnvironmentChange: (value: string) => void;
    onFilterOwnerChange: (value: string) => void;
    onReset: () => void;
};

export const FlagFilters: React.FC<FlagFiltersProps> = ({
    filterStatus,
    filterTags,
    filterEnvironment,
    filterOwner,
    tagOptions,
    environmentOptions,
    ownerOptions,
    onFilterStatusChange,
    onFilterTagsChange,
    onFilterEnvironmentChange,
    onFilterOwnerChange,
    onReset,
}) => {
    return (
        <div className="card">
            <div className="mb-3 flex items-center justify-between">
                <h3>Filters</h3>
                <button type="button" className="btn-secondary" onClick={onReset}>
                    Reset
                </button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                    <label className="label">Status</label>
                    <select
                        className="input"
                        value={filterStatus}
                        onChange={(e) => onFilterStatusChange(e.target.value as 'all' | 'active' | 'inactive')}
                    >
                        <option value="all">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
                <div>
                    <label className="label">Tags</label>
                    <input
                        className="input"
                        value={filterTags}
                        onChange={(e) => onFilterTagsChange(e.target.value)}
                        list="feature-flag-tags"
                        placeholder="Search tags"
                    />
                    <datalist id="feature-flag-tags">
                        {tagOptions.map((tag) => (
                            <option key={tag} value={tag} />
                        ))}
                    </datalist>
                </div>
                <div>
                    <label className="label">Environment</label>
                    <input
                        className="input"
                        value={filterEnvironment}
                        onChange={(e) => onFilterEnvironmentChange(e.target.value)}
                        list="feature-flag-environments"
                        placeholder="Search environment"
                    />
                    <datalist id="feature-flag-environments">
                        {environmentOptions.map((env) => (
                            <option key={env} value={env} />
                        ))}
                    </datalist>
                </div>
                <div>
                    <label className="label">Owner</label>
                    <input
                        className="input"
                        value={filterOwner}
                        onChange={(e) => onFilterOwnerChange(e.target.value)}
                        list="feature-flag-owners"
                        placeholder="Search owner"
                    />
                    <datalist id="feature-flag-owners">
                        {ownerOptions.map((owner) => (
                            <option key={owner} value={owner} />
                        ))}
                    </datalist>
                </div>
            </div>
        </div>
    );
};
