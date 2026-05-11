import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface HugeParticleOrbProps {
    position: [number, number, number];
    isListening?: boolean;
    isSpeaking?: boolean;
    isCyanDominant?: boolean;
    offsetScale?: number;
    onClick?: (e: any) => void;
    onPointerMove?: (e: any) => void;
    isHighlighted?: boolean;
}

export const HugeParticleOrb: React.FC<HugeParticleOrbProps> = ({ 
    position, 
    isListening = false, 
    isSpeaking = false,
    isCyanDominant = true,
    offsetScale = 1.0,
    onClick,
    onPointerMove,
    isHighlighted = false
}) => {
    const pointsRef = useRef<THREE.Points>(null);
    const materialRef = useRef<THREE.PointsMaterial>(null);
    const wordPulseRef = useRef<number>(0);

    // Bounding mesh for raycasting
    const radius = 60 * offsetScale;

    useEffect(() => {
        const handlePulse = () => {
            wordPulseRef.current = 1.0;
        };
        window.addEventListener('chatbot-word', handlePulse);
        return () => window.removeEventListener('chatbot-word', handlePulse);
    }, []);

    const { positions, colors } = useMemo(() => {
        const count = 8000;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const theta = Math.random() * 2 * Math.PI;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius + (Math.random() - 0.5) * 15 * offsetScale;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            const mix = Math.random();
            const color = new THREE.Color();
            const cyanChance = isCyanDominant ? 0.7 : 0.3;
            
            if (mix < cyanChance) {
                color.setHex(0x00FFFF);
            } else {
                color.setHex(0xFF00FF);
            }
            // If highlighted, boost color brightness
            if (isHighlighted) {
                color.multiplyScalar(2.0);
            }
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        return { positions, colors };
    }, [isCyanDominant, offsetScale, radius, isHighlighted]);

    useFrame((state, delta) => {
        const t = state.clock.getElapsedTime();
        if (pointsRef.current) {
            pointsRef.current.rotation.y = t * 0.2 * (offsetScale % 2 === 0 ? -1 : 1);
            pointsRef.current.rotation.x = t * 0.1 * offsetScale;

            wordPulseRef.current = THREE.MathUtils.lerp(wordPulseRef.current, 0, delta * 10);

            let scale = 1.0;
            if (isListening) scale = 1.0 + Math.sin(t * 10) * 0.05;
            if (isSpeaking) {
                scale = 1.0 + Math.sin(t * 5) * 0.08 + wordPulseRef.current * 0.15;
            }
            if (!isListening && !isSpeaking) {
                scale = 1.0 + Math.sin(t * 2) * 0.02;
            }
            // Add pulse effect if highlighted
            if (isHighlighted) {
                scale *= 1.2 + Math.sin(t * 5) * 0.1;
            }
            
            pointsRef.current.scale.set(scale, scale, scale);
            
            if (materialRef.current) {
                materialRef.current.opacity = isSpeaking ? 0.8 + (wordPulseRef.current * 0.2) : 0.8;
                if (isHighlighted) materialRef.current.opacity = 1.0;
            }
        }
    });

    return (
        <group position={position}>
            {/* Invisible Hit Area for Raycasting */}
            <mesh 
                onClick={(e) => { e.stopPropagation(); onClick?.(e); }} 
                onPointerMove={(e) => { e.stopPropagation(); onPointerMove?.(e); }}
            >
                <sphereGeometry args={[radius * 1.5, 16, 16]} />
                <meshBasicMaterial transparent opacity={0.0} depthWrite={false} colorWrite={false} />
            </mesh>
            <points ref={pointsRef}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
                    <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
                </bufferGeometry>
                <pointsMaterial
                    ref={materialRef}
                    size={0.6}
                    vertexColors={true}
                    transparent={true}
                    opacity={0.8}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    sizeAttenuation={true}
                />
            </points>
        </group>
    );
};
