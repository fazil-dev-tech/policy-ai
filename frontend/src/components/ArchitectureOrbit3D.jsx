import { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import CanvasErrorBoundary from './shared/CanvasErrorBoundary';

export const ARCHITECTURE_NODES = [
    {
        id: 'client',
        title: 'Client & Ext Shield',
        short: 'Web · WA · Gmail',
        color: '#22d3ee',
        shape: 'box',
        pos: [-4.4, 0.2, 0.9],
        specs: 'React 18 + Vite SPA · Signed 10MB Upload · Chrome MV3 Extension (localRules + Content Scripts)',
        metrics: '3 Surfaces · <10ms local heuristic',
    },
    {
        id: 'api',
        title: 'Express API Gate',
        short: 'REST · Auth · Security',
        color: '#a855f7',
        shape: 'icosahedron',
        pos: [-2.6, -1.15, 2.1],
        specs: 'JWT Auth Middleware · Zod Schema Validation · Rate Limiter · RDAP & VirusTotal URL Inspector',
        metrics: '10 Route Groups · Zero-500 Guard',
    },
    {
        id: 'ai',
        title: 'Nemotron-3.5 / Gemma-4 AI',
        short: '$0 Free Multi-Model',
        color: '#ec4899',
        shape: 'dodecahedron',
        pos: [-0.8, 0.85, 0.25],
        specs: 'OpenRouter $0 Free Cascade (Nemotron 3.5 Lightning / Super VL / Gemma 4) + Dynamic Registry & Parinidhi Voice',
        metrics: '8-Model Chain · 1M Context Window',
    },
    {
        id: 'db',
        title: 'Supabase PG & Index',
        short: 'RLS · Clauses · Vault',
        color: '#10b981',
        shape: 'prism',
        pos: [1.1, -1.0, 1.5],
        specs: 'PostgreSQL + Row-Level Security · Private Storage Buckets · Table-Aware Clause Citations & Family Vault',
        metrics: 'RLS Protected · Signed Downloads',
    },
    {
        id: 'engine',
        title: 'IRDAI & YOLOv8 ML',
        short: 'Waterfall · Vision ML',
        color: '#f59e0b',
        shape: 'octahedron',
        pos: [2.75, 0.72, -0.4],
        specs: 'Deterministic Payout Waterfall (1% Room Cap, Copay, 60m Moratorium) + FastAPI YOLOv8 / sklearn Car Estimator',
        metrics: 'IRDAI 2024 Rules · Sidecar :8000',
    },
    {
        id: 'dispatch',
        title: 'Claim & GRO Dispatch',
        short: 'PDF Guides · Appeals',
        color: '#f43f5e',
        shape: 'sphere',
        pos: [4.45, -0.25, 0.75],
        specs: 'Downloadable Claim Prep Guide PDF · Family Emergency E-Card PDF · IRDAI GRO Grievance Drafts · SMTP Alerts',
        metrics: '3h Discharge SLA · 1930 SOS Playbook',
    },
];

function OrbitStarfield({ reducedMotion }) {
    const ref = useRef();
    const positions = useMemo(() => {
        const count = 420;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 34;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 18;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 16 - 5;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !ref.current) return;
        ref.current.rotation.y = clock.elapsedTime * 0.015;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.055} color="#cbd5e1" transparent opacity={0.55} sizeAttenuation />
        </points>
    );
}

function OrbitRings() {
    return (
        <group rotation={[Math.PI / 2.28, 0.08, -0.06]} position={[0, -0.15, 0.7]}>
            <mesh>
                <torusGeometry args={[4.75, 0.012, 12, 140]} />
                <meshBasicMaterial color="#64748b" transparent opacity={0.28} />
            </mesh>
            <mesh rotation={[0.05, 0.1, 0]}>
                <torusGeometry args={[3.45, 0.01, 12, 120]} />
                <meshBasicMaterial color="#ec4899" transparent opacity={0.22} />
            </mesh>
            <mesh rotation={[-0.04, -0.06, 0]}>
                <torusGeometry args={[2.15, 0.009, 10, 96]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.18} />
            </mesh>
        </group>
    );
}

