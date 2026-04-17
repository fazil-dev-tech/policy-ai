import { useState, useRef, useMemo, Component } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, Shield, Zap, Lock, Mail, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Error Boundary for Canvas ───
class CanvasErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { error: false, errorMsg: '' }; }
    static getDerivedStateFromError(error) { return { error: true, errorMsg: error.message || String(error) }; }
    render() {
        if (this.state.error) return <div style={{ color: 'red', padding: 20, background: 'black', position: 'relative', zIndex: 9999 }}>Canvas Crash: {this.state.errorMsg}</div>;
        return this.props.children;
    }
}

// ─── Precision 3D Cyber Core (Max Professional) ──────────────────────────────
function CyberCore({ position = [-3, 0, -2], active = false }) {
    const groupRef = useRef();
    const ring1 = useRef();
    const ring2 = useRef();
    const ring3 = useRef();
    const dotsRef = useRef();

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const speed = active ? 4.0 : 3.0;
        if (groupRef.current) {
            groupRef.current.position.y = Math.sin(t * 2.0) * 0.25;
            groupRef.current.rotation.y = t * 0.15 * speed;
        }
        if (ring1.current) ring1.current.rotation.x = t * 0.3 * speed;
        if (ring2.current) ring2.current.rotation.y = t * 0.4 * speed;
        if (ring3.current) ring3.current.rotation.z = t * -0.25 * speed;
        if (dotsRef.current) dotsRef.current.rotation.y = t * 0.08 * speed;
    });

    const primaryColor = active ? "#0ea5e9" : "#d946ef";     // Blue / Magenta
    const secondaryColor = active ? "#3b82f6" : "#9333ea";   // Deeper Blue / Purple
    const accentColor = active ? "#10b981" : "#f472b6";      // Green / Pink

    const { positions, colors } = useMemo(() => {
        const count = 100;
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);
        const colorBase = new THREE.Color(primaryColor);
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const r = 1.9 + Math.random() * 0.2;
            pos[i * 3] = r * Math.cos(theta) * Math.sin(phi);
            pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            pos[i * 3 + 2] = r * Math.cos(phi);
            colorBase.toArray(cols, i * 3);
        }
        return { positions: pos, colors: cols };
    }, [primaryColor]);

    return (
        <group ref={groupRef} position={position}>
            {/* Ambient Base Glow */}
            <mesh>
                <sphereGeometry args={[2.5, 32, 32]} />
                <meshBasicMaterial color={primaryColor} transparent opacity={0.12} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
            </mesh>
            <mesh>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshBasicMaterial color={secondaryColor} transparent opacity={0.25} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
            </mesh>

            {/* Dark Energy Core - Ultra Glossy */}
            <mesh>
                <icosahedronGeometry args={[1.2, 2]} />
                <meshPhongMaterial color="#0f172a" emissive={primaryColor} emissiveIntensity={0.6} specular="#ffffff" shininess={500} flatShading />
            </mesh>

            {/* Geometric Outer Shell */}
            <mesh>
                <icosahedronGeometry args={[1.5, 1]} />
                <meshStandardMaterial color={accentColor} wireframe transparent opacity={active ? 0.8 : 0.6} />
            </mesh>

            {/* Swarm Nodes */}
            <points ref={dotsRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[colors, 3]} />
                </bufferGeometry>
                <pointsMaterial size={0.06} vertexColors transparent opacity={0.8} />
            </points>

            {/* Orbiting Tech Rings */}
            <group ref={ring1} rotation={[Math.PI / 4, 0, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[2.2, 0.015, 16, 100, Math.PI * 1.5]} />
                    <meshBasicMaterial color={primaryColor} transparent opacity={0.7} />
                </mesh>
                <mesh position={[2.2, 0, 0]}>
                    <sphereGeometry args={[0.08, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[0, 0, -2.2]}>
                    <sphereGeometry args={[0.05, 16, 16]} />
                    <meshBasicMaterial color={primaryColor} />
                </mesh>
            </group>

            <group ref={ring2} rotation={[0, Math.PI / 4, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[2.6, 0.02, 16, 100, Math.PI * 1.8]} />
                    <meshBasicMaterial color={secondaryColor} transparent opacity={0.6} />
                </mesh>
                <mesh position={[-2.6, 0, 0]}>
                    <sphereGeometry args={[0.06, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>

            <group ref={ring3} rotation={[0, 0, Math.PI / 3]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[3.0, 0.01, 16, 100]} />
                    <meshBasicMaterial color={accentColor} transparent opacity={0.4} />
                </mesh>
                <mesh position={[3.0, 0, 0]}>
                    <sphereGeometry args={[0.07, 16, 16]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>

            <pointLight distance={20} intensity={active ? 4 : 3} color={primaryColor} position={[0, 0, 0]} />
            <pointLight distance={12} intensity={2.5} color="#ffffff" position={[3, 3, 3]} />
        </group>
    );
}

// ─── Data Stream Field ───────────────────────────────────────────────────────
function DataStreamField({ active = false }) {
    const pointsRef = useRef();
    const count = 1200;

    const { positions, randoms, sizes } = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const rands = new Float32Array(count);
        const sz = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 60;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 15;
            rands[i] = Math.random();
            sz[i] = Math.random() * 2.0;
        }
        return { positions: pos, randoms: rands, sizes: sz };
    }, []);

    useFrame(({ clock }) => {
        const speed = active ? 1.2 : 0.5;
        if (pointsRef.current) {
            for (let i = 0; i < count; i++) {
                positions[i * 3 + 1] += (randoms[i] + 0.2) * speed;
                if (positions[i * 3 + 1] > 30) {
                    positions[i * 3 + 1] = -30;
                    positions[i * 3] = (Math.random() - 0.5) * 60;
                }
            }
            pointsRef.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
            </bufferGeometry>
            <pointsMaterial size={0.12} color={active ? "#38bdf8" : "#fbcfe8"} transparent opacity={0.5} sizeAttenuation />
        </points>
    );
}

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
            toast.error(err.response?.data?.error || 'Login failed');
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
            toast.error(err.response?.data?.error || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (form.otp.length !== 6) return toast.error('Please enter the 6-digit code');
        setLoading(true);
        try {
            await verifyOtp(form.email, form.otp);
            toast.success('Welcome back!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-layout" style={{ background: 'transparent', position: 'relative' }}>

            {/* Full Screen 3D Animated Background */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, background: 'linear-gradient(to bottom right, #f8fafc, #f1f5f9)' }}>
                <CanvasErrorBoundary>
                    <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ alpha: true, antialias: true }}>
                        <ambientLight intensity={2.0} />
                        <directionalLight position={[10, 10, 10]} intensity={2.5} color={otpSent ? "#0ea5e9" : "#d946ef"} />
                        <pointLight position={[-10, -10, -10]} intensity={1.5} color="#3b82f6" />
                        <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
                        <CyberCore position={[0, 0, 0]} active={otpSent} />
                        <DataStreamField active={otpSent} />
                        <fog attach="fog" args={['#f8fafc', 8, 20]} />
                    </Canvas>
                </CanvasErrorBoundary>
            </div>

            {/* Left Brand Panel - Transparent to show 3D */}
            <div className="auth-brand-panel" style={{ background: 'transparent', borderRight: 'none', boxShadow: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '40px 30px' }}>
                <div className="auth-brand-inner" style={{ position: 'relative', zIndex: 1, textShadow: '0 4px 12px rgba(255,255,255,0.9)', textAlign: 'left', maxWidth: '280px' }}>
                    <div className="auth-brand-logo" style={{ background: 'transparent', padding: 0 }}>
                        <img src="/logo.png" alt="PolicyAI" style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} />
                    </div>
                    <h1 className="auth-brand-name" style={{ color: '#1e293b', fontSize: '1.6rem' }}>PolicyAI</h1>
                    <p className="auth-brand-tagline" style={{ color: '#475569', fontSize: '0.85rem' }}>Secure Access Protocol<br />Initialized</p>

                    <div className="auth-brand-features" style={{ background: 'rgba(255,255,255,0.55)', padding: 14, borderRadius: 14, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', marginTop: 12 }}>
                        <div className="auth-brand-feature" style={{ color: '#334155', fontSize: '0.8rem' }}>
                            <Zap size={15} style={{ color: '#d946ef' }} /> <span>Quantum AES-256 Encryption</span>
                        </div>
                        <div className="auth-brand-feature" style={{ color: '#334155', fontSize: '0.8rem' }}>
                            <Shield size={15} style={{ color: '#3b82f6' }} /> <span>Stateless Identity Verification</span>
                        </div>
                        <div className="auth-brand-feature" style={{ color: '#334155', fontSize: '0.8rem' }}>
                            <Lock size={15} style={{ color: '#10b981' }} /> <span>Dynamic Payload Delivery</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Form Panel - Glassmorphic */}
            <div className="auth-form-panel" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="auth-card" style={{ background: 'rgba(255, 255, 255, 0.8)', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.9)' }}>
                    <div className="auth-logo">
                        <div className="logo-icon" style={{ background: 'transparent', padding: 0, overflow: 'hidden' }}>
                            <img src="/logo.png" alt="PolicyAI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <h1 style={{ color: '#1e293b' }}>{otpSent ? 'Digital Key Required' : 'Welcome Back'}</h1>
                        <p style={{ color: '#64748b' }}>{otpSent ? 'Check your email for the access code' : 'Sign in to your PolicyAI account'}</p>
                    </div>

                    {/* Login Method Tabs */}
                    <div style={{ display: 'flex', background: 'rgba(241, 245, 249, 0.6)', borderRadius: 12, padding: 4, marginBottom: 24, border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                        <button
                            type="button"
                            onClick={() => { setLoginMethod('password'); setOtpSent(false); }}
                            style={{
                                flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                background: loginMethod === 'password' ? '#ffffff' : 'transparent',
                                color: loginMethod === 'password' ? '#1e293b' : '#64748b',
                                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: loginMethod === 'password' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                            }}
                        >
                            <Key size={14} /> Password
                        </button>
                        <button
                            type="button"
                            onClick={() => { setLoginMethod('otp'); form.password = ''; }}
                            style={{
                                flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                background: loginMethod === 'otp' ? '#ffffff' : 'transparent',
                                color: loginMethod === 'otp' ? '#d946ef' : '#64748b',
                                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                boxShadow: loginMethod === 'otp' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                            }}
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
                                    <label className="form-label" style={{ color: '#d946ef' }}>Secure 6-Digit Payload</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter digital key"
                                        value={form.otp}
                                        onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
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
                                    : otpSent ? <><Lock size={18} /> Transmit Key</> : <><Zap size={18} /> Request Identity Payload</>
                                }
                            </button>

                            {otpSent && (
                                <div style={{ textAlign: 'center', marginTop: 16 }}>
                                    <button
                                        type="button"
                                        onClick={() => { setOtpSent(false); setForm({ ...form, otp: '' }); }}
                                        style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                                    >
                                        Re-configure Target Email Address
                                    </button>
                                </div>
                            )}
                        </form>
                    )}

                    <div className="auth-footer" style={{ color: '#64748b' }}>
                        Don't have clearance? <Link to="/register" style={{ color: '#d946ef' }}>Request Access</Link>
                    </div>
                    <div className="auth-footer" style={{ marginTop: 8 }}>
                        <Link to="/" style={{ color: '#94a3b8', fontSize: 13 }}>← Terminate session overlay</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
