import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, Shield, Zap, Lock, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import CanvasErrorBoundary from '../components/shared/CanvasErrorBoundary';
import CyberCore from '../components/shared/CyberCore';
import DataStreamField from '../components/shared/DataStreamField';
import GridFloor from '../components/shared/GridFloor';
import { SpotlightCard } from '../components/shared/MotionPrimitives';

export default function LoginPage() {
    const { login, sendOtp, verifyOtp } = useAuth();
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

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(form.email, form.password);
            toast.success('Welcome back!');
            navigate(postLoginPath, { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!form.email) return toast.error('Please enter your email first');
        setLoading(true);
        try {
            await sendOtp(form.email);
            setOtpSent(true);
            toast.success('Login code sent to your email!');
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!/^\d{6,8}$/.test(form.otp)) return toast.error('Please enter the 6-to-8 digit verification code');
        setLoading(true);
        try {
            await verifyOtp(form.email, form.otp);
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
            <div className="auth-brand-panel auth-brand-dark">
                <div className="auth-panel-canvas" aria-hidden="true">
                    <CanvasErrorBoundary fallbackTitle="PolicyGuard Auth">
                        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.15, 9.8], fov: 44 }} gl={{ alpha: true, antialias: true }}>
                            <ambientLight intensity={1.15} />
                            <directionalLight position={[8, 9, 8]} intensity={1.65} color="#ffffff" />
                            <directionalLight position={[-6, 6, 4]} intensity={1.45} color={otpSent ? '#06b6d4' : '#fb7185'} />
                            <pointLight position={[-8, -6, 4]} intensity={1.2} color="#22d3ee" />
                            <CyberCore position={[0, 1.78, -0.5]} scale={0.66} active={otpSent} />
                            <DataStreamField active={otpSent} color="#f472b6" />
                            <GridFloor colorPrimary={otpSent ? '#22d3ee' : '#e11d48'} colorSecondary="#1e293b" opacity={0.22} y={-3.6} />
                            <fog attach="fog" args={['#050814', 9, 24]} />
                        </Canvas>
                    </CanvasErrorBoundary>
                </div>

                <div className="auth-brand-inner auth-brand-dark-inner">
                    <div className="auth-brand-badge">
                        <span className="hero-live-dot" aria-hidden="true" />
                        <span>IRDAI COMPLIANCE ENGINE</span>
                    </div>
                    <div className="auth-brand-logo-row">
                        <span className="brand-emblem-dark auth-logo-mark-wrap">
                            <img src="/logo.png" alt="PolicyGuard AI" className="auth-logo-mark" />
                        </span>
                        <div>
                            <h1 className="auth-brand-name-obsidian">PolicyGuard AI</h1>
                            <p className="auth-brand-tagline-obsidian">IRDAI-Aligned Insurance &amp; Claims Engine</p>
                        </div>
                    </div>

                    <div className="auth-brand-features-obsidian">
                        <div className="auth-brand-feature-obsidian">
                            <Zap size={15} style={{ color: '#fb7185' }} /> <span>Clause-Cited Policy Analysis</span>
                        </div>
                        <div className="auth-brand-feature-obsidian">
                            <Shield size={15} style={{ color: '#22d3ee' }} /> <span>3-Surface Anti-Phishing Shield</span>
                        </div>
                        <div className="auth-brand-feature-obsidian">
                            <Lock size={15} style={{ color: '#10b981' }} /> <span>User-Scoped Encrypted Policy Vault</span>
                        </div>
                    </div>
                </div>
            </div>

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
                            onClick={() => { setLoginMethod('password'); setOtpSent(false); }}
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
                            onClick={() => { setLoginMethod('otp'); setForm((prev) => ({ ...prev, password: '' })); }}
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
                                <div style={{ textAlign: 'center', marginTop: 16 }}>
                                    <button
                                        type="button"
                                        onClick={() => { setOtpSent(false); setForm({ ...form, otp: '' }); }}
                                        style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                                    >
                                        Change Email Address
                                    </button>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="auth-footer">
                        Don&apos;t have an account? <Link to="/register">Create Account</Link>
                    </div>
                    <div className="auth-footer auth-footer-back">
                        <Link to="/" className="auth-back-link"><ArrowLeft size={14} /> Back to home</Link>
                    </div>
                </SpotlightCard>
            </div>
        </div>
    );
}
