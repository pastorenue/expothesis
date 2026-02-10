import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentApi } from './services/api';
import { ExperimentCreator } from './components/ExperimentCreator';
import { ExperimentMonitor } from './components/ExperimentMonitor';
import { StatisticalDashboard } from './components/StatisticalDashboard';
import { UserGroupManager } from './components/UserGroupManager';
import { FlowStudio } from './components/FlowStudio';
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
    const [viewMode, setViewMode] = React.useState<'cards' | 'table'>('cards');
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    React.useEffect(() => {
        if (searchParams.get('new') === '1') {
            setShowCreator(true);
        }
    }, [searchParams]);

    const { data: experiments = [], isLoading } = useQuery({
        queryKey: ['experiments'],
        queryFn: async () => {
            const response = await experimentApi.list();
            return response.data;
        },
    });

    const startMutation = useMutation({
        mutationFn: (id: string) => experimentApi.start(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiments'] });
        },
    });

    const pauseMutation = useMutation({
        mutationFn: (id: string) => experimentApi.pause(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiments'] });
        },
    });

    const stopMutation = useMutation({
        mutationFn: (id: string) => experimentApi.stop(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiments'] });
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
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1>Experiments</h1>
                    <p className="mt-1 text-slate-400">Manage and analyze your A/B tests in real time.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex rounded-xl border border-slate-800/80 bg-slate-950/50 p-1">
                        <button
                            className={`px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${viewMode === 'cards'
                                ? 'rounded-lg bg-slate-800 text-slate-100'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                            onClick={() => setViewMode('cards')}
                        >
                            Cards
                        </button>
                        <button
                            className={`px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition ${viewMode === 'table'
                                ? 'rounded-lg bg-slate-800 text-slate-100'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                            onClick={() => setViewMode('table')}
                        >
                            Table
                        </button>
                    </div>
                    <button onClick={() => setShowCreator(true)} className="btn-primary">
                        + New
                    </button>
                </div>
            </div>

            {experiments.length === 0 ? (
                <div className="card text-center">
                    <h2 className="mb-2">Welcome to Expothesis</h2>
                    <p className="mb-4 text-slate-400">
                        Create your first experiment to start testing hypotheses and analyzing results
                    </p>
                    <button onClick={() => setShowCreator(true)} className="btn-primary">
                        Create First Experiment
                    </button>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {experiments.map((exp) => (
                        <Link key={exp.id} to={`/experiment/${exp.id}`} className="block">
                            <div className="card hover:border-slate-700/80 transition-shadow">
                                <div className="mb-3 flex items-start justify-between">
                                    <h3>{exp.name}</h3>
                                    <StatusBadge status={exp.status} />
                                </div>
                                <p className="mb-3 text-sm text-slate-400">{exp.description}</p>
                                <div className="grid grid-cols-2 gap-3 soft-divider pt-3">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Primary Metric</p>
                                        <p className="font-medium text-slate-100">{exp.primary_metric}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Variants</p>
                                        <p className="font-medium text-slate-100">{exp.variants.length}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <div className="grid grid-cols-[1.4fr_1fr_140px_120px_140px] gap-4 border-b border-slate-800/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        <span>Name</span>
                        <span>Primary Metric</span>
                        <span>Variants</span>
                        <span>Status</span>
                        <span>Actions</span>
                    </div>
                    <div className="divide-y divide-slate-800/70">
                        {experiments.map((exp) => (
                            <div
                                key={exp.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => navigate(`/experiment/${exp.id}`)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        navigate(`/experiment/${exp.id}`);
                                    }
                                }}
                                className="grid grid-cols-[1.4fr_1fr_140px_120px_140px] gap-4 px-4 py-4 text-sm text-slate-200 transition hover:bg-slate-900/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            >
                                <div>
                                    <div className="font-semibold text-slate-100">{exp.name}</div>
                                    <div className="text-xs text-slate-500">{exp.description}</div>
                                </div>
                                <span className="text-slate-300">{exp.primary_metric}</span>
                                <span className="text-slate-300">{exp.variants.length}</span>
                                <StatusBadge status={exp.status} />
                                <div className="flex items-center gap-2">
                                    {(exp.status === 'draft' || exp.status === 'paused') && (
                                        <button
                                            className="btn-secondary h-9 w-9 p-0"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                startMutation.mutate(exp.id);
                                            }}
                                            aria-label="Start experiment"
                                        >
                                            <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5l11 7-11 7V5z" />
                                            </svg>
                                        </button>
                                    )}
                                    {exp.status === 'running' && (
                                        <button
                                            className="btn-secondary h-9 w-9 p-0 relative"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                pauseMutation.mutate(exp.id);
                                            }}
                                            aria-label="Pause experiment"
                                        >
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <span className="absolute h-6 w-6 animate-ping rounded-full bg-emerald-400/25"></span>
                                            </span>
                                            <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v12m4-12v12" />
                                            </svg>
                                        </button>
                                    )}
                                    {exp.status !== 'stopped' && (
                                        <button
                                            className="btn-secondary h-9 w-9 p-0"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                stopMutation.mutate(exp.id);
                                            }}
                                            aria-label="Stop experiment"
                                        >
                                            <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="6" y="6" width="12" height="12" rx="1.5" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
            <Link to="/" className="inline-flex items-center text-cyan-300 hover:text-cyan-200">
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
                <div className="card">
                    <p className="text-slate-300">
                        ℹ️ Start the experiment to begin collecting data and viewing analysis results.
                    </p>
                </div>
            )}
        </div>
    );
}

function Layout({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [isRailCollapsed, setIsRailCollapsed] = React.useState(false);
    const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');
    const navItems = [
        {
            to: '/',
            label: 'Experiments',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h10M4 12h16M4 17h7" />
                </svg>
            ),
        },
        {
            to: '/user-groups',
            label: 'User Groups',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 4c-3 0-5 1.5-5 3v1h10v-1c0-1.5-2-3-5-3Zm8 0c-1 0-2 .2-3 .6a4.4 4.4 0 0 1 2 3.4v1h7v-1c0-1.5-2-3-6-3Z" />
                </svg>
            ),
        },
        {
            to: '/flow-studio',
            label: 'Flow Studio',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h6v6H6zM12 12h6v6h-6zM12 6h6v6h-6zM6 12h6v6H6z" />
                </svg>
            ),
        },
    ];

    const pageTitle = location.pathname.startsWith('/experiment/')
        ? 'Experiment Control'
        : location.pathname.startsWith('/user-groups')
            ? 'User Segments'
            : location.pathname.startsWith('/flow-studio')
                ? 'Flow Studio'
            : 'Experiment Dashboard';

    React.useEffect(() => {
        const saved = window.localStorage.getItem('expothesis-theme');
        if (saved === 'light' || saved === 'dark') {
            setTheme(saved);
        }
    }, []);

    React.useEffect(() => {
        document.documentElement.classList.toggle('theme-light', theme === 'light');
        window.localStorage.setItem('expothesis-theme', theme);
    }, [theme]);

    return (
        <div className="app-shell">
            <div className={`app-grid ${isRailCollapsed ? 'app-grid-rail' : ''}`}>
                {isSidebarOpen && (
                    <button
                        aria-label="Close navigation"
                        className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                )}
                <aside
                    className={`sidebar fixed left-0 top-0 z-40 h-full transform transition-transform duration-300 md:static md:h-auto md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                        } ${isRailCollapsed ? 'sidebar-collapsed' : 'w-[260px]'}`}
                >
                    <Link to="/" className="sidebar-brand">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-900 font-bold">
                            Ex
                        </div>
                        <div>
                            <div className="text-lg font-semibold">Expothesis</div>
                            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Labs</div>
                        </div>
                    </Link>

                    <div className="sidebar-pill">Experiment Suite</div>

                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const isActive =
                                item.to === '/'
                                    ? location.pathname === '/'
                                    : location.pathname.startsWith(item.to);
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`sidebar-link group relative ${isActive ? 'sidebar-link-active' : ''}`}
                                    onClick={() => setIsSidebarOpen(false)}
                                >
                                    <span className="text-cyan-200/80">{item.icon}</span>
                                    <span className={isRailCollapsed ? 'md:sr-only' : ''}>
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-auto space-y-4">
                        <button
                            className="btn-secondary hidden w-full items-center justify-center md:flex"
                            onClick={() => setIsRailCollapsed((prev) => !prev)}
                            aria-label={isRailCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d={isRailCollapsed ? 'M9 5l6 7-6 7' : 'M15 5l-6 7 6 7'}
                                />
                            </svg>
                        </button>
                        <div className="panel">
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">System</p>
                            <p className="mt-2 text-sm text-slate-300">Realtime analytics</p>
                            <p className="text-xs text-slate-500">Streaming updates every 5s</p>
                        </div>

                    </div>
                </aside>

                <div className="flex min-h-screen flex-col">
                    <header className="topbar">
                        <div className="flex items-center gap-3">
                            <button
                                className="btn-secondary h-10 w-10 p-0 md:hidden"
                                aria-label="Open navigation"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
                                </svg>
                            </button>
                            <div>
                            <div className="topbar-meta">Status</div>
                            <div className="topbar-title">{pageTitle}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                className="btn-secondary h-10 w-10 p-0"
                                aria-label="Toggle dark mode"
                                onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                            >
                                {theme === 'dark' ? (
                                    <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.36 6.36-1.41-1.41M8.05 8.05 6.64 6.64m10.72 0-1.41 1.41M8.05 15.95l-1.41 1.41"
                                        />
                                        <circle cx="12" cy="12" r="4" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
                                        />
                                    </svg>
                                )}
                            </button>
                            <div className="meta-chip">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80"></span>
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
                                </span>
                                Live stream
                            </div>
                            <div className="meta-chip">
                                <span className="h-2 w-2 rounded-full bg-cyan-400"></span>
                                5s refresh
                            </div>
                        </div>
                    </header>
                    <main className="px-8 py-8">{children}</main>
                </div>
            </div>
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
                        <Route path="/flow-studio" element={<FlowStudio />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
