import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Float, ContactShadows, MeshDistortMaterial, MeshPhysicalMaterial, Sparkles, Sphere, Icosahedron } from '@react-three/drei';
import * as THREE from 'three';

/**
 * A highly realistic, glassmorphic 3D AI Core representing the "Policy Intelligence" brain.
 * Uses MeshPhysicalMaterial to simulate glass, index of refraction (transmission), and HDRI lighting.
 */
export default function AiCore3D({ active = false }) {
    const innerCoreRef = useRef();
    const midRingRef = useRef();
    const outerRingRef = useRef();

    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const speed = active ? 2.5 : 0.8; // Accelerates when "active" (e.g. OTP requested)

        if (innerCoreRef.current) {
            innerCoreRef.current.rotation.x = t * 0.3 * speed;
            innerCoreRef.current.rotation.y = t * 0.4 * speed;
        }
        if (midRingRef.current) {
            midRingRef.current.rotation.x = t * -0.2 * speed;
            midRingRef.current.rotation.z = t * 0.3 * speed;
        }
        if (outerRingRef.current) {
            outerRingRef.current.rotation.y = t * 0.15 * speed;
            outerRingRef.current.rotation.z = t * -0.1 * speed;
        }
    });

    // Theme Colors
    const primaryColor = active ? "#3b82f6" : "#d946ef"; // Blue when active, Pink when idle
    const secondaryColor = active ? "#10b981" : "#8b5cf6"; // Green when active, Purple when idle

    return (
        <group position={[3, 0, -1]}>
            {/* Global HDRI Environment Lighting for realistic reflections */}
            <Environment preset="city" />

            {/* Floating Container to give smooth hovering motion */}
            <Float
                speed={2 * (active ? 2 : 1)}
                rotationIntensity={0.5}
                floatIntensity={2}
                floatingRange={[-0.2, 0.2]}
            >
                <group scale={1.2}>

                    {/* Inner Pulsing Energy Core */}
                    <mesh ref={innerCoreRef}>
                        <sphereGeometry args={[0.8, 64, 64]} />
                        <MeshDistortMaterial
                            color={primaryColor}
                            emissive={primaryColor}
                            emissiveIntensity={active ? 2 : 1}
                            distort={active ? 0.4 : 0.2}
                            speed={active ? 5 : 2}
                            roughness={0.2}
                            metalness={0.8}
                        />
                    </mesh>

                    {/* Middle Glass Icosahedron Shell */}
                    <mesh ref={midRingRef}>
                        <icosahedronGeometry args={[1.5, 0]} />
                        <meshPhysicalMaterial
                            color="#ffffff"
                            transmission={0.9}     // Glass look
                            opacity={1}
                            metalness={0.1}
                            roughness={0.05}
                            ior={1.52}             // Index of Refraction for standard glass
                            thickness={0.5}        // Refraction volume
                            clearcoat={1}
                            clearcoatRoughness={0.1}
                            envMapIntensity={2}    // Reflect HDRI heavily
                        />
                    </mesh>

                    {/* Outer Thin Wireframe Icosahedron */}
                    <mesh ref={outerRingRef}>
                        <icosahedronGeometry args={[2.0, 1]} />
                        <meshStandardMaterial
                            color={secondaryColor}
                            wireframe
                            transparent
                            opacity={0.15}
                        />
                    </mesh>

                    {/* Orbital Data Rings */}
                    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                        <torusGeometry args={[2.4, 0.01, 16, 100]} />
                        <meshPhysicalMaterial color={secondaryColor} emissive={secondaryColor} emissiveIntensity={1} opacity={0.8} transparent />
                    </mesh>

                    {/* Floating Data Particles (Sparkles) */}
                    <Sparkles
                        count={active ? 300 : 150}
                        scale={6}
                        size={active ? 6 : 4}
                        speed={active ? 0.8 : 0.3}
                        opacity={0.4}
                        color={primaryColor}
                    />
                </group>
            </Float>

            {/* Realistic Ground Shadow (Contact Shadows) */}
            <ContactShadows
                position={[0, -3.5, 0]}
                opacity={0.4}
                scale={15}
                blur={2.5}
                far={10}
                color="#1e293b"
            />

            {/* Ambient & Directed Lights */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} color={primaryColor} />
            <pointLight position={[-10, -10, -5]} intensity={1} color={secondaryColor} />
        </group>
    );
}
