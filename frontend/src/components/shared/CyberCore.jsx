import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function CyberCore({ position = [4, 0, -2], active = false }) {
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
