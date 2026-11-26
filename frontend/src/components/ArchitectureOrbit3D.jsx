import { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import * as THREE from 'three';
import CanvasErrorBoundary from './shared/CanvasErrorBoundary';

export const ARCHITECTURE_NODES = [
    {
        id: 'client',
        title: 'Browser & Scam Shield',
        short: 'Web App · Chrome Ext',
        color: '#38bdf8',
        shape: 'box',
        pos: [-7.0, 0.32, 0.45],
        labelOffset: [0, 0.98, 0],
        specs: 'Web workspace paired with our Chrome extension guarding Websites, WhatsApp Web & Gmail from fake links.',
        metrics: '3 Surfaces · Instant Rules',
    },
    {
        id: 'api',
        title: 'API Security Gate',
        short: 'Auth · Validation',
        color: '#818cf8',
        shape: 'icosahedron',
        pos: [-4.2, -0.58, 1.25],
        labelOffset: [0, -1.0, 0],
        specs: 'JWT user authentication, strict input checks, rate limiting, and live domain safety inspection.',
        metrics: 'Protected Routes · Safe Input',
    },
    {
        id: 'ai',
        title: 'Multilingual AI Router',
        short: 'Voice · Free Failover',
        color: '#fb7185',
        shape: 'dodecahedron',
        pos: [-1.4, 0.62, -0.85],
        labelOffset: [0, 0.98, 0],
        specs: 'Free-tier AI failover powering plain-English policy explanations and Parinidhi voice & chat assistance.',
        metrics: 'Zero-Cost AI · Live Web Check',
    },
    {
        id: 'db',
        title: 'Private Vault & Index',
        short: 'Database · Storage',
        color: '#10b981',
        shape: 'prism',
        pos: [1.4, -0.56, 1.15],
        labelOffset: [0, -1.0, 0],
        specs: 'User-scoped PostgreSQL storage, private signed downloads, page-cited policy search, and family records.',
        metrics: 'Row-Level Vault · Signed Files',
    },
    {
        id: 'engine',
        title: 'Claim & Damage Engine',
        short: 'Payouts · Photo AI',
        color: '#f59e0b',
        shape: 'octahedron',
        pos: [4.2, 0.56, -0.75],
        labelOffset: [0, 0.98, 0],
        specs: 'Rule-based IRDAI payout calculator plus car photo damage estimator with local Python model fallback.',
        metrics: '7 Scenarios · Quote Audit',
    },
    {
        id: 'dispatch',
        title: 'PDF & Appeal Dispatch',
        short: 'Guides · E-Cards',
        color: '#f43f5e',
        shape: 'sphere',
        pos: [7.0, -0.22, 0.55],
        labelOffset: [0, -1.0, 0],
        specs: 'Downloadable Claim Prep Guides, Family Emergency Cards, 3-hour cashless SLA alerts & IRDAI appeal drafts.',
        metrics: '3h Cashless Rule · SOS Ready',
    },
];

function createOrbitSpriteTexture(soft = false) {
    if (typeof document === 'undefined') return null;
    const size = soft ? 128 : 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    if (soft) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.42)');
        grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.12)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.88)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.24)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function OrbitCameraFrame({ reducedMotion }) {
    const { camera } = useThree();
    useEffect(() => {
        camera.lookAt(0, -0.05, 0);
    }, [camera]);

    useFrame(({ pointer }) => {
        if (reducedMotion) return;
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 0.42, 0.04);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 2.15 + pointer.y * 0.24, 0.04);
        camera.lookAt(0, -0.05, 0);
    });

    return null;
}

