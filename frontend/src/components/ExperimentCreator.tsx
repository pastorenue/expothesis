import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    CreateExperimentRequest,
    Hypothesis,
    Variant,
    MetricType,
    HealthCheck,
} from '../types';
import {
    MetricType as MT,
    ExperimentType,
    SamplingMethod,
    AnalysisEngine,
    HealthCheckDirection,
} from '../types';
import { userGroupApi, featureFlagApi, featureGateApi } from '../services/api';

interface ExperimentCreatorProps {
    onSubmit: (experiment: CreateExperimentRequest) => void;
    onCancel: () => void;
}

export const ExperimentCreator: React.FC<ExperimentCreatorProps> = ({ onSubmit, onCancel }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState<CreateExperimentRequest>({
        name: '',
        description: '',
        experiment_type: ExperimentType.AbTest,
        sampling_method: SamplingMethod.Hash,
        analysis_engine: AnalysisEngine.Frequentist,
        health_checks: [],
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

    const { data: featureFlags = [] } = useQuery({
        queryKey: ['featureFlags'],
        queryFn: async () => {
            const response = await featureFlagApi.list();
            return response.data;
        },
    });

    const { data: featureGates = [] } = useQuery({
        queryKey: ['featureGates'],
        queryFn: async () => {
            const response = await featureGateApi.list();
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

    const addHealthCheck = () => {
        setFormData((prev) => ({
            ...prev,
            health_checks: [
                ...(prev.health_checks || []),
                {
                    metric_name: '',
                    direction: HealthCheckDirection.AtLeast,
                    min: 0,
                    max: 1,
                } as HealthCheck,
            ],
        }));
    };

    const updateHealthCheck = (index: number, field: keyof HealthCheck, value: any) => {
        setFormData((prev) => {
            const current = prev.health_checks || [];
            const updated = [...current];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, health_checks: updated };
        });
    };

    const removeHealthCheck = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            health_checks: (prev.health_checks || []).filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = () => {
        onSubmit(formData);
    };

    const renderStepIndicator = () => (
        <div className="mb-8 flex justify-between">
            {['Basics', 'Hypothesis', 'Variants', 'Review'].map((label, idx) => (
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
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <label className="label">Experiment Type</label>
                            <select
                                className="input"
                                value={formData.experiment_type}
                                onChange={(e) => updateField('experiment_type', e.target.value as ExperimentType)}
                            >
                                <option value={ExperimentType.AbTest}>A/B Test</option>
                                <option value={ExperimentType.Multivariate}>Multivariate</option>
                                <option value={ExperimentType.FeatureGate}>Feature Gate</option>
                                <option value={ExperimentType.Holdout}>Holdout</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Sampling Method</label>
                            <select
                                className="input"
                                value={formData.sampling_method}
                                onChange={(e) => updateField('sampling_method', e.target.value as SamplingMethod)}
                            >
                                <option value={SamplingMethod.Hash}>Hash (Deterministic)</option>
                                <option value={SamplingMethod.Random}>Random</option>
                                <option value={SamplingMethod.Stratified}>Stratified</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Analysis Engine</label>
                            <select
                                className="input"
                                value={formData.analysis_engine}
                                onChange={(e) => updateField('analysis_engine', e.target.value as AnalysisEngine)}
                            >
                                <option value={AnalysisEngine.Frequentist}>Frequentist</option>
                                <option value={AnalysisEngine.Bayesian}>Bayesian</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="label">Feature Flag</label>
                            <select
                                className="input"
                                value={formData.feature_flag_id || ''}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        feature_flag_id: e.target.value || undefined,
                                        feature_gate_id: undefined,
                                    }))
                                }
                            >
                                <option value="">Not linked</option>
                                {featureFlags.map((flag) => (
                                    <option key={flag.id} value={flag.id}>
                                        {flag.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Feature Gate</label>
                            <select
                                className="input"
                                value={formData.feature_gate_id || ''}
                                onChange={(e) => updateField('feature_gate_id', e.target.value || undefined)}
                            >
                                <option value="">Not linked</option>
                                {featureGates
                                    .filter((gate) =>
                                        formData.feature_flag_id ? gate.flag_id === formData.feature_flag_id : true
                                    )
                                    .map((gate) => (
                                        <option key={gate.id} value={gate.id}>
                                            {gate.name}
                                        </option>
                                    ))}
                            </select>
                            <p className="mt-1 text-xs text-slate-500">Tie gates to feature flags for rollout control.</p>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-100">Health Checks</h4>
                            <button onClick={addHealthCheck} className="btn-secondary">
                                + Add Health Check
                            </button>
                        </div>
                        {(formData.health_checks || []).length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">No health checks configured.</p>
                        ) : (
                            <div className="mt-4 space-y-3">
                                {(formData.health_checks || []).map((check, idx) => (
                                    <div key={idx} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 md:grid-cols-[1.2fr_1fr_1fr_80px]">
                                        <input
                                            className="input"
                                            placeholder="Metric name"
                                            value={check.metric_name}
                                            onChange={(e) => updateHealthCheck(idx, 'metric_name', e.target.value)}
                                        />
                                        <select
                                            className="input"
                                            value={check.direction}
                                            onChange={(e) =>
                                                updateHealthCheck(idx, 'direction', e.target.value as HealthCheckDirection)
                                            }
                                        >
                                            <option value={HealthCheckDirection.AtLeast}>At least</option>
                                            <option value={HealthCheckDirection.AtMost}>At most</option>
                                            <option value={HealthCheckDirection.Between}>Between</option>
                                        </select>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                className="input"
                                                placeholder="Min"
                                                value={check.min ?? ''}
                                                onChange={(e) => updateHealthCheck(idx, 'min', e.target.value ? Number(e.target.value) : undefined)}
                                            />
                                            <input
                                                type="number"
                                                className="input"
                                                placeholder="Max"
                                                value={check.max ?? ''}
                                                onChange={(e) => updateHealthCheck(idx, 'max', e.target.value ? Number(e.target.value) : undefined)}
                                            />
                                        </div>
                                        <button onClick={() => removeHealthCheck(idx)} className="btn-danger">
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-300">
                            <span>Type: {formData.experiment_type}</span>
                            <span>Sampling: {formData.sampling_method}</span>
                            <span>Engine: {formData.analysis_engine}</span>
                            <span>Primary Metric: {formData.primary_metric || '—'}</span>
                        </div>
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
                    <div className="card bg-slate-950/60">
                        <h3 className="mb-2">Feature Gate Link</h3>
                        <p className="text-sm text-slate-300">
                            Flag: {featureFlags.find((flag) => flag.id === formData.feature_flag_id)?.name || 'None'}
                        </p>
                        <p className="text-sm text-slate-300">
                            Gate: {featureGates.find((gate) => gate.id === formData.feature_gate_id)?.name || 'None'}
                        </p>
                    </div>
                    <div className="card bg-slate-950/60">
                        <h3 className="mb-2">Health Checks</h3>
                        {(formData.health_checks || []).length === 0 ? (
                            <p className="text-sm text-slate-500">No health checks configured.</p>
                        ) : (
                            <ul className="space-y-1 text-sm text-slate-300">
                                {(formData.health_checks || []).map((check, idx) => (
                                    <li key={idx}>
                                        {check.metric_name || 'Metric'} ({check.direction}) {check.min ?? '—'} - {check.max ?? '—'}
                                    </li>
                                ))}
                            </ul>
                        )}
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