function TelemetryPackets({ reducedMotion }) {
    const curves = useMemo(() => {
        const list = [];
        for (let i = 0; i < ARCHITECTURE_NODES.length; i++) {
            const a = new THREE.Vector3(...ARCHITECTURE_NODES[i].pos);
            const b = new THREE.Vector3(...ARCHITECTURE_NODES[(i + 1) % ARCHITECTURE_NODES.length].pos);
            const mid = a.clone().add(b).multiplyScalar(0.5);
            mid.y += i % 2 === 0 ? 0.38 : -0.32;
            mid.z += 0.25;
            list.push({
                curve: new THREE.QuadraticBezierCurve3(a, mid, b),
                color: ARCHITECTURE_NODES[i].color,
                offset: i * 0.17,
            });
        }
        return list;
    }, []);

    const lineGeometries = useMemo(
        () => curves.map((c) => new THREE.BufferGeometry().setFromPoints(c.curve.getPoints(32))),
        [curves]
    );

    const pulseRefs = useRef([]);

    useFrame(({ clock }) => {
        if (reducedMotion) return;
        const t = clock.elapsedTime * 0.34;
        curves.forEach((c, idx) => {
            const mesh = pulseRefs.current[idx];
            if (!mesh) return;
            const u = (t + c.offset) % 1;
            const pt = c.curve.getPoint(u);
            mesh.position.copy(pt);
        });
    });

    return (
        <group>
            {curves.map((c, idx) => (
                <group key={idx}>
                    <line geometry={lineGeometries[idx]}>
                        <lineBasicMaterial color={c.color} transparent opacity={0.42} />
                    </line>
                    <mesh ref={(el) => { pulseRefs.current[idx] = el; }} position={ARCHITECTURE_NODES[idx].pos}>
                        <sphereGeometry args={[0.075, 12, 12]} />
                        <meshBasicMaterial color={c.color} />
                    </mesh>
                </group>
            ))}
        </group>
    );
}

function NodeGeometry({ shape, color, active }) {
    const scale = active ? 1.18 : 1;
    return (
        <group scale={scale}>
            {shape === 'box' && (
                <>
                    <mesh>
                        <boxGeometry args={[0.72, 0.72, 0.72]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.25, 20, 20]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
                    </mesh>
                </>
            )}
            {shape === 'icosahedron' && (
                <>
                    <mesh>
                        <icosahedronGeometry args={[0.56, 1]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.26, 20, 20]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.0} />
                    </mesh>
                </>
            )}
            {shape === 'dodecahedron' && (
                <>
                    <mesh>
                        <dodecahedronGeometry args={[0.62, 0]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.29, 24, 24]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.35} />
                    </mesh>
                </>
            )}
            {shape === 'prism' && (
                <>
                    <mesh rotation={[0.15, 0.35, -0.1]}>
                        <boxGeometry args={[0.42, 0.76, 0.24]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.88} />
                    </mesh>
                    <mesh>
                        <boxGeometry args={[0.22, 0.48, 0.14]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.05} />
                    </mesh>
                </>
            )}
            {shape === 'octahedron' && (
                <>
                    <mesh>
                        <octahedronGeometry args={[0.55, 0]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.25, 20, 20]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} />
                    </mesh>
                </>
            )}
            {shape === 'sphere' && (
                <>
                    <mesh>
                        <icosahedronGeometry args={[0.58, 2]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.75} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.32, 24, 24]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.15} />
                    </mesh>
                </>
            )}
            {/* Subtle equator halo around each node */}
            <mesh rotation={[Math.PI / 2.2, 0, 0]}>
                <torusGeometry args={[0.68, 0.012, 10, 48]} />
                <meshBasicMaterial color={color} transparent opacity={active ? 0.85 : 0.42} />
            </mesh>
        </group>
    );
}

function InteractiveNode({ node, index, active, onSelect, reducedMotion }) {
    const meshRef = useRef();

    useFrame(({ clock }) => {
        if (reducedMotion || !meshRef.current) return;
        const t = clock.elapsedTime;
        meshRef.current.rotation.y = t * 0.45 + index;
        meshRef.current.rotation.x = Math.sin(t * 0.6 + index) * 0.15;
        meshRef.current.position.y = node.pos[1] + Math.sin(t * 1.4 + index) * 0.08;
    });

    const labelBelow = index % 2 === 1;

    return (
        <group
            ref={meshRef}
            position={node.pos}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(node.id);
            }}
            onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                document.body.style.cursor = 'default';
            }}
        >
            <NodeGeometry shape={node.shape} color={node.color} active={active} />
            <Html
                center
                position={[0, labelBelow ? -0.98 : 0.96, 0]}
                style={{ pointerEvents: 'auto' }}
            >
                <button
                    type="button"
                    onClick={() => onSelect(node.id)}
                    className={`arch-node-pill ${active ? 'active' : ''}`}
                    style={{ '--node-color': node.color }}
                >
                    <span className="arch-node-dot" style={{ background: node.color }} />
                    <span>{node.title}</span>
                </button>
            </Html>
        </group>
    );
}

