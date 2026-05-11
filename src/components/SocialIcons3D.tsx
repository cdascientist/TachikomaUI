import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Float } from '@react-three/drei';

function getParticlePositions(type: 'linkedin' | 'instagram'): Float32Array {
    const size = 120;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return new Float32Array();

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (type === 'linkedin') {
        // LinkedIn logo
        ctx.lineWidth = 14;
        ctx.strokeRect(20, 20, 80, 80);
        ctx.font = "bold 56px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("in", 60, 64);
    } else if (type === 'instagram') {
        // Instagram logo
        ctx.lineWidth = 12;
        ctx.strokeRect(20, 20, 80, 80);
        ctx.beginPath();
        ctx.arc(60, 60, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(80, 40, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const points = [];
    
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            if (imgData[i] > 128) {
                // Determine density based on type - more particles for thicker look
                const density = 2; // particles per pixel
                for (let p = 0; p < density; p++) {
                    points.push(
                        (x - size / 2) * 0.2 + (Math.random()-0.5)*0.3,
                        -(y - size / 2) * 0.2 + (Math.random()-0.5)*0.3,
                        (Math.random() - 0.5) * 2.0
                    );
                }
            }
        }
    }
    
    return new Float32Array(points);
}

const ParticleIcon: React.FC<{ type: 'linkedin' | 'instagram', color: string, position: [number, number, number], url: string }> = ({ type, color, position, url }) => {
    const pointsRef = useRef<THREE.Points>(null);
    const [hovered, setHovered] = useState(false);
    
    const positions = useMemo(() => getParticlePositions(type), [type]);
    const count = positions.length / 3;

    // Custom coloring to make it look like the environment
    const colors = useMemo(() => {
        const c = new Float32Array(count * 3);
        const baseColor = new THREE.Color(color);
        
        for (let i = 0; i < count; i++) {
            // slight color variation for particle effect
            const rOffset = (Math.random() - 0.5) * 0.3;
            c[i*3] = Math.max(0, Math.min(1, baseColor.r + rOffset));
            c[i*3+1] = Math.max(0, Math.min(1, baseColor.g + rOffset));
            c[i*3+2] = Math.max(0, Math.min(1, baseColor.b + rOffset));
        }
        return c;
    }, [color, count]);

    const materialRef = useRef<THREE.PointsMaterial>(null);

    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        if (pointsRef.current) {
            // Slowly rotate continuously
            pointsRef.current.rotation.y = (t * 0.5) * 0.5 + (type === 'linkedin' ? 0.1 : -0.1);
            pointsRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
            
            // Hover effect on scale (base scale is 0.65)
            const baseScale = 0.65;
            const targetScale = hovered ? baseScale * 1.2 : baseScale;
            pointsRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
            
            if (materialRef.current) {
                const targetColor = hovered ? new THREE.Color('#ffffff') : new THREE.Color(color);
                materialRef.current.color.lerp(targetColor, 0.1);
            }
        }
    });

    // Create an invisible hitbox for the pointer events
    return (
        <group position={position}>
            <points ref={pointsRef} scale={[0.65, 0.65, 0.65]}>
                <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
                    <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
                </bufferGeometry>
                <pointsMaterial 
                    ref={materialRef}
                    size={0.15} 
                    vertexColors={true} 
                    transparent={true} 
                    opacity={0.8} 
                    blending={THREE.AdditiveBlending} 
                    depthWrite={false}
                    sizeAttenuation={true}
                />
            </points>
            <mesh 
                visible={false} 
                onClick={() => window.open(url, '_blank')}
                onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
                scale={[0.65, 0.65, 0.65]}
            >
                <boxGeometry args={[20, 20, 4]} />
                <meshBasicMaterial transparent opacity={0.0} />
            </mesh>
        </group>
    );
};

    export const SocialIcons3D: React.FC = () => {
    const groupRef = useRef<THREE.Group>(null);
    const { viewport, camera } = useThree();
    
    // Get viewport size at a fixed distance to accurately place UI relative to edges
    const distance = 70;
    
    useFrame(({ camera, viewport }) => {
        if (groupRef.current) {
            // Only show when extremely close to the home page coordinates
            const distanceToHome = camera.position.distanceTo(new THREE.Vector3(0, 50, 600));
            
            // Fade out smoothly using scale if not exactly on home page (distance < 50 for max scale, 0 beyond 150)
            const targetVisible = distanceToHome < 150;
            groupRef.current.visible = targetVisible;
            
            // Follow the camera perfectly as a HUD
            groupRef.current.position.copy(camera.position);
            groupRef.current.quaternion.copy(camera.quaternion);
            groupRef.current.translateZ(-distance);
        }
    });

    // Place icons slightly inward from the absolute edges
    // Make sure we have a fallback or scale it down if on a tiny mobile screen
    const isMobile = viewport.width < 50; 
    const currentViewport = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, -distance));
    const xOffset = currentViewport.width / 2 - (isMobile ? 8 : 12);
    const yOffset = -currentViewport.height / 2 + (isMobile ? 12 : 20);
    const iconScale = isMobile ? 0.7 : 1;

    return (
        <group ref={groupRef}>
            {/* Stacking the LinkedIn icon on top of the Instagram icon on the right side */}
            <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5} floatingRange={[-1, 1]} position={[xOffset, yOffset + (isMobile ? 12 : 16), 0]}>
                <group scale={[iconScale, iconScale, iconScale]}>
                    <ParticleIcon 
                        type="linkedin" 
                        color="#00FFFF" // cyan for LinkedIn feeling but cyberpunk
                        position={[0, 0, 0]} 
                        url="https://www.linkedin.com/in/cdascientist/" 
                    />
                </group>
            </Float>
            <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.5} floatingRange={[-1, 1]} position={[xOffset, yOffset, 0]}>
                <group scale={[iconScale, iconScale, iconScale]}>
                    <ParticleIcon 
                        type="instagram" 
                        color="#FF00FF" // fuchsia for Instagram feeling but cyberpunk
                        position={[0, 0, 0]} 
                        url="https://www.instagram.com/cdascientist" 
                    />
                </group>
            </Float>
        </group>
    );
};
