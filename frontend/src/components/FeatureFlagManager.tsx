import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    CreateFeatureFlagRequest,
    CreateFeatureGateRequest,
    FeatureFlag,
    FeatureGate,
    FeatureFlagStatus,
    FeatureGateStatus,
} from '../types';
import { featureFlagApi, featureGateApi } from '../services/api';

const emptyFlag: CreateFeatureFlagRequest = {
    name: '',
    description: '',
    status: FeatureFlagStatus.Active,
    tags: [],
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
    const [flagForm, setFlagForm] = useState<CreateFeatureFlagRequest>({ ...emptyFlag });
    const [tagInput, setTagInput] = useState('');
    const [gateForm, setGateForm] = useState<CreateFeatureGateRequest>({ ...emptyGate });
    const [flagSort, setFlagSort] = useState<'asc' | 'desc'>('asc');

    const { data: flags = [], isLoading: flagsLoading } = useQuery({
        queryKey: ['featureFlags'],
        queryFn: async () => (await featureFlagApi.list()).data,
    });

    const { data: gates = [], isLoading: gatesLoading } = useQuery({
        queryKey: ['featureGates'],
        queryFn: async () => (await featureGateApi.list()).data,
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

    const sortedFlags = useMemo(() => {
        const data = [...flags];
        data.sort((a, b) => a.name.localeCompare(b.name));
        if (flagSort === 'desc') data.reverse();
        return data;
    }, [flags, flagSort]);

    const toggleFlagSort = () => {
        setFlagSort((prev) => (prev === 'asc' ? 'desc' : 'asc'));
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
                <div className="card animate-slide-up bg-slate-950/60">
                    <h3 className="mb-4">Create Feature Flag</h3>
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
                        <input
                            className="input"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                        />
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() =>
                                createFlag.mutate({
                                    ...flagForm,
                                    tags: tagInput
                                        .split(',')
                                        .map((tag) => tag.trim())
                                        .filter(Boolean),
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
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                    {flags.length === 0 ? (
                        <div className="card text-center">
                            <p className="text-slate-400">No feature flags yet. Create your first flag.</p>
                        </div>
                    ) : (
                        <div className="card overflow-hidden">
                            <div className="grid grid-cols-[48px_1.2fr_1fr_1fr_140px] gap-4 border-b border-slate-800/70 px-4 py-2 text-sm font-bold text-slate-300">
                                <span>#</span>
                                <button type="button" onClick={toggleFlagSort} className="flex items-center gap-2 text-left">
                                    Name
                                    <span className="text-xs">{flagSort === 'asc' ? '▲' : '▼'}</span>
                                </button>
                                <span>Status</span>
                                <span>Tags</span>
                                <span>Updated</span>
                            </div>
                            <div className="divide-y divide-slate-800/70">
                                {sortedFlags.map((flag, index) => (
                                    <button
                                        key={flag.id}
                                        onClick={() => {
                                            setSelectedFlag(flag);
                                            setGateForm({ ...emptyGate, flag_id: flag.id });
                                        }}
                                        className={`table-row grid w-full grid-cols-[48px_1.2fr_1fr_1fr_140px] gap-4 px-4 py-2 text-left text-sm leading-none text-slate-200 transition ${
                                            selectedFlag?.id === flag.id ? 'table-row-selected' : ''
                                        }`}
                                    >
                                        <span className="text-slate-400">{index + 1}</span>
                                        <span className="font-semibold text-slate-100">{flag.name}</span>
                                        <span
                                            className={
                                                flag.status === FeatureFlagStatus.Active ? 'text-emerald-300' : 'text-slate-400'
                                            }
                                        >
                                            {flag.status.charAt(0).toUpperCase() + flag.status.slice(1)}
                                        </span>
                                        <span className="text-slate-300">
                                            {(flag.tags || []).length === 0 ? '—' : flag.tags.join(', ')}
                                        </span>
                                        <span className="text-slate-400">
                                            {new Date(flag.updated_at).toLocaleDateString()}
                                        </span>
                                    </button>
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
                                <div className="card overflow-hidden">
                                    <div className="grid grid-cols-[48px_1.2fr_1fr_1fr_120px_120px] gap-3 border-b border-slate-800/70 px-4 py-2 text-sm font-bold text-slate-300">
                                        <span>#</span>
                                        <span>Name</span>
                                        <span>Status</span>
                                        <span>Rule</span>
                                        <span>Pass</span>
                                        <span>Default</span>
                                    </div>
                                    <div className="divide-y divide-slate-800/70">
                                        {selectedGates.map((gate, index) => (
                                            <div
                                                key={gate.id}
                                                className="table-row grid grid-cols-[48px_1.2fr_1fr_1fr_120px_120px] gap-3 px-4 py-2 text-sm leading-none text-slate-200"
                                            >
                                                <span className="text-slate-400">{index + 1}</span>
                                                <span className="font-semibold text-slate-100">{gate.name}</span>
                                                <span
                                                    className={
                                                        gate.status === FeatureGateStatus.Active ? 'text-emerald-300' : 'text-slate-400'
                                                    }
                                                >
                                                    {gate.status.charAt(0).toUpperCase() + gate.status.slice(1)}
                                                </span>
                                                <span className="truncate text-slate-400" title={gate.rule}>
                                                    {gate.rule}
                                                </span>
                                                <span className="text-slate-300">{gate.pass_value ? 'True' : 'False'}</span>
                                                <span className="text-slate-300">{gate.default_value ? 'True' : 'False'}</span>
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
    );
};
