
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserGroup } from '../types';
import { userGroupApi } from '../services/api';

export const UserGroupManager: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [rulePrompt, setRulePrompt] = useState('');
    const [editRulePrompt, setEditRulePrompt] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        assignment_rule: 'random',
    });
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        assignment_rule: 'random',
    });

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ['userGroups'],
        queryFn: async () => {
            const response = await userGroupApi.list();
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: userGroupApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userGroups'] });
            setShowCreateForm(false);
            setFormData({ name: '', description: '', assignment_rule: 'random' });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: typeof editForm }) => {
            const response = await userGroupApi.update(id, data);
            return response.data;
        },
        onSuccess: (group) => {
            queryClient.setQueryData(['userGroups'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return existing.map((item: UserGroup) => (item.id === group.id ? group : item));
            });
            setSelectedGroup(group);
            setIsEditing(false);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await userGroupApi.delete(id);
            return id;
        },
        onSuccess: (id) => {
            queryClient.setQueryData(['userGroups'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return existing.filter((item: UserGroup) => item.id !== id);
            });
            if (selectedGroup?.id === id) {
                setSelectedGroup(null);
            }
            setIsEditing(false);
        },
    });

    const handleCreate = () => {
        createMutation.mutate(formData);
    };

    const buildRuleFromText = (text: string) => {
        const normalized = text.trim().toLowerCase();
        const conditions: any[] = [];

        const countryMatch = normalized.match(/country\s*(is|=)\s*([a-z]+)/i);
        if (countryMatch) {
            conditions.push({ attribute: 'country', op: 'eq', value: countryMatch[2].toUpperCase() });
        }

        const emailMatch = normalized.match(/email\s*(ends with|domain)\s*(@?[a-z0-9.-]+)/i);
        if (emailMatch) {
            const domain = emailMatch[2].startsWith('@') ? emailMatch[2] : `@${emailMatch[2]}`;
            conditions.push({ attribute: 'email', op: 'regex', value: `.*\\${domain}$` });
        }

        const planMatch = normalized.match(/plan\s*(is|=)\s*([a-z0-9_-]+)/i);
        if (planMatch) {
            conditions.push({ attribute: 'plan', op: 'eq', value: planMatch[2] });
        }

        const regionMatch = normalized.match(/region\s*(is|=)\s*([a-z0-9_-]+)/i);
        if (regionMatch) {
            conditions.push({ attribute: 'region', op: 'eq', value: regionMatch[2] });
        }

        const ageMatch = normalized.match(/age\s*(>=|<=|>|<)\s*(\d+)/i);
        if (ageMatch) {
            conditions.push({ attribute: 'age', op: ageMatch[1], value: Number(ageMatch[2]) });
        }

        if (conditions.length === 0) {
            conditions.push({ attribute: 'attribute', op: 'eq', value: 'value' });
        }

        return JSON.stringify({ version: '1', conditions }, null, 2);
    };

    const handleUpdate = () => {
        if (!selectedGroup) return;
        updateMutation.mutate({
            id: selectedGroup.id,
            data: {
                name: editForm.name,
                description: editForm.description,
                assignment_rule: editForm.assignment_rule,
            },
        });
    };

    const handleDelete = (groupId: string) => {
        if (!window.confirm('Delete this user group? This cannot be undone.')) return;
        deleteMutation.mutate(groupId);
    };

    useEffect(() => {
        if (!selectedGroup) return;
        setEditForm({
            name: selectedGroup.name,
            description: selectedGroup.description,
            assignment_rule: selectedGroup.assignment_rule,
        });
    }, [selectedGroup]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-800 border-t-cyan-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2>User Groups</h2>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="btn-primary"
                >
                    + Create User Group
                </button>
            </div>

            {showCreateForm && (
                <div className="card animate-slide-up bg-slate-950/60">
                    <h3 className="mb-4">New User Group</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="label">Group Name</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Beta Users"
                            />
                        </div>
                        <div>
                            <label className="label">Description</label>
                            <textarea
                                className="input"
                                rows={2}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe this user group"
                            />
                        </div>
                        <div>
                            <label className="label">Assignment Mode</label>
                            <select
                                className="input"
                                value={formData.assignment_rule.startsWith('{') ? 'custom' : formData.assignment_rule}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'custom') {
                                        setFormData({ ...formData, assignment_rule: '{\n  "version": "1",\n  "conditions": []\n}' });
                                    } else {
                                        setFormData({ ...formData, assignment_rule: val });
                                    }
                                }}
                            >
                                <option value="random">Random Assignment</option>
                                <option value="hash">Hash-Based (Consistent)</option>
                                <option value="manual">Manual Assignment</option>
                                <option value="custom">Custom Rule (JSON)</option>
                            </select>
                        </div>
                        <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Rule Copilot</p>
                                <span className="badge-gray">Draft JSON</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-300">
                                Describe your targeting rule in plain language.
                            </p>
                            <div className="mt-3 flex flex-col gap-2">
                                <input
                                    type="text"
                                    className="input"
                                    value={rulePrompt}
                                    onChange={(e) => setRulePrompt(e.target.value)}
                                    placeholder="e.g., Country is US and plan is enterprise"
                                />
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setFormData({ ...formData, assignment_rule: buildRuleFromText(rulePrompt) })}
                                >
                                    Generate JSON Rule
                                </button>
                            </div>
                        </div>
                        {(formData.assignment_rule.startsWith('{') || formData.assignment_rule === 'custom') && (
                            <div>
                                <label className="label">Rule Definition (JSON)</label>
                                <textarea
                                    className="input font-mono text-sm"
                                    rows={6}
                                    value={formData.assignment_rule}
                                    onChange={(e) => setFormData({ ...formData, assignment_rule: e.target.value })}
                                    placeholder='{ "attribute": "email", "regex": ".*@google.com" }'
                                />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button onClick={handleCreate} className="btn-success">
                                Create Group
                            </button>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => (
                    <div
                        key={group.id}
                        className={`card cursor-pointer transition-all ${selectedGroup?.id === group.id ? 'ring-2 ring-cyan-400/70' : ''
                            } `}
                        onClick={() => setSelectedGroup(group)}
                    >
                        <h3 className="mb-2">{group.name}</h3>
                        <p className="mb-3 text-sm text-slate-400">{group.description}</p>
                        <div className="flex items-center justify-between soft-divider pt-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Users</p>
                                <p className="text-lg font-bold text-slate-100">{group.size.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Assignment</p>
                                <p className="badge-info text-xs">{group.assignment_rule}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedGroup && (
                <div className="card animate-fade-in">
                    <div className="flex items-center justify-between">
                        <h3>Selected Group: {selectedGroup.name}</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsEditing((prev) => !prev)}
                                className="btn-secondary"
                            >
                                {isEditing ? 'Close' : 'Edit'}
                            </button>
                            <button
                                onClick={() => handleDelete(selectedGroup.id)}
                                className="btn-danger"
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    {isEditing ? (
                        <div className="mt-4 space-y-3">
                            <div>
                                <label className="label">Group Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Description</label>
                                <textarea
                                    className="input"
                                    rows={2}
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Assignment Mode</label>
                                <select
                                    className="input"
                                    value={editForm.assignment_rule.startsWith('{') ? 'custom' : editForm.assignment_rule}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === 'custom') {
                                            setEditForm({ ...editForm, assignment_rule: '{\n  "version": "1",\n  "conditions": []\n}' });
                                        } else {
                                            setEditForm({ ...editForm, assignment_rule: val });
                                        }
                                    }}
                                >
                                    <option value="random">Random Assignment</option>
                                    <option value="hash">Hash-Based (Consistent)</option>
                                    <option value="manual">Manual Assignment</option>
                                    <option value="custom">Custom Rule (JSON)</option>
                                </select>
                            </div>
                            <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Rule Copilot</p>
                                    <span className="badge-gray">Draft JSON</span>
                                </div>
                                <p className="mt-2 text-sm text-slate-300">
                                    Describe your targeting rule in plain language.
                                </p>
                                <div className="mt-3 flex flex-col gap-2">
                                    <input
                                        type="text"
                                        className="input"
                                        value={editRulePrompt}
                                        onChange={(e) => setEditRulePrompt(e.target.value)}
                                        placeholder="e.g., Email ends with @example.com"
                                    />
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => setEditForm({ ...editForm, assignment_rule: buildRuleFromText(editRulePrompt) })}
                                    >
                                        Generate JSON Rule
                                    </button>
                                </div>
                            </div>
                            {(editForm.assignment_rule.startsWith('{') || editForm.assignment_rule === 'custom') && (
                                <div>
                                    <label className="label">Rule Definition (JSON)</label>
                                    <textarea
                                        className="input font-mono text-sm"
                                        rows={6}
                                        value={editForm.assignment_rule}
                                        onChange={(e) => setEditForm({ ...editForm, assignment_rule: e.target.value })}
                                    />
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={handleUpdate} className="btn-success">
                                    Save Changes
                                </button>
                                <button onClick={() => setIsEditing(false)} className="btn-secondary">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="mb-4 text-slate-300">{selectedGroup.description}</p>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-slate-400">Total Users</p>
                                    <p className="text-2xl font-bold text-slate-100">
                                        {selectedGroup.size.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Created</p>
                                    <p className="font-medium text-slate-100">
                                        {new Date(selectedGroup.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-400">Assignment Rule</p>
                                    <p className="font-medium text-slate-100">{selectedGroup.assignment_rule}</p>
                                </div>
                            </div>
                            <div className="mt-4">
                                <p className="mb-2 text-sm font-medium text-slate-400">
                                    💡 Drag this group to move it between experiments (feature coming soon)
                                </p>
                            </div>
                        </>
                    )}
                </div>
            )}

            {groups.length === 0 && !showCreateForm && (
                <div className="card text-center">
                    <p className="text-slate-400">No user groups yet. Create your first group to get started!</p>
                </div>
            )}
        </div>
    );
};
