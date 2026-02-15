import React from 'react';
import { FeatureFlagStatus, type FeatureFlag, type UserGroup } from '../../types';

type FlagTableProps = {
    flags: FeatureFlag[];
    sortedFlags: FeatureFlag[];
    selectedFlag: FeatureFlag | null;
    flagSort: 'asc' | 'desc';
    editingFlagId: string | null;
    editForm: {
        name: string;
        description: string;
        status: FeatureFlagStatus;
        tagsInput: string;
        tags: string[];
        environment: string;
        owner: string;
        user_groups: string[];
        groupInput: string;
    };
    userGroupById: Map<string, UserGroup>;
    onToggleSort: () => void;
    onSelectFlag: (flag: FeatureFlag) => void;
    onStartEdit: (flag: FeatureFlag) => void;
    onSaveEdit: (flag: FeatureFlag) => void;
    onCancelEdit: () => void;
    onDelete: (flag: FeatureFlag) => void;
    onEditFormChange: (next: FlagTableProps['editForm']) => void;
    onAddTag: (value: string, setter: (tags: string[]) => void, current: string[]) => void;
    onRemoveTag: (value: string, setter: (tags: string[]) => void, current: string[]) => void;
    onAddGroup: (value: string, setter: (groups: string[]) => void, current: string[]) => void;
    onRemoveGroup: (value: string, setter: (groups: string[]) => void, current: string[]) => void;
};

