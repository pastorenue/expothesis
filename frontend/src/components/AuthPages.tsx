import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

const getAuthError = (error: unknown, fallback: string) => {
    const err = error as { response?: { data?: { error?: string } } };
    return err.response?.data?.error ?? fallback;
};

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [totp, setTotp] = React.useState('');
    const [totpEnabled, setTotpEnabled] = React.useState(false);
    const [step, setStep] = React.useState<'login' | 'otp'>('login');
    const [error, setError] = React.useState<string | null>(null);

    const handleLogin = async () => {
        setError(null);
        try {
            const res = await authApi.login({ email, password });
            setTotpEnabled(res.data.totp_enabled);
            if (!res.data.requires_otp) {
                const tokenRes = await authApi.verifyOtp({ email, code: '' });
                window.localStorage.setItem('expothesis-token', tokenRes.data.token);
                window.localStorage.setItem('expothesis-user-id', tokenRes.data.user_id);
                navigate('/home');
                return;
            }
            setStep('otp');
        } catch (err: unknown) {
            setError(getAuthError(err, 'Login failed'));
        }
    };

    const handleVerify = async () => {
        setError(null);
        try {
            const res = await authApi.verifyOtp({ email, code: '', totp_code: totp || undefined });
            window.localStorage.setItem('expothesis-token', res.data.token);
            window.localStorage.setItem('expothesis-user-id', res.data.user_id);
            navigate('/home');
        } catch (err: unknown) {
            setError(getAuthError(err, 'Verification failed'));
        }
    };

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
                    <Link to="/" className="landing-link">Home</Link>
                </div>
            </header>
            <div className="flex min-h-screen items-center justify-center px-6 py-10">
                <div className="card w-full max-w-md">
                    <h2 className="mb-2">{step === 'login' ? 'Sign in' : 'Verify OTP'}</h2>
                    <p className="text-sm text-slate-400">
                        {step === 'login'
                            ? 'Use your email and password to continue.'
                            : 'Enter the code from your authenticator app.'}
                    </p>
                    {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
                    <div className="mt-4 space-y-3">
                        {step === 'login' ? (
                            <>
                                <input
                                    type="email"
                                    className="input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email"
                                />
                                <input
                                    type="password"
                                    className="input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                />
                                <button className="btn-primary w-full" onClick={handleLogin}>
                                    Continue
                                </button>
                                <p className="text-sm text-slate-400">
                                    No account? <Link to="/register" className="text-cyan-300">Create one</Link>
                                </p>
                            </>
                        ) : (
                            <>
                                {totpEnabled && (
                                    <input
                                        type="text"
                                        className="input"
                                        value={totp}
                                        onChange={(e) => setTotp(e.target.value)}
                                        placeholder="Authenticator code"
                                    />
                                )}
                                <button className="btn-primary w-full" onClick={handleVerify}>
                                    Verify & Sign in
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    const handleRegister = async () => {
        setError(null);
        try {
            const res = await authApi.register({ email, password });
            if (!res.data.requires_otp) {
                const tokenRes = await authApi.verifyOtp({ email, code: '' });
                window.localStorage.setItem('expothesis-token', tokenRes.data.token);
                window.localStorage.setItem('expothesis-user-id', tokenRes.data.user_id);
                navigate('/home');
                return;
            }
        } catch (err: unknown) {
            setError(getAuthError(err, 'Registration failed'));
        }
    };

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
                    <Link to="/" className="landing-link">Home</Link>
                </div>
            </header>
            <div className="flex min-h-screen items-center justify-center px-6 py-10">
                <div className="card w-full max-w-md">
                    <h2 className="mb-2">Create account</h2>
                    <p className="text-sm text-slate-400">
                        Create your account to start experimenting.
                    </p>
                    {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
                    <div className="mt-4 space-y-3">
                        <>
                            <input
                                type="email"
                                className="input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email"
                            />
                            <input
                                type="password"
                                className="input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                            />
                            <button className="btn-primary w-full" onClick={handleRegister}>
                                Register
                            </button>
                            <p className="text-sm text-slate-400">
                                Already have an account? <Link to="/login" className="text-cyan-300">Sign in</Link>
                            </p>
                        </>
                    </div>
                </div>
            </div>
        </div>
    );
};
