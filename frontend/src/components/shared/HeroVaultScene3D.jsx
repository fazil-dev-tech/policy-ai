import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import CameraRig from './CameraRig';

const MODE_PALETTES = {
    health: { core: '#e11d48', rim: '#fda4af', glow: '#fb7185', crystalTint: '#140c18' },
    motor: { core: '#d97706', rim: '#fde68a', glow: '#fbbf24', crystalTint: '#17110b' },
    shield: { core: '#0284c7', rim: '#7dd3fc', glow: '#38bdf8', crystalTint: '#0b1422' },
};

function createGlowSpriteTexture() {
    if (typeof document === 'undefined') return null;
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.94)');
    grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.32)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function DeepSpaceStars({ reducedMotion, spriteMap }) {
    const starsRef = useRef();

    const positions = useMemo(() => {
        const count = 1150;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 46;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 26;
            arr[i * 3 + 2] = -2 - Math.random() * 18;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !starsRef.current) return;
        starsRef.current.rotation.y = clock.elapsedTime * 0.014;
        starsRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.025;
    });

    return (
        <points ref={starsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                map={spriteMap || undefined}
                size={0.135}
                color="#f1f5f9"
                transparent
                opacity={0.86}
                sizeAttenuation
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

function OrbitalEnergySparks({ sparkColor = '#fb7185', accentColor = '#fda4af', reducedMotion, spriteMap }) {
    const primaryRef = useRef();
    const secondaryRef = useRef();

    const primaryPositions = useMemo(() => {
        const count = 190;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.45 + Math.pow(Math.random(), 0.72) * 7.8;
            arr[i * 3] = Math.cos(angle) * radius * 1.16;
            arr[i * 3 + 1] = 0.6 + (Math.random() - 0.5) * 6.2;
            arr[i * 3 + 2] = Math.sin(angle) * radius * 0.55 - 1.4;
        }
        return arr;
    }, []);

    const secondaryPositions = useMemo(() => {
        const count = 130;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            arr[i * 3] = (Math.random() - 0.5) * 26;
            arr[i * 3 + 1] = (Math.random() - 0.5) * 14;
            arr[i * 3 + 2] = -1 - Math.random() * 10;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion) return;
        const t = clock.elapsedTime;
        if (primaryRef.current) {
            primaryRef.current.rotation.y = t * 0.055;
            primaryRef.current.position.y = Math.sin(t * 0.55) * 0.14;
        }
        if (secondaryRef.current) {
            secondaryRef.current.rotation.y = -t * 0.032;
            secondaryRef.current.rotation.z = Math.sin(t * 0.18) * 0.04;
        }
    });

    return (
        <>
            <points ref={primaryRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[primaryPositions, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    map={spriteMap || undefined}
                    size={0.21}
                    color={sparkColor}
                    transparent
                    opacity={0.92}
                    sizeAttenuation
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>
            <points ref={secondaryRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[secondaryPositions, 3]} />
                </bufferGeometry>
                <pointsMaterial
                    map={spriteMap || undefined}
                    size={0.15}
                    color={accentColor}
                    transparent
                    opacity={0.68}
                    sizeAttenuation
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </points>
        </>
    );
}

function AmbientHorizonMist({ color = '#fda4af', reducedMotion, spriteMap }) {
    const ref = useRef();
    const positions = useMemo(() => {
        const count = 380;
        const arr = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * 34;
            const z = (Math.random() - 0.5) * 16 - 3;
            const wave = Math.sin(x * 0.28) * 0.35 + Math.cos(z * 0.35) * 0.25;
            arr[i * 3] = x;
            arr[i * 3 + 1] = -3.45 + wave;
            arr[i * 3 + 2] = z;
        }
        return arr;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !ref.current) return;
        ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.08) * 0.05;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial
                map={spriteMap || undefined}
                size={0.095}
                color={color}
                transparent
                opacity={0.34}
                sizeAttenuation
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

function CalibrationDial({ reducedMotion, rimColor }) {
    const dialRef = useRef();

    const ticks = useMemo(() => {
        const list = [];
        const total = 32;
        const radius = 2.85;
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
        <group ref={dialRef} rotation={[Math.PI / 2.75, 0.2, 0]}>
            <mesh>
                <torusGeometry args={[2.85, 0.009, 10, 128]} />
                <meshBasicMaterial color="#94a3b8" transparent opacity={0.28} depthWrite={false} />
            </mesh>
            <mesh>
                <torusGeometry args={[2.32, 0.008, 10, 110]} />
                <meshBasicMaterial color={rimColor} transparent opacity={0.26} depthWrite={false} />
            </mesh>
            {ticks.map((t, idx) => (
                <mesh key={idx} position={[t.x, t.y, 0]} rotation={[0, 0, t.rotZ]}>
                    <boxGeometry args={[t.major ? 0.14 : 0.055, 0.015, 0.015]} />
                    <meshBasicMaterial color={t.major ? rimColor : '#94a3b8'} transparent opacity={t.major ? 0.65 : 0.3} depthWrite={false} />
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
            rootRef.current.position.y = 0.68 + Math.sin(t * 0.85) * 0.1;
            rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, t * 0.09 + pointer.x * 0.18, 0.045);
            rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, -0.05 + pointer.y * 0.1, 0.045);
            if (ringA.current) ringA.current.rotation.z = t * 0.22;
            if (ringB.current) ringB.current.rotation.x = -t * 0.17;
            if (ringC.current) ringC.current.rotation.y = t * 0.14;
            if (crystalRef.current) crystalRef.current.rotation.y = -t * 0.22;
            if (nucleusRef.current) {
                nucleusRef.current.rotation.y = t * 0.38;
                const pulse = 1 + Math.sin(t * 2.1) * 0.06;
                nucleusRef.current.scale.setScalar(pulse);
            }
        }
    });

    return (
        /* Centered inside the open space gap with generous black margin before left copy & right console */
        <group ref={rootRef} position={[0.06, 0.68, -0.4]} scale={0.65}>
            {/* Luminous Inner Energy Nucleus */}
            <mesh ref={nucleusRef}>
                <octahedronGeometry args={[0.56, 0]} />
                <meshStandardMaterial
                    color="#fff1f5"
                    emissive={palette.glow}
                    emissiveIntensity={1.6}
                    roughness={0.16}
                />
            </mesh>

            {/* Refractive Crystal Facet Shell */}
            <mesh ref={crystalRef}>
                <octahedronGeometry args={[1.08, 1]} />
                <meshPhysicalMaterial
                    color={palette.crystalTint}
                    emissive={palette.core}
                    emissiveIntensity={0.48}
                    metalness={0.28}
                    roughness={0.12}
                    clearcoat={1}
                    clearcoatRoughness={0.08}
                    reflectivity={0.95}
                    iridescence={0.38}
                    transparent
                    opacity={0.8}
                    depthWrite={false}
                    flatShading
                />
            </mesh>

            {/* Outer Subtle Geodesic Wireframe */}
            <mesh renderOrder={3}>
                <icosahedronGeometry args={[1.56, 1]} />
                <meshStandardMaterial
                    color="#64748b"
                    emissive={palette.rim}
                    emissiveIntensity={0.35}
                    metalness={0.85}
                    roughness={0.22}
                    wireframe
                    transparent
                    opacity={0.5}
                    depthWrite={false}
                />
            </mesh>

            {/* Volumetric Dual Aura Glow */}
            <mesh renderOrder={1}>
                <sphereGeometry args={[2.1, 32, 32]} />
                <meshBasicMaterial color={palette.core} transparent opacity={0.18} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
            </mesh>
            <mesh renderOrder={1}>
                <sphereGeometry args={[2.65, 32, 32]} />
                <meshBasicMaterial color={palette.rim} transparent opacity={0.085} blending={THREE.AdditiveBlending} side={THREE.BackSide} depthWrite={false} />
            </mesh>

            {/* Precision Gyroscopic Orbit Rings */}
            <group ref={ringA} rotation={[Math.PI / 3.1, 0.36, 0]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[2.16, 0.013, 12, 128]} />
                    <meshBasicMaterial color={palette.glow} transparent opacity={0.72} depthWrite={false} />
                </mesh>
                <mesh position={[2.16, 0, 0]}>
                    <sphereGeometry args={[0.064, 12, 12]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
            </group>

            <group ref={ringB} rotation={[-Math.PI / 4.2, -0.4, 0.28]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[2.46, 0.011, 12, 128, Math.PI * 1.55]} />
                    <meshBasicMaterial color={palette.rim} transparent opacity={0.56} depthWrite={false} />
                </mesh>
                <mesh position={[0, 2.46, 0]}>
                    <sphereGeometry args={[0.056, 12, 12]} />
                    <meshBasicMaterial color={palette.rim} />
                </mesh>
            </group>

            <group ref={ringC} rotation={[Math.PI / 2.2, -0.32, 0.55]}>
                <mesh renderOrder={2}>
                    <torusGeometry args={[1.84, 0.008, 10, 100, Math.PI * 1.3]} />
                    <meshBasicMaterial color="#e2e8f0" transparent opacity={0.28} depthWrite={false} />
                </mesh>
            </group>

            <CalibrationDial reducedMotion={reducedMotion} rimColor={palette.rim} />
            <pointLight position={[0, 0, 1.5]} distance={10} intensity={2.4} color={palette.glow} />
        </group>
    );
}

export default function HeroVaultScene3D({ mode = 'health', reducedMotion = false }) {
    const palette = MODE_PALETTES[mode] || MODE_PALETTES.health;
    const spriteMap = useMemo(() => createGlowSpriteTexture(), []);

    useEffect(() => {
        return () => {
            if (spriteMap) spriteMap.dispose();
        };
    }, [spriteMap]);

    return (
        <CanvasErrorBoundary fallbackTitle="3D Core Engine Preview Ready">
            <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 0.25, 11.4], fov: 42 }}
                gl={{ alpha: true, antialias: true }}
            >
                <ambientLight intensity={1.15} />
                <directionalLight position={[8, 9, 8]} intensity={2.3} color="#ffffff" />
                <directionalLight position={[-6, 6, 4]} intensity={1.45} color={palette.glow} />
                <pointLight position={[0, -2.5, 4]} intensity={1.25} color={palette.rim} />
                <CameraRig intensity={0.42} />
                <DeepSpaceStars reducedMotion={reducedMotion} spriteMap={spriteMap} />
                <OrbitalEnergySparks
                    sparkColor={palette.glow}
                    accentColor={palette.rim}
                    reducedMotion={reducedMotion}
                    spriteMap={spriteMap}
                />
                <AmbientHorizonMist color={palette.rim} reducedMotion={reducedMotion} spriteMap={spriteMap} />
                <VaultCoreAssembly mode={mode} reducedMotion={reducedMotion} />
                <fog attach="fog" args={['#050811', 12, 32]} />
            </Canvas>
        </CanvasErrorBoundary>
    );
}
