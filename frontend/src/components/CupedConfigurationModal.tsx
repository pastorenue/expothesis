import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentApi } from '../services/api';
import { LoadingSpinner } from './Common';
import type { CupedConfigRequest } from '../types';

interface CupedConfigurationModalProps {
    experimentId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const CupedConfigurationModal: React.FC<CupedConfigurationModalProps> = ({
    experimentId,
    isOpen,
    onClose,
}) => {
    const queryClient = useQueryClient();
    const [covariate, setCovariate] = React.useState('pre_experiment_value');
    const [lookbackDays, setLookbackDays] = React.useState(14);
    const [minSample, setMinSample] = React.useState(100);

    const { data: config, isLoading } = useQuery({
        queryKey: ['cupedConfig', experimentId],
        queryFn: async () => {
            try {
                const response = await experimentApi.getCupedConfig(experimentId);
                return response.data;
            } catch (e) {
                return null; // config doesn't exist yet
            }
        },
        enabled: isOpen,
    });

    React.useEffect(() => {
        if (config) {
            setCovariate(config.covariate_metric);
            setLookbackDays(config.lookback_days);
            setMinSample(config.min_sample_size);
        }
    }, [config]);

    const saveMutation = useMutation({
        mutationFn: (data: CupedConfigRequest) => experimentApi.saveCupedConfig(experimentId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cupedConfig', experimentId] });
            queryClient.invalidateQueries({ queryKey: ['analysis', experimentId] }); // Refresh analysis if using CUPED
            onClose();
        },
        onError: (error: unknown) => {
            const err = error as { response?: { data?: { error?: string } }; message?: string };
            alert(`Failed to save CUPED config: ${err?.response?.data?.error || err?.message || 'Unknown error'}`);
        }
    });

    const handleSave = () => {
        saveMutation.mutate({
            covariate_metric: covariate,
            lookback_days: lookbackDays,
            min_sample_size: minSample,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-100">Configure CUPED</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {isLoading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="label">Covariate Metric</label>
                            <input
                                type="text"
                                className="input"
                                value={covariate}
                                onChange={(e) => setCovariate(e.target.value)}
                                placeholder="e.g. pre_experiment_spend"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                This metric should be highly correlated with your primary metric but measured *before* the experiment started.
                            </p>
                        </div>

                        <div>
                            <label className="label">Lookback Window (Days)</label>
                            <input
                                type="number"
                                className="input"
                                value={lookbackDays}
                                onChange={(e) => setLookbackDays(parseInt(e.target.value) || 0)}
                                min="1"
                                max="365"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                How many days prior to the start date should be included for the covariate calculation.
                            </p>
                        </div>

                        <div>
                            <label className="label">Minimum Sample Size</label>
                            <input
                                type="number"
                                className="input"
                                value={minSample}
                                onChange={(e) => setMinSample(parseInt(e.target.value) || 0)}
                                min="100"
                            />
                            <p className="mt-1 text-xs text-slate-500">
                                Minimum number of matched users required to perform CUPED adjustment.
                            </p>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button onClick={onClose} className="btn-secondary">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="btn-primary"
                                disabled={saveMutation.isPending}
                            >
                                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