export const FlagTable: React.FC<FlagTableProps> = ({
    flags,
    sortedFlags,
    selectedFlag,
    flagSort,
    editingFlagId,
    editForm,
    userGroupById,
    onToggleSort,
    onSelectFlag,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onDelete,
    onEditFormChange,
    onAddTag,
    onRemoveTag,
    onAddGroup,
    onRemoveGroup,
}) => {
    if (flags.length === 0) {
        return (
            <div className="card text-center">
                <p className="text-slate-400">No feature flags yet. Create your first flag.</p>
            </div>
        );
    }

    return (
        <div className="card overflow-hidden feature-flag-table">
            <div className="feature-flag-row feature-flag-header border-b border-slate-800/70 px-4 py-2 text-sm font-bold text-slate-300">
                <span>#</span>
                <button type="button" onClick={onToggleSort} className="flex items-center gap-2 text-left">
                    Name
                    <span className="text-xs">{flagSort === 'asc' ? '▲' : '▼'}</span>
                </button>
                <span>Status</span>
                <span>Environment</span>
                <span>Owner</span>
                <span>Tags</span>
                <span>Groups</span>
                <span>Updated</span>
                <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-slate-800/70">
                {sortedFlags.map((flag, index) => (
                    <div
                        key={flag.id}
                        onClick={() => {
                            if (editingFlagId) return;
                            onSelectFlag(flag);
                        }}
                        className={`table-row feature-flag-row w-full px-4 py-2 text-left text-sm leading-none text-slate-200 transition ${
                            selectedFlag?.id === flag.id ? 'table-row-selected' : ''
                        }`}
                    >
                        <span className="text-slate-400">{index + 1}</span>
                        {editingFlagId === flag.id ? (
                            <input
                                className="input h-8"
                                value={editForm.name}
                                onChange={(e) => onEditFormChange({ ...editForm, name: e.target.value })}
                            />
                        ) : (
                            <span className="font-semibold text-slate-100">{flag.name}</span>
                        )}
                        {editingFlagId === flag.id ? (
                            <select
                                className="input h-8"
                                value={editForm.status}
                                onChange={(e) =>
                                    onEditFormChange({ ...editForm, status: e.target.value as FeatureFlagStatus })
                                }
                            >
                                <option value={FeatureFlagStatus.Active}>Active</option>
                                <option value={FeatureFlagStatus.Inactive}>Inactive</option>
                            </select>
                        ) : (
                            <span
                                className={`status-badge ${
                                    flag.status === FeatureFlagStatus.Active ? 'status-badge--active' : 'status-badge--inactive'
                                }`}
                            >
                                {flag.status.charAt(0).toUpperCase() + flag.status.slice(1)}
                            </span>
                        )}
                        {editingFlagId === flag.id ? (
                            <input
                                className="input h-8"
                                value={editForm.environment}
                                onChange={(e) => onEditFormChange({ ...editForm, environment: e.target.value })}
                            />
                        ) : (
                            <span className="text-slate-300">{flag.environment || '—'}</span>
                        )}
                        {editingFlagId === flag.id ? (
                            <input
                                className="input h-8"
                                value={editForm.owner}
                                onChange={(e) => onEditFormChange({ ...editForm, owner: e.target.value })}
                            />
                        ) : (
                            <span className="text-slate-300">{flag.owner || '—'}</span>
                        )}
                        {editingFlagId === flag.id ? (
                            <div className="chip-input chip-input--table">
                                <div className="chip-list">
                                    {editForm.tags.map((tag) => (
                                        <span key={tag} className="chip">
                                            {tag}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onRemoveTag(tag, (tags) => onEditFormChange({ ...editForm, tags }), editForm.tags);
                                                }}
                                                aria-label={`Remove ${tag}`}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    className="input chip-input-field"
                                    value={editForm.tagsInput}
                                    onChange={(e) => onEditFormChange({ ...editForm, tagsInput: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === ',' || e.key === 'Enter') {
                                            e.preventDefault();
                                            onAddTag(
                                                editForm.tagsInput,
                                                (tags) => onEditFormChange({ ...editForm, tags }),
                                                editForm.tags,
                                            );
                                            onEditFormChange({ ...editForm, tagsInput: '' });
                                        }
                                    }}
                                    list="feature-flag-tags"
                                    placeholder="Add tag"
                                />
                            </div>
                        ) : (
                            <span className="text-slate-300">
                                {(flag.tags || []).length === 0 ? '—' : flag.tags.join(', ')}
                            </span>
                        )}
                        {editingFlagId === flag.id ? (
                            <div className="chip-input chip-input--table">
                                <div className="chip-list">
                                    {editForm.user_groups.map((id) => (
                                        <span key={id} className="chip">
                                            {userGroupById.get(id)?.name || id}
                                            <button
                                                type="button"
                                                className="chip-remove"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onRemoveGroup(
                                                        id,
                                                        (groups) => onEditFormChange({ ...editForm, user_groups: groups }),
                                                        editForm.user_groups,
                                                    );
                                                }}
                                                aria-label="Remove user group"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <input
                                    className="input chip-input-field"
                                    value={editForm.groupInput}
                                    onChange={(e) => onEditFormChange({ ...editForm, groupInput: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === ',' || e.key === 'Enter') {
                                            e.preventDefault();
                                            onAddGroup(
                                                editForm.groupInput,
                                                (groups) => onEditFormChange({ ...editForm, user_groups: groups }),
                                                editForm.user_groups,
                                            );
                                            onEditFormChange({ ...editForm, groupInput: '' });
                                        }
                                    }}
                                    list="feature-flag-user-groups"
                                    placeholder="Add group"
                                />
                            </div>
                        ) : (
                            <span className="text-slate-300">
                                {(flag.user_groups || []).length === 0
                                    ? '—'
                                    : (flag.user_groups || [])
                                          .map((id) => userGroupById.get(id)?.name || id)
                                          .slice(0, 2)
                                          .join(', ') + ((flag.user_groups || []).length > 2 ? '…' : '')}
                            </span>
                        )}
                        <span className="text-slate-400">
                            {new Date(flag.updated_at).toLocaleDateString()}
                        </span>
                        <div className="flex items-center justify-end gap-2">
                            {editingFlagId === flag.id ? (
                                <>
                                    <button
                                        type="button"
                                        className="icon-action"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onSaveEdit(flag);
                                        }}
                                        title="Save changes"
                                        aria-label="Save changes"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="icon-action"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onCancelEdit();
                                        }}
                                        title="Cancel edit"
                                        aria-label="Cancel edit"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className="icon-action"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onStartEdit(flag);
                                        }}
                                        title="Edit flag"
                                        aria-label="Edit flag"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l2.651 2.651-9.193 9.193-3.535.884.884-3.535 9.193-9.193z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.875 4.5" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        className="icon-action"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDelete(flag);
                                        }}
                                        title="Delete flag"
                                        aria-label="Delete flag"
                                    >
                                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l1 14h10l1-14" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
