import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import CameraRig from './CameraRig';
import GridFloor from './GridFloor';
import DataStreamField from './DataStreamField';

const MODE_PALETTES = {
    health: { core: '#e11d48', rim: '#38bdf8', glow: '#fb7185', grid: '#e11d4840', crystalTint: '#11182c' },
    motor: { core: '#d97706', rim: '#38bdf8', glow: '#fbbf24', grid: '#f59e0b40', crystalTint: '#16131c' },
    shield: { core: '#0284c7', rim: '#10b981', glow: '#38bdf8', grid: '#38bdf840', crystalTint: '#0b1828' },
};

function CalibrationDial({ reducedMotion, rimColor }) {
    const dialRef = useRef();

    const ticks = useMemo(() => {
        const list = [];
        const total = 32;
        const radius = 3.65;
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
        dialRef.current.rotation.z = -clock.elapsedTime * 0.045;
    });

    return (
        <group ref={dialRef} rotation={[Math.PI / 2.78, 0.24, 0]}>
            <mesh>
                <torusGeometry args={[3.65, 0.011, 10, 128]} />
                <meshBasicMaterial color="#64748b" transparent opacity={0.36} />
            </mesh>
            <mesh>
                <torusGeometry args={[2.85, 0.009, 10, 110]} />
                <meshBasicMaterial color={rimColor} transparent opacity={0.34} />
            </mesh>
            {ticks.map((t, idx) => (
                <mesh key={idx} position={[t.x, t.y, 0]} rotation={[0, 0, t.rotZ]}>
                    <boxGeometry args={[t.major ? 0.2 : 0.08, 0.018, 0.018]} />
                    <meshBasicMaterial color={t.major ? rimColor : '#94a3b8'} transparent opacity={t.major ? 0.85 : 0.38} />
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
            rootRef.current.position.y = 0.28 + Math.sin(t * 0.85) * 0.14;
            rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, t * 0.09 + pointer.x * 0.2, 0.045);
            rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, -0.06 + pointer.y * 0.11, 0.045);
            if (ringA.current) ringA.current.rotation.z = t * 0.22;
            if (ringB.current) ringB.current.rotation.x = -t * 0.16;
            if (ringC.current) ringC.current.rotation.y = t * 0.14;
            if (crystalRef.current) crystalRef.current.rotation.y = -t * 0.24;
            if (nucleusRef.current) {
                nucleusRef.current.rotation.y = t * 0.42;
                const pulse = 1 + Math.sin(t * 2.2) * 0.06;
                nucleusRef.current.scale.setScalar(pulse);
            }
        }
    });

    return (
        <group ref={rootRef} position={[1.35, 0.28, -0.95]} scale={1.18}>
            {/* Luminous Inner Energy Nucleus */}
            <mesh ref={nucleusRef}>
                <octahedronGeometry args={[0.58, 0]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive={palette.glow}
                    emissiveIntensity={1.6}
                    roughness={0.15}
                />
            </mesh>

            {/* Refractive Crystal Facet Shell */}
            <mesh ref={crystalRef}>
                <octahedronGeometry args={[1.08, 1]} />
                <meshPhysicalMaterial
                    color={palette.crystalTint}
                    emissive={palette.core}
                    emissiveIntensity={0.48}
                    metalness={0.25}
                    roughness={0.1}
                    clearcoat={1}
                    clearcoatRoughness={0.08}
                    reflectivity={0.95}
                    iridescence={0.45}
                    transparent
                    opacity={0.86}
                    depthWrite={false}
                    flatShading
                />
            </mesh>

            {/* Outer Precision Geodesic Cage */}
            <mesh renderOrder={3}>
                <icosahedronGeometry args={[1.56, 1]} />
                <meshStandardMaterial
                    color="#475569"
                    emissive={palette.rim}
                    emissiveIntensity={0.42}
                    metalness={0.85}
                    roughness={0.2}
                    wireframe
                    transparent
                    opacity={0.72}
                    depthWrite={false}
                />
            </mesh>

            {/* Volumetric Dual Halo Glow */}
            <mesh renderOrder={1}>
                <sphereGeometry args={[2.15, 32, 32]} />
                <meshBasicMaterial color={palette.core} transparent opacity={0.14} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
            </mesh>
            <mesh renderOrder={1}>
                <sphereGeometry args={[2.75, 32, 32]} />
                <meshBasicMaterial color={palette.rim} transparent opacity={0.06} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
            </mesh>

            {/* Precision Gyroscopic Orbit Rings */}
            <group ref={ringA} rotation={[Math.PI / 3.1, 0.42, 0]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[2.32, 0.015, 12, 128]} />
                    <meshBasicMaterial color={palette.glow} transparent opacity={0.88} depthWrite={false} />
                </mesh>
                <mesh position={[2.32, 0, 0]}>
                    <sphereGeometry args={[0.072, 14, 14]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>

            <group ref={ringB} rotation={[-Math.PI / 4, -0.45, 0.3]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[2.7, 0.012, 12, 128, Math.PI * 1.55]} />
                    <meshBasicMaterial color={palette.rim} transparent opacity={0.78} depthWrite={false} />
                </mesh>
                <mesh position={[0, 2.7, 0]}>
                    <sphereGeometry args={[0.058, 12, 12]} />
                    <meshBasicMaterial color={palette.rim} />
                </mesh>
            </group>

            <group ref={ringC} rotation={[Math.PI / 2.2, -0.32, 0.55]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[1.92, 0.009, 10, 100, Math.PI * 1.25]} />
                    <meshBasicMaterial color="#e2e8f0" transparent opacity={0.35} depthWrite={false} />
                </mesh>
            </group>

            <CalibrationDial reducedMotion={reducedMotion} rimColor={palette.rim} />
            <pointLight position={[0, 0, 1.5]} distance={9} intensity={2.4} color={palette.glow} />
        </group>
    );
}

export default function HeroVaultScene3D({ mode = 'health', reducedMotion = false }) {
    const palette = MODE_PALETTES[mode] || MODE_PALETTES.health;
    return (
        <CanvasErrorBoundary fallbackTitle="3D Core Engine Preview Ready">
            <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 0.35, 10.6], fov: 46 }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={1.15} />
                <directionalLight position={[8, 9, 8]} intensity={2.4} color="#ffffff" />
                <directionalLight position={[-6, 6, 4]} intensity={1.6} color={palette.glow} />
                <pointLight position={[-8, -5, 4]} intensity={1.5} color={palette.rim} />
                <CameraRig intensity={0.48} />
                <DataStreamField active={mode !== 'health'} color={palette.glow} />
                <GridFloor colorPrimary={palette.grid} colorSecondary="#33415534" y={-4.35} />
                <VaultCoreAssembly mode={mode} reducedMotion={reducedMotion} />
                <fog attach="fog" args={['#090d16', 11, 29]} />
            </Canvas>
        </CanvasErrorBoundary>
    );
}
