import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import CameraRig from './CameraRig';
import DataStreamField from './DataStreamField';

const MODE_PALETTES = {
    health: { core: '#e11d48', rim: '#fda4af', glow: '#fb7185', crystalTint: '#140c18' },
    motor: { core: '#d97706', rim: '#fde68a', glow: '#fbbf24', crystalTint: '#17110b' },
    shield: { core: '#0284c7', rim: '#7dd3fc', glow: '#38bdf8', crystalTint: '#0b1422' },
};

function AmbientHorizonMist({ color = '#fda4af', reducedMotion }) {
    const ref = useRef();
    const positions = useMemo(() => {
        const count = 420;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 32;
            const z = (Math.random() - 0.5) * 18 - 3;
            const wave = Math.sin(x * 0.28) * 0.35 + Math.cos(z * 0.35) * 0.25;
            arr[i * 3] = x;
            arr[i * 3 + 1] = -3.6 + wave;
            arr[i * 3 + 2] = z;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !ref.current) return;
        ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.08) * 0.06;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.055} color={color} transparent opacity={0.34} sizeAttenuation depthWrite={false} />
        </points>
    );
}

function CalibrationDial({ reducedMotion, rimColor }) {
    const dialRef = useRef();

    const ticks = useMemo(() => {
        const list = [];
        const total = 32;
        const radius = 3.55;
        for (let i = 0; i < total; i++) {
            const angle = (i / total) * Math.PI * 2;
            list.push({
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
                rotZ: angle,
                major: i % 8 === 0,
            });
        }
        return list;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !dialRef.current) return;
        dialRef.current.rotation.z = -clock.elapsedTime * 0.04;
    });

    return (
        <group ref={dialRef} rotation={[Math.PI / 2.75, 0.2, 0]}>
            <mesh>
                <torusGeometry args={[3.55, 0.008, 10, 128]} />
                <meshBasicMaterial color="#64748b" transparent opacity={0.22} depthWrite={false} />
            </mesh>
            <mesh>
                <torusGeometry args={[2.8, 0.007, 10, 110]} />
                <meshBasicMaterial color={rimColor} transparent opacity={0.24} depthWrite={false} />
            </mesh>
            {ticks.map((t, idx) => (
                <mesh key={idx} position={[t.x, t.y, 0]} rotation={[0, 0, t.rotZ]}>
                    <boxGeometry args={[t.major ? 0.16 : 0.06, 0.014, 0.014]} />
                    <meshBasicMaterial color={t.major ? rimColor : '#64748b'} transparent opacity={t.major ? 0.55 : 0.25} depthWrite={false} />
                </mesh>
            ))}
        </group>
    );
}

