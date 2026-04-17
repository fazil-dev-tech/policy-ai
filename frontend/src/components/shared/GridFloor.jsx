import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export default function GridFloor() {
    const gridRef = useRef();
    useFrame(({ clock }) => {
        if (gridRef.current) gridRef.current.position.z = (clock.elapsedTime * 0.8) % 2;
    });
    return <gridHelper ref={gridRef} args={[80, 40, '#ec489950', '#f9a8d420']} position={[0, -5, -5]} />;
}
