import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentApi } from './services/api';
import { ExperimentCreator } from './components/ExperimentCreator';
import { ExperimentMonitor } from './components/ExperimentMonitor';
import { StatisticalDashboard } from './components/StatisticalDashboard';
import { UserGroupManager } from './components/UserGroupManager';
import { FlowStudio } from './components/FlowStudio';
import { FeatureFlagManager } from './components/FeatureFlagManager';
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
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [sortConfig, setSortConfig] = React.useState<{ key: 'name' | 'start_date'; direction: 'asc' | 'desc' }>({
        key: 'name',
        direction: 'asc',
    });

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

    const sortedExperiments = React.useMemo(() => {
        const data = [...experiments];
        if (sortConfig.key === 'name') {
            data.sort((a, b) => a.name.localeCompare(b.name));
        } else {
            data.sort((a, b) => {
                const aTime = a.start_date ? new Date(a.start_date).getTime() : Number.POSITIVE_INFINITY;
                const bTime = b.start_date ? new Date(b.start_date).getTime() : Number.POSITIVE_INFINITY;
                return aTime - bTime;
            });
        }
        if (sortConfig.direction === 'desc') {
            data.reverse();
        }
        return data;
    }, [experiments, sortConfig]);

    const toggleSort = (key: 'name' | 'start_date') => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

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
        onSuccess: (response) => {
            queryClient.setQueryData(['experiments'], (oldData: any) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return [response.data, ...existing];
            });
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
            ) : (
                <div className="card overflow-hidden">
                    <div className="grid grid-cols-[48px_1.4fr_1fr_120px_120px_120px_140px_140px_140px] gap-4 border-b border-slate-800/70 px-4 py-2 text-sm font-bold text-slate-300">
                        <span>#</span>
                        <button
                            type="button"
                            onClick={() => toggleSort('name')}
                            className="flex items-center gap-2 text-left"
                        >
                            Name
                            <span className="text-xs">
                                {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                            </span>
                        </button>
                        <span>Primary Metric</span>
                        <span>Gate</span>
                        <button
                            type="button"
                            onClick={() => toggleSort('start_date')}
                            className="flex items-center gap-2 text-left"
                        >
                            Start Date
                            <span className="text-xs">
                                {sortConfig.key === 'start_date' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                            </span>
                        </button>
                        <span>Owner</span>
                        <span>Variants</span>
                        <span>Status</span>
                        <span>Actions</span>
                    </div>
                    <div className="divide-y divide-slate-800/70">
                        {sortedExperiments.map((exp, index) => (
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
                                className="table-row grid grid-cols-[48px_1.4fr_1fr_120px_120px_120px_140px_140px_140px] gap-4 px-4 py-2 text-sm leading-none text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            >
                                <span className="text-slate-400">{index + 1}</span>
                                <div className="font-semibold text-slate-100">{exp.name}</div>
                                <span className="text-slate-300">{exp.primary_metric}</span>
                                <span className="text-slate-300">
                                    {exp.feature_gate_id ? (
                                        <span className="badge-info">Linked</span>
                                    ) : (
                                        '—'
                                    )}
                                </span>
                                <span className="text-slate-300">
                                    {exp.start_date ? new Date(exp.start_date).toLocaleDateString() : '—'}
                                </span>
                                <span className="text-slate-300">Unassigned</span>
                                <span className="text-slate-300">{exp.variants.length}</span>
                                <StatusBadge status={exp.status} format="title" />
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
            <Link to="/dashboard" className="inline-flex items-center text-cyan-300 hover:text-cyan-200">
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

function LandingPage() {
    return (
        <div className="landing-page">
            <header className="landing-header">
                <div className="landing-brand">
                    <span className="landing-brand-mark">Ex</span>
                    <div>
                        <div className="landing-brand-name">Expothesis</div>
                        <div className="landing-brand-tag">Experiment Intelligence</div>
                    </div>
                </div>
                <div className="landing-header-actions">
                    <a href="#platform" className="landing-link">
                        Platform
                    </a>
                    <Link to="/dashboard" className="btn-primary landing-cta">
                        Go to Dashboard
                    </Link>
                </div>
            </header>

            <section className="landing-hero">
                <div className="landing-hero-content">
                    <div className="landing-kicker">Futuristic Experiment Suite</div>
                    <h1 className="landing-title">
                        Map, simulate, and activate experiments as living systems.
                    </h1>
                    <p className="landing-subtitle">
                        Bring your product strategy to life with 3D flow orchestration, intelligent gates, and
                        real-time analytics that feel like an operations command center.
                    </p>
                    <div className="landing-hero-actions">
                        <Link to="/dashboard" className="btn-primary">
                            Open Dashboard
                        </Link>
                        <a href="#platform" className="btn-secondary">
                            Explore Platform
                        </a>
                    </div>
                    <div className="landing-metrics">
                        {[
                            { label: 'Flow Latency', value: '< 200ms' },
                            { label: 'Gate Accuracy', value: '99.98%' },
                            { label: 'Streaming Signals', value: '24/7' },
                        ].map((item) => (
                            <div key={item.label} className="landing-metric-card">
                                <p>{item.label}</p>
                                <span>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="landing-hero-visual">
                    <div className="landing-stack">
                        <svg className="landing-stack-lines" viewBox="0 0 420 520" fill="none">
                            <path d="M70 140 L210 250 L350 140" className="landing-line" />
                            <path d="M70 330 L210 440 L350 330" className="landing-line landing-line-alt" />
                        </svg>

                        <div className="landing-layer layer-top">
                            <div className="layer-header">
                                <span>Build Experience</span>
                                <div className="layer-chip">API</div>
                            </div>
                            <div className="layer-orbit">
                                {['Audience', 'Journey', 'Signals', 'Activation'].map((label) => (
                                    <div key={label} className="orbit-node">
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="layer-center">Experiment Flow</div>
                        </div>

                        <div className="landing-layer layer-mid">
                            <div className="layer-header">
                                <span>Process Intelligence Graph</span>
                                <div className="layer-chip">API</div>
                            </div>
                            <div className="layer-graph">
                                <div className="graph-node" />
                                <div className="graph-node" />
                                <div className="graph-node" />
                                <div className="graph-edge" />
                            </div>
                        </div>

                        <div className="landing-layer layer-core">
                            <div className="layer-header">
                                <span>Data Core</span>
                                <div className="layer-chip">API</div>
                            </div>
                            <div className="layer-grid">
                                {Array.from({ length: 24 }).map((_, idx) => (
                                    <span key={idx} className="grid-cell" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="platform" className="landing-section">
                <div className="landing-section-header">
                    <h2>Designed for experiment orchestration at scale</h2>
                    <p>
                        Inspired by modern execution intelligence platforms, Expothesis connects gates, experiments,
                        and analytics into a single control plane.
                    </p>
                </div>
                <div className="landing-grid">
                    {[
                        {
                            title: '3D Flow Studio',
                            body: 'Animate your experimentation pipelines with drag-and-drop sequencing, live simulation, and signal paths.',
                        },
                        {
                            title: 'Feature Gates + Experiments',
                            body: 'Coordinate rollouts, guardrails, and measurement in one place with intelligent gate logic.',
                        },
                        {
                            title: 'Realtime Insight Engine',
                            body: 'Stream metrics, Bayesian signals, and health checks with continuous analysis.',
                        },
                    ].map((item) => (
                        <div key={item.title} className="landing-feature-card">
                            <h3>{item.title}</h3>
                            <p>{item.body}</p>
                            <span className="landing-card-cta">Learn more →</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-section landing-section-bottom">
                <div className="landing-callout">
                    <div>
                        <h2>Command the lifecycle of every experiment.</h2>
                        <p>Step into the dashboard and launch your first flow.</p>
                    </div>
                    <Link to="/dashboard" className="btn-primary">
                        Enter Dashboard
                    </Link>
                </div>
            </section>
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
            to: '/dashboard',
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
        {
            to: '/feature-flags',
            label: 'Feature Flags',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v18m0-15h9l-2 3 2 3H5" />
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
            : location.pathname.startsWith('/feature-flags')
                ? 'Feature Flags'
            : location.pathname.startsWith('/dashboard')
                ? 'Experiment Dashboard'
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

    if (location.pathname === '/') {
        return <>{children}</>;
    }

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
                    <Link to="/dashboard" className="sidebar-brand">
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
                                item.to === '/dashboard'
                                    ? location.pathname === '/dashboard'
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
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/dashboard" element={<HomePage />} />
                        <Route path="/experiment/:id" element={<ExperimentDetailPage />} />
                        <Route path="/user-groups" element={<UserGroupManager />} />
                        <Route path="/flow-studio" element={<FlowStudio />} />
                        <Route path="/feature-flags" element={<FeatureFlagManager />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
