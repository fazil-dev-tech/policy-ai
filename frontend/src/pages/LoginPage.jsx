import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, Zap, Lock, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import AuthBrandPanel from '../components/shared/AuthBrandPanel';
import { SpotlightCard } from '../components/shared/MotionPrimitives';

export default function LoginPage() {
    const { login, sendOtp, resendSignupOtp, verifyOtp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const rawFrom = location.state?.from;
    const postLoginPath = (typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//') && rawFrom !== '/login' && rawFrom !== '/register')
        ? rawFrom
        : '/dashboard';

    const [loginMethod, setLoginMethod] = useState('password');
    const [form, setForm] = useState({ email: '', password: '', otp: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpType, setOtpType] = useState('email');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

    useEffect(() => {
        if (resendCooldown <= 0) return undefined;
        const id = window.setInterval(() => {
            setResendCooldown((prev) => (prev > 1 ? prev - 1 : 0));
        }, 1000);
        return () => window.clearInterval(id);
    }, [resendCooldown]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setNeedsEmailConfirm(false);
        try {
            await login(form.email, form.password);
            toast.success('Welcome back!');
            navigate(postLoginPath, { replace: true });
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Login failed';
            if (msg.toLowerCase().includes('verify your email')) {
                setNeedsEmailConfirm(true);
            }
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        if (!form.email.trim()) return toast.error('Please enter your email first');
        setLoading(true);
        try {
            if (otpType === 'signup') {
                await resendSignupOtp(form.email);
            } else {
                await sendOtp(form.email);
            }
            setOtpSent(true);
            setResendCooldown(30);
            toast.success('Verification code sent to your email!');
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyUnconfirmedAccount = async () => {
        if (!form.email.trim()) return toast.error('Please enter your email first');
        setLoading(true);
        try {
            await resendSignupOtp(form.email);
            setLoginMethod('otp');
            setOtpType('signup');
            setOtpSent(true);
            setNeedsEmailConfirm(false);
            setResendCooldown(30);
            setForm((prev) => ({ ...prev, password: '', otp: '' }));
            toast.success('Signup verification code sent to your email!');
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to resend verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!/^\d{6,8}$/.test(form.otp)) return toast.error('Please enter the 6-to-8 digit verification code');
        setLoading(true);
        try {
            await verifyOtp(form.email, form.otp, otpType);
            toast.success('Welcome back!');
            navigate(postLoginPath, { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-layout auth-obsidian-shell">
            {/* Left Editorial Brand Panel with Dedicated Centered 3D Canvas */}
            <AuthBrandPanel
                active={otpSent}
                badgeText="IRDAI POLICYHOLDER SHIELD · INDIA"
                tagline="Clause Clarity · Claim Math · Scam Defense"
                fallbackTitle="PolicyGuard Auth"
                streamColor="#f472b6"
            />

            {/* Right Floating Crystal Glass Form Panel */}
            <div className="auth-form-panel auth-form-glass-stage">
                <SpotlightCard className="auth-card auth-card-clean" hoverLift={false}>
                    <div className="auth-logo">
                        <div className="auth-card-mobile-pill">
                            <span className="hero-live-dot" aria-hidden="true" />
                            <span>IRDAI-Aligned · Free Vault</span>
                        </div>
                        <div className="auth-card-logo-badge">
                            <img src="/logo.png" alt="PolicyGuard AI" />
                        </div>
                        <h1>{otpSent ? 'Verify Email Code' : 'Welcome Back'}</h1>
                        <p>{otpSent ? 'Enter the code sent to your inbox' : 'Sign in to your PolicyGuard AI workspace'}</p>
                    </div>

                    {/* Login Method Tabs */}
                    <div className="auth-method-tabs">
                        <button
                            type="button"
                            onClick={() => {
                                setLoginMethod('password');
                                setOtpSent(false);
                                setOtpType('email');
                                setResendCooldown(0);
                                setForm((prev) => ({ ...prev, otp: '' }));
                            }}
                            className={`auth-method-tab ${loginMethod === 'password' ? 'active' : ''}`}
                        >
                            {loginMethod === 'password' && (
                                <motion.span
                                    layoutId="authLoginTabPill"
                                    className="auth-method-tab-pill"
                                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                />
                            )}
                            <span className="auth-method-tab-label"><KeyRound size={14} /> Password</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setLoginMethod('otp');
                                setNeedsEmailConfirm(false);
                                setForm((prev) => ({ ...prev, password: '' }));
                            }}
                            className={`auth-method-tab ${loginMethod === 'otp' ? 'active' : ''}`}
                        >
                            {loginMethod === 'otp' && (
                                <motion.span
                                    layoutId="authLoginTabPill"
                                    className="auth-method-tab-pill"
                                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                />
                            )}
                            <span className="auth-method-tab-label"><Mail size={14} /> Email Code</span>
                        </button>
                    </div>

                    {loginMethod === 'password' ? (
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                    autoComplete="email"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="login-password"
                                        type={showPass ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required
                                        style={{ paddingRight: 44 }}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="auth-password-toggle"
                                        aria-label={showPass ? 'Hide password' : 'Show password'}
                                        onClick={() => setShowPass(!showPass)}
                                    >
                                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                id="login-submit"
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%', marginTop: 8 }}
                                disabled={loading}
                            >
                                {loading
                                    ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                    : <><LogIn size={18} /> Authenticate</>
                                }
                            </button>

                            {needsEmailConfirm && (
                                <div className="auth-confirm-banner">
                                    <span>Account email not verified yet.</span>
                                    <button type="button" onClick={handleVerifyUnconfirmedAccount} disabled={loading}>
                                        Send verification code
                                    </button>
                                </div>
                            )}
                        </form>
                    ) : (
                        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                    disabled={otpSent}
                                    autoComplete="email"
                                />
                            </div>

                            {otpSent && (
                                <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                                    <label className="form-label" style={{ color: 'var(--accent-primary)' }}>Email Verification Code (6–8 Digits)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={8}
                                        className="form-input"
                                        placeholder="Enter code"
                                        value={form.otp}
                                        onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                                        required
                                        autoComplete="one-time-code"
                                        style={{ letterSpacing: '4px', fontSize: 18, textAlign: 'center', background: '#fff1f5', borderColor: '#fecdd3', color: '#be123c', fontWeight: 'bold' }}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{
                                    width: '100%', marginTop: 8,
                                    background: otpSent ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--accent-gradient)',
                                    color: '#fff'
                                }}
                                disabled={loading}
                            >
                                {loading
                                    ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2, borderColor: '#fff', borderTopColor: 'transparent' }} />
                                    : otpSent ? <><Lock size={18} /> Verify &amp; Sign In</> : <><Zap size={18} /> Send Verification Code</>
                                }
                            </button>

                            {otpSent && (
                                <div className="auth-otp-actions">
                                    <button
                                        type="button"
                                        onClick={handleSendOtp}
                                        disabled={loading || resendCooldown > 0}
                                    >
                                        {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}
                                    </button>
                                    <span aria-hidden="true">·</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtpSent(false);
                                            setOtpType('email');
                                            setResendCooldown(0);
                                            setForm({ ...form, otp: '' });
                                        }}
                                        disabled={loading}
                                    >
                                        Change Email Address
                                    </button>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="auth-footer">
                        Don&apos;t have an account? <Link to="/register" state={location.state}>Create Account</Link>
                    </div>
                    <div className="auth-footer auth-footer-back">
                        <Link to="/" className="auth-back-link"><ArrowLeft size={14} /> Back to home</Link>
                    </div>
                </SpotlightCard>
            </div>
        </div>
    );
}
