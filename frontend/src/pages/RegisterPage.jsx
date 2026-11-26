import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff, Shield, Zap, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Canvas } from '@react-three/fiber';
import CanvasErrorBoundary from '../components/shared/CanvasErrorBoundary';
import CyberCore from '../components/shared/CyberCore';
import DataStreamField from '../components/shared/DataStreamField';

export default function RegisterPage() {
    const { register, verifyOtp } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [otp, setOtp] = useState('');
    const [needsVerification, setNeedsVerification] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.name.trim().length < 2) return toast.error('Please enter your full name (at least 2 characters)');
        if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
        setLoading(true);
        try {
            const res = await register(form.name.trim(), form.email, form.password);
            if (res?.requiresVerification) {
                setNeedsVerification(true);
                toast.success('Account created! Check your email for the verification code.');
            } else {
                toast.success('Account created successfully!');
                navigate('/dashboard');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySignup = async (e) => {
        e.preventDefault();
        if (!/^\d{6,8}$/.test(otp)) return toast.error('Please enter the 6-to-8 digit verification code');
        setLoading(true);
        try {
            await verifyOtp(form.email, otp, 'signup');
            toast.success('Email verified! Welcome to PolicyAI.');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Invalid verification code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-layout auth-obsidian-shell">
            {/* Ambient Obsidian 3D Canvas */}
            <div className="auth-canvas-bg">
                <CanvasErrorBoundary fallbackTitle="PolicyGuard Sign Up">
                    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 10], fov: 56 }} gl={{ alpha: true, antialias: true }}>
                        <ambientLight intensity={1.2} />
                        <directionalLight position={[10, 10, 10]} intensity={1.8} color="#e11d48" />
                        <pointLight position={[-10, -10, -10]} intensity={1.1} color="#22d3ee" />
                        <CyberCore position={[-0.6, 0, 0]} active={needsVerification} />
                        <DataStreamField active={needsVerification} color="#22d3ee" />
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
                            <p className="auth-brand-tagline-obsidian">Free Insurance Clarity &amp; Claim Protection</p>
                        </div>
                    </div>

                    <div className="auth-brand-features-obsidian">
                        <div className="auth-brand-feature-obsidian"><Zap size={15} style={{ color: '#fb7185' }} /> <span>IRDAI CIS &amp; Room-Rent Audit</span></div>
                        <div className="auth-brand-feature-obsidian"><Shield size={15} style={{ color: '#22d3ee' }} /> <span>7-Scenario Payout Calculator</span></div>
                        <div className="auth-brand-feature-obsidian"><Lock size={15} style={{ color: '#10b981' }} /> <span>Private Family Emergency Vault</span></div>
                    </div>
                </div>
            </div>

            {/* Right Crisp Form Panel */}
            <div className="auth-form-panel auth-form-light">
                <div className="auth-card auth-card-clean">
                    <div className="auth-logo">
                        <img src="/logo.png" alt="PolicyGuard AI" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', marginBottom: 10 }} />
                        <h1>{needsVerification ? 'Verify Email' : 'Create Account'}</h1>
                        <p>{needsVerification ? `Enter the verification code sent to ${form.email}` : 'Join PolicyGuard AI — completely free'}</p>
                    </div>

                    {needsVerification ? (
                        <form onSubmit={handleVerifySignup}>
                            <div className="form-group">
                                <label className="form-label">Email Verification Code (6–8 Digits)</label>
                                <input
                                    id="register-otp"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={8}
                                    className="form-input"
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    required
                                    autoComplete="one-time-code"
                                    style={{ letterSpacing: '6px', fontSize: 20, textAlign: 'center', fontWeight: 'bold' }}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                                {loading
                                    ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                    : <><Lock size={18} /> Confirm &amp; Continue</>
                                }
                            </button>
                            <div style={{ textAlign: 'center', marginTop: 12 }}>
                                <button type="button" onClick={() => { setNeedsVerification(false); setOtp(''); }}
                                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                                    Back to registration
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input id="register-name" type="text" className="form-input"
                                    placeholder="John Doe" value={form.name} required autoComplete="name"
                                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input id="register-email" type="email" className="form-input"
                                    placeholder="you@example.com" value={form.email} required autoComplete="email"
                                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input id="register-password" type={showPass ? 'text' : 'password'}
                                        className="form-input" placeholder="Min. 6 characters"
                                        value={form.password} required style={{ paddingRight: 48 }}
                                        autoComplete="new-password"
                                        onChange={(e) => setForm({ ...form, password: e.target.value })} />
                                    <button type="button" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass(!showPass)}
                                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <input id="register-confirm" type="password" className="form-input"
                                    placeholder="Repeat your password" value={form.confirmPassword} required
                                    autoComplete="new-password"
                                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                            </div>
                            <button id="register-submit" type="submit" className="btn btn-primary btn-lg"
                                style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                                {loading
                                    ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                    : <><UserPlus size={18} /> Create Account</>
                                }
                            </button>
                        </form>
                    )}

                    <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
                    <div className="auth-footer" style={{ marginTop: 8 }}>
                        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 13 }}>← Back to home</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
