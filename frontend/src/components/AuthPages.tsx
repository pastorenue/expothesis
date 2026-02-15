import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [otp, setOtp] = React.useState('');
    const [totp, setTotp] = React.useState('');
    const [devCode, setDevCode] = React.useState<string | undefined>(undefined);
    const [totpEnabled, setTotpEnabled] = React.useState(false);
    const [step, setStep] = React.useState<'login' | 'otp'>('login');
    const [error, setError] = React.useState<string | null>(null);

    const handleLogin = async () => {
        setError(null);
        try {
            const res = await authApi.login({ email, password });
            setTotpEnabled(res.data.totp_enabled);
            setDevCode(res.data.dev_code);
            setStep('otp');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    const handleVerify = async () => {
        setError(null);
        try {
            const res = await authApi.verifyOtp({ email, code: otp, totp_code: totp || undefined });
            window.localStorage.setItem('expothesis-token', res.data.token);
            window.localStorage.setItem('expothesis-user-id', res.data.user_id);
            navigate('/home');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Verification failed');
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
                            : 'Enter the code sent to your email.'}
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
                                <input
                                    type="text"
                                    className="input"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Email OTP code"
                                />
                                {totpEnabled && (
                                    <input
                                        type="text"
                                        className="input"
                                        value={totp}
                                        onChange={(e) => setTotp(e.target.value)}
                                        placeholder="Authenticator code"
                                    />
                                )}
                                {devCode && (
                                    <div className="text-xs text-slate-400">Dev OTP: {devCode}</div>
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
    const [otp, setOtp] = React.useState('');
    const [devCode, setDevCode] = React.useState<string | undefined>(undefined);
    const [step, setStep] = React.useState<'register' | 'otp'>('register');
    const [error, setError] = React.useState<string | null>(null);

    const handleRegister = async () => {
        setError(null);
        try {
            const res = await authApi.register({ email, password });
            setDevCode(res.data.dev_code);
            setStep('otp');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
        }
    };

    const handleVerify = async () => {
        setError(null);
        try {
            const res = await authApi.verifyOtp({ email, code: otp });
            window.localStorage.setItem('expothesis-token', res.data.token);
            window.localStorage.setItem('expothesis-user-id', res.data.user_id);
            navigate('/home');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Verification failed');
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
                    <h2 className="mb-2">{step === 'register' ? 'Create account' : 'Verify Email'}</h2>
                    <p className="text-sm text-slate-400">
                        {step === 'register'
                            ? 'Create your account to start experimenting.'
                            : 'Enter the code sent to your email.'}
                    </p>
                    {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
                    <div className="mt-4 space-y-3">
                        {step === 'register' ? (
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
                        ) : (
                            <>
                                <input
                                    type="text"
                                    className="input"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Email OTP code"
                                />
                                {devCode && (
                                    <div className="text-xs text-slate-400">Dev OTP: {devCode}</div>
                                )}
                                <button className="btn-primary w-full" onClick={handleVerify}>
                                    Verify & Continue
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
