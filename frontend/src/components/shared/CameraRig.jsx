import { useFrame, useThree } from '@react-three/fiber';

export default function CameraRig({ intensity = 0.8 }) {
    const { camera } = useThree();
    useFrame(({ pointer }) => {
        camera.position.x += (pointer.x * intensity - camera.position.x) * 0.045;
        camera.position.y += (pointer.y * (intensity * 0.65) - camera.position.y) * 0.045;
        camera.lookAt(0, 0, 0);
    });
    return null;
}
