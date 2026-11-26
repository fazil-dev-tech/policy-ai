import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

function FemaleHumanoidHead({ state = 'idle', mouthLevel = 0 }) {
    const groupRef = useRef();
    const jawRef = useRef();
    const upperLipRef = useRef();
    const haloRef = useRef();
    const leftEyeRef = useRef();
    const rightEyeRef = useRef();

    const stateColors = {
        idle: '#ec4899',
        listening: '#059669',
        researching: '#8b5cf6',
        speaking: '#f43f5e',
    };
    const accentHex = stateColors[state] || '#ec4899';

    useFrame(({ clock }) => {
        const t = clock.getElapsedTime();
        if (groupRef.current) {
            const nodAmp = state === 'speaking' ? 0.05 : 0.02;
            groupRef.current.rotation.y = Math.sin(t * 0.7) * 0.14;
            groupRef.current.rotation.x = Math.sin(t * 1.4) * nodAmp;
        }

        // Animated jaw & lower-lip movement synchronized with speech boundaries
        if (jawRef.current && upperLipRef.current) {
            const targetOpen =
                state === 'speaking'
                    ? 0.08 + Math.abs(Math.sin(t * 15)) * 0.14 + mouthLevel * 0.12
                    : state === 'listening'
                      ? 0.02
                      : 0.0;
            jawRef.current.position.y = THREE.MathUtils.lerp(jawRef.current.position.y, -0.22 - targetOpen, 0.35);
            jawRef.current.scale.y = THREE.MathUtils.lerp(jawRef.current.scale.y, 1 + targetOpen * 2.4, 0.35);
            upperLipRef.current.position.y = THREE.MathUtils.lerp(upperLipRef.current.position.y, -0.17 + targetOpen * 0.25, 0.35);
        }

        // Subtle realistic blink every ~4 seconds
        const blinkPhase = t % 4.2;
        const blinkScaleY = blinkPhase > 4.05 ? 0.12 : 1.0;
        if (leftEyeRef.current && rightEyeRef.current) {
            leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, blinkScaleY, 0.5);
            rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, blinkScaleY, 0.5);
        }

        if (haloRef.current) {
            haloRef.current.rotation.z = t * (state === 'researching' ? 1.8 : 0.45);
            const pulse = state === 'speaking' || state === 'listening' ? 1 + Math.sin(t * 6) * 0.05 : 1;
            haloRef.current.scale.set(pulse, pulse, 1);
        }
    });

    return (
        <Float speed={1.8} rotationIntensity={0.12} floatIntensity={0.28}>
            <group ref={groupRef} position={[0, 0.05, 0]}>
                {/* Sculpted Shoulders & Collar Bust */}
                <mesh position={[0, -0.92, 0]} scale={[1.35, 0.52, 0.72]}>
                    <sphereGeometry args={[0.62, 32, 32]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.25} metalness={0.18} />
                </mesh>
                {/* Rose Accent Collar Ring */}
                <mesh position={[0, -0.66, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.31, 0.032, 16, 48]} />
                    <meshStandardMaterial color={accentHex} emissive={accentHex} emissiveIntensity={0.55} roughness={0.2} metalness={0.4} />
                </mesh>
                {/* Neck */}
                <mesh position={[0, -0.49, 0]}>
                    <cylinderGeometry args={[0.17, 0.22, 0.36, 28]} />
                    <meshStandardMaterial color="#fde8ef" roughness={0.38} metalness={0.05} />
                </mesh>

                {/* Head / Face Oval */}
                <mesh position={[0, 0.03, 0]} scale={[0.92, 1.12, 0.96]}>
                    <sphereGeometry args={[0.46, 36, 36]} />
                    <meshStandardMaterial color="#fff1f5" roughness={0.32} metalness={0.08} />
                </mesh>

                {/* Stylized Hair Crown & Side Locks */}
                <mesh position={[0, 0.21, -0.06]} scale={[1.03, 0.94, 1.05]}>
                    <sphereGeometry args={[0.47, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
                    <meshStandardMaterial color="#312e81" roughness={0.35} metalness={0.25} />
                </mesh>
                <mesh position={[-0.36, -0.06, -0.14]} scale={[0.42, 0.88, 0.55]}>
                    <sphereGeometry args={[0.42, 24, 24]} />
                    <meshStandardMaterial color="#312e81" roughness={0.35} metalness={0.25} />
                </mesh>
                <mesh position={[0.36, -0.06, -0.14]} scale={[0.42, 0.88, 0.55]}>
                    <sphereGeometry args={[0.42, 24, 24]} />
                    <meshStandardMaterial color="#312e81" roughness={0.35} metalness={0.25} />
                </mesh>

                {/* Expressive Eyes + Brows */}
                <group ref={leftEyeRef} position={[-0.15, 0.08, 0.39]}>
                    <mesh>
                        <sphereGeometry args={[0.052, 18, 18]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.2} />
                    </mesh>
                    <mesh position={[0.015, 0.015, 0.042]}>
                        <sphereGeometry args={[0.015, 12, 12]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                </group>
                <group ref={rightEyeRef} position={[0.15, 0.08, 0.39]}>
                    <mesh>
                        <sphereGeometry args={[0.052, 18, 18]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.1} metalness={0.2} />
                    </mesh>
                    <mesh position={[0.015, 0.015, 0.042]}>
                        <sphereGeometry args={[0.015, 12, 12]} />
                        <meshBasicMaterial color="#ffffff" />
                    </mesh>
                </group>
                {/* Eyebrows */}
                <mesh position={[-0.15, 0.165, 0.39]} rotation={[0, 0, 0.08]} scale={[1.2, 0.25, 0.4]}>
                    <capsuleGeometry args={[0.035, 0.06, 6, 12]} />
                    <meshStandardMaterial color="#1e1b4b" />
                </mesh>
                <mesh position={[0.15, 0.165, 0.39]} rotation={[0, 0, -0.08]} scale={[1.2, 0.25, 0.4]}>
                    <capsuleGeometry args={[0.035, 0.06, 6, 12]} />
                    <meshStandardMaterial color="#1e1b4b" />
                </mesh>

                {/* Subtle Nose Bridge */}
                <mesh position={[0, -0.02, 0.43]} scale={[0.45, 0.9, 0.6]}>
                    <sphereGeometry args={[0.055, 16, 16]} />
                    <meshStandardMaterial color="#fce7f3" roughness={0.35} />
                </mesh>

                {/* Upper Lip */}
                <mesh ref={upperLipRef} position={[0, -0.17, 0.415]} rotation={[0, 0, Math.PI / 2]} scale={[0.5, 1.35, 0.55]}>
                    <capsuleGeometry args={[0.024, 0.085, 8, 16]} />
                    <meshStandardMaterial color="#e11d48" roughness={0.25} />
                </mesh>

                {/* Articulated Lower Lip / Jaw synced to speech */}
                <mesh ref={jawRef} position={[0, -0.22, 0.41]} rotation={[0, 0, Math.PI / 2]} scale={[0.55, 1.2, 0.55]}>
                    <capsuleGeometry args={[0.024, 0.075, 8, 16]} />
                    <meshStandardMaterial color="#be123c" roughness={0.25} />
                </mesh>

                {/* Holographic Reactive Status Halo */}
                <mesh ref={haloRef} position={[0, 0.04, -0.34]}>
                    <torusGeometry args={[0.88, 0.018, 16, 72]} />
                    <meshStandardMaterial color={accentHex} emissive={accentHex} emissiveIntensity={0.8} transparent opacity={0.75} />
                </mesh>
            </group>
        </Float>
    );
}

class AvatarErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', borderRadius: 16
                }}>
                    <div style={{
                        width: 84, height: 84, borderRadius: '50%',
                        background: 'var(--accent-gradient)', boxShadow: 'var(--accent-glow)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 28
                    }}>P</div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Parinidhi Voice Core Active</span>
                </div>
            );
        }
        return this.props.children;
    }
}

export default function ParinidhiAvatar3D({ state = 'idle', mouthLevel = 0, height = 240 }) {
    return (
        <div style={{ width: '100%', height, borderRadius: 18, overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle at 50% 35%, rgba(244,114,182,0.18), rgba(255,255,255,0.65))' }}>
            <AvatarErrorBoundary>
                <Canvas camera={{ position: [0, 0.05, 2.35], fov: 38 }} dpr={[1, 1.5]}>
                    <ambientLight intensity={1.15} />
                    <directionalLight position={[2, 3, 4]} intensity={1.4} color="#ffffff" />
                    <pointLight position={[-2, -1, 2]} intensity={0.9} color="#ec4899" />
                    <FemaleHumanoidHead state={state} mouthLevel={mouthLevel} />
                </Canvas>
            </AvatarErrorBoundary>
            <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.88)', border: '1px solid var(--border-color)',
                padding: '3px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.6
            }}>
                Parinidhi · {state}
            </div>
        </div>
    );
}
