import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff, Lock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthBrandPanel from '../components/shared/AuthBrandPanel';
import { SpotlightCard } from '../components/shared/MotionPrimitives';

export default function RegisterPage() {
    const { register, verifyOtp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const rawFrom = location.state?.from;
    const postRegisterPath = (typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//') && rawFrom !== '/login' && rawFrom !== '/register')
        ? rawFrom
        : '/dashboard';
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [otp, setOtp] = useState('');
    const [needsVerification, setNeedsVerification] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
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
                navigate(postRegisterPath, { replace: true });
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
            toast.success('Email verified! Welcome to PolicyGuard AI.');
            navigate(postRegisterPath, { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Invalid verification code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-layout auth-obsidian-shell">
            {/* Left Editorial Brand Panel with Dedicated Centered 3D Canvas */}
            <AuthBrandPanel
                active={needsVerification}
                badgeText="FREE POLICYHOLDER VAULT · INDIA"
                tagline="Free Insurance Clarity · Health, Car & 2W Claims"
                fallbackTitle="PolicyGuard Sign Up"
                streamColor="#22d3ee"
            />

            {/* Right Floating Crystal Glass Form Panel */}
            <div className="auth-form-panel auth-form-glass-stage">
                <SpotlightCard className="auth-card auth-card-clean" hoverLift={false}>
                    <div className="auth-logo">
                        <div className="auth-card-mobile-pill">
                            <span className="hero-live-dot" aria-hidden="true" />
                            <span>Free Policyholder Vault</span>
                        </div>
                        <div className="auth-card-logo-badge">
                            <img src="/logo.png" alt="PolicyGuard AI" />
                        </div>
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
                                        value={form.password} required style={{ paddingRight: 44 }}
                                        autoComplete="new-password"
                                        onChange={(e) => setForm({ ...form, password: e.target.value })} />
                                    <button type="button" className="auth-password-toggle" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass(!showPass)}>
                                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input id="register-confirm" type={showConfirmPass ? 'text' : 'password'} className="form-input"
                                        placeholder="Repeat your password" value={form.confirmPassword} required style={{ paddingRight: 44 }}
                                        autoComplete="new-password"
                                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
                                    <button type="button" className="auth-password-toggle" aria-label={showConfirmPass ? 'Hide confirm password' : 'Show confirm password'} onClick={() => setShowConfirmPass(!showConfirmPass)}>
                                        {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {form.confirmPassword.length > 0 && (
                                    <span className={`auth-field-hint ${form.password === form.confirmPassword ? 'ok' : 'err'}`}>
                                        {form.password === form.confirmPassword ? 'Passwords match' : 'Passwords do not match yet'}
                                    </span>
                                )}
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

                    <div className="auth-footer">Already have an account? <Link to="/login" state={location.state}>Sign in</Link></div>
                    <div className="auth-footer auth-footer-back">
                        <Link to="/" className="auth-back-link"><ArrowLeft size={14} /> Back to home</Link>
                    </div>
                </SpotlightCard>
            </div>
        </div>
    );
}
