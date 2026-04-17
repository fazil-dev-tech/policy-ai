import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

export default function DataStreamField({ active = false }) {
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
