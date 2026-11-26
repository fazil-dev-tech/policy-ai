import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function GridFloor({ colorPrimary = '#fb7185', colorSecondary = '#1e293b', opacity = 0.24, y = -4.35 }) {
    const gridRef = useRef();

    useEffect(() => {
        const mat = gridRef.current?.material;
        if (!mat) return;
        const materials = Array.isArray(mat) ? mat : [mat];
        materials.forEach((m) => {
            m.transparent = true;
            m.opacity = opacity;
            m.depthWrite = false;
            m.needsUpdate = true;
        });
    }, [opacity, colorPrimary, colorSecondary]);

    useFrame(({ clock }) => {
        if (gridRef.current) {
            gridRef.current.position.z = ((clock.elapsedTime * 0.65) % 2) - 6;
        }
    });

    return <gridHelper ref={gridRef} args={[96, 48, colorPrimary, colorSecondary]} position={[0, y, -6]} />;
}
