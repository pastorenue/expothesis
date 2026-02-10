import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentApi } from './services/api';
import { ExperimentCreator } from './components/ExperimentCreator';
import { ExperimentMonitor } from './components/ExperimentMonitor';
import { StatisticalDashboard } from './components/StatisticalDashboard';
import { UserGroupManager } from './components/UserGroupManager';
import { LoadingSpinner, StatusBadge } from './components/Common';
import type { CreateExperimentRequest } from './types';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

function HomePage() {
    const [showCreator, setShowCreator] = React.useState(false);
    const queryClient = useQueryClient();

    const { data: experiments = [], isLoading } = useQuery({
        queryKey: ['experiments'],
        queryFn: async () => {
            const response = await experimentApi.list();
            return response.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: CreateExperimentRequest) => experimentApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiments'] });
            setShowCreator(false);
        },
    });

    if (isLoading) return <LoadingSpinner />;

    if (showCreator) {
        return (
            <ExperimentCreator
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setShowCreator(false)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1>Experiments</h1>
                    <p className="mt-1 text-gray-600">Manage and analyze your A/B tests</p>
                </div>
                <button onClick={() => setShowCreator(true)} className="btn-primary">
                    + New Experiment
                </button>
            </div>

            {experiments.length === 0 ? (
                <div className="card bg-gradient-to-br from-primary-50 to-blue-50 text-center">
                    <h2 className="mb-2">Welcome to Expothesis</h2>
                    <p className="mb-4 text-gray-600">
                        Create your first experiment to start testing hypotheses and analyzing results
                    </p>
                    <button onClick={() => setShowCreator(true)} className="btn-primary">
                        Create First Experiment
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {experiments.map((exp) => (
                        <Link key={exp.id} to={`/experiment/${exp.id}`} className="block">
                            <div className="card hover:shadow-xl transition-shadow">
                                <div className="mb-3 flex items-start justify-between">
                                    <h3>{exp.name}</h3>
                                    <StatusBadge status={exp.status} />
                                </div>
                                <p className="mb-3 text-sm text-gray-600">{exp.description}</p>
                                <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3">
                                    <div>
                                        <p className="text-xs text-gray-500">Primary Metric</p>
                                        <p className="font-medium text-gray-900">{exp.primary_metric}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Variants</p>
                                        <p className="font-medium text-gray-900">{exp.variants.length}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}

function ExperimentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();

    const { data: experiment, isLoading: expLoading } = useQuery({
        queryKey: ['experiment', id],
        queryFn: async () => {
            const response = await experimentApi.get(id!);
            return response.data;
        },
    });

    const { data: analysis, isLoading: analysisLoading } = useQuery({
        queryKey: ['analysis', id],
        queryFn: async () => {
            const response = await experimentApi.getAnalysis(id!);
            return response.data;
        },
        enabled: !!experiment && experiment.status === 'running',
        refetchInterval: 5000, // Poll every 5 seconds when running
    });

    const startMutation = useMutation({
        mutationFn: () => experimentApi.start(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
            queryClient.invalidateQueries({ queryKey: ['analysis', id] });
        },
        onError: (error: any) => {
            console.error('Failed to start experiment:', error);
            alert(`Failed to start experiment: ${error.response?.data?.error || error.message}`);
        }
    });

    const pauseMutation = useMutation({
        mutationFn: () => experimentApi.pause(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
        },
        onError: (error: any) => {
            console.error('Failed to pause experiment:', error);
            alert(`Failed to pause experiment: ${error.response?.data?.error || error.message}`);
        }
    });

    const stopMutation = useMutation({
        mutationFn: () => experimentApi.stop(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
            queryClient.invalidateQueries({ queryKey: ['analysis', id] });
        },
        onError: (error: any) => {
            console.error('Failed to stop experiment:', error);
            alert(`Failed to stop experiment: ${error.response?.data?.error || error.message}`);
        }
    });

    if (expLoading) return <LoadingSpinner />;
    if (!experiment) return <div>Experiment not found</div>;

    return (
        <div className="space-y-6">
            <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700">
                ← Back to Experiments
            </Link>

            <ExperimentMonitor
                experiment={experiment}
                onStart={() => startMutation.mutate()}
                onPause={() => pauseMutation.mutate()}
                onStop={() => stopMutation.mutate()}
                isLoading={startMutation.isPending || pauseMutation.isPending || stopMutation.isPending}
            />

            {analysisLoading && <LoadingSpinner />}
            {analysis && (
                <StatisticalDashboard
                    analysis={analysis}
                    isPolling={analysisLoading || !!experiment && experiment.status === 'running'}
                />
            )}

            {experiment.status === 'draft' && (
                <div className="card bg-primary-50">
                    <p className="text-primary-800">
                        ℹ️ Start the experiment to begin collecting data and viewing analysis results.
                    </p>
                </div>
            )}
        </div>
    );
}

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <nav className="border-b border-gray-200 bg-white shadow-sm">
                <div className="container mx-auto px-4">
                    <div className="flex h-16 items-center justify-between">
                        <Link to="/" className="flex items-center space-x-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white text-xl font-bold">
                                Ex
                            </div>
                            <span className="text-2xl font-bold text-gray-900">Expothesis</span>
                        </Link>
                        <div className="flex space-x-4">
                            <Link to="/" className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium">
                                Experiments
                            </Link>
                            <Link to="/user-groups" className="px-4 py-2 text-gray-700 hover:text-primary-600 font-medium">
                                User Groups
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="container mx-auto px-4 py-8">{children}</main>
        </div>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/experiment/:id" element={<ExperimentDetailPage />} />
                        <Route path="/user-groups" element={<UserGroupManager />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
