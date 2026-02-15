import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CreateFeatureFlagRequest,
    CreateFeatureGateRequest,
    FeatureFlag,
    FeatureGate,
    FeatureFlagStatus,
    FeatureGateStatus,
    UserGroup,
    Experiment,
} from '../types';
import { featureFlagApi, featureGateApi, userGroupApi, experimentApi } from '../services/api';

const emptyFlag: CreateFeatureFlagRequest = {
    name: '',
    description: '',
    status: FeatureFlagStatus.Active,
    tags: [],
    environment: '',
    owner: '',
    user_groups: [],
};

const emptyGate: CreateFeatureGateRequest = {
    flag_id: '',
    name: '',
    description: '',
    status: FeatureGateStatus.Active,
    rule: '{\n  "version": "1",\n  "conditions": []\n}',
    default_value: false,
    pass_value: true,
};

export const FeatureFlagManager: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
    const [showFlagForm, setShowFlagForm] = useState(false);
    const [showGateForm, setShowGateForm] = useState(false);
    const [openGateDetailId, setOpenGateDetailId] = useState<string | null>(null);
    const [gateTooltipSide, setGateTooltipSide] = useState<'left' | 'right'>('left');
    const [flagForm, setFlagForm] = useState<CreateFeatureFlagRequest>({ ...emptyFlag });
    const [tagInput, setTagInput] = useState('');
    const [groupInput, setGroupInput] = useState('');
    const [gateForm, setGateForm] = useState<CreateFeatureGateRequest>({ ...emptyGate });
    const [flagSort, setFlagSort] = useState<'asc' | 'desc'>('asc');
    const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        status: FeatureFlagStatus.Active,
        tagsInput: '',
        tags: [] as string[],
        environment: '',
        owner: '',
        user_groups: [] as string[],
        groupInput: '',
    });
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [filterTags, setFilterTags] = useState('');
    const [filterEnvironment, setFilterEnvironment] = useState('');
    const [filterOwner, setFilterOwner] = useState('');

    const { data: flags = [], isLoading: flagsLoading } = useQuery({
        queryKey: ['featureFlags'],
        queryFn: async () => (await featureFlagApi.list()).data,
    });

    const { data: gates = [], isLoading: gatesLoading } = useQuery({
        queryKey: ['featureGates'],
        queryFn: async () => (await featureGateApi.list()).data,
    });

    const { data: userGroups = [] } = useQuery({
        queryKey: ['userGroups'],
        queryFn: async () => (await userGroupApi.list()).data,
    });

    const { data: experiments = [] } = useQuery({
        queryKey: ['experiments'],
        queryFn: async () => (await experimentApi.list()).data,
    });

    const createFlag = useMutation({
        mutationFn: (data: CreateFeatureFlagRequest) => featureFlagApi.create(data),
        onSuccess: (response) => {
            queryClient.setQueryData(['featureFlags'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return [response.data, ...existing];
            });
            setShowFlagForm(false);
            setFlagForm({ ...emptyFlag });
            setTagInput('');
        },
    });

    const updateFlag = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateFeatureFlagRequest> }) =>
            featureFlagApi.update(id, data),
        onSuccess: (response) => {
            queryClient.setQueryData(['featureFlags'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return existing.map((item: FeatureFlag) => (item.id === response.data.id ? response.data : item));
            });
            setEditingFlagId(null);
        },
    });

    const deleteFlag = useMutation({
        mutationFn: (id: string) => featureFlagApi.delete(id),
        onSuccess: (_, id) => {
            queryClient.setQueryData(['featureFlags'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return existing.filter((item: FeatureFlag) => item.id !== id);
            });
            if (selectedFlag?.id === id) {
                setSelectedFlag(null);
            }
        },
    });

    const createGate = useMutation({
        mutationFn: (data: CreateFeatureGateRequest) => featureGateApi.create(data),
        onSuccess: (response) => {
            queryClient.setQueryData(['featureGates'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return [response.data, ...existing];
            });
            setShowGateForm(false);
            setGateForm({ ...emptyGate, flag_id: selectedFlag?.id || '' });
        },
    });

    const selectedGates = useMemo(() => {
        if (!selectedFlag) return [] as FeatureGate[];
        return gates.filter((gate) => gate.flag_id === selectedFlag.id);
    }, [gates, selectedFlag]);

    const rolloutAdvice = useMemo(() => {
        if (!selectedFlag) return null;
        const linkedExperiments = experiments.filter(
            (experiment: Experiment) => experiment.feature_flag_id === selectedFlag.id,
        ).length;
        const activeGates = selectedGates.filter((gate) => gate.status === FeatureGateStatus.Active).length;

        const steps: string[] = [];
        if (selectedFlag.status === FeatureFlagStatus.Inactive) {
            steps.push('Start with a 5% rollout to a controlled segment.');
            steps.push('Add guardrails for error rate and latency before scaling.');
        } else {
            steps.push('Ramp gradually (10% → 25% → 50% → 100%) while monitoring SRM and guardrails.');
        }
        if (activeGates === 0) {
            steps.push('Create at least one active gate to control exposure.');
        }
        if (linkedExperiments === 0) {
            steps.push('Run an experiment linked to this flag to quantify lift and risk.');
        }

        return {
            headline: selectedFlag.status === FeatureFlagStatus.Active ? 'Flag is active' : 'Flag is inactive',
            steps,
            linkedExperiments,
            activeGates,
        };
    }, [experiments, selectedFlag, selectedGates]);

    const tagOptions = useMemo(() => {
        const tagSet = new Set<string>();
        flags.forEach((flag) => (flag.tags || []).forEach((tag) => tagSet.add(tag)));
        return Array.from(tagSet).sort();
    }, [flags]);

    const environmentOptions = useMemo(() => {
        const envSet = new Set<string>();
        flags.forEach((flag) => {
            if (flag.environment) envSet.add(flag.environment);
        });
        return Array.from(envSet).sort();
    }, [flags]);

    const ownerOptions = useMemo(() => {
        const ownerSet = new Set<string>();
        flags.forEach((flag) => {
            if (flag.owner) ownerSet.add(flag.owner);
        });
        return Array.from(ownerSet).sort();
    }, [flags]);

    const filteredFlags = useMemo(() => {
        return flags.filter((flag) => {
            const matchesStatus =
                filterStatus === 'all' ? true : filterStatus === 'active' ? flag.status === FeatureFlagStatus.Active : flag.status === FeatureFlagStatus.Inactive;
            const matchesTags = filterTags
                ? (flag.tags || []).some((tag) => tag.toLowerCase().includes(filterTags.toLowerCase()))
                : true;
            const matchesEnvironment = filterEnvironment
                ? (flag.environment || '').toLowerCase().includes(filterEnvironment.toLowerCase())
                : true;
            const matchesOwner = filterOwner ? (flag.owner || '').toLowerCase().includes(filterOwner.toLowerCase()) : true;
            return matchesStatus && matchesTags && matchesEnvironment && matchesOwner;
        });
    }, [flags, filterStatus, filterTags, filterEnvironment, filterOwner]);

    const sortedFlags = useMemo(() => {
        const data = [...filteredFlags];
        data.sort((a, b) => a.name.localeCompare(b.name));
        if (flagSort === 'desc') data.reverse();
        return data;
    }, [filteredFlags, flagSort]);

    const toggleFlagSort = () => {
        setFlagSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    };

    const userGroupById = useMemo(() => {
        const map = new Map<string, UserGroup>();
        userGroups.forEach((group) => map.set(group.id, group));
        return map;
    }, [userGroups]);

    const userGroupByName = useMemo(() => {
        const map = new Map<string, UserGroup>();
        userGroups.forEach((group) => map.set(group.name.toLowerCase(), group));
        return map;
    }, [userGroups]);

    const startEditFlag = (flag: FeatureFlag) => {
        setEditingFlagId(flag.id);
        setEditForm({
            name: flag.name,
            description: flag.description,
            status: flag.status,
            tagsInput: '',
            tags: flag.tags || [],
            environment: flag.environment || '',
            owner: flag.owner || '',
            user_groups: flag.user_groups || [],
            groupInput: '',
        });
    };

    const saveEditFlag = (flag: FeatureFlag) => {
        updateFlag.mutate({
            id: flag.id,
            data: {
                name: editForm.name,
                description: editForm.description,
                status: editForm.status,
                tags: editForm.tags,
                environment: editForm.environment,
                owner: editForm.owner,
                user_groups: editForm.user_groups,
            },
        });
    };

    const addTagChip = (value: string, setter: (tags: string[]) => void, current: string[]) => {
        const next = value.trim();
        if (!next) return;
        if (current.includes(next)) return;
        setter([...current, next]);
    };

    const removeTagChip = (value: string, setter: (tags: string[]) => void, current: string[]) => {
        setter(current.filter((tag) => tag !== value));
    };

    const addGroupChip = (value: string, setter: (groups: string[]) => void, current: string[]) => {
        const next = value.trim();
        if (!next) return;
        let groupId = next;
        const match = userGroupByName.get(next.toLowerCase());
        if (match) {
            groupId = match.id;
        } else if (!userGroupById.get(next)) {
            return;
        }
        if (current.includes(groupId)) return;
        setter([...current, groupId]);
    };

    const removeGroupChip = (value: string, setter: (groups: string[]) => void, current: string[]) => {
        setter(current.filter((groupId) => groupId !== value));
    };

    if (flagsLoading || gatesLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-cyan-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2>Feature Flags</h2>
                    <p className="text-sm text-slate-400">Ship with gates, experiments, and rollout safety checks.</p>
                </div>
                <button onClick={() => setShowFlagForm((prev) => !prev)} className="btn-primary">
                    + New Flag
                </button>
            </div>

            {showFlagForm && (
                <div className="modal-overlay">
                    <div className="modal-backdrop" onClick={() => setShowFlagForm(false)} />
                    <div className="modal-panel">
                        <div className="modal-header">
                            <h3>Create Feature Flag</h3>
                            <button
                                type="button"
                                className="icon-action"
                                onClick={() => setShowFlagForm(false)}
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
                            onClick={() =>
                                createFlag.mutate({
                                    ...flagForm,
                                })
                            }
                            className="btn-success"
                            disabled={createFlag.isPending}
                        >
                            Create Flag
                        </button>
                        <button onClick={() => setShowFlagForm(false)} className="btn-secondary">
                            Cancel
                        </button>
                    </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
                <div className="space-y-4">
                    <div className="card">
                        <div className="mb-3 flex items-center justify-between">
                            <h3>Filters</h3>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                    setFilterStatus('all');
                                    setFilterTags('');
                                    setFilterEnvironment('');
                                    setFilterOwner('');
                                }}
                            >
                                Reset
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div>
                                <label className="label">Status</label>
                                <select
                                    className="input"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
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
                                    onChange={(e) => setFilterTags(e.target.value)}
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
                                    onChange={(e) => setFilterEnvironment(e.target.value)}
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
                                    onChange={(e) => setFilterOwner(e.target.value)}
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
                    {flags.length === 0 ? (
                        <div className="card text-center">
                            <p className="text-slate-400">No feature flags yet. Create your first flag.</p>
                        </div>
                    ) : (
                        <div className="card overflow-hidden feature-flag-table">
                            <div className="feature-flag-row feature-flag-header border-b border-slate-800/70 px-4 py-2 text-sm font-bold text-slate-300">
                                <span>#</span>
                                <button type="button" onClick={toggleFlagSort} className="flex items-center gap-2 text-left">
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
                                            setSelectedFlag(flag);
                                            setGateForm({ ...emptyGate, flag_id: flag.id });
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
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            />
                                        ) : (
                                            <span className="font-semibold text-slate-100">{flag.name}</span>
                                        )}
                                        {editingFlagId === flag.id ? (
                                            <select
                                                className="input h-8"
                                                value={editForm.status}
                                                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as FeatureFlagStatus })}
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
                                                onChange={(e) => setEditForm({ ...editForm, environment: e.target.value })}
                                            />
                                        ) : (
                                            <span className="text-slate-300">{flag.environment || '—'}</span>
                                        )}
                                        {editingFlagId === flag.id ? (
                                            <input
                                                className="input h-8"
                                                value={editForm.owner}
                                                onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
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
                                                                    removeTagChip(tag, (tags) => setEditForm({ ...editForm, tags }), editForm.tags);
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
                                                    onChange={(e) => setEditForm({ ...editForm, tagsInput: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === ',' || e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addTagChip(
                                                                editForm.tagsInput,
                                                                (tags) => setEditForm({ ...editForm, tags }),
                                                                editForm.tags,
                                                            );
                                                            setEditForm((prev) => ({ ...prev, tagsInput: '' }));
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
                                                                    removeGroupChip(
                                                                        id,
                                                                        (groups) => setEditForm({ ...editForm, user_groups: groups }),
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
                                                    onChange={(e) => setEditForm({ ...editForm, groupInput: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === ',' || e.key === 'Enter') {
                                                            e.preventDefault();
                                                            addGroupChip(
                                                                editForm.groupInput,
                                                                (groups) => setEditForm({ ...editForm, user_groups: groups }),
                                                                editForm.user_groups,
                                                            );
                                                            setEditForm((prev) => ({ ...prev, groupInput: '' }));
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
                                                            saveEditFlag(flag);
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
                                                            setEditingFlagId(null);
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
                                                            startEditFlag(flag);
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
                                                            if (window.confirm(`Delete ${flag.name}?`)) {
                                                                deleteFlag.mutate(flag.id);
                                                            }
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
                    )}
                </div>

                <div className="space-y-4">
                    <div className="card">
                        <div className="flex items-center justify-between">
                            <h3>Feature Gates</h3>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!selectedFlag && flags.length > 0) {
                                        setSelectedFlag(flags[0]);
                                        setGateForm({ ...emptyGate, flag_id: flags[0].id });
                                    }
                                    setShowGateForm(true);
                                }}
                                className="btn-secondary"
                            >
                                + New Gate
                            </button>
                        </div>
                        {!selectedFlag && (
                            <p className="mt-3 text-sm text-slate-400">Select a feature flag to manage its gates.</p>
                        )}
                        {selectedFlag && (
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{selectedFlag.name}</p>
                        )}
                    </div>

                    {selectedFlag && rolloutAdvice && (
                        <div className="card">
                            <div className="flex items-center justify-between">
                                <h3>AI Rollout Advisor</h3>
                                <span className="badge-gray">
                                    {rolloutAdvice.activeGates} gates · {rolloutAdvice.linkedExperiments} experiments
                                </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">{rolloutAdvice.headline}</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-300">
                                {rolloutAdvice.steps.map((step, idx) => (
                                    <li key={idx}>• {step}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {showGateForm && selectedFlag && (
                        <div className="card animate-slide-up bg-slate-950/60">
                            <h3 className="mb-4">Create Feature Gate</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="label">Gate Name</label>
                                    <input
                                        className="input"
                                        value={gateForm.name}
                                        onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })}
                                        placeholder="e.g., checkout_gate"
                                    />
                                </div>
                                <div>
                                    <label className="label">Status</label>
                                    <select
                                        className="input"
                                        value={gateForm.status}
                                        onChange={(e) => setGateForm({ ...gateForm, status: e.target.value as FeatureGateStatus })}
                                    >
                                        <option value={FeatureGateStatus.Active}>Active</option>
                                        <option value={FeatureGateStatus.Inactive}>Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-3">
                                <label className="label">Description</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    value={gateForm.description}
                                    onChange={(e) => setGateForm({ ...gateForm, description: e.target.value })}
                                />
                            </div>
                            <div className="mt-3">
                                <label className="label">Targeting Rule (JSON)</label>
                                <textarea
                                    className="input font-mono text-sm"
                                    rows={5}
                                    value={gateForm.rule}
                                    onChange={(e) => setGateForm({ ...gateForm, rule: e.target.value })}
                                />
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={gateForm.pass_value}
                                        onChange={(e) => setGateForm({ ...gateForm, pass_value: e.target.checked })}
                                    />
                                    Pass when rule matches
                                </label>
                                <label className="flex items-center gap-2 text-sm text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={gateForm.default_value}
                                        onChange={(e) => setGateForm({ ...gateForm, default_value: e.target.checked })}
                                    />
                                    Default pass when rule fails
                                </label>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    onClick={() => createGate.mutate({ ...gateForm, flag_id: selectedFlag.id })}
                                    className="btn-success"
                                    disabled={createGate.isPending}
                                >
                                    Create Gate
                                </button>
                                <button onClick={() => setShowGateForm(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedFlag && (
                        <div className="space-y-3">
                            {selectedGates.length === 0 ? (
                                <div className="card text-center">
                                    <p className="text-slate-400">No gates for this flag yet.</p>
                                </div>
                            ) : (
                                <div className="card feature-gate-table">
                                    <div className="feature-gate-row border-b border-slate-800/70 px-4 py-2 text-sm font-bold text-slate-300">
                                        <span>#</span>
                                        <span>Name</span>
                                        <span>Status</span>
                                    </div>
                                    <div className="divide-y divide-slate-800/70">
                                        {selectedGates.map((gate, index) => (
                                            <div
                                                key={gate.id}
                                                className="table-row feature-gate-row px-4 py-2 text-sm leading-none text-slate-200"
                                                onClick={(event) => {
                                                    const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                                    const shouldFlip = rect.left < 460;
                                                    setGateTooltipSide(shouldFlip ? 'right' : 'left');
                                                    setOpenGateDetailId((prev) => (prev === gate.id ? null : gate.id));
                                                }}
                                            >
                                                <span className="text-slate-400">{index + 1}</span>
                                                <span className="font-semibold text-slate-100">{gate.name}</span>
                                                <span
                                                    className={`status-badge ${
                                                        gate.status === FeatureGateStatus.Active ? 'status-badge--active' : 'status-badge--inactive'
                                                    }`}
                                                >
                                                    {gate.status.charAt(0).toUpperCase() + gate.status.slice(1)}
                                                </span>
                                                {openGateDetailId === gate.id && (
                                                    <div
                                                        className={`gate-tooltip ${gateTooltipSide === 'right' ? 'gate-tooltip--right' : ''}`}
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <div className="gate-tooltip-header">
                                                            <span className="text-sm font-semibold text-slate-100">Feature Gate</span>
                                                            <button
                                                                type="button"
                                                                className="icon-action"
                                                                onClick={() => setOpenGateDetailId(null)}
                                                                aria-label="Close"
                                                            >
                                                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className="gate-tooltip-body">
                                                            <div>
                                                                <div className="label">Name</div>
                                                                <div className="text-slate-100">{gate.name}</div>
                                                            </div>
                                                            <div>
                                                                <div className="label">Status</div>
                                                                <div
                                                                    className={`status-badge ${
                                                                        gate.status === FeatureGateStatus.Active
                                                                            ? 'status-badge--active'
                                                                            : 'status-badge--inactive'
                                                                    }`}
                                                                >
                                                                    {gate.status.charAt(0).toUpperCase() + gate.status.slice(1)}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="label">Description</div>
                                                                <div className="text-slate-100">{gate.description || '—'}</div>
                                                            </div>
                                                            <div>
                                                                <div className="label">Rule</div>
                                                                <pre className="input font-mono text-xs whitespace-pre-wrap">{gate.rule}</pre>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div>
                                                                    <div className="label">Pass value</div>
                                                                    <div className="text-slate-100">{gate.pass_value ? 'True' : 'False'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="label">Default value</div>
                                                                    <div className="text-slate-100">{gate.default_value ? 'True' : 'False'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <datalist id="feature-flag-user-groups">
                {userGroups.map((group) => (
                    <option key={group.id} value={group.name} />
                ))}
            </datalist>
        </div>
    );
};