function OrbitStarfield({ reducedMotion, spriteMap }) {
    const ref = useRef();
    const positions = useMemo(() => {
        const count = 560;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 38;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 20;
            arr[i * 3 + 2] = (Math.random() - 0.5) * 16 - 4;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !ref.current) return;
        ref.current.rotation.y = clock.elapsedTime * 0.012;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                map={spriteMap || undefined}
                size={0.14}
                color="#e2e8f0"
                transparent
                opacity={0.78}
                sizeAttenuation
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

function ActiveNodeGlow({ activePos, activeColor = '#ffffff', auraMap }) {
    if (!activePos) return null;
    return (
        <group position={activePos}>
            <sprite scale={[2.9, 2.9, 1]} renderOrder={1}>
                <spriteMaterial
                    map={auraMap || undefined}
                    color={activeColor}
                    transparent
                    opacity={0.38}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </sprite>
            <sprite scale={[1.65, 1.65, 1]} renderOrder={2}>
                <spriteMaterial
                    map={auraMap || undefined}
                    color="#ffffff"
                    transparent
                    opacity={0.16}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </sprite>
        </group>
    );
}

function TelemetryPackets({ reducedMotion }) {
    const curves = useMemo(() => {
        const list = [];
        for (let i = 0; i < ARCHITECTURE_NODES.length - 1; i++) {
            const a = new THREE.Vector3(...ARCHITECTURE_NODES[i].pos);
            const b = new THREE.Vector3(...ARCHITECTURE_NODES[i + 1].pos);
            const mid = a.clone().add(b).multiplyScalar(0.5);
            mid.y += i % 2 === 0 ? 0.22 : -0.18;
            mid.z += 0.16;
            list.push({
                curve: new THREE.QuadraticBezierCurve3(a, mid, b),
                color: ARCHITECTURE_NODES[i].color,
                offset: i * 0.21,
            });
        }
        return list;
    }, []);

    const lineGeometries = useMemo(
        () => curves.map((c) => new THREE.BufferGeometry().setFromPoints(c.curve.getPoints(36))),
        [curves]
    );

    const pulseRefs = useRef([]);

    useEffect(() => () => {
        lineGeometries.forEach((g) => g.dispose());
    }, [lineGeometries]);

    useFrame(({ clock }) => {
        if (reducedMotion) return;
        const t = clock.elapsedTime * 0.34;
        curves.forEach((c, idx) => {
            const baseU = (t + c.offset) % 1;
            [0, 0.036, 0.072].forEach((lag, bIdx) => {
                const mesh = pulseRefs.current[idx * 3 + bIdx];
                if (!mesh) return;
                const u = (baseU - lag + 1) % 1;
                mesh.position.copy(c.curve.getPoint(u));
            });
        });
    });

    return (
        <group>
            {curves.map((c, idx) => (
                <group key={idx}>
                    <line geometry={lineGeometries[idx]}>
                        <lineBasicMaterial color={c.color} transparent opacity={0.44} depthWrite={false} />
                    </line>
                    {[0.082, 0.058, 0.038].map((rad, bIdx) => (
                        <mesh
                            key={bIdx}
                            ref={(el) => { pulseRefs.current[idx * 3 + bIdx] = el; }}
                            position={ARCHITECTURE_NODES[idx].pos}
                        >
                            <sphereGeometry args={[rad, 10, 10]} />
                            <meshBasicMaterial color={c.color} transparent opacity={1 - bIdx * 0.26} depthWrite={false} />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
}

function NodeGeometry({ shape, color, active }) {
    const scale = active ? 1.2 : 1.02;
    const emissiveInt = active ? 1.55 : 1.05;
    return (
        <group scale={scale}>
            {shape === 'box' && (
                <>
                    <mesh renderOrder={3}>
                        <boxGeometry args={[0.76, 0.76, 0.76]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.95} depthWrite={false} />
                    </mesh>
                    <mesh>
                        <boxGeometry args={[0.38, 0.38, 0.38]} />
                        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={emissiveInt} roughness={0.14} clearcoat={1} />
                    </mesh>
                </>
            )}
            {shape === 'icosahedron' && (
                <>
                    <mesh renderOrder={3}>
                        <icosahedronGeometry args={[0.58, 1]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.92} depthWrite={false} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.27, 20, 20]} />
                        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={emissiveInt} roughness={0.14} clearcoat={1} />
                    </mesh>
                </>
            )}
            {shape === 'dodecahedron' && (
                <>
                    <mesh renderOrder={3}>
                        <dodecahedronGeometry args={[0.64, 0]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.95} depthWrite={false} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.29, 24, 24]} />
                        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={active ? 1.65 : 1.2} roughness={0.12} clearcoat={1} />
                    </mesh>
                </>
            )}
            {shape === 'prism' && (
                <>
                    <mesh rotation={[0.15, 0.35, -0.1]} renderOrder={3}>
                        <boxGeometry args={[0.44, 0.78, 0.26]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.95} depthWrite={false} />
                    </mesh>
                    <mesh>
                        <boxGeometry args={[0.24, 0.48, 0.15]} />
                        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={emissiveInt} roughness={0.15} clearcoat={1} />
                    </mesh>
                </>
            )}
            {shape === 'octahedron' && (
                <>
                    <mesh renderOrder={3}>
                        <octahedronGeometry args={[0.58, 0]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.94} depthWrite={false} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.26, 20, 20]} />
                        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={emissiveInt} roughness={0.14} clearcoat={1} />
                    </mesh>
                </>
            )}
            {shape === 'sphere' && (
                <>
                    <mesh renderOrder={3}>
                        <icosahedronGeometry args={[0.6, 2]} />
                        <meshBasicMaterial color={color} wireframe transparent opacity={0.88} depthWrite={false} />
                    </mesh>
                    <mesh>
                        <sphereGeometry args={[0.32, 24, 24]} />
                        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={emissiveInt} roughness={0.12} clearcoat={1} />
                    </mesh>
                </>
            )}
            {/* Equator ring around each node with depthWrite={false} */}
            <mesh rotation={[Math.PI / 2.2, 0, 0]} renderOrder={3}>
                <torusGeometry args={[0.72, 0.022, 12, 56]} />
                <meshBasicMaterial color={color} transparent opacity={active ? 0.92 : 0.56} depthWrite={false} />
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
        meshRef.current.position.y = Math.sin(t * 1.4 + index) * 0.08;
    });

    const labelOffset = node.labelOffset || [0, index % 2 === 1 ? -0.92 : 0.94, 0];

    return (
        <group position={node.pos}>
            <group
                ref={meshRef}
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
            </group>
            <Html
                center
                position={labelOffset}
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
    const [autoCycle, setAutoCycle] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

    const spriteMap = useMemo(() => createOrbitSpriteTexture(false), []);
    const auraMap = useMemo(() => createOrbitSpriteTexture(true), []);

    useEffect(() => {
        if (spriteMap) spriteMap.needsUpdate = true;
        if (auraMap) auraMap.needsUpdate = true;
        return () => {
            document.body.style.cursor = 'default';
            if (spriteMap) spriteMap.dispose();
            if (auraMap) auraMap.dispose();
        };
    }, [spriteMap, auraMap]);
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        []
    );

    useEffect(() => {
        if (reducedMotion || !autoCycle || isHovered) return undefined;
        const timer = window.setInterval(() => {
            setSelectedId((prev) => {
                const idx = ARCHITECTURE_NODES.findIndex((n) => n.id === prev);
                return ARCHITECTURE_NODES[(idx + 1) % ARCHITECTURE_NODES.length].id;
            });
        }, 4200);
        return () => window.clearInterval(timer);
    }, [reducedMotion, autoCycle, isHovered]);

    const activeIdx = Math.max(0, ARCHITECTURE_NODES.findIndex((n) => n.id === selectedId));
    const activeNode = ARCHITECTURE_NODES[activeIdx] || ARCHITECTURE_NODES[2];

    return (
        <div
            className="arch-stage"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <span className="arch-corner tl" />
            <span className="arch-corner tr" />
            <span className="arch-corner bl" />
            <span className="arch-corner br" />

            {/* Clean Symmetric Top HUD */}
            <div className="arch-hud-top">
                <div className="arch-hud-chip">
                    <span className="arch-hud-status">
                        <span className="arch-node-dot" style={{ background: autoCycle ? '#22d3ee' : '#fbbf24' }} />
                        LIVE ARCHITECTURE · 6 CONNECTED LAYERS
                    </span>
                    <span className="arch-hud-sub">CLICK ANY LAYER BELOW OR IN 3D TO INSPECT DATA FLOW</span>
                </div>
                <div className="arch-hud-chip right">
                    <span className="arch-hud-status" style={{ color: '#fda4af' }}>
                        PRIVACY-FIRST PIPELINE
                    </span>
                    <span className="arch-hud-sub">PII MASKING · RULE-CHECKED PAYOUTS · PRIVATE STORAGE</span>
                </div>
            </div>

            {/* 3D Orbital Canvas */}
            <div className="arch-canvas-wrap">
                <CanvasErrorBoundary fallbackTitle="Interactive 3D view switched to compact mode">
                    <Canvas
                        dpr={[1, 1.5]}
                        camera={{ position: [0, 2.15, 11.4], fov: 39 }}
                        gl={{ alpha: true, antialias: true }}
                    >
                        <OrbitCameraFrame reducedMotion={reducedMotion} />
                        <ambientLight intensity={0.95} />
                        <directionalLight position={[6, 8, 6]} intensity={2.1} color="#ffffff" />
                        <pointLight position={[-6, -3, 4]} intensity={1.35} color="#ec4899" />
                        <OrbitStarfield reducedMotion={reducedMotion} spriteMap={spriteMap} />
                        <ActiveNodeGlow activePos={activeNode.pos} activeColor={activeNode.color} auraMap={auraMap} />
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

            {/* Unified Glass Pipeline Dock & Inspector Drawer */}
            <div className="arch-footer-area">
                <div className="arch-pipeline-dock">
                    <div className="arch-pipeline-tabs" role="tablist" aria-label="System Architecture Pipeline">
                        {ARCHITECTURE_NODES.map((n, i) => {
                            const isActive = selectedId === n.id;
                            return (
                                <button
                                    key={n.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setSelectedId(n.id)}
                                    className={`arch-dock-item ${isActive ? 'active' : ''}`}
                                    style={{ '--node-color': n.color }}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId="archPipelineDockPill"
                                            className="arch-dock-active-bg"
                                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                                        />
                                    )}
                                    <span className="arch-dock-content">
                                        <span className="arch-node-dot" style={{ background: n.color }} />
                                        <span>{i + 1}. {n.title}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        className={`arch-dock-play ${autoCycle ? 'playing' : 'paused'}`}
                        onClick={() => setAutoCycle((p) => !p)}
                        aria-label={autoCycle ? 'Pause automatic tour' : 'Play automatic tour'}
                        aria-pressed={!autoCycle}
                        title={autoCycle ? 'Pause auto-tour' : 'Play auto-tour'}
                    >
                        {autoCycle ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                </div>

                <div key={activeNode.id} className="arch-inspector-card arch-inspector-enter" style={{ '--node-color': activeNode.color }}>
                    <div className="arch-inspector-head">
                        <div className="arch-inspector-title">
                            <span className="arch-node-dot" style={{ background: activeNode.color, boxShadow: `0 0 10px ${activeNode.color}` }} />
                            <span className="arch-step-counter">0{activeIdx + 1} / 0{ARCHITECTURE_NODES.length}</span>
                            <strong>{activeNode.title}</strong>
                            <span className="arch-inspector-tag">{activeNode.short}</span>
                        </div>
                        <span className="arch-inspector-metric">{activeNode.metrics}</span>
                    </div>
                    <p className="arch-inspector-desc">{activeNode.specs}</p>
                </div>
            </div>
        </div>
    );
}
