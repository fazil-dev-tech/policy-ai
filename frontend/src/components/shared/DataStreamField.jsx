import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

export default function DataStreamField({ active = false, color = '#f472b6' }) {
    const pointsRef = useRef();
    const count = 520;
    const reducedMotion = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
        []
    );

    const positions = useMemo(() => {
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 44;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 32;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 8;
        }
        return pos;
    }, []);

    useFrame(({ clock }) => {
        if (reducedMotion || !pointsRef.current) return;
        const speed = active ? 0.14 : 0.05;
        pointsRef.current.rotation.y = clock.elapsedTime * speed;
        pointsRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.25) * 0.06;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.09} color={active ? '#38bdf8' : color} transparent opacity={0.48} sizeAttenuation />
        </points>
    );
}
