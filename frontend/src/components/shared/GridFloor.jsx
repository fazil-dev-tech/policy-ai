import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function GridFloor({ colorPrimary = '#fb718548', colorSecondary = '#33415538', y = -4.35 }) {
    const gridRef = useRef();
    useFrame(({ clock }) => {
        if (gridRef.current) {
            gridRef.current.position.z = ((clock.elapsedTime * 0.65) % 2) - 6;
        }
    });
    return <gridHelper ref={gridRef} args={[96, 48, colorPrimary, colorSecondary]} position={[0, y, -6]} />;
}
