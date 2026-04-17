import { useRef, useMemo, Component } from 'react';
import { useNavigate } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Shield, ChevronRight, Zap, Lock, Globe, BarChart2, Cpu, FileText } from 'lucide-react';
import * as THREE from 'three';

// ─── Error Boundary for Three.js Canvas ──────────────────────────────────────
class CanvasErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { error: false, errorMsg: '' }; }
    static getDerivedStateFromError(error) { return { error: true, errorMsg: error.message || String(error) }; }
    render() {
        if (this.state.error) return <div style={{ color: 'red', padding: 20, background: 'black' }}>WebGL Crash: {this.state.errorMsg}</div>;
        return this.props.children;
    }
}

// ─── Precision 3D Cyber Core (Max Professional) ──────────────────────────────
function CyberCore({ position = [4, 0, -2], active = false }) {
    const groupRef = useRef();
    const ring1 = useRef();
    const ring2 = useRef();
    const ring3 = useRef();
    const dotsRef = useRef();

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const speed = active ? 3.5 : 2.5;
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
            <pointLight distance={12} intensity={2} color="#ffffff" position={[3, 3, 3]} />
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

// ─── Grid Floor ──────────────────────────────────────────────────────────────
function GridFloor() {
    const gridRef = useRef();
    useFrame(({ clock }) => {
        if (gridRef.current) gridRef.current.position.z = (clock.elapsedTime * 0.8) % 2;
    });
    return <gridHelper ref={gridRef} args={[80, 40, '#ec489950', '#f9a8d420']} position={[0, -5, -5]} />;
}

// ─── Camera Parallax Rig ─────────────────────────────────────────────────────
function CameraRig() {
    const { camera } = useThree();
    useFrame(({ mouse }) => {
        camera.position.x += (mouse.x * 2.0 - camera.position.x) * 0.05;
        camera.position.y += (mouse.y * 1.2 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
    });
    return null;
}

// ─── Feature Card ────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color }) {
    return (
        <div className="feature-card">
            <div className="feature-icon" style={{ background: `${color}22`, boxShadow: `0 0 24px ${color}33` }}>
                <Icon size={26} style={{ color }} />
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
        </div>
    );
}

// ─── Main Landing Page ───────────────────────────────────────────────────────
export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="landing-root">
            {/* Three.js Canvas — Max Realistic Full 3D background */}
            <div className="landing-canvas">
                <CanvasErrorBoundary>
                    <Canvas camera={{ position: [0, 0, 12], fov: 60 }} gl={{ alpha: true, antialias: true }}
                        style={{ background: 'transparent' }}>
                        <ambientLight intensity={2.0} />
                        <directionalLight position={[10, 10, 10]} intensity={2.5} color="#ec4899" />
                        <pointLight position={[-10, -10, -10]} intensity={1.5} color="#3b82f6" />
                        <pointLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />

                        <CameraRig />
                        <DataStreamField active={false} />
                        <CyberCore position={[4, 0, -2]} active={false} />
                        <GridFloor />

                        <fog attach="fog" args={['#fdf2f8', 10, 30]} />
                    </Canvas>
                </CanvasErrorBoundary>
            </div>

            {/* Nav */}
            <nav className="landing-nav">
                <div className="landing-nav-logo">
                    <div className="logo-icon" style={{ width: 36, height: 36, background: 'transparent', padding: 0, overflow: 'hidden', borderRadius: 10 }}>
                        <img src="/logo.png" alt="PolicyAI" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ color: '#1e293b' }}>PolicyAI</span>
                </div>
                <div className="landing-nav-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/login')}>Sign In</button>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>Get Started</button>
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="landing-hero-content">
                    <div className="hero-badge">
                        <Zap size={12} /> AI-Powered · Enterprise Grade
                    </div>
                    <h1 className="hero-title" style={{ fontSize: '4.5rem', lineHeight: '1.1', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '1.5rem', textShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                        Insurance Intelligence,<br />
                        <span className="gradient-text" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Unleashed by AI.</span>
                    </h1>
                    <p className="hero-subtitle" style={{ fontSize: '1.25rem', lineHeight: '1.6', color: '#475569', maxWidth: '600px', marginBottom: '2.5rem' }}>
                        Enterprise-grade document analysis. Instantly decode complex jargon, uncover hidden exclusions, map fraud risks, and streamline your claims in under 30 seconds.
                    </p>
                    <div className="hero-cta">
                        <button className="btn btn-primary btn-lg hero-cta-main" style={{ boxShadow: '0 10px 25px rgba(217, 70, 239, 0.3)' }} onClick={() => navigate('/register')}>
                            Start Free — No Credit Card <ChevronRight size={18} />
                        </button>
                        <button className="btn btn-ghost btn-lg" onClick={() => navigate('/login')}>
                            Already have an account?
                        </button>
                    </div>
                    <div className="hero-stats" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.8)', padding: '20px 30px', borderRadius: '16px', marginTop: '20px' }}>
                        <div className="hero-stat"><span className="hero-stat-num" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>99.2%</span><span style={{ color: '#475569', fontWeight: 600 }}>Analysis Accuracy</span></div>
                        <div className="hero-stat-divider" style={{ background: '#cbd5e1' }} />
                        <div className="hero-stat"><span className="hero-stat-num" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>&lt;30s</span><span style={{ color: '#475569', fontWeight: 600 }}>Processing Time</span></div>
                        <div className="hero-stat-divider" style={{ background: '#cbd5e1' }} />
                        <div className="hero-stat"><span className="hero-stat-num" style={{ background: 'linear-gradient(135deg, #ec4899, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800 }}>100%</span><span style={{ color: '#475569', fontWeight: 600 }}>Secure &amp; Private</span></div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="landing-features">
                <h2 className="section-title">Everything you need to master your insurance</h2>
                <p className="section-subtitle">Powered by advanced AI · Financial-grade security · Zero complexity</p>
                <div className="features-grid">
                    <FeatureCard icon={Cpu} title="AI Policy Analysis" color="#8b5cf6"
                        desc="Upload any PDF — health, life, auto, travel. AI extracts coverage, exclusions, and claim steps in plain English." />
                    <FeatureCard icon={Shield} title="Fraud Detection" color="#10b981"
                        desc="AI flags suspicious clauses, hidden fees, and red flags with a real-time verification score." />
                    <FeatureCard icon={Globe} title="Policy Chat" color="#3b82f6"
                        desc="Ask anything in natural language. Get instant, accurate answers from your actual document." />
                    <FeatureCard icon={BarChart2} title="Market Intelligence" color="#f59e0b"
                        desc="Compare providers, claim settlement ratios, and get tailored consumer recommendations." />
                    <FeatureCard icon={Lock} title="Claim Guidance" color="#ef4444"
                        desc="Step-by-step AI-guided claims with required documents, timelines, and tips." />
                    <FeatureCard icon={FileText} title="Instant Insights" color="#6366f1"
                        desc="From upload to full analysis in under 30 seconds. Simple summary anyone can understand." />
                </div>
            </section>

            {/* CTA */}
            <section className="landing-cta">
                <div className="landing-cta-box">
                    <h2>Ready to take control of your insurance?</h2>
                    <p>Join thousands using PolicyAI to demystify their coverage.</p>
                    <button className="btn btn-primary btn-lg" onClick={() => navigate('/register')}>
                        Get Started Free <ChevronRight size={18} />
                    </button>
                </div>
            </section>

            <footer className="landing-footer">
                <span>© 2026 PolicyAI · AI-Powered Insurance Intelligence</span>
                <span>Built by Mohamed Fazil Pasha</span>
            </footer>
        </div>
    );
}
