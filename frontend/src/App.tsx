import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useLocation, useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { experimentApi } from './services/api';
import { ExperimentCreator } from './components/ExperimentCreator';
import { ExperimentMonitor } from './components/experiment/ExperimentMonitor';
import { StatisticalDashboard } from './components/StatisticalDashboard';
import { UserGroupManager } from './components/UserGroupManager';
import { SimulationStudio } from './components/SimulationStudio';
import { FeatureFlagManager } from './components/FeatureFlagManager';
import { SessionReplayPanel } from './components/SessionReplayPanel';
import { AnalyticsMonitoringDashboard } from './components/AnalyticsMonitoringDashboard';
import { HomeOverview } from './components/HomeOverview';
import { AiAssistHub } from './components/AiAssistHub';
import { TemplatesPlan } from './components/TemplatesPlan';
import { LoginPage, RegisterPage } from './components/AuthPages';
import { LoadingSpinner, StatusBadge } from './components/Common';
import { UserSettings } from './components/UserSettings';
import type { CreateExperimentRequest, Experiment } from './types';
import { ExpothesisTracker } from './sdk/expothesis';

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
            queryClient.setQueryData<Experiment[]>(['experiments'], (oldData) => {
                const existing = Array.isArray(oldData) ? oldData : [];
                return [response.data, ...existing];
            });
            setShowCreator(false);
        },
    });

    if (isLoading) return <LoadingSpinner fullHeight />;

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
                                            className="btn-secondary h-7 w-7 p-0"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                startMutation.mutate(exp.id);
                                            }}
                                            aria-label="Start experiment"
                                        >
                                            <svg viewBox="0 0 24 24" className="mx-auto h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5l11 7-11 7V5z" />
                                            </svg>
                                        </button>
                                    )}
                                    {exp.status === 'running' && (
                                        <button
                                            className="btn-secondary h-7 w-7 p-0 relative"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                pauseMutation.mutate(exp.id);
                                            }}
                                            aria-label="Pause experiment"
                                        >
                                            <span className="absolute inset-0 flex items-center justify-center">
                                                <span className="absolute h-6 w-6 animate-ping rounded-full bg-emerald-400/25"></span>
                                            </span>
                                            <svg viewBox="0 0 24 24" className="mx-auto h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6v12m4-12v12" />
                                            </svg>
                                        </button>
                                    )}
                                    {exp.status !== 'stopped' && (
                                        <button
                                            className="btn-secondary h-7 w-7 p-0"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                stopMutation.mutate(exp.id);
                                            }}
                                            aria-label="Stop experiment"
                                        >
                                            <svg viewBox="0 0 24 24" className="mx-auto h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
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
    const [useCuped, setUseCuped] = React.useState(false);

    const getMutationErrorMessage = (error: unknown) => {
        const err = error as { response?: { data?: { error?: string } }; message?: string };
        return err.response?.data?.error ?? err.message ?? 'Unknown error';
    };

    const { data: experiment, isLoading: expLoading } = useQuery({
        queryKey: ['experiment', id],
        queryFn: async () => {
            const response = await experimentApi.get(id!);
            return response.data;
        },
    });

    const { data: analysis, isLoading: analysisLoading } = useQuery({
        queryKey: ['analysis', id, useCuped],
        queryFn: async () => {
            const response = await experimentApi.getAnalysis(id!, useCuped);
            return response.data;
        },
        enabled: !!experiment,
        refetchInterval: (experiment?.status === 'running') ? 5000 : false,
    });

    const startMutation = useMutation({
        mutationFn: () => experimentApi.start(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
            queryClient.invalidateQueries({ queryKey: ['analysis', id] });
        },
        onError: (error: unknown) => {
            console.error('Failed to start experiment:', error);
            alert(`Failed to start experiment: ${getMutationErrorMessage(error)}`);
        }
    });

    const pauseMutation = useMutation({
        mutationFn: () => experimentApi.pause(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
        },
        onError: (error: unknown) => {
            console.error('Failed to pause experiment:', error);
            alert(`Failed to pause experiment: ${getMutationErrorMessage(error)}`);
        }
    });

    const stopMutation = useMutation({
        mutationFn: () => experimentApi.stop(id!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['experiment', id] });
            queryClient.invalidateQueries({ queryKey: ['analysis', id] });
        },
        onError: (error: unknown) => {
            console.error('Failed to stop experiment:', error);
            alert(`Failed to stop experiment: ${getMutationErrorMessage(error)}`);
        }
    });

    if (expLoading) return <LoadingSpinner fullHeight />;
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
                    isPolling={analysisLoading || (!!experiment && experiment.status === 'running')}
                    useCuped={useCuped}
                    onToggleCuped={setUseCuped}
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
    const trackerRef = React.useRef<ExpothesisTracker | null>(null);
    const trackerStarted = React.useRef(false);

    React.useEffect(() => {
        if (trackerStarted.current) {
            return;
        }
        trackerStarted.current = true;
        const tracker = new ExpothesisTracker({
            autoTrack: true,
            recordReplay: true,
            apiKey: import.meta.env.VITE_TRACKING_KEY,
            replayBatchSize: 40,
            replaySnapshotGraceMs: 5000,
            autoEndOnRouteChange: false,
            autoRestartOnRouteChange: false,
        });
        tracker.init();
        trackerRef.current = tracker;

        return () => {
            tracker.end();
            trackerStarted.current = false;
        };
    }, []);

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
                    {window.localStorage.getItem('expothesis-token') ? (
                        <Link to="/home" className="btn-primary landing-cta">
                            Open Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link to="/login" className="landing-link">
                                Log in
                            </Link>
                            <Link to="/register" className="btn-primary landing-cta">
                                Sign up
                            </Link>
                        </>
                    )}
                </div>
            </header>

            <section className="landing-hero">
                <div className="landing-hero-content">
                    <div className="landing-kicker">Futuristic Experiment Suite</div>
                    <h1 className="landing-title">
                        Map, simulate, and activate experiments as living systems.
                    </h1>
                    <p className="landing-subtitle">
                        Bring your product strategy to life with experimentation orchestration, intelligent gates, and
                        real-time analytics that feel like an operations command center.
                    </p>
                    <div className="landing-hero-actions">
                        {window.localStorage.getItem('expothesis-token') ? (
                            <Link to="/home" className="btn-primary">
                                Open Dashboard
                            </Link>
                        ) : (
                            <Link to="/register" className="btn-primary">
                                Get started
                            </Link>
                        )}
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
                            title: 'Simulation Studio',
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
                        <p>Step into the dashboard and launch your first simulation.</p>
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
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [isRailCollapsed, setIsRailCollapsed] = React.useState(false);
    const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');
    const navItems = [
        {
            to: '/home',
            label: 'Home',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l8-6 8 6V20a1 1 0 0 1-1 1h-4.5a.5.5 0 0 1-.5-.5V15a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v5.5a.5.5 0 0 1-.5.5H5a1 1 0 0 1-1-1v-9.5Z" />
                </svg>
            ),
        },
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
            to: '/insights',
            label: 'Insights',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5m5 14V9m5 10V7m5 12V11" />
                </svg>
            ),
        },
        {
            to: '/ai-assist',
            label: 'AI Assist',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m12.36 6.36-2.12-2.12M8.76 8.76 6.64 6.64m8.72 0-2.12 2.12M8.76 15.24 6.64 17.36" />
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
            to: '/simulation-studio',
            label: 'Simulation Studio',
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
        {
            to: '/sessions',
            label: 'Sessions',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
                </svg>
            ),
        },
        {
            to: '/templates',
            label: 'Templates/Plan',
            icon: (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 3h9l3 3v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 13h6M9 17h4" />
                </svg>
            ),
        },
    ];

    const pageTitle = location.pathname.startsWith('/experiment/')
        ? 'Experiment Control'
        : location.pathname.startsWith('/home')
            ? 'Home'
        : location.pathname.startsWith('/user-groups')
            ? 'User Segments'
            : location.pathname.startsWith('/simulation-studio')
                ? 'Simulation Studio'
            : location.pathname.startsWith('/feature-flags')
                ? 'Feature Flags'
            : location.pathname.startsWith('/sessions')
                ? 'Sessions'
            : location.pathname.startsWith('/templates')
                ? 'Templates/Plan'
            : location.pathname.startsWith('/insights')
                ? 'Insights'
            : location.pathname.startsWith('/settings')
                ? 'User Settings'
            : location.pathname.startsWith('/ai-assist')
                ? 'AI Assist'
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

    const authToken = window.localStorage.getItem('expothesis-token');
    const isPublicRoute = ['/', '/login', '/register'].includes(location.pathname);

    if (isPublicRoute) {
        return <>{children}</>;
    }

    if (!authToken && !isPublicRoute) {
        return <Navigate to="/login" replace />;
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
                    className={`sidebar relative fixed left-0 top-0 z-40 h-full transform transition-transform duration-300 md:sticky md:top-0 md:h-screen md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                        } ${isRailCollapsed ? 'sidebar-collapsed' : 'w-[260px]'}`}
                >
                    <button
                        className="sidebar-float-toggle"
                        onClick={() => setIsRailCollapsed((prev) => !prev)}
                        aria-label={isRailCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className={`h-4 w-4 transition-transform duration-300 ${isRailCollapsed ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-6 7 6 7" />
                        </svg>
                    </button>
                    <Link to="/home" className="sidebar-brand">
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
                                item.to === '/dashboard' || item.to === '/home'
                                    ? location.pathname === item.to
                                    : location.pathname.startsWith(item.to);
                            return (
                                <Link
                                    key={item.to}
                                    to={item.to}
                                    className={`sidebar-link group relative ${isActive ? 'sidebar-link-active' : ''}`}
                                    onClick={() => setIsSidebarOpen(false)}
                                    aria-label={item.label}
                                >
                                    <span className="text-cyan-200/80">{item.icon}</span>
                                    <span className={isRailCollapsed ? 'md:sr-only' : ''}>
                                        {item.label}
                                    </span>
                                    <span className="rail-tooltip" role="tooltip">
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-auto space-y-4">
                        <div className="panel">
                            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">System</p>
                            <p className="mt-2 text-sm text-slate-300">Realtime analytics</p>
                            <p className="text-xs text-slate-500">Streaming updates every 5s</p>
                        </div>
                        <div className="sidebar-actions">
                            <Link to="/settings" className="sidebar-link group relative">
                                <span className="text-cyan-200/80">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm8 5.5-1.7.3a6.7 6.7 0 0 1-.7 1.7l1 1.4-1.6 1.6-1.4-1a6.7 6.7 0 0 1-1.7.7L12 20l-2.3-1.7a6.7 6.7 0 0 1-1.7-.7l-1.4 1-1.6-1.6 1-1.4a6.7 6.7 0 0 1-.7-1.7L4 12l1.7-2.3a6.7 6.7 0 0 1 .7-1.7l-1-1.4L7 4.9l1.4 1a6.7 6.7 0 0 1 1.7-.7L12 4l2.3 1.7a6.7 6.7 0 0 1 1.7.7l1.4-1L19 7l-1 1.4a6.7 6.7 0 0 1 .7 1.7L20 12Z"
                                        />
                                    </svg>
                                </span>
                                <span className={isRailCollapsed ? 'md:sr-only' : ''}>User Settings</span>
                                <span className="rail-tooltip" role="tooltip">User Settings</span>
                            </Link>
                            <button
                                type="button"
                                className="sidebar-link group relative"
                                onClick={() => {
                                    window.localStorage.removeItem('expothesis-token');
                                    setIsSidebarOpen(false);
                                    navigate('/login');
                                }}
                                aria-label="Log out"
                            >
                                <span className="text-rose-300/80">
                                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 17l5-5-5-5" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3" />
                                    </svg>
                                </span>
                                <span className={isRailCollapsed ? 'md:sr-only' : ''}>Log out</span>
                                <span className="rail-tooltip" role="tooltip">Log out</span>
                            </button>
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
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/home" element={<HomeOverview />} />
                        <Route path="/dashboard" element={<HomePage />} />
                        <Route path="/experiment/:id" element={<ExperimentDetailPage />} />
                        <Route path="/user-groups" element={<UserGroupManager />} />
                        <Route path="/insights" element={<AnalyticsMonitoringDashboard />} />
                        <Route path="/ai-assist" element={<AiAssistHub />} />
                        <Route path="/simulation-studio" element={<SimulationStudio />} />
                        <Route path="/feature-flags" element={<FeatureFlagManager />} />
                        <Route path="/templates" element={<TemplatesPlan />} />
                        <Route path="/settings" element={<UserSettings />} />
                        <Route
                            path="/sessions"
                            element={
                                <div className="space-y-6">
                                    <div>
                                        <h1>Session Replay</h1>
                                        <p className="mt-1 text-slate-400">
                                            Review session replays, heatmaps, and live activity.
                                        </p>
                                    </div>
                                    <SessionReplayPanel />
                                </div>
                            }
                        />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

export default App;
