import React from 'react';
import { FeatureFlagStatus, type CreateFeatureFlagRequest, type UserGroup } from '../../types';

type CreateFlagModalProps = {
    flagForm: CreateFeatureFlagRequest;
    setFlagForm: (value: CreateFeatureFlagRequest) => void;
    tagInput: string;
    setTagInput: (value: string) => void;
    groupInput: string;
    setGroupInput: (value: string) => void;
    userGroups: UserGroup[];
    userGroupById: Map<string, UserGroup>;
    onClose: () => void;
    onCreate: () => void;
    isPending: boolean;
    addTagChip: (value: string, setter: (tags: string[]) => void, current: string[]) => void;
    removeTagChip: (value: string, setter: (tags: string[]) => void, current: string[]) => void;
    addGroupChip: (value: string, setter: (groups: string[]) => void, current: string[]) => void;
    removeGroupChip: (value: string, setter: (groups: string[]) => void, current: string[]) => void;
};

export const CreateFlagModal: React.FC<CreateFlagModalProps> = ({
    flagForm,
    setFlagForm,
    tagInput,
    setTagInput,
    groupInput,
    setGroupInput,
    userGroups,
    userGroupById,
    onClose,
    onCreate,
    isPending,
    addTagChip,
    removeTagChip,
    addGroupChip,
    removeGroupChip,
}) => {
    return (
        <div className="modal-overlay">
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-panel">
                <div className="modal-header">
                    <h3>Create Feature Flag</h3>
                    <button
                        type="button"
                        className="icon-action"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label className="label">Flag Name</label>
                        <input
                            className="input"
                            value={flagForm.name}
                            onChange={(e) => setFlagForm({ ...flagForm, name: e.target.value })}
                            placeholder="e.g., new_checkout_flow"
                        />
                    </div>
                    <div>
                        <label className="label">Status</label>
                        <select
                            className="input"
                            value={flagForm.status}
                            onChange={(e) => setFlagForm({ ...flagForm, status: e.target.value as FeatureFlagStatus })}
                        >
                            <option value={FeatureFlagStatus.Active}>Active</option>
                            <option value={FeatureFlagStatus.Inactive}>Inactive</option>
                        </select>
                    </div>
                    <div>
                        <label className="label">Environment</label>
                        <input
                            className="input"
                            value={flagForm.environment || ''}
                            onChange={(e) => setFlagForm({ ...flagForm, environment: e.target.value })}
                            placeholder="e.g., production"
                        />
                    </div>
                    <div>
                        <label className="label">Owner</label>
                        <input
                            className="input"
                            value={flagForm.owner || ''}
                            onChange={(e) => setFlagForm({ ...flagForm, owner: e.target.value })}
                            placeholder="e.g., growth-team"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="label">Description</label>
                    <textarea
                        className="input"
                        rows={2}
                        value={flagForm.description}
                        onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
                    />
                </div>
                <div className="mt-3">
                    <label className="label">Tags (comma-separated)</label>
                    <div className="chip-input">
                        <div className="chip-list">
                            {(flagForm.tags || []).map((tag) => (
                                <span key={tag} className="chip">
                                    {tag}
                                    <button
                                        type="button"
                                        className="chip-remove"
                                        onClick={() =>
                                            removeTagChip(tag, (tags) => setFlagForm({ ...flagForm, tags }), flagForm.tags || [])
                                        }
                                        aria-label={`Remove ${tag}`}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                        <input
                            className="input chip-input-field"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === ',' || e.key === 'Enter') {
                                    e.preventDefault();
                                    addTagChip(tagInput, (tags) => setFlagForm({ ...flagForm, tags }), flagForm.tags || []);
                                    setTagInput('');
                                }
                            }}
                            list="feature-flag-tags"
                            placeholder="Type tag and press comma"
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <label className="label">User Groups</label>
                    {userGroups.length > 0 ? (
                        <div className="chip-input">
                            <div className="chip-list">
                                {(flagForm.user_groups || []).map((id) => (
                                    <span key={id} className="chip">
                                        {userGroupById.get(id)?.name || id}
                                        <button
                                            type="button"
                                            className="chip-remove"
                                            onClick={() =>
                                                removeGroupChip(
                                                    id,
                                                    (groups) => setFlagForm({ ...flagForm, user_groups: groups }),
                                                    flagForm.user_groups || [],
                                                )
                                            }
                                            aria-label="Remove user group"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <input
                                className="input chip-input-field"
                                value={groupInput}
                                onChange={(e) => setGroupInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === ',' || e.key === 'Enter') {
                                        e.preventDefault();
                                        addGroupChip(
                                            groupInput,
                                            (groups) => setFlagForm({ ...flagForm, user_groups: groups }),
                                            flagForm.user_groups || [],
                                        );
                                        setGroupInput('');
                                    }
                                }}
                                list="feature-flag-user-groups"
                                placeholder="Type group and press comma"
                            />
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 italic">No user groups available.</p>
                    )}
                </div>
                <div className="mt-4 flex gap-2">
                    <button
                        onClick={onCreate}
                        className="btn-success"
                        disabled={isPending}
                    >
                        Create Flag
                    </button>
                    <button onClick={onClose} className="btn-secondary">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
