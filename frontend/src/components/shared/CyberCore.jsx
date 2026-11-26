import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function createCoreGlowTexture(soft = false) {
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
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
        grad.addColorStop(0.24, 'rgba(255, 255, 255, 0.42)');
        grad.addColorStop(0.52, 'rgba(255, 255, 255, 0.13)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.88)');
        grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

export default function CyberCore({ position = [4, 0, -2], scale = 1, active = false }) {
    const groupRef = useRef();
    const ring1 = useRef();
    const ring2 = useRef();
    const ring3 = useRef();
    const dotsRef = useRef();

    const spriteMap = useMemo(() => createCoreGlowTexture(false), []);
    const auraMap = useMemo(() => createCoreGlowTexture(true), []);

    const icoGeoForEdges = useMemo(() => new THREE.IcosahedronGeometry(1.16, 1), []);

    useEffect(() => {
        if (spriteMap) spriteMap.needsUpdate = true;
        if (auraMap) auraMap.needsUpdate = true;
        return () => {
            if (spriteMap) spriteMap.dispose();
            if (auraMap) auraMap.dispose();
        };
    }, [spriteMap, auraMap]);

    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        []
    );

    const baseY = Number(position?.[1] ?? 0);

    useFrame(({ clock }) => {
        if (reducedMotion) return;
        const t = clock.elapsedTime;
        const speed = active ? 2.1 : 1.05;
        if (groupRef.current) {
            groupRef.current.position.y = baseY + Math.sin(t * 1.2) * 0.14;
            groupRef.current.rotation.y = t * 0.12 * speed;
        }
        if (ring1.current) ring1.current.rotation.x = t * 0.24 * speed;
        if (ring2.current) ring2.current.rotation.y = t * 0.3 * speed;
        if (ring3.current) ring3.current.rotation.z = t * -0.18 * speed;
        if (dotsRef.current) dotsRef.current.rotation.y = t * 0.05 * speed;
    });

    const primaryColor = active ? "#06b6d4" : "#e11d48";     // Cyan / Crimson Rose
    const secondaryColor = active ? "#0284c7" : "#ec4899";   // Deep Cyan / Rose
    const accentColor = active ? "#10b981" : "#fda4af";      // Emerald / Soft Rose Rim
    const shellTint = active ? "#0b1422" : "#140c18";

    const { positions, colors } = useMemo(() => {
        const count = 100;
        const pos = new Float32Array(count * 3);
        const cols = new Float32Array(count * 3);
        const colorBase = new THREE.Color(accentColor);
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const r = 1.88 + Math.random() * 0.18;
            pos[i * 3] = r * Math.cos(theta) * Math.sin(phi);
            pos[i * 3 + 1] = r * Math.sin(theta) * Math.sin(phi);
            pos[i * 3 + 2] = r * Math.cos(phi);
            colorBase.toArray(cols, i * 3);
        }
        return { positions: pos, colors: cols };
    }, [accentColor]);

    return (
        <group ref={groupRef} position={position} scale={scale}>
            {/* Smooth Radial Ambient Aura */}
            <sprite scale={[6.4, 6.4, 1]} renderOrder={0}>
                <spriteMaterial map={auraMap || undefined} color={primaryColor} transparent opacity={0.36} blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>
            <sprite scale={[4.2, 4.2, 1]} renderOrder={0}>
                <spriteMaterial map={auraMap || undefined} color={secondaryColor} transparent opacity={0.26} blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>

            {/* Luminous Inner Nucleus */}
            <mesh>
                <octahedronGeometry args={[0.48, 0]} />
                <meshStandardMaterial
                    color="#fff1f5"
                    emissive={primaryColor}
                    emissiveIntensity={1.55}
                    roughness={0.18}
                />
            </mesh>
            <sprite scale={[1.7, 1.7, 1]} renderOrder={1}>
                <spriteMaterial map={auraMap || undefined} color={primaryColor} transparent opacity={0.42} blending={THREE.AdditiveBlending} depthWrite={false} />
            </sprite>

            {/* Refractive Crystal Core (controlled specular sheen + crisp edge highlights) */}
            <mesh>
                <icosahedronGeometry args={[1.16, 1]} />
                <meshPhysicalMaterial
                    color={shellTint}
                    emissive={primaryColor}
                    emissiveIntensity={0.34}
                    metalness={0.3}
                    roughness={0.22}
                    clearcoat={0.5}
                    clearcoatRoughness={0.18}
                    iridescence={0.45}
                    transparent
                    opacity={0.82}
                    depthWrite
                    flatShading
                />
            </mesh>
            <lineSegments>
                <edgesGeometry args={[icoGeoForEdges]} />
                <lineBasicMaterial color={accentColor} transparent opacity={0.42} depthWrite={false} />
            </lineSegments>

            {/* Geometric Outer Wireframe */}
            <mesh renderOrder={3}>
                <icosahedronGeometry args={[1.52, 1]} />
                <meshStandardMaterial color={accentColor} emissive={primaryColor} emissiveIntensity={0.24} wireframe transparent opacity={active ? 0.54 : 0.36} depthWrite={false} />
            </mesh>

            {/* Swarm Nodes */}
            <points ref={dotsRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" args={[positions, 3]} />
                    <bufferAttribute attach="attributes-color" args={[colors, 3]} />
                </bufferGeometry>
                <pointsMaterial map={spriteMap || undefined} size={0.12} vertexColors transparent opacity={0.82} depthWrite={false} blending={THREE.AdditiveBlending} />
            </points>

            {/* Orbiting Tech Rings */}
            <group ref={ring1} rotation={[Math.PI / 4, 0, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
                    <torusGeometry args={[2.16, 0.019, 16, 120]} />
                    <meshBasicMaterial color={primaryColor} transparent opacity={0.62} depthWrite={false} />
                </mesh>
                <mesh position={[2.16, 0, 0]}>
                    <sphereGeometry args={[0.072, 14, 14]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
                <sprite position={[2.16, 0, 0]} scale={[0.42, 0.42, 1]} renderOrder={3}>
                    <spriteMaterial map={spriteMap || undefined} color={primaryColor} transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} />
                </sprite>
                <mesh position={[-2.16, 0, 0]}>
                    <sphereGeometry args={[0.05, 14, 14]} />
                    <meshBasicMaterial color={accentColor} />
                </mesh>
            </group>

            <group ref={ring2} rotation={[0, Math.PI / 4, 0]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
                    <torusGeometry args={[2.52, 0.016, 16, 120]} />
                    <meshBasicMaterial color={secondaryColor} transparent opacity={0.48} depthWrite={false} />
                </mesh>
                <mesh position={[-2.52, 0, 0]}>
                    <sphereGeometry args={[0.06, 14, 14]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
                <sprite position={[-2.52, 0, 0]} scale={[0.38, 0.38, 1]} renderOrder={3}>
                    <spriteMaterial map={spriteMap || undefined} color={secondaryColor} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} />
                </sprite>
            </group>

            <group ref={ring3} rotation={[0, 0, Math.PI / 3]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
                    <torusGeometry args={[2.86, 0.013, 14, 120]} />
                    <meshBasicMaterial color={accentColor} transparent opacity={0.3} depthWrite={false} />
                </mesh>
                <mesh position={[2.86, 0, 0]}>
                    <sphereGeometry args={[0.055, 14, 14]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
                <sprite position={[2.86, 0, 0]} scale={[0.34, 0.34, 1]} renderOrder={3}>
                    <spriteMaterial map={spriteMap || undefined} color={accentColor} transparent opacity={0.78} blending={THREE.AdditiveBlending} depthWrite={false} />
                </sprite>
            </group>

            <pointLight distance={16} intensity={active ? 3.2 : 2.5} color={primaryColor} position={[0, 0, 0.5]} />
            <pointLight distance={10} intensity={0.95} color="#ffe4e6" position={[3, 3, 3]} />
        </group>
    );
}
