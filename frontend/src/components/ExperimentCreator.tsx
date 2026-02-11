import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CreateExperimentRequest, Hypothesis, Variant, MetricType } from '../types';
import { MetricType as MT } from '../types';
import { userGroupApi } from '../services/api';

interface ExperimentCreatorProps {
    onSubmit: (experiment: CreateExperimentRequest) => void;
    onCancel: () => void;
}

export const ExperimentCreator: React.FC<ExperimentCreatorProps> = ({ onSubmit, onCancel }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<CreateExperimentRequest>({
        name: '',
        description: '',
        hypothesis: {
            null_hypothesis: '',
            alternative_hypothesis: '',
            expected_effect_size: 0.05,
            metric_type: MT.Proportion,
            significance_level: 0.05,
            power: 0.8,
        },
        variants: [
            { name: 'Control', description: '', allocation_percent: 50, is_control: true },
            { name: 'Treatment', description: '', allocation_percent: 50, is_control: false },
        ],
        primary_metric: '',
        user_groups: [],
    });

    const { data: availableGroups = [] } = useQuery({
        queryKey: ['userGroups'],
        queryFn: async () => {
            const response = await userGroupApi.list();
            return response.data;
        },
    });

    const toggleUserGroup = (groupId: string) => {
        setFormData((prev: CreateExperimentRequest) => {
            const current = prev.user_groups || [];
            const next = current.includes(groupId)
                ? current.filter((id: string) => id !== groupId)
                : [...current, groupId];
            return { ...prev, user_groups: next };
        });
    };

    const updateField = (field: keyof CreateExperimentRequest, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const updateHypothesis = (field: keyof Hypothesis, value: any) => {
        setFormData((prev) => ({
            ...prev,
            hypothesis: { ...prev.hypothesis, [field]: value },
        }));
    };

    const updateVariant = (index: number, field: keyof Variant, value: any) => {
        setFormData((prev) => {
            const newVariants = [...prev.variants];
            newVariants[index] = { ...newVariants[index], [field]: value };
            return { ...prev, variants: newVariants };
        });
    };

    const addVariant = () => {
        const totalAllocation = formData.variants.reduce((sum, v) => sum + v.allocation_percent, 0);
        setFormData((prev) => ({
            ...prev,
            variants: [
                ...prev.variants,
                {
                    name: `Variant ${prev.variants.length + 1}`,
                    description: '',
                    allocation_percent: Math.max(0, 100 - totalAllocation),
                    is_control: false,
                },
            ],
        }));
    };

    const removeVariant = (index: number) => {
        if (formData.variants.length > 2) {
            setFormData((prev) => ({
                ...prev,
                variants: prev.variants.filter((_, i) => i !== index),
            }));
        }
    };

    const handleSubmit = () => {
        onSubmit(formData);
    };

    const renderStepIndicator = () => (
        <div className="mb-8 flex justify-between">
            {['Basic Info', 'Hypothesis', 'Variants', 'Review'].map((label, idx) => (
                <div key={idx} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                        <div
                            className={`flex h-10 w-10 items-center justify-center rounded-full ${step > idx + 1
                                ? 'bg-emerald-400 text-slate-900'
                                : step === idx + 1
                                    ? 'bg-cyan-400 text-slate-900'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                        >
                            {step > idx + 1 ? '✓' : idx + 1}
                        </div>
                        <span className="mt-2 text-sm font-medium text-slate-300">{label}</span>
                    </div>
                    {idx < 3 && (
                        <div className={`mx-4 h-1 flex-1 ${step > idx + 1 ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                    )}
                </div>
            ))}
        </div>
    );

    return (
        <div className="card max-w-4xl mx-auto animate-slide-up">
            <h2 className="mb-6">Create New Experiment</h2>

            {renderStepIndicator()}

            {/* Step 1: Basic Info */}
            {step === 1 && (
                <div className="space-y-4">
                    <div>
                        <label className="label">Experiment Name</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('name', e.target.value)}
                            placeholder="e.g., Homepage CTA Button Color Test"
                        />
                    </div>
                    <div>
                        <label className="label">Description</label>
                        <textarea
                            className="input"
                            rows={3}
                            value={formData.description}
                            onChange={(e) => updateField('description', e.target.value)}
                            placeholder="Describe what this experiment is testing"
                        />
                    </div>
                    <div>
                        <label className="label">Target User Groups</label>
                        {availableGroups.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {availableGroups.map((group) => (
                                    <button
                                        key={group.id}
                                        onClick={() => toggleUserGroup(group.id)}
                                        className={`p-2 text-sm border rounded-md transition-colors ${formData.user_groups?.includes(group.id)
                                            ? 'bg-cyan-500/10 border-cyan-400 text-cyan-200'
                                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-600'
                                            }`}
                                    >
                                        {group.name} ({group.size})
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic">No user groups available. Experiment will target all users by default.</p>
                        )}
                    </div>
                    <div>
                        <label className="label">Primary Metric</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.primary_metric}
                            onChange={(e) => updateField('primary_metric', e.target.value)}
                            placeholder="e.g., conversion_rate, average_order_value"
                        />
                    </div>
                </div>
            )}

            {/* Step 2: Hypothesis */}
            {step === 2 && (
                <div className="space-y-4">
                    <div>
                        <label className="label">Null Hypothesis (H₀)</label>
                        <textarea
                            className="input"
                            rows={2}
                            value={formData.hypothesis.null_hypothesis}
                            onChange={(e) => updateHypothesis('null_hypothesis', e.target.value)}
                            placeholder="e.g., The new button color has no effect on conversion rate"
                        />
                    </div>
                    <div>
                        <label className="label">Alternative Hypothesis (H₁)</label>
                        <textarea
                            className="input"
                            rows={2}
                            value={formData.hypothesis.alternative_hypothesis}
                            onChange={(e) => updateHypothesis('alternative_hypothesis', e.target.value)}
                            placeholder="e.g., The new button color increases conversion rate"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Metric Type</label>
                            <select
                                className="input"
                                value={formData.hypothesis.metric_type}
                                onChange={(e) => updateHypothesis('metric_type', e.target.value as MetricType)}
                            >
                                <option value={MT.Proportion}>Proportion (Conversion Rate)</option>
                                <option value={MT.Continuous}>Continuous (Average)</option>
                                <option value={MT.Count}>Count</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Expected Effect Size</label>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={formData.hypothesis.expected_effect_size}
                                onChange={(e) => updateHypothesis('expected_effect_size', parseFloat(e.target.value))}
                            />
                            <p className="mt-1 text-xs text-slate-500">Minimum detectable effect (e.g., 0.05 = 5%)</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Significance Level (α)</label>
                            <input
                                type="number"
                                step="0.01"
                                max="1"
                                className="input"
                                value={formData.hypothesis.significance_level}
                                onChange={(e) => updateHypothesis('significance_level', parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="label">Statistical Power (1-β)</label>
                            <input
                                type="number"
                                step="0.05"
                                max="1"
                                className="input"
                                value={formData.hypothesis.power}
                                onChange={(e) => updateHypothesis('power', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Variants */}
            {step === 3 && (
                <div className="space-y-4">
                    {formData.variants.map((variant, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h4 className="font-semibold text-slate-100">
                                    {variant.is_control && <span className="badge-info mr-2">Control</span>}
                                    Variant {idx + 1}
                                </h4>
                                {!variant.is_control && formData.variants.length > 2 && (
                                    <button
                                        onClick={() => removeVariant(idx)}
                                        className="text-rose-300 hover:text-rose-200"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="label">Name</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={variant.name}
                                        onChange={(e) => updateVariant(idx, 'name', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="label">Allocation %</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="input"
                                        value={variant.allocation_percent}
                                        onChange={(e) => updateVariant(idx, 'allocation_percent', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                            <div className="mt-2">
                                <label className="label">Description</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={variant.description}
                                    onChange={(e) => updateVariant(idx, 'description', e.target.value)}
                                    placeholder="Describe this variant"
                                />
                            </div>
                        </div>
                    ))}
                    <button onClick={addVariant} className="btn-secondary w-full">
                        + Add Variant
                    </button>
                    <div className="rounded-xl bg-cyan-500/10 p-3 border border-cyan-500/20">
                        <p className="text-sm text-cyan-200">
                            Total Allocation:{' '}
                            <span className="font-bold">
                                {formData.variants.reduce((sum, v) => sum + v.allocation_percent, 0).toFixed(1)}%
                            </span>
                            {formData.variants.reduce((sum, v) => sum + v.allocation_percent, 0) !== 100 && (
                                <span className="ml-2 text-amber-200">⚠ Must equal 100%</span>
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
                <div className="space-y-4">
                    <div className="card bg-slate-950/60">
                        <h3 className="mb-2">Experiment Summary</h3>
                        <p className="font-semibold text-slate-100">{formData.name}</p>
                        <p className="text-sm text-slate-400">{formData.description}</p>
                    </div>
                    <div className="card bg-slate-950/60">
                        <h3 className="mb-2">Hypothesis</h3>
                        <p className="text-sm">
                            <strong>H₀:</strong> {formData.hypothesis.null_hypothesis}
                        </p>
                        <p className="text-sm">
                            <strong>H₁:</strong> {formData.hypothesis.alternative_hypothesis}
                        </p>
                    </div>
                    <div className="card bg-slate-950/60">
                        <h3 className="mb-2">Variants ({formData.variants.length})</h3>
                        <ul className="space-y-1">
                            {formData.variants.map((v, idx) => (
                                <li key={idx} className="text-sm">
                                    {v.name} - {v.allocation_percent}% {v.is_control && '(Control)'}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex justify-between">
                {step > 1 ? (
                    <button onClick={() => setStep(step - 1)} className="btn-secondary">
                        ← Previous
                    </button>
                ) : (
                    <button onClick={onCancel} className="btn-secondary">
                        Cancel
                    </button>
                )}

                {step < 4 ? (
                    <button onClick={() => setStep(step + 1)} className="btn-primary">
                        Next →
                    </button>
                ) : (
                    <button onClick={handleSubmit} className="btn-success">
                        Create Experiment
                    </button>
                )}
            </div>
        </div>
    );
};
