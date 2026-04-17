import { useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Eye, EyeOff, Shield, Zap, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Precision 3D Cyber Core (Max Professional) ──────────────────────────────
function CyberCore({ position = [-3, 0, -2], active = false }) {
    const groupRef = useRef();
    const ring1 = useRef();
    const ring2 = useRef();
    const ring3 = useRef();
    const dotsRef = useRef();

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const speed = 3.5;
        if (groupRef.current) {
            groupRef.current.position.y = Math.sin(t * 2.0) * 0.25;
            groupRef.current.rotation.y = t * 0.15 * speed;
        }
        if (ring1.current) ring1.current.rotation.x = t * 0.3 * speed;
        if (ring2.current) ring2.current.rotation.y = t * 0.4 * speed;
        if (ring3.current) ring3.current.rotation.z = t * -0.25 * speed;
        if (dotsRef.current) dotsRef.current.rotation.y = t * 0.08 * speed;
    });

    const primaryColor = "#0ea5e9";     // Blue
    const secondaryColor = "#3b82f6";   // Deeper Blue
    const accentColor = "#10b981";      // Green

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
    }, []);

    return (
        <group ref={groupRef} position={position}>
            {/* Ambient Base Glow */}
            <mesh>
                <sphereGeometry args={[2.5, 32, 32]} />
                <meshBasicMaterial color={primaryColor} transparent opacity={0.15} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
            </mesh>
            <mesh>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshBasicMaterial color={secondaryColor} transparent opacity={0.3} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
            </mesh>

            {/* Dark Energy Core - Ultra Glossy */}
            <mesh>
                <icosahedronGeometry args={[1.2, 2]} />
                <meshPhongMaterial color="#0f172a" emissive={primaryColor} emissiveIntensity={0.6} specular="#ffffff" shininess={500} flatShading />
            </mesh>

            {/* Geometric Outer Shell */}
            <mesh>
                <icosahedronGeometry args={[1.5, 1]} />
                <meshStandardMaterial color={accentColor} wireframe transparent opacity={0.8} />
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

            <pointLight distance={20} intensity={4} color={primaryColor} position={[0, 0, 0]} />
            <pointLight distance={10} intensity={2} color="#ffffff" position={[2, 2, 2]} />
        </group>
    );
}

// ─── Data Stream Field ───────────────────────────────────────────────────────
function DataStreamField() {
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

    useFrame(() => {
        const speed = 1.0; // Faster stream speed
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
            <pointsMaterial size={0.12} color="#38bdf8" transparent opacity={0.6} sizeAttenuation />
        </points>
    );
}


export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
        if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
        setLoading(true);
        try {
            await register(form.name, form.email, form.password);
            toast.success('Account created successfully!');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-split-layout" style={{ background: 'transparent', position: 'relative' }}>
            {/* Full Screen 3D Animated Background */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1, background: 'linear-gradient(to bottom right, #f8fafc, #f1f5f9)' }}>
                <Canvas camera={{ position: [0, 0, 10], fov: 60 }} gl={{ alpha: true, antialias: true }}>
                    <ambientLight intensity={2.0} />
                    <directionalLight position={[10, 10, 10]} intensity={2.5} color="#0ea5e9" />
                    <pointLight position={[-10, -10, -10]} intensity={1.5} color="#3b82f6" />
                    <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
                    <CyberCore position={[0, 0, 0]} />
                    <DataStreamField />
                    <fog attach="fog" args={['#f8fafc', 8, 20]} />
                </Canvas>
            </div>

            {/* Left Brand Panel - Made Transparent to show 3D */}
            <div className="auth-brand-panel" style={{ background: 'transparent', borderRight: 'none', boxShadow: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: '40px 30px' }}>
                <div className="auth-brand-inner" style={{ position: 'relative', zIndex: 1, textShadow: '0 4px 12px rgba(255,255,255,0.9)', textAlign: 'left', maxWidth: '280px' }}>
                    <div className="auth-brand-logo" style={{ background: 'transparent', padding: 0 }}>
                        <img src="/logo.png" alt="PolicyAI" style={{ width: 52, height: 52, objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} />
                    </div>
                    <h1 className="auth-brand-name" style={{ color: '#1e293b', fontSize: '1.6rem' }}>PolicyAI</h1>
                    <p className="auth-brand-tagline" style={{ color: '#475569', fontSize: '0.85rem' }}>Your AI-Powered<br />Insurance Companion</p>

                    <div className="auth-brand-features" style={{ background: 'rgba(255,255,255,0.55)', padding: 14, borderRadius: 14, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.6)', marginTop: 12 }}>
                        <div className="auth-brand-feature" style={{ color: '#334155', fontSize: '0.8rem' }}><Zap size={15} style={{ color: '#d946ef' }} /> <span>AI analysis in under 30s</span></div>
                        <div className="auth-brand-feature" style={{ color: '#334155', fontSize: '0.8rem' }}><Shield size={15} style={{ color: '#3b82f6' }} /> <span>Fraud detection &amp; verification</span></div>
                        <div className="auth-brand-feature" style={{ color: '#334155', fontSize: '0.8rem' }}><Lock size={15} style={{ color: '#10b981' }} /> <span>Bank-grade data security</span></div>
                    </div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div className="auth-form-panel" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="auth-card" style={{ background: 'rgba(255, 255, 255, 0.8)', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.9)' }}>
                    <div className="auth-logo">
                        <div className="logo-icon" style={{ background: 'transparent', padding: 0, overflow: 'hidden' }}>
                            <img src="/logo.png" alt="PolicyAI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <h1 style={{ color: '#1e293b' }}>Create Account</h1>
                        <p style={{ color: '#64748b' }}>Join PolicyAI — it's free</p>
                    </div>

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
                                <button type="button" onClick={() => setShowPass(!showPass)}
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

                    <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
                    <div className="auth-footer" style={{ marginTop: 8 }}>
                        <Link to="/" style={{ color: 'var(--text-muted)', fontSize: 13 }}>← Back to home</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
