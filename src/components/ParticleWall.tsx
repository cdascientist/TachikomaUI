import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleWallProps {
    position: [number, number, number];
    scale: number;
    density: number;
    baseScale: number;
    monolithicVertexFloatBuffer: Float32Array;
    monolithicColorFloatBuffer: Float32Array;
    massiveConcatenatedVerticesCount: number;
    isHighlighted: boolean;
    onClick: (e: any) => void;
}

export const ParticleWall: React.FC<ParticleWallProps> = ({ 
    position, scale, density, baseScale, 
    monolithicVertexFloatBuffer, monolithicColorFloatBuffer, massiveConcatenatedVerticesCount,
    isHighlighted, onClick 
}) => {
    const pointCloudRef = useRef<THREE.Points>(null!);

    useEffect(() => {
        if (pointCloudRef.current) {
            const totalVertices = massiveConcatenatedVerticesCount / 3;
            const drawCount = Math.floor(totalVertices * (density / 100));
            pointCloudRef.current.geometry.setDrawRange(0, drawCount);
        }
    }, [density, massiveConcatenatedVerticesCount]);

    useFrame((state, delta) => {
        if (pointCloudRef.current) {
            pointCloudRef.current.rotation.y += delta * 0.05;
            const mat = pointCloudRef.current.material as THREE.PointsMaterial;
            mat.opacity = (0.7 + Math.sin(state.clock.elapsedTime * 2) * 0.1) * (isHighlighted ? 1.5 : 1.0);
        }
    });

    const finalScale = scale * baseScale;

    return (
        <group position={position} scale={[finalScale, finalScale, finalScale]}>
            <points 
                ref={pointCloudRef} 
            >
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={massiveConcatenatedVerticesCount / 3}
                        array={monolithicVertexFloatBuffer}
                        itemSize={3}
                    />
                    <bufferAttribute
                        attach="attributes-color"
                        count={massiveConcatenatedVerticesCount / 3}
                        array={monolithicColorFloatBuffer}
                        itemSize={3}
                    />
                </bufferGeometry>
                <pointsMaterial
                    size={0.15}
                    vertexColors={true}
                    transparent={true}
                    opacity={0.9}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    sizeAttenuation={true}
                />
            </points>
            {/* Invisible Hit Area for Raycasting */}
            <mesh 
                onClick={(e) => {
                    e.stopPropagation();
                    onClick(e);
                }}
            >
                <boxGeometry args={[300, 300, 300]} />
                <meshBasicMaterial transparent opacity={0.0} depthWrite={false} colorWrite={false} />
            </mesh>
        </group>
    );
};