function VaultCoreAssembly({ mode = 'health', reducedMotion }) {
    const rootRef = useRef();
    const ringA = useRef();
    const ringB = useRef();
    const ringC = useRef();
    const crystalRef = useRef();
    const nucleusRef = useRef();
    const palette = MODE_PALETTES[mode] || MODE_PALETTES.health;

    useFrame(({ clock, pointer }) => {
        if (!rootRef.current) return;
        if (!reducedMotion) {
            const t = clock.elapsedTime;
            rootRef.current.position.y = 0.22 + Math.sin(t * 0.8) * 0.12;
            rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, t * 0.08 + pointer.x * 0.16, 0.04);
            rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, -0.06 + pointer.y * 0.09, 0.04);
            if (ringA.current) ringA.current.rotation.z = t * 0.18;
            if (ringB.current) ringB.current.rotation.x = -t * 0.14;
            if (ringC.current) ringC.current.rotation.y = t * 0.12;
            if (crystalRef.current) crystalRef.current.rotation.y = -t * 0.2;
            if (nucleusRef.current) {
                nucleusRef.current.rotation.y = t * 0.35;
                const pulse = 1 + Math.sin(t * 2.0) * 0.05;
                nucleusRef.current.scale.setScalar(pulse);
            }
        }
    });

    return (
        /* Centered neatly behind the right frosted glass card so halo & rings frame all 4 glass edges symmetrically */
        <group ref={rootRef} position={[2.65, 0.22, -1.75]} scale={1.36}>
            {/* Luminous Inner Energy Nucleus */}
            <mesh ref={nucleusRef}>
                <octahedronGeometry args={[0.56, 0]} />
                <meshStandardMaterial
                    color="#fff1f5"
                    emissive={palette.glow}
                    emissiveIntensity={1.45}
                    roughness={0.18}
                />
            </mesh>

            {/* Refractive Crystal Facet Shell */}
            <mesh ref={crystalRef}>
                <octahedronGeometry args={[1.08, 1]} />
                <meshPhysicalMaterial
                    color={palette.crystalTint}
                    emissive={palette.core}
                    emissiveIntensity={0.42}
                    metalness={0.28}
                    roughness={0.12}
                    clearcoat={1}
                    clearcoatRoughness={0.08}
                    reflectivity={0.95}
                    iridescence={0.35}
                    transparent
                    opacity={0.78}
                    depthWrite={false}
                    flatShading
                />
            </mesh>

            {/* Outer Subtle Geodesic Wireframe */}
            <mesh renderOrder={3}>
                <icosahedronGeometry args={[1.56, 1]} />
                <meshStandardMaterial
                    color="#475569"
                    emissive={palette.rim}
                    emissiveIntensity={0.28}
                    metalness={0.85}
                    roughness={0.22}
                    wireframe
                    transparent
                    opacity={0.42}
                    depthWrite={false}
                />
            </mesh>

            {/* Volumetric Dual Aura Glow behind Glass Card */}
            <mesh renderOrder={1}>
                <sphereGeometry args={[2.25, 32, 32]} />
                <meshBasicMaterial color={palette.core} transparent opacity={0.16} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
            </mesh>
            <mesh renderOrder={1}>
                <sphereGeometry args={[2.95, 32, 32]} />
                <meshBasicMaterial color={palette.rim} transparent opacity={0.07} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
            </mesh>

            {/* Precision Gyroscopic Orbit Rings */}
            <group ref={ringA} rotation={[Math.PI / 3.1, 0.36, 0]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[2.32, 0.011, 12, 128]} />
                    <meshBasicMaterial color={palette.glow} transparent opacity={0.58} depthWrite={false} />
                </mesh>
                <mesh position={[2.32, 0, 0]}>
                    <sphereGeometry args={[0.056, 12, 12]} />
                    <meshBasicMaterial color={palette.rim} />
                </mesh>
            </group>

            <group ref={ringB} rotation={[-Math.PI / 4.2, -0.4, 0.28]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[2.72, 0.009, 12, 128, Math.PI * 1.5]} />
                    <meshBasicMaterial color={palette.rim} transparent opacity={0.46} depthWrite={false} />
                </mesh>
                <mesh position={[0, 2.72, 0]}>
                    <sphereGeometry args={[0.048, 12, 12]} />
                    <meshBasicMaterial color={palette.rim} />
                </mesh>
            </group>

            <group ref={ringC} rotation={[Math.PI / 2.2, -0.32, 0.55]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[1.92, 0.007, 10, 100, Math.PI * 1.25]} />
                    <meshBasicMaterial color="#cbd5e1" transparent opacity={0.22} depthWrite={false} />
                </mesh>
            </group>

            <CalibrationDial reducedMotion={reducedMotion} rimColor={palette.rim} />
            <pointLight position={[0, 0, 1.5]} distance={10} intensity={2.2} color={palette.glow} />
        </group>
    );
}

export default function HeroVaultScene3D({ mode = 'health', reducedMotion = false }) {
    const palette = MODE_PALETTES[mode] || MODE_PALETTES.health;
    return (
        <CanvasErrorBoundary fallbackTitle="3D Core Engine Preview Ready">
            <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 0.25, 10.6], fov: 44 }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={1.1} />
                <directionalLight position={[8, 9, 8]} intensity={2.2} color="#ffffff" />
                <directionalLight position={[-6, 6, 4]} intensity={1.4} color={palette.glow} />
                <pointLight position={[2.6, -3, 4]} intensity={1.2} color={palette.rim} />
                <CameraRig intensity={0.42} />
                <DataStreamField active={mode !== 'health'} color={palette.rim} />
                <AmbientHorizonMist color={palette.rim} reducedMotion={reducedMotion} />
                <VaultCoreAssembly mode={mode} reducedMotion={reducedMotion} />
                <fog attach="fog" args={['#060913', 10, 28]} />
            </Canvas>
        </CanvasErrorBoundary>
    );
}
