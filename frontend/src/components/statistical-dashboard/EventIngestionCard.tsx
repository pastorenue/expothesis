import React from 'react';
import { eventApi } from '../../services/api';
import type { ExperimentAnalysis } from '../../types';
import { useQueryClient } from '@tanstack/react-query';

type EventIngestionCardProps = {
    experiment: ExperimentAnalysis['experiment'];
};

export const EventIngestionCard: React.FC<EventIngestionCardProps> = ({ experiment }) => {
    const queryClient = useQueryClient();

    return (
        <div className="card border-dashed border-2 border-slate-800/70 bg-slate-950/60">
            <h3 className="mb-4 text-slate-200">Test Event Ingestion</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label className="label">User ID</label>
                    <input type="text" className="input" id="test-user-id" placeholder="e.g. user123" />
                </div>
                <div>
                    <label className="label">Variant</label>
                    <select className="input" id="test-variant">
                        {experiment.variants.map((v) => (
                            <option key={v.name} value={v.name}>
                                {v.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label">Value</label>
                    <input type="number" className="input" id="test-value" defaultValue="1.0" step="0.1" />
                </div>
                <button
                    onClick={async () => {
                        const userId = (document.getElementById('test-user-id') as HTMLInputElement).value;
                        const variant = (document.getElementById('test-variant') as HTMLSelectElement).value;
                        const value = parseFloat((document.getElementById('test-value') as HTMLInputElement).value);

                        if (!userId) {
                            alert('Please enter a User ID');
                            return;
                        }

                        try {
                            await eventApi.ingest({
                                experiment_id: experiment.id,
                                user_id: userId,
                                variant: variant,
                                metric_name: experiment.primary_metric,
                                metric_value: value,
                            });
                            // Refresh analysis so graphs reflect the new event
                            queryClient.invalidateQueries({
                                predicate: (q) =>
                                    Array.isArray(q.queryKey) &&
                                    q.queryKey[0] === 'analysis' &&
                                    q.queryKey.includes(experiment.id),
                            });
                            queryClient.invalidateQueries({
                                predicate: (q) =>
                                    Array.isArray(q.queryKey) &&
                                    q.queryKey[0] === 'experiment' &&
                                    q.queryKey.includes(experiment.id),
                            });
                        } catch (e) {
                            console.error('Failed to ingest event', e);
                            alert('Failed to ingest event. Check console for details.');
                        }
                    }}
                    className="btn-primary w-full"
                >
                    Send Event
                </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
                💡 This form is for manual testing. In production, events would be sent via the Ingestion SDK.
            </p>
        </div>
    );
};