export default function ArchitectureOrbit3D() {
    const [selectedId, setSelectedId] = useState('ai');
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        []
    );
    const activeNode = ARCHITECTURE_NODES.find((n) => n.id === selectedId) || ARCHITECTURE_NODES[2];

    const cycleNextNode = () => {
        const idx = ARCHITECTURE_NODES.findIndex((n) => n.id === selectedId);
        setSelectedId(ARCHITECTURE_NODES[(idx + 1) % ARCHITECTURE_NODES.length].id);
    };

    return (
        <div className="arch-stage">
            <span className="arch-corner tl" />
            <span className="arch-corner tr" />
            <span className="arch-corner bl" />
            <span className="arch-corner br" />

            {/* Top HUD telemetry bars */}
            <div className="arch-hud-top">
                <div className="arch-hud-chip">
                    <span className="arch-hud-status">
                        <span className="arch-node-dot" style={{ background: '#22d3ee' }} />
                        SYS_TELEMETRY: ACTIVE (6/6 NODES)
                    </span>
                    <span className="arch-hud-sub">ORBITAL INCLINATION: 34.2° · END-TO-END DETERMINISTIC</span>
                </div>
                <div className="arch-hud-chip right">
                    <span className="arch-hud-status" style={{ color: '#c084fc' }}>
                        OPENROUTER $0 FREE · RLS STORAGE
                    </span>
                    <span className="arch-hud-sub">AES-256 JWT · IRDAI RULE ENGINE · ZERO MOCKS</span>
                </div>
            </div>

            {/* 3D Orbital Canvas */}
            <div className="arch-canvas-wrap">
                <CanvasErrorBoundary fallbackTitle="Interactive 3D view switched to compact mode">
                    <Canvas
                        dpr={[1, 1.5]}
                        camera={{ position: [0, 1.55, 9.6], fov: 42 }}
                        gl={{ alpha: true, antialias: true }}
                    >
                        <ambientLight intensity={0.75} />
                        <pointLight position={[6, 6, 6]} intensity={1.8} color="#ffffff" />
                        <pointLight position={[-6, -3, 4]} intensity={1.1} color="#ec4899" />
                        <OrbitStarfield reducedMotion={reducedMotion} />
                        <OrbitRings />
                        <TelemetryPackets reducedMotion={reducedMotion} />
                        {ARCHITECTURE_NODES.map((node, i) => (
                            <InteractiveNode
                                key={node.id}
                                node={node}
                                index={i}
                                active={selectedId === node.id}
                                onSelect={setSelectedId}
                                reducedMotion={reducedMotion}
                            />
                        ))}
                    </Canvas>
                </CanvasErrorBoundary>
            </div>

            {/* Bottom Center Pill + Mobile Selector Strip + Live Node Spec Drawer */}
            <div className="arch-footer-area">
                <div className="arch-mobile-pills">
                    {ARCHITECTURE_NODES.map((n) => (
                        <button
                            key={n.id}
                            type="button"
                            onClick={() => setSelectedId(n.id)}
                            className={`arch-node-pill ${selectedId === n.id ? 'active' : ''}`}
                            style={{ '--node-color': n.color }}
                        >
                            <span className="arch-node-dot" style={{ background: n.color }} />
                            <span>{n.title}</span>
                        </button>
                    ))}
                </div>

                <div className="arch-inspector-card" style={{ '--node-color': activeNode.color }}>
                    <div className="arch-inspector-head">
                        <div className="arch-inspector-title">
                            <span className="arch-node-dot" style={{ background: activeNode.color }} />
                            <strong>{activeNode.title}</strong>
                            <span className="arch-inspector-tag">{activeNode.short}</span>
                        </div>
                        <span className="arch-inspector-metric">{activeNode.metrics}</span>
                    </div>
                    <p className="arch-inspector-desc">{activeNode.specs}</p>
                </div>

                <button type="button" className="arch-center-pill" onClick={cycleNextNode}>
                    <span className="arch-node-dot" style={{ background: '#22d3ee' }} />
                    <span>SYSTEM ARCHITECTURE · CLICK TO CYCLE NODE</span>
                </button>
            </div>
        </div>
    );
}
