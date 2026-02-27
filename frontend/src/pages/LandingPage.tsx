import React from 'react';
import { Link } from 'react-router-dom';
import { ExpothesisTracker } from '../sdk/expothesis';

export function LandingPage() {
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
