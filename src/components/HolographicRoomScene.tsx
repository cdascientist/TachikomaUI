import { ParticleWall } from './ParticleWall';
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AutomatedMemoryCleaner } from '../lib/AutomatedMemoryCleaner';

import { SocialIcons3D } from './SocialIcons3D';
import { HugeParticleOrb } from './HugeParticleOrb';
import { positionWorkerCode, lookAtWorkerCode } from '../workers/PanningWorker';

interface HolographicRoomSceneProperties {
    aggregatedParallelDataChunksMatrix: any[];
    sandboxDensity?: number;
    sandboxOrbScale?: number;
    sandboxWallScale?: number;
    wallsConfig?: any[];
    planesConfig?: any[];
    orbPositions?: [number, number, number][];
    activeRoomIndex?: number;
    selectedElementId?: string;
    onElementPositionChange?: (id: string, pos: [number, number, number]) => void;
    onElementSelect?: (id: string) => void;
}

export const HolographicRoomScene: React.FC<HolographicRoomSceneProperties> = React.memo(({
    aggregatedParallelDataChunksMatrix,
    sandboxDensity = 100,
    sandboxOrbScale = 1,
    sandboxWallScale = 1,
    wallsConfig = [],
    planesConfig = [],
    orbPositions,
    activeRoomIndex = 0,
    selectedElementId = "",
    onElementPositionChange,
    onElementSelect
}) => {
    const { camera, gl } = useThree();
    
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        const handleListening = (e: any) => setIsListening(e.detail);
        const handleSpeaking = (e: any) => setIsSpeaking(e.detail);
        window.addEventListener('chatbot-listening', handleListening);
        window.addEventListener('chatbot-speaking', handleSpeaking);
        return () => {
            window.removeEventListener('chatbot-listening', handleListening);
            window.removeEventListener('chatbot-speaking', handleSpeaking);
        };
    }, []);
    
    // Memory Optimization: Register webgl cleanup
    useEffect(() => {
        AutomatedMemoryCleaner.registerCleanupTask(() => {
            if (gl.info.memory.textures > 50) { 
                gl.clear(); 
            }
        });
    }, [gl]);

    // Smooth main-thread camera pan state
    const targetCameraPos = useRef(new THREE.Vector3(0, 50, 600));
    const targetLookAt = useRef(new THREE.Vector3(0, 50, 0));
    const currentLookAt = useRef(new THREE.Vector3(0, 50, 0));

    const posTrajectoryTime = useRef<number>(0);
    const lookTrajectoryTime = useRef<number>(0);
    const isWaitingForPosWorker = useRef<boolean>(false);
    const isWaitingForLookWorker = useRef<boolean>(false);
    
    // Journey mode
    const journeySequence = useRef<{pos: number[], look: number[]}[]>([]);

    const pointCloudRef = useRef<THREE.Points>(null);

    useEffect(() => {
        const handleResize = () => {
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.fov = window.innerWidth < 768 ? 100 : 75;
                camera.updateProjectionMatrix();
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // trigger immediately

        let currentRoomDest = 0;
        let baseTp = [0, 50, 600];
        let baseTl = [0, 50, 0];

        const onRoomChange = (e: any) => {
            const destIndex = e.detail?.sectionIndex ?? e.detail;
            const slideIndex = e.detail?.slideIndex ?? 0;
            currentRoomDest = destIndex;
            let tp = [0, 50, 600];
            let tl = [0, 50, 0];

            if (destIndex === 0) { // Landing
                tp = [0, 50, 600];
                tl = [0, 50, 0];
            } else if (destIndex === 1) { // ChatBot
                tp = [-300, 50, 400];
                tl = [-300, 50, -50];
            } else if (destIndex === 2) { // Particle Sandbox
                // Moved further back so we can see the cloud and all orbs
                tp = [0, 800, 1800]; 
                tl = [0, 100, -200];
            } else if (destIndex === 3) { // Video
                tp = [300 + (slideIndex * 50), 50, 400];   
                tl = [300 + (slideIndex * 50), 50, -50]; 
            } else if (destIndex === 4) { // Architecture
                tp = [600, 50, 450];
                tl = [600, 50, -100];
            } else if (destIndex === 5) { // Resume
                tp = [-600, 50, 450]; 
                tl = [-600, 50, -100];
            } else if (destIndex === 6) { // Dynamic Thread
                tp = [900, 50, 500];
                tl = [900, 50, -150];
            } else if (destIndex === 7) { // Nexus
                tp = [-900 + (slideIndex * 100), 50, 500];
                tl = [-900 + (slideIndex * 100), 50, -150];
            } else if (destIndex === 8) { // Global Canvas Delegation
                tp = [1200, 50, 600]; 
                tl = [1200, 50, -200];
            } else if (destIndex >= 9) { // Data Ingestion
                tp = [-1200, 50, 600]; 
                tl = [-1200, 50, -200];
            }

            baseTp = [...tp];
            baseTl = [...tl];

            targetCameraPos.current.set(tp[0], tp[1], tp[2]);
            targetLookAt.current.set(tl[0], tl[1], tl[2]);
        };

        const onPan = (e: any) => {
            // Only strictly override manual panning for Room 0 (Landing)
            if (currentRoomDest === 0) {
                const { deltaX, deltaY, type } = e.detail;
                // Move position horizontally/vertically based on touch delta
                const panFactor = 0.5;
                const newTp = [baseTp[0] - deltaX * panFactor, baseTp[1] + deltaY * panFactor, baseTp[2]];
                const newTl = [baseTl[0] - deltaX * panFactor * 0.5, baseTl[1] + deltaY * panFactor * 0.5, baseTl[2]];
                
                targetCameraPos.current.set(newTp[0], newTp[1], newTp[2]);
                targetLookAt.current.set(newTl[0], newTl[1], newTl[2]);

                if (type === 'panend' || type === 'panstart' && e.detail.isFinal) {
                    baseTp = [...newTp];
                    baseTl = [...newTl];
                }
            }
        };

        const onDoubleTap = (e: any) => {
            if (currentRoomDest === 0) {
                // Initialize a flying journey around the orbs
                journeySequence.current = [
                    { pos: [-300, 50, 50], look: [-300, 50, -50] },       // Chatbot orb
                    { pos: [0, 800, 1000], look: [0, 100, -200] },        // Sandbox orb
                    { pos: [300, 50, 50], look: [300, 50, -50] },         // Video orb
                    { pos: [600, 50, 0], look: [600, 50, -100] },         // Architecture
                    { pos: [0, 50, 600], look: [0, 50, 0] }               // Back to home
                ];

                const nextStop = journeySequence.current.shift()!;
                targetCameraPos.current.set(nextStop.pos[0], nextStop.pos[1], nextStop.pos[2]);
                targetLookAt.current.set(nextStop.look[0], nextStop.look[1], nextStop.look[2]);
            }
        };

        window.addEventListener('fullpage-room-change', onRoomChange);
        window.addEventListener('hammer-pan', onPan);
        window.addEventListener('hammer-doubletap', onDoubleTap);
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('fullpage-room-change', onRoomChange);
            window.removeEventListener('hammer-pan', onPan);
            window.removeEventListener('hammer-doubletap', onDoubleTap);
        };
    }, [camera]);

    useFrame((state, delta) => {
        const safeDelta = Math.min(delta, 0.1);
        const lerpFactor = 1 - Math.exp(-6 * safeDelta); 

        // If on a journey, queue the next point
        if (journeySequence.current.length > 0) {
            if (camera.position.distanceTo(targetCameraPos.current) < 50 && currentLookAt.current.distanceTo(targetLookAt.current) < 50) {
                const nextStop = journeySequence.current.shift()!;
                targetCameraPos.current.set(nextStop.pos[0], nextStop.pos[1], nextStop.pos[2]);
                targetLookAt.current.set(nextStop.look[0], nextStop.look[1], nextStop.look[2]);
            }
        }

        camera.position.lerp(targetCameraPos.current, lerpFactor);
        currentLookAt.current.lerp(targetLookAt.current, lerpFactor);
        camera.lookAt(currentLookAt.current);
    });

    // Compilation Phase (Optimized with useMemo to prevent per-frame jitter)
    const { monolithicVertexFloatBuffer, monolithicColorFloatBuffer, massiveConcatenatedVerticesCount } = React.useMemo(() => {
        let count = 0;
        aggregatedParallelDataChunksMatrix.forEach(isolatedChunkMatrixData => {
            count += isolatedChunkMatrixData.verticesFloat32Array.length;
        });

        const vertexBuffer = new Float32Array(count);
        const colorBuffer = new Float32Array(count);

        let offset = 0;
        for (const chunk of aggregatedParallelDataChunksMatrix) {
            vertexBuffer.set(chunk.verticesFloat32Array, offset);
            colorBuffer.set(chunk.colorsFloat32Array, offset);
            offset += chunk.verticesFloat32Array.length;
        }

        return {
            monolithicVertexFloatBuffer: vertexBuffer,
            monolithicColorFloatBuffer: colorBuffer,
            massiveConcatenatedVerticesCount: count
        };
    }, [aggregatedParallelDataChunksMatrix]);

    // removed legacy useEffect for single wall

    const [isPlacing, setIsPlacing] = useState(false);

    const handleElementClick = (id: string) => {
        if (activeRoomIndex !== 2) return;
        if (selectedElementId === id) {
            setIsPlacing((prev) => !prev);
        } else {
            if (onElementSelect) onElementSelect(id);
            setIsPlacing(true);
        }
    };

    const handlePlanePointerMove = (e: any) => {
        if (activeRoomIndex !== 2 || !isPlacing || !selectedElementId || !onElementPositionChange) return;
        
        let currentY = 50;
        if (selectedElementId.startsWith("orb") && orbPositions) {
            const idxStr = selectedElementId.replace("orb_", "");
            const idx = parseInt(idxStr, 10);
            if (!isNaN(idx) && orbPositions[idx]) {
                currentY = orbPositions[idx][1];
            }
        } else if (selectedElementId.startsWith("wall")) {
            const wall = wallsConfig.find(w => w.id === selectedElementId);
            if (wall) {
                currentY = wall.position[1];
            }
        } else if (selectedElementId.startsWith("plane")) {
            const plane = planesConfig.find(p => p.id === selectedElementId);
            if (plane) {
                currentY = plane.position[1];
            }
        }

        if (e.point) {
            onElementPositionChange(selectedElementId, [e.point.x, currentY, e.point.z]);
        }
    };

    const handlePlaneClick = (e: any) => {
        if (activeRoomIndex !== 2 || !isPlacing || !selectedElementId || !onElementPositionChange) return;
        
        let currentY = 50;
        if (selectedElementId.startsWith("orb") && orbPositions) {
            const idxStr = selectedElementId.replace("orb_", "");
            const idx = parseInt(idxStr, 10);
            if (!isNaN(idx) && orbPositions[idx]) {
                currentY = orbPositions[idx][1];
            }
        } else if (selectedElementId.startsWith("wall")) {
            const wall = wallsConfig.find(w => w.id === selectedElementId);
            if (wall) {
                currentY = wall.position[1];
            }
        } else if (selectedElementId.startsWith("plane")) {
            const plane = planesConfig.find(p => p.id === selectedElementId);
            if (plane) {
                currentY = plane.position[1];
            }
        }

        if (e.point) {
            onElementPositionChange(selectedElementId, [e.point.x, currentY, e.point.z]);
            setIsPlacing(false);
            e.stopPropagation();
        }
    };
    
    // ... Inside the render block, find <points ref={pointCloudRef}> and wrap it with <group>
    // Wait, let's just replace the orbs block
    
    return (
        <group>
            <ambientLight intensity={1.5} />
            <directionalLight position={[10, 20, 10]} intensity={2} />
            
            {/* Background Plane for Dragging Interaction */
             activeRoomIndex === 2 && (
                <mesh 
                    position={[0, 50, 0]} 
                    rotation={[-Math.PI / 2, 0, 0]} 
                    onPointerMove={handlePlanePointerMove} 
                    onClick={handlePlaneClick}
                >
                    <planeGeometry args={[10000, 10000]} />
                    <meshBasicMaterial transparent opacity={0.0} colorWrite={false} depthWrite={false} />
                </mesh>
            )}

            {wallsConfig.map((wall) => (
                <ParticleWall 
                    key={wall.id}
                    position={wall.position}
                    scale={wall.scale}
                    baseScale={sandboxWallScale}
                    density={sandboxDensity}
                    monolithicVertexFloatBuffer={monolithicVertexFloatBuffer}
                    monolithicColorFloatBuffer={monolithicColorFloatBuffer}
                    massiveConcatenatedVerticesCount={massiveConcatenatedVerticesCount}
                    isHighlighted={selectedElementId === wall.id}
                    onClick={() => handleElementClick(wall.id)}
                />
            ))}

            {planesConfig.map((plane) => (
                <mesh 
                    key={plane.id}
                    position={plane.position}
                    rotation={[-Math.PI / 2, 0, 0]}
                    scale={[plane.scale, plane.scale, 1]}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleElementClick(plane.id);
                    }}
                >
                    <planeGeometry args={[10, 10, 16, 16]} />
                    <meshBasicMaterial 
                        color={selectedElementId === plane.id ? "#ffffff" : "#f0f"} 
                        wireframe 
                        transparent 
                        opacity={0.3} 
                    />
                </mesh>
            ))}

            {orbPositions && orbPositions.map((pos, index) => {
                const isCyan = index === 0 || index === 2 || index === 3 || index === 5 || index === 6 || index === 7 || index >= 9;
                const scale = index === 1 || index === 5 ? 1.5 : (index === 2 ? 2.5 : (index === 8 ? 1.8 : (index === 3 || index === 6 ? 1.2 : 1.0)));
                return (
                    <HugeParticleOrb 
                        key={index}
                        position={pos}
                        isListening={index === 1 ? isListening : false}
                        isSpeaking={index === 1 ? isSpeaking : false}
                        isCyanDominant={isCyan}
                        offsetScale={scale * sandboxOrbScale}
                        onClick={() => handleElementClick(`orb_${index}`)}
                        isHighlighted={selectedElementId === `orb_${index}`}
                    />
                );
            })}

            <SocialIcons3D />
        </group>
    );
});
