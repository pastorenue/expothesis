
import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserGroup } from '../types';
import { userGroupApi } from '../services/api';

export const UserGroupManager: React.FC = () => {
    const queryClient = useQueryClient();
    const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formData, setFormData] = useState({
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

    const handleCreate = () => {
        createMutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
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
                <div className="card animate-slide-up bg-primary-50">
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
                        className={`card cursor - pointer transition - all ${selectedGroup?.id === group.id ? 'ring-2 ring-primary-600' : ''
                            } `}
                        onClick={() => setSelectedGroup(group)}
                    >
                        <h3 className="mb-2">{group.name}</h3>
                        <p className="mb-3 text-sm text-gray-600">{group.description}</p>
                        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                            <div>
                                <p className="text-sm text-gray-500">Users</p>
                                <p className="text-lg font-bold text-gray-900">{group.size.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Assignment</p>
                                <p className="badge-info text-xs">{group.assignment_rule}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedGroup && (
                <div className="card animate-fade-in bg-gradient-to-r from-primary-50 to-blue-50">
                    <h3 className="mb-3">Selected Group: {selectedGroup.name}</h3>
                    <p className="mb-4 text-gray-700">{selectedGroup.description}</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-gray-600">Total Users</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {selectedGroup.size.toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Created</p>
                            <p className="font-medium text-gray-900">
                                {new Date(selectedGroup.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Assignment Rule</p>
                            <p className="font-medium text-gray-900">{selectedGroup.assignment_rule}</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="mb-2 text-sm font-medium text-gray-700">
                            💡 Drag this group to move it between experiments (feature coming soon)
                        </p>
                    </div>
                </div>
            )}

            {groups.length === 0 && !showCreateForm && (
                <div className="card bg-gray-50 text-center">
                    <p className="text-gray-600">No user groups yet. Create your first group to get started!</p>
                </div>
            )}
        </div>
    );
};
