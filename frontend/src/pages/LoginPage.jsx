import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, Shield, Zap, Lock, Mail, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { Canvas } from '@react-three/fiber';
import CanvasErrorBoundary from '../components/shared/CanvasErrorBoundary';
import CyberCore from '../components/shared/CyberCore';
import DataStreamField from '../components/shared/DataStreamField';

export default function LoginPage() {
    const { login, sendOtp, verifyOtp } = useAuth();
    const navigate = useNavigate();

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
            navigate('/dashboard');
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
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-layout auth-obsidian-shell">
            {/* Ambient Obsidian 3D Canvas */}
            <div className="auth-canvas-bg">
                <CanvasErrorBoundary fallbackTitle="PolicyGuard Auth">
                    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 10], fov: 56 }} gl={{ alpha: true, antialias: true }}>
                        <ambientLight intensity={1.2} />
                        <directionalLight position={[10, 10, 10]} intensity={1.8} color={otpSent ? '#06b6d4' : '#e11d48'} />
                        <pointLight position={[-10, -10, -10]} intensity={1.1} color="#22d3ee" />
                        <CyberCore position={[-0.6, 0, 0]} active={otpSent} />
                        <DataStreamField active={otpSent} color="#f472b6" />
                        <fog attach="fog" args={['#050814', 8, 22]} />
                    </Canvas>
                </CanvasErrorBoundary>
            </div>

            {/* Left Editorial Brand Panel */}
            <div className="auth-brand-panel auth-brand-dark">
                <div className="auth-brand-inner auth-brand-dark-inner">
                    <div className="auth-brand-logo-row">
                        <img src="/logo.png" alt="PolicyGuard AI" className="auth-logo-mark" />
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
                            <Lock size={15} style={{ color: '#10b981' }} /> <span>Supabase RLS Encrypted Vault</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Crisp Light Form Panel */}
            <div className="auth-form-panel auth-form-light">
                <div className="auth-card auth-card-clean">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="PolicyGuard AI" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', marginBottom: 10 }} />
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
                            <Key size={14} /> Password
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginMethod('otp'); setForm((prev) => ({ ...prev, password: '' })); }}
                            className={`auth-method-tab ${loginMethod === 'otp' ? 'active' : ''}`}
                        >
                            <Mail size={14} /> Email Code
                        </button>
                    </div>

                    {loginMethod === 'password' ? (
                        <form onSubmit={handlePasswordSubmit}>
                            <div className="form-group">
                                <label className="form-label" style={{ color: '#475569' }}>Email Address</label>
                                <input
                                    id="login-email"
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                    autoComplete="email"
                                    style={{ background: '#ffffff' }}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" style={{ color: '#475569' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="login-password"
                                        type={showPass ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Enter your password"
                                        value={form.password}
                                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                                        required
                                        style={{ paddingRight: 48, background: '#ffffff' }}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPass ? 'Hide password' : 'Show password'}
                                        onClick={() => setShowPass(!showPass)}
                                        style={{
                                            position: 'absolute', right: 14, top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none', border: 'none',
                                            color: '#94a3b8', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center',
                                        }}
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
                                <label className="form-label" style={{ color: '#475569' }}>Email Address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                    disabled={otpSent}
                                    autoComplete="email"
                                    style={{ background: '#ffffff' }}
                                />
                            </div>

                            {otpSent && (
                                <div className="form-group" style={{ animation: 'fadeIn 0.3s ease' }}>
                                    <label className="form-label" style={{ color: '#d946ef' }}>Email Verification Code (6–8 Digits)</label>
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
                                        style={{ letterSpacing: '4px', fontSize: 18, textAlign: 'center', background: '#fdf2f8', borderColor: '#fbcfe8', color: '#be185d', fontWeight: 'bold' }}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{
                                    width: '100%', marginTop: 8,
                                    background: otpSent ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #d946ef, #a21caf)',
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

                    <div className="auth-footer" style={{ color: '#64748b' }}>
                        Don&apos;t have an account? <Link to="/register" style={{ color: '#d946ef' }}>Create Account</Link>
                    </div>
                    <div className="auth-footer" style={{ marginTop: 8 }}>
                        <Link to="/" style={{ color: '#94a3b8', fontSize: 13 }}>← Back to home</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
