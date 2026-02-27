import { Link } from 'react-router-dom';

export function LandingHeader() {
    return (
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
    );
}
