import { useFrame, useThree } from '@react-three/fiber';

export default function CameraRig() {
    const { camera } = useThree();
    useFrame(({ mouse }) => {
        camera.position.x += (mouse.x * 2.0 - camera.position.x) * 0.05;
        camera.position.y += (mouse.y * 1.2 - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
    });
    return null;
}
