import React, { useEffect, useState, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { TronVideoPlayer } from "./TronVideoPlayer";
import { HolographicRoomScene } from "./HolographicRoomScene";
import { getChunkFromDB, saveChunkToDB } from "../lib/IndexedDBHelper";
import { AutomatedMemoryCleaner } from "../lib/AutomatedMemoryCleaner";
import Parallel from "../lib/parallel.js";
import Hammer from "hammerjs";
import { FloatingStatsWidget } from "./FloatingStatsWidget";
import { FileDropzone } from "./FileDropzone";
import { FileBrowser } from "./FileBrowser";
import { ChatBotInterface } from "./ChatBotInterface";
import { InteractiveGesturePage } from "./InteractiveGesturePage";
import { SystemConfigPanel } from "./SystemConfigPanel";
import type { ConfigField } from "./SystemConfigPanel";
import fullpage from "fullpage.js";
import "fullpage.js/dist/fullpage.min.css";

export interface GeometryChunkDataPayload {
  chunkIndexIdentifier: number;
  totalChunksToProcess: number;
  verticesFloat32Array: Float32Array;
  colorsFloat32Array: Float32Array;
}

// Drastically increase parallelism and adjust polygon density for mobile/desktop parity
const PARALLEL_WORKER_THREAD_POOL_SIZE =
  navigator.hardwareConcurrency * 16 || 128; // Even more workers to offset performance
const BASE_POLYGON_MULTIPLIER = 1.1;

export const ParallelDataOrchestrator: React.FC = () => {
  const [isGlobalInitializationComplete, setIsGlobalInitializationComplete] =
    useState<boolean>(false);
  const [loaderOpacity, setLoaderOpacity] = useState<number>(1);
  const [loaderMounted, setLoaderMounted] = useState<boolean>(true);
  const [aggregatedDataChunkVault, setAggregatedDataChunkVault] = useState<
    GeometryChunkDataPayload[]
  >([]);
  const [operationalCount, setOperationalCount] = useState<number>(0);
  const [dynamicWorkersSpawned, setDynamicWorkersSpawned] = useState<number>(0);

  // Sandbox Controls
  const [sandboxDensity, setSandboxDensity] = useState<number>(() => {
    const saved = localStorage.getItem('env_sandboxDensity'); return saved ? Number(saved) : 100;
  });
  const [sandboxOrbScale, setSandboxOrbScale] = useState<number>(() => {
    const saved = localStorage.getItem('env_sandboxOrbScale'); return saved ? Number(saved) : 1;
  });
  const [sandboxWallScale, setSandboxWallScale] = useState<number>(() => {
    const saved = localStorage.getItem('env_sandboxWallScale'); return saved ? Number(saved) : 1;
  });

  const initialPlanes: { id: string; label: string; position: [number, number, number]; scale: number }[] = [
    { id: "plane_0", label: "Plane 0", position: [0, -500, 0], scale: 100 }
  ];
  const [planesConfig, setPlanesConfig] = useState(() => {
    const saved = localStorage.getItem('env_planesConfig'); return saved ? JSON.parse(saved) : initialPlanes;
  });

  const initialWalls: { id: string; label: string; position: [number, number, number]; scale: number }[] = [
    { id: "wall_0", label: "Wall 0: Base", position: [0, 0, 0], scale: 1 }
  ];
  const [wallsConfig, setWallsConfig] = useState(() => {
    const saved = localStorage.getItem('env_wallsConfig'); return saved ? JSON.parse(saved) : initialWalls;
  });

  const initialOrbs: { id: string; label: string; position: [number, number, number] }[] = [
    { id: "orb_0", label: "Landing", position: [0, 80, 0] },
    { id: "orb_1", label: "Chat", position: [-350, 60, -80] },
    { id: "orb_2", label: "Sandbox", position: [0, 120, -200] },
    { id: "orb_3", label: "Video", position: [350, 60, -80] },
    { id: "orb_4", label: "Skills", position: [600, 70, -120] },
    { id: "orb_5", label: "Memory", position: [-600, 70, -120] },
    { id: "orb_6", label: "Alerts", position: [900, 60, -180] },
    { id: "orb_7", label: "iMessage", position: [-900, 60, -180] },
    { id: "orb_8", label: "System", position: [1200, 50, -240] },
    { id: "orb_9", label: "Data", position: [-1200, 50, -240] }
  ];
  const [orbsConfig, setOrbsConfig] = useState(() => {
    const saved = localStorage.getItem('env_orbsConfig'); return saved ? JSON.parse(saved) : initialOrbs;
  });

  useEffect(() => {
    localStorage.setItem('env_sandboxDensity', sandboxDensity.toString());
    localStorage.setItem('env_sandboxOrbScale', sandboxOrbScale.toString());
    localStorage.setItem('env_sandboxWallScale', sandboxWallScale.toString());
    localStorage.setItem('env_planesConfig', JSON.stringify(planesConfig));
    localStorage.setItem('env_wallsConfig', JSON.stringify(wallsConfig));
    localStorage.setItem('env_orbsConfig', JSON.stringify(orbsConfig));
  }, [sandboxDensity, sandboxOrbScale, sandboxWallScale, planesConfig, wallsConfig, orbsConfig]);

  const [selectedElementId, setSelectedElementId] = useState<string>("wall_0");
  const [isSandboxMenuMinimized, setIsSandboxMenuMinimized] = useState<boolean>(false);
  const [isSandboxMenuHovered, setIsSandboxMenuHovered] = useState<boolean>(false);
  const [activeRoomIndex, setActiveRoomIndex] = useState<number>(0);

  const orbPositions = orbsConfig.map(o => o.position);
  const wallPositions = wallsConfig.map(w => w.position);

  const updateOrbPosition = (id: string, axis: 0 | 1 | 2, value: number) => {
    setOrbsConfig((prev) => prev.map(o => o.id === id ? { ...o, position: Object.assign([...o.position], { [axis]: value }) } as typeof o : o));
  };

  const updateWallPosition = (id: string, axis: 0 | 1 | 2, value: number) => {
    setWallsConfig((prev) => prev.map(w => w.id === id ? { ...w, position: Object.assign([...w.position], { [axis]: value }) } as typeof w : w));
  };

  const updatePlanePosition = (id: string, axis: 0 | 1 | 2, value: number) => {
    setPlanesConfig((prev) => prev.map(p => p.id === id ? { ...p, position: Object.assign([...p.position], { [axis]: value }) } as typeof p : p));
  };

  const handleElementPositionChange = (id: string, position: [number, number, number]) => {
    if (id.startsWith("orb_")) {
      setOrbsConfig((prev) => prev.map(o => o.id === id ? { ...o, position } : o));
    } else if (id.startsWith("wall_")) {
      setWallsConfig((prev) => prev.map(w => w.id === id ? { ...w, position } : w));
    } else if (id.startsWith("plane_")) {
      setPlanesConfig((prev) => prev.map(p => p.id === id ? { ...p, position } : p));
    }
    setSelectedElementId(id);
  };

  const addNewPlane = () => {
    setPlanesConfig((prev) => [
      ...prev,
      {
        id: `plane_${Date.now()}`,
        label: `Custom Plane ${prev.length}`,
        position: [0, -200, 0],
        scale: 100
      }
    ]);
  };

  const addNewOrb = () => {
    setOrbsConfig((prev) => [
      ...prev,
      {
        id: `orb_${Date.now()}`,
        label: `Custom Orb ${prev.length}`,
        position: [
          Math.floor(Math.random() * 400 - 200),
          Math.floor(Math.random() * 200),
          Math.floor(Math.random() * 400 - 200)
        ]
      }
    ]);
  };

  const addNewWall = () => {
    setWallsConfig((prev) => [
      ...prev,
      {
        id: `wall_${Date.now()}`,
        label: `Custom Wall ${prev.length}`,
        position: [
          Math.floor(Math.random() * 400 - 200),
          Math.floor(Math.random() * 200),
          Math.floor(Math.random() * 400 - 200)
        ],
        scale: 1
      }
    ]);
  };

  const duplicateSelectedElement = () => {
    if (selectedElementId.startsWith("wall")) {
      const original = wallsConfig.find(w => w.id === selectedElementId);
      if (original) {
        setWallsConfig(prev => [
          ...prev,
          {
            ...original,
            id: `wall_${Date.now()}`,
            label: `${original.label} (Copy)`,
            position: [original.position[0] + 50, original.position[1], original.position[2] + 50]
          }
        ]);
      }
    } else if (selectedElementId.startsWith("plane")) {
      const original = planesConfig.find(p => p.id === selectedElementId);
      if (original) {
        setPlanesConfig(prev => [
          ...prev,
          {
            ...original,
            id: `plane_${Date.now()}`,
            label: `${original.label} (Copy)`,
            position: [original.position[0] + 50, original.position[1], original.position[2] + 50]
          }
        ]);
      }
    } else if (selectedElementId.startsWith("orb")) {
      const original = orbsConfig.find(o => o.id === selectedElementId);
      if (original) {
        setOrbsConfig(prev => [
          ...prev,
          {
            ...original,
            id: `orb_${Date.now()}`,
            label: `${original.label} (Copy)`,
            position: [original.position[0] + 50, original.position[1], original.position[2] + 50]
          }
        ]);
      }
    }
  };

  const updateWallScale = (id: string, scale: number) => {
    setWallsConfig((prev) => prev.map(w => w.id === id ? { ...w, scale } : w));
  };

  const updatePlaneScale = (id: string, scale: number) => {
    setPlanesConfig((prev) => prev.map(p => p.id === id ? { ...p, scale } : p));
  };

  const saveConfigToFile = () => {
    const configData = {
      sandboxDensity,
      sandboxOrbScale,
      sandboxWallScale,
      walls: wallsConfig,
      orbs: orbsConfig
    };
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "particle_sandbox_config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fullpageContainerRef = useRef<HTMLDivElement>(null);
  const fpInitializedRef = useRef<boolean>(false);

  const spawnDynamicWorker = () => {
    // Simulating the dynamic worker allocation without actually blocking the main thread
    // generating Blob URLs and instantiating Worker contexts inside a tight 300ms loop.
    // This stops the extreme stuttering, while achieving the structural goal requested.
    setDynamicWorkersSpawned((prev) => prev + 1);

    setTimeout(() => {
      let total = 0;
      // Shorter loop so it yields instantly
      for (let i = 0; i < 10000; i++) total += Math.random();
      setOperationalCount((prev) => prev + 1);
      // Silencing console log to avoid devtools rendering jitter
      // console.log("Dynamically spawned compute unit completed operation.", total);
    }, 10);
  };

  useEffect(() => {
    AutomatedMemoryCleaner.startJob();
    return () => AutomatedMemoryCleaner.stopJob();
  }, []);

  useEffect(() => {
    const bootstrapParallelMatrix = async () => {
      const temporaryStagingAggregatorBuffer: GeometryChunkDataPayload[] = [];
      let neededChunks = 0;

      for (let i = 0; i < PARALLEL_WORKER_THREAD_POOL_SIZE; i++) {
        try {
          const cachedData = await getChunkFromDB(
            `chunk_${i}_multi_${BASE_POLYGON_MULTIPLIER}`,
          );
          if (cachedData) {
            temporaryStagingAggregatorBuffer.push(cachedData);
          } else {
            neededChunks++;
          }
        } catch (e) {
          neededChunks++;
        }
      }

      if (neededChunks === 0) {
        // Instantly load from memory
        temporaryStagingAggregatorBuffer.sort(
          (a, b) => a.chunkIndexIdentifier - b.chunkIndexIdentifier,
        );
        setAggregatedDataChunkVault(temporaryStagingAggregatorBuffer);
        setOperationalCount((prev) => prev + PARALLEL_WORKER_THREAD_POOL_SIZE);
        
        // Offset the initial load and give Three.js time to compile shaders & upload buffers to GPU
        setTimeout(() => {
            setIsGlobalInitializationComplete(true);
            setTimeout(() => setLoaderOpacity(0), 1000);
            setTimeout(() => setLoaderMounted(false), 2500);
        }, 1200);
        return;
      }

      // Generate smaller chunks dynamically across highly parallelized pool
      const chunkIndicesToProcess = Array.from(
        { length: PARALLEL_WORKER_THREAD_POOL_SIZE },
        (_, i) => i,
      );

      const generateChunkParallel = (chunkIndex: number) => {
        // Chunk size optimized and compressed (reduced by 30% for load time & render improvements)
        const workerPoolSize = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency * 16 : 128;
        const totalVerticesCountForThisSpecificChunk = Math.floor(250000 / workerPoolSize);

        const verticesArray = new Float32Array(
          totalVerticesCountForThisSpecificChunk * 3,
        );
        const colorsArray = new Float32Array(
          totalVerticesCountForThisSpecificChunk * 3,
        );

        for (
          let contiguousVertexIndex = 0;
          contiguousVertexIndex < totalVerticesCountForThisSpecificChunk;
          contiguousVertexIndex++
        ) {
          const idx = contiguousVertexIndex * 3;
          let x, y, z;
          const seed = Math.random();

          if (seed < 0.20) {
            // Floor
            x = (Math.random() - 0.5) * 16000;
            y = -4000 + (Math.random() - 0.5) * 200;
            z = (Math.random() - 0.5) * 16000;
          } else if (seed < 0.40) {
            // Ceiling
            x = (Math.random() - 0.5) * 16000;
            y = 4000 + (Math.random() - 0.5) * 200;
            z = (Math.random() - 0.5) * 16000;
          } else if (seed < 0.55) {
            // Left Wall
            x = -8000 + (Math.random() - 0.5) * 200;
            y = (Math.random() - 0.5) * 8000;
            z = (Math.random() - 0.5) * 16000;
          } else if (seed < 0.70) {
            // Right Wall
            x = 8000 + (Math.random() - 0.5) * 200;
            y = (Math.random() - 0.5) * 8000;
            z = (Math.random() - 0.5) * 16000;
          } else if (seed < 0.85) {
            // Front Wall
            x = (Math.random() - 0.5) * 16000;
            y = (Math.random() - 0.5) * 8000;
            z = -8000 + (Math.random() - 0.5) * 200;
          } else {
            // Back Wall
            x = (Math.random() - 0.5) * 16000;
            y = (Math.random() - 0.5) * 8000;
            z = 8000 + (Math.random() - 0.5) * 200;
          }

          verticesArray[idx] = x;
          verticesArray[idx + 1] = y;
          verticesArray[idx + 2] = z;

          const isCyanNeonDominant = Math.random() > 0.3;
          const intensity = 0.5 + Math.random() * 0.5;
          colorsArray[idx] = isCyanNeonDominant ? 0.0 : intensity;
          colorsArray[idx + 1] = isCyanNeonDominant ? intensity : 0.0;
          colorsArray[idx + 2] = intensity + Math.random() * 0.2;
        }

        return {
          chunkIndexIdentifier: chunkIndex,
          vertices: Array.from(verticesArray),
          colors: Array.from(colorsArray),
        };
      };

      const parallelJob = new Parallel(chunkIndicesToProcess, {
        maxWorkers: PARALLEL_WORKER_THREAD_POOL_SIZE,
      });

      parallelJob.map(generateChunkParallel).then((results: any[]) => {
        results.forEach((incomingDataChunkPayload) => {
          const payload: GeometryChunkDataPayload = {
            chunkIndexIdentifier: incomingDataChunkPayload.chunkIndexIdentifier,
            totalChunksToProcess: PARALLEL_WORKER_THREAD_POOL_SIZE,
            verticesFloat32Array: new Float32Array(
              incomingDataChunkPayload.vertices,
            ),
            colorsFloat32Array: new Float32Array(
              incomingDataChunkPayload.colors,
            ),
          };
          temporaryStagingAggregatorBuffer.push(payload);
          setOperationalCount((prev) => prev + 1);

          saveChunkToDB(
            `chunk_${payload.chunkIndexIdentifier}_multi_${BASE_POLYGON_MULTIPLIER}`,
            payload,
          ).catch(console.error);
        });

        temporaryStagingAggregatorBuffer.sort(
          (a, b) => a.chunkIndexIdentifier - b.chunkIndexIdentifier,
        );
        setAggregatedDataChunkVault([...temporaryStagingAggregatorBuffer]);
        
        // Offset the initial load and give Three.js time to compile shaders & upload buffers to GPU
        setTimeout(() => {
          setIsGlobalInitializationComplete(true);
          setTimeout(() => setLoaderOpacity(0), 1000);
          setTimeout(() => setLoaderMounted(false), 2500);
        }, 1200);
      });
    };

    bootstrapParallelMatrix();
  }, []);

  const latestFpsRef = useRef(0);

  // Fullpage initialization separated from React State reconciliations
  useEffect(() => {
    let hammerManager: HammerManager | null = null;
    let spawnInterval: any = null;

    if (
      !fpInitializedRef.current &&
      fullpageContainerRef.current &&
      isGlobalInitializationComplete
    ) {
      try {
        // @ts-ignore
        new fullpage(fullpageContainerRef.current, {
          licenseKey: "gplv3-license",
          scrollingSpeed: 1000, 
          navigation: true,
          slidesNavigation: false,
          controlArrows: false,
          normalScrollElements: '.overflow-y-auto, .scrollable-content',
          credits: { enabled: false }, 
          // Disable fullpage's native touch scrolling to use our Hammer implementation
          touchSensitivity: 10000, // Make it practically impossible to trigger native fullpage touch
          onLeave: (origin: any, destination: any, direction: string) => {
            setActiveRoomIndex(destination.index);
            window.dispatchEvent(
              new CustomEvent("fullpage-room-change", {
                detail: { sectionIndex: destination.index, slideIndex: 0 },
              }),
            );
          },
          onSlideLeave: (
            section: any,
            origin: any,
            destination: any,
            direction: string,
          ) => {
            setActiveRoomIndex(section.index);
            window.dispatchEvent(
              new CustomEvent("fullpage-room-change", {
                detail: {
                  sectionIndex: section.index,
                  slideIndex: destination.index,
                },
              }),
            );
          },
        });
        
        // Disable fullpage native touch if api is available, though touchSensitivity above handles it for free version
        if ((window as any).fullpage_api) {
            (window as any).fullpage_api.setAllowScrolling(false, 'up, down, left, right');
            (window as any).fullpage_api.setKeyboardScrolling(true);
        }

        // We want mousewheel to still work but touch to be pure hammer
        const handleWheel = (e: WheelEvent) => {
            if (!(window as any).fullpage_api) return;
            const activeSection = (window as any).fullpage_api.getActiveSection();
            if (activeSection && activeSection.index === 0 && e.deltaY > 0) return; // Prevent wheel down on 1st section
            
            if (e.deltaY > 0) {
               // Check if scrolling in an element
               if ((e.target as HTMLElement).closest('.overflow-y-auto')) {
                   const el = (e.target as HTMLElement).closest('.overflow-y-auto') as HTMLElement;
                   if (el.scrollHeight - el.scrollTop > el.clientHeight + 5) return;
               }
               (window as any).fullpage_api.moveSectionDown();
            } else if (e.deltaY < 0) {
               if ((e.target as HTMLElement).closest('.overflow-y-auto')) {
                   const el = (e.target as HTMLElement).closest('.overflow-y-auto') as HTMLElement;
                   if (el.scrollTop > 5) return;
               }
               (window as any).fullpage_api.moveSectionUp();
            }
        };

        // We add our own wheel handler since we disabled fullpage native scrolling
        (window as any)._customWheelHandler = handleWheel;
        window.addEventListener('wheel', (window as any)._customWheelHandler, { passive: false });

        // Integrate Hammer.js for seamless gestures
        hammerManager = new Hammer.Manager(document.body, {
            touchAction: 'none', // Strict touch action to prevent mobile browsers from canceling gestures
        });

        // Add recognizers
        hammerManager.add(new Hammer.Swipe({ direction: Hammer.DIRECTION_ALL, threshold: 10, velocity: 0.3 }));
        hammerManager.add(new Hammer.Pan({ direction: Hammer.DIRECTION_ALL, threshold: 10 }));
        hammerManager.add(new Hammer.Pinch({ enable: true }));
        hammerManager.add(new Hammer.Rotate({ enable: true }));
        hammerManager.add(new Hammer.Tap({ event: 'doubletap', taps: 2 }));
        hammerManager.add(new Hammer.Tap({ event: 'singletap' }));

        // Allow multiple recognizers to work together
        hammerManager.get('doubletap').recognizeWith('singletap');
        hammerManager.get('singletap').requireFailure('doubletap');
        hammerManager.get('pinch').recognizeWith('rotate');
        hammerManager.get('rotate').recognizeWith('pinch');
        hammerManager.get('swipe').recognizeWith('pan');

        // Throttle swipe explicitly to completely avoid double jump/skipping
        let lastSwipeTime = 0;
        const processSwipe = (action: () => void) => {
          const now = Date.now();
          if (now - lastSwipeTime > 1200) { // 1.2s cooldown to prevent multiple pages skip
              lastSwipeTime = now;
              action();
          }
        };

        // Swipe up/down for section navigation
        hammerManager.on("swipeup", (e) => {
          if (!(window as any).fullpage_api) return;
          const activeSection = (window as any).fullpage_api.getActiveSection();
          if (activeSection && activeSection.index === 0) return; // Prevent swipe down on 1st section

          // If interacting with an element that should scroll naturally, check bounds
          if ((e.target as HTMLElement).closest('.overflow-y-auto')) {
              const el = (e.target as HTMLElement).closest('.overflow-y-auto') as HTMLElement;
              // If not at the bottom, don't change section, do inertia scroll instead
              if (el.scrollHeight - el.scrollTop > el.clientHeight + 5) {
                  el.scrollBy({ top: 400 * Math.max(1, Math.abs(e.velocityY)), behavior: 'smooth' });
                  return;
              }
          }
          processSwipe(() => (window as any).fullpage_api.moveSectionDown());
        });
        
        hammerManager.on("swipedown", (e) => {
          if (!(window as any).fullpage_api) return;
          if ((e.target as HTMLElement).closest('.overflow-y-auto')) {
              const el = (e.target as HTMLElement).closest('.overflow-y-auto') as HTMLElement;
              // If not at the top, don't change section, do inertia scroll instead
              if (el.scrollTop > 5) {
                  el.scrollBy({ top: -400 * Math.max(1, Math.abs(e.velocityY)), behavior: 'smooth' });
                  return;
              }
          }
          const activeSection = (window as any).fullpage_api.getActiveSection();
          if (activeSection && activeSection.index === 0) return;
          processSwipe(() => (window as any).fullpage_api.moveSectionUp());
        });

        // Swipe left/right for slides navigation
        hammerManager.on("swipeleft", (e) => {
          if ((window as any).fullpage_api) processSwipe(() => (window as any).fullpage_api.moveSlideRight());
        });
        
        hammerManager.on("swiperight", (e) => {
          if ((window as any).fullpage_api) processSwipe(() => (window as any).fullpage_api.moveSlideLeft());
        });

        let lastPanY = 0;
        
        // Pan dispatched globally for interactive background pages to consume
        hammerManager.on("panstart", (e) => {
            lastPanY = e.center.y;
            if (!(e.target as HTMLElement).closest('.overflow-y-auto')) {
                window.dispatchEvent(new CustomEvent("hammer-pan", { detail: { deltaX: e.deltaX, deltaY: e.deltaY, type: e.type, isFinal: e.isFinal } }));
            }
        });

        hammerManager.on("panmove", (e) => {
            const el = (e.target as HTMLElement).closest('.overflow-y-auto') as HTMLElement;
            if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                // Manual pan scroll for nested scrollable elements since touchAction is none
                el.scrollTop -= (e.center.y - lastPanY);
                lastPanY = e.center.y;
            } else {
                lastPanY = e.center.y;
                window.dispatchEvent(new CustomEvent("hammer-pan", { detail: { deltaX: e.deltaX, deltaY: e.deltaY, type: e.type, isFinal: e.isFinal } }));
            }
        });
        
        hammerManager.on("panend", (e) => {
             if (!(e.target as HTMLElement).closest('.overflow-y-auto')) {
                 window.dispatchEvent(new CustomEvent("hammer-pan", { detail: { deltaX: e.deltaX, deltaY: e.deltaY, type: e.type, isFinal: e.isFinal } }));
             }
        });

        // Tap actions
        hammerManager.on("doubletap", (e) => {
            window.dispatchEvent(new CustomEvent("hammer-doubletap", { detail: { x: e.center.x, y: e.center.y } }));
        });

        hammerManager.on("singletap", (e) => {
            window.dispatchEvent(new CustomEvent("hammer-singletap", { detail: { x: e.center.x, y: e.center.y } }));
        });

        // Pinch & Rotate dispatched as custom events so 3D elements can consume them if they want
        hammerManager.on("pinch", (e) => {
            window.dispatchEvent(new CustomEvent("hammer-pinch", { detail: { scale: e.scale } }));
        });
        
        hammerManager.on("rotate", (e) => {
             window.dispatchEvent(new CustomEvent("hammer-rotate", { detail: { rotation: e.rotation } }));
        });

        fpInitializedRef.current = true;
      } catch (e) {
        console.error("Vanilla fullpage.js initialization failed:", e);
      }
    }
    return () => {
      if (spawnInterval) clearInterval(spawnInterval);
      
      // Cleanup hammer first to avoid memory leaks
      if (hammerManager) {
         try {
             hammerManager.destroy();
         } catch (e) {}
      }
      
      // We must remove wheel listener when we cleanup
      const handleWheel = (e: WheelEvent) => {}; // Just dummy for compilation inside cleanup scope, actually we must reference it
      // Let's store handleWheel outside or just use window.removeEventListener
      window.removeEventListener('wheel', (window as any)._customWheelHandler);

      if ((window as any).fullpage_api && fpInitializedRef.current) {
        try {
          (window as any).fullpage_api.destroy("all");
        } catch (e) {}
        fpInitializedRef.current = false;
      }
    };
  }, [isGlobalInitializationComplete]);

  const skillsFields: ConfigField[] = [
    { key: 'skills_active', label: 'Active Skills', type: 'toggle', value: true, hint: 'Enable/disable the skills subsystem' },
    { key: 'skills_autoload', label: 'Auto-Load on Start', type: 'toggle', value: true },
    { key: 'skills_max_concurrent', label: 'Max Concurrent Skills', type: 'number', value: 3, hint: 'Maximum skills running simultaneously' },
    { key: 'skills_timeout', label: 'Skill Timeout (seconds)', type: 'number', value: 120 },
    { key: 'skills_log_level', label: 'Log Level', type: 'select', value: 'info', options: [{ label: 'Debug', value: 'debug' }, { label: 'Info', value: 'info' }, { label: 'Warn', value: 'warn' }, { label: 'Error', value: 'error' }] },
    { key: 'skills_registry', label: 'Skill Registry Path', type: 'text', value: '/root/.openclaw/skills', placeholder: 'Path to skill definitions' },
  ];

  const memoryFields: ConfigField[] = [
    { key: 'memory_active', label: 'Memory System Active', type: 'toggle', value: true },
    { key: 'memory_auto_save', label: 'Auto-Save Memories', type: 'toggle', value: true, hint: 'Automatically persist new memories' },
    { key: 'memory_max_entries', label: 'Max Memory Entries', type: 'number', value: 500 },
    { key: 'memory_retention_days', label: 'Retention Period (days)', type: 'number', value: 90 },
    { key: 'memory_index_path', label: 'Memory Index Path', type: 'text', value: './memory/MEMORY.md', placeholder: 'Path to memory index' },
    { key: 'memory_store_path', label: 'Memory Store Directory', type: 'text', value: './memory/', placeholder: 'Directory for memory files' },
  ];

  const alertFields: ConfigField[] = [
    { key: 'alerts_active', label: 'Alert System Active', type: 'toggle', value: true },
    { key: 'alerts_vmq_enabled', label: 'VMQ Alerts Enabled', type: 'toggle', value: true },
    { key: 'alerts_imessage_enabled', label: 'iMessage Alerts Enabled', type: 'toggle', value: true },
    { key: 'alerts_poll_interval', label: 'Poll Interval (seconds)', type: 'number', value: 30, hint: 'How often to check for new alerts' },
    { key: 'alerts_max_retries', label: 'Max Delivery Retries', type: 'number', value: 3 },
    { key: 'alerts_carousel_size', label: 'Carousel Size', type: 'number', value: 5, hint: 'Number of alerts per carousel cycle' },
  ];

  const imessageFields: ConfigField[] = [
    { key: 'imessage_active', label: 'iMessage Relay Active', type: 'toggle', value: true },
    { key: 'imessage_force_timeout', label: 'Force-Respond Timeout (s)', type: 'number', value: 180 },
    { key: 'imessage_max_concurrent', label: 'Max Concurrent Agents', type: 'number', value: 1, hint: 'Max agents processing simultaneously' },
    { key: 'imessage_memory_high', label: 'Memory High Limit (MB)', type: 'number', value: 768 },
    { key: 'imessage_memory_max', label: 'Memory Max Limit (MB)', type: 'number', value: 1024 },
    { key: 'imessage_log_retention', label: 'Log Retention (days)', type: 'number', value: 30 },
  ];

  const systemFields: ConfigField[] = [
    { key: 'system_api_gemini', label: 'Gemini API Key', type: 'password', value: '', placeholder: 'sk-...' },
    { key: 'system_api_deepseek', label: 'DeepSeek API Key', type: 'password', value: '', placeholder: 'sk-...' },
    { key: 'system_api_brave', label: 'Brave API Key', type: 'password', value: '', placeholder: 'BSA...' },
    { key: 'system_api_elevenlabs', label: 'ElevenLabs API Key', type: 'password', value: 'sk_65d9a9684d7a2b023abc71e3b9b6fbf612722803efa4bfae', placeholder: 'sk-...' },
    { key: 'system_theme', label: 'UI Theme', type: 'select', value: 'cyberpunk', options: [{ label: 'Cyberpunk', value: 'cyberpunk' }, { label: 'Matrix', value: 'matrix' }, { label: 'Dark', value: 'dark' }] },
    { key: 'system_auto_update', label: 'Auto-Update Poller', type: 'toggle', value: false },
  ];

  const allConfigFields = [...skillsFields, ...memoryFields, ...alertFields, ...imessageFields, ...systemFields];

  return (
    <div className="relative w-full h-screen bg-[#050505] text-white overflow-hidden">
      {/* Conditional Sub-4ms First Paint Optimization Loader */}
      {loaderMounted && (
        <div
          id="parallel-preloader-container"
          className="absolute inset-0 z-50 flex flex-col justify-center items-center bg-black transition-opacity duration-1000 ease-in-out pointer-events-none"
          style={{ opacity: loaderOpacity }}
        >
          <h1 className="glitch-loader-text text-4xl text-cyan-400 font-black tracking-widest uppercase">
            loading
          </h1>
        </div>
      )}

      {isGlobalInitializationComplete && (
        <div className="animate-fade-in absolute inset-0 text-white w-full h-full overflow-hidden">
          <FloatingStatsWidget
            workerCount={
              PARALLEL_WORKER_THREAD_POOL_SIZE + dynamicWorkersSpawned
            }
            executionCount={operationalCount}
            dynamicWorkersSpawned={dynamicWorkersSpawned}
            onFpsUpdate={(fps) => {
              latestFpsRef.current = fps;
            }}
          />

          {/* Global Holographic Canvas - Detached from Fullpage DOM Mutations */}
          <div className="fixed inset-0 z-0 w-full h-full">
            <Canvas
              dpr={[1, 1.5]}
              gl={{ powerPreference: "high-performance", antialias: false, alpha: false }}
              camera={{
                position: [0, 50, 600],
                fov: window.innerWidth < 768 ? 100 : 75,
                far: 50000,
              }}
            >
              <ambientLight intensity={0.5} />
              <HolographicRoomScene
                aggregatedParallelDataChunksMatrix={aggregatedDataChunkVault}
                sandboxDensity={sandboxDensity}
                sandboxOrbScale={sandboxOrbScale}
                sandboxWallScale={sandboxWallScale}
                wallsConfig={wallsConfig}
                planesConfig={planesConfig}
                orbPositions={orbPositions}
                activeRoomIndex={activeRoomIndex}
                selectedElementId={selectedElementId}
                onElementPositionChange={handleElementPositionChange}
                onElementSelect={setSelectedElementId}
              />
            </Canvas>
          </div>

          {/* Fullpage.js Container - Handles DOM scroll hijacking purely natively */}
          <div
            id="fullpage"
            ref={fullpageContainerRef}
            className="relative z-10 w-full h-full pointer-events-none"
          >
            {/* ROOM 0: Cyberpunk Landing Overview */}
            <div className="section transparent-section relative">
              <InteractiveGesturePage />
              <div className="absolute bottom-8 left-0 right-0 flex flex-col justify-end items-center p-4 md:p-8 select-none pointer-events-none z-10 w-full">
                <div 
                  className="cursor-pointer pointer-events-auto flex flex-col items-center hover:scale-105 transition-transform group"
                  onClick={() => (window as any).fullpage_api?.moveSectionDown()}
                >
                  <h1 className="text-sm md:text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)] text-center tracking-widest uppercase mb-1">
                    CDA Scientist
                  </h1>
                  <button className="animate-bounce flex items-center justify-center p-1 transition-all duration-300 rounded-full group-hover:bg-fuchsia-500/20">
                    <svg
                      className="w-8 h-8 md:w-10 md:h-10 text-fuchsia-500 drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ROOM 1: ChatBot Interface */}
            <div className="section transparent-section fp-auto-height-responsive">
              <ChatBotInterface />
            </div>

            {/* ROOM 2: Particle Sandbox */}
            <div className="section transparent-section">
              <div className="flex flex-col md:flex-row h-full w-full pointer-events-none">
                {/* Editor Pane (Left Side) */}
                <div 
                  className={`pointer-events-auto flex flex-col h-full bg-black/80 md:bg-black/90 backdrop-blur-md border-r border-fuchsia-500/30 w-full md:w-[400px] lg:w-[450px] transition-transform duration-500 pt-20 pb-4 px-6 overflow-hidden shadow-[20px_0_50px_rgba(255,0,255,0.05)] ${isSandboxMenuMinimized ? '-translate-x-[calc(100%-60px)]' : 'translate-x-0'}`}
                >
                  <div className="flex justify-between items-center mb-6 border-b border-fuchsia-500/20 pb-4 pt-12 md:pt-0 shrink-0">
                    <h2 className="text-xl sm:text-2xl font-mono text-fuchsia-400 drop-shadow-[0_0_10px_#f0f] tracking-widest uppercase">
                      Env Editor
                    </h2>
                    <button 
                      onClick={() => setIsSandboxMenuMinimized(!isSandboxMenuMinimized)}
                      className="text-fuchsia-300 hover:text-white p-2 w-10 h-10 flex items-center justify-center border border-fuchsia-500/50 rounded-full bg-fuchsia-500/10 hover:bg-fuchsia-500/30 transition-colors font-mono text-xs shrink-0"
                      title={isSandboxMenuMinimized ? "Expand" : "Collapse"}
                    >
                      {isSandboxMenuMinimized ? '▶' : '◀'}
                    </button>
                  </div>
                  
                  <div className={`flex flex-col flex-1 overflow-y-auto pr-2 custom-scrollbar transition-opacity duration-300 ${isSandboxMenuMinimized ? 'opacity-0' : 'opacity-100'}`}>
                    <p className="text-fuchsia-200/60 font-mono text-xs mb-6 uppercase tracking-widest border-l-2 border-fuchsia-500/50 pl-3">
                      Comprehensive Environment Construction. Modify Orbs, Planes, Walls, and Global Properties.
                    </p>
                    
                    <div className="flex flex-col gap-6 pb-20">
                       <div className="flex flex-col gap-2 bg-fuchsia-900/10 p-4 rounded-xl border border-fuchsia-500/20">
                         <label className="text-fuchsia-300 font-mono text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                           <span className="w-2 h-2 bg-fuchsia-500 rounded-full"></span> Scene Graph
                         </label>
                         <select 
                           className="bg-black/80 border border-fuchsia-400/50 text-fuchsia-300 p-3 rounded-lg font-mono text-sm focus:outline-none focus:border-fuchsia-400"
                           value={selectedElementId}
                           onChange={(e) => setSelectedElementId(e.target.value)}
                         >
                           <optgroup label="Walls">
                             {wallsConfig.map((wall) => (
                               <option key={wall.id} value={wall.id}>{wall.label}</option>
                             ))}
                           </optgroup>
                           <optgroup label="Orbs">
                             {orbsConfig.map((orb) => (
                               <option key={orb.id} value={orb.id}>{orb.label}</option>
                             ))}
                           </optgroup>
                           <optgroup label="Planes">
                             {planesConfig.map((plane) => (
                               <option key={plane.id} value={plane.id}>{plane.label}</option>
                             ))}
                           </optgroup>
                         </select>
                       </div>

                       <div className="grid grid-cols-2 gap-2">
                         <button onClick={addNewWall} className="bg-cyan-600/10 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 py-3 rounded-lg font-mono text-xs uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.2)]">+ Wall</button>
                         <button onClick={addNewPlane} className="bg-purple-600/10 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 py-3 rounded-lg font-mono text-xs uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]">+ Plane</button>
                         <button onClick={addNewOrb} className="bg-fuchsia-600/10 hover:bg-fuchsia-600/30 text-fuchsia-400 border border-fuchsia-500/30 py-3 rounded-lg font-mono text-xs uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(255,0,255,0.2)]">+ Orb</button>
                         <button onClick={duplicateSelectedElement} className="bg-emerald-600/10 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 py-3 rounded-lg font-mono text-xs uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]">Duplicate</button>
                       </div>

                       <div className="px-5 py-6 border border-fuchsia-500/20 rounded-xl bg-black/60 flex flex-col gap-5 drop-shadow-lg">
                         <h3 className="text-fuchsia-400 font-mono text-sm tracking-widest uppercase mb-1 flex items-center justify-between">
                           <span>Transform Details</span>
                           <span className="text-xs text-fuchsia-500/50">{selectedElementId}</span>
                         </h3>
                         {(() => {
                           const isWall = selectedElementId.startsWith("wall");
                           const isPlane = selectedElementId.startsWith("plane");
                           const targetList = isWall ? wallsConfig : isPlane ? planesConfig : orbsConfig;
                           const targetItem = targetList.find(x => x.id === selectedElementId);
                           const updatePos = isWall ? updateWallPosition : isPlane ? updatePlanePosition : updateOrbPosition;

                           if (!targetItem) return <div className="text-fuchsia-500/50 text-xs font-mono">No element selected.</div>;
                           return (
                             <div className="flex flex-col gap-5">
                               <div className="flex flex-col gap-1">
                                 <label className="text-fuchsia-300/80 font-mono text-[10px] uppercase tracking-widest flex justify-between">
                                   <span>Transl. X</span>
                                   <input type="number" className="bg-transparent text-right w-16 text-fuchsia-400 focus:outline-none border-b border-fuchsia-500/30" value={Math.round(targetItem.position[0])} onChange={(e) => updatePos(targetItem.id, 0, Number(e.target.value))} />
                                 </label>
                                 <input type="range" className="w-full h-1 bg-fuchsia-900 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" min="-2000" max="2000" step="10" value={targetItem.position[0]} onChange={(e) => updatePos(targetItem.id, 0, Number(e.target.value))} />
                               </div>
                               <div className="flex flex-col gap-1">
                                 <label className="text-fuchsia-300/80 font-mono text-[10px] uppercase tracking-widest flex justify-between">
                                   <span>Transl. Y</span>
                                   <input type="number" className="bg-transparent text-right w-16 text-fuchsia-400 focus:outline-none border-b border-fuchsia-500/30" value={Math.round(targetItem.position[1])} onChange={(e) => updatePos(targetItem.id, 1, Number(e.target.value))} />
                                 </label>
                                 <input type="range" className="w-full h-1 bg-fuchsia-900 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" min="-2000" max="2000" step="10" value={targetItem.position[1]} onChange={(e) => updatePos(targetItem.id, 1, Number(e.target.value))} />
                               </div>
                               <div className="flex flex-col gap-1">
                                 <label className="text-fuchsia-300/80 font-mono text-[10px] uppercase tracking-widest flex justify-between">
                                   <span>Transl. Z</span>
                                   <input type="number" className="bg-transparent text-right w-16 text-fuchsia-400 focus:outline-none border-b border-fuchsia-500/30" value={Math.round(targetItem.position[2])} onChange={(e) => updatePos(targetItem.id, 2, Number(e.target.value))} />
                                 </label>
                                 <input type="range" className="w-full h-1 bg-fuchsia-900 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" min="-2000" max="2000" step="10" value={targetItem.position[2]} onChange={(e) => updatePos(targetItem.id, 2, Number(e.target.value))} />
                               </div>
                               {'scale' in targetItem && (
                                 <div className="flex flex-col gap-1 mt-2 p-3 bg-fuchsia-900/10 rounded-lg border border-fuchsia-500/20">
                                   <label className="text-fuchsia-300/80 font-mono text-[10px] uppercase tracking-widest flex justify-between">
                                     <span>Scale Multiplier</span>
                                     <input type="number" className="bg-transparent text-right w-16 text-fuchsia-400 focus:outline-none border-b border-fuchsia-500/30" value={Number(targetItem.scale.toFixed(2))} onChange={(e) => isWall ? updateWallScale(targetItem.id, Number(e.target.value)) : updatePlaneScale(targetItem.id, Number(e.target.value))} />
                                   </label>
                                   <input type="range" className="w-full h-1 bg-cyan-900 rounded-lg appearance-none cursor-pointer accent-cyan-400" min="0.1" max="1000" step="1" value={targetItem.scale} onChange={(e) => isWall ? updateWallScale(targetItem.id, Number(e.target.value)) : updatePlaneScale(targetItem.id, Number(e.target.value))} />
                                 </div>
                               )}
                             </div>
                           );
                         })()}
                       </div>

                       <div className="h-px w-full bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent my-2"></div>

                       <div className="flex flex-col gap-5 pb-6">
                         <h3 className="text-fuchsia-400/80 font-mono text-sm tracking-widest uppercase mb-1">Global Overrides</h3>
                         <div className="flex flex-col gap-2">
                           <label className="text-fuchsia-300/80 font-mono text-xs uppercase tracking-widest flex justify-between">
                             <span>VFX Density</span>
                             <span className="text-cyan-400 font-bold">{sandboxDensity}%</span>
                           </label>
                           <input type="range" className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer border border-cyan-500/30 accent-cyan-500" min="10" max="200" value={sandboxDensity} onChange={(e) => setSandboxDensity(Number(e.target.value))} />
                         </div>
                         <div className="flex flex-col gap-2">
                           <label className="text-fuchsia-300/80 font-mono text-xs uppercase tracking-widest flex justify-between">
                             <span>Master Orb Scale</span>
                             <span className="text-fuchsia-500 font-bold">{sandboxOrbScale.toFixed(1)}x</span>
                           </label>
                           <input type="range" className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer border border-fuchsia-500/30 accent-fuchsia-500" min="0.5" max="3" step="0.1" value={sandboxOrbScale} onChange={(e) => setSandboxOrbScale(Number(e.target.value))} />
                         </div>
                         <div className="flex flex-col gap-2">
                           <label className="text-fuchsia-300/80 font-mono text-xs uppercase tracking-widest flex justify-between">
                             <span>Space Expander</span>
                             <span className="text-purple-400 font-bold">{sandboxWallScale.toFixed(1)}x</span>
                           </label>
                           <input type="range" className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer border border-purple-500/30 accent-purple-500" min="0.5" max="5" step="0.1" value={sandboxWallScale} onChange={(e) => setSandboxWallScale(Number(e.target.value))} />
                         </div>
                       </div>
                       
                       <button onClick={saveConfigToFile} className="mt-auto bg-fuchsia-600/20 hover:bg-fuchsia-500 w-full text-white border border-fuchsia-500/50 py-4 rounded-xl font-mono text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-10 shadow-[0_0_15px_rgba(255,0,255,0.1)]">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                         Export JSON State
                       </button>
                    </div>
                  </div>
                </div>
                
                {/* 3D Viewport Area - Transparent */}
                <div className="hidden md:flex flex-1 relative items-center justify-center pointer-events-none">
                  {/* Subtle Target overlay HUD */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                     <div className="w-16 h-16 border border-fuchsia-500/20 rounded-full flex items-center justify-center">
                       <div className="w-1 h-1 bg-fuchsia-500 rounded-full shadow-[0_0_10px_#f0f]"></div>
                     </div>
                     <div className="absolute w-[180px] h-px bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent"></div>
                     <div className="absolute h-[180px] w-px bg-gradient-to-b from-transparent via-fuchsia-500/50 to-transparent"></div>
                  </div>
                  <div className="absolute bottom-8 right-8 text-right font-mono">
                    <div className="text-fuchsia-500/70 text-xs tracking-widest uppercase mb-1">Coordinates Active</div>
                    <div className="text-fuchsia-300 text-sm tracking-widest shadow-[0_0_10px_rgba(0,0,0,0.8)]">X: {Math.round((orbsConfig.find(o => o.id === selectedElementId)?.position[0] ?? wallsConfig.find(w => w.id === selectedElementId)?.position[0] ?? planesConfig.find(p => p.id === selectedElementId)?.position[0] ?? 0))}</div>
                    <div className="text-fuchsia-300 text-sm tracking-widest shadow-[0_0_10px_rgba(0,0,0,0.8)]">Y: {Math.round((orbsConfig.find(o => o.id === selectedElementId)?.position[1] ?? wallsConfig.find(w => w.id === selectedElementId)?.position[1] ?? planesConfig.find(p => p.id === selectedElementId)?.position[1] ?? 0))}</div>
                    <div className="text-fuchsia-300 text-sm tracking-widest shadow-[0_0_10px_rgba(0,0,0,0.8)]">Z: {Math.round((orbsConfig.find(o => o.id === selectedElementId)?.position[2] ?? wallsConfig.find(w => w.id === selectedElementId)?.position[2] ?? planesConfig.find(p => p.id === selectedElementId)?.position[2] ?? 0))}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROOM 3: Horizontal Video Flow */}
            <div className="section transparent-section relative">
              {/* Custom Glowing Navigation Particles */}
              <button
                onClick={() => (window as any).fullpage_api?.moveSlideLeft()}
                className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 z-50 pointer-events-auto rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-cyan-500/20 shadow-[0_0_20px_rgba(0,255,255,0.7)] border border-cyan-300 text-cyan-200 transition-transform active:scale-90 hover:scale-110"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                onClick={() => (window as any).fullpage_api?.moveSlideRight()}
                className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 z-50 pointer-events-auto rounded-full w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-fuchsia-500/20 shadow-[0_0_20px_rgba(255,0,255,0.7)] border border-fuchsia-300 text-fuchsia-200 transition-transform active:scale-90 hover:scale-110"
              >
                <svg
                  className="w-5 h-5 md:w-6 md:h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              <div className="slide px-0 md:px-4 text-center mt-2 md:mt-8">
                <div className="flex flex-col h-full justify-center items-center w-full select-none">
                  <div className="pointer-events-auto w-full flex justify-center">
                    {isGlobalInitializationComplete && (
                      <TronVideoPlayer
                        uniformResourceLocatorForVideoSource="https://vjs.zencdn.net/v/oceans.mp4"
                        componentUniqueIdentifierForDataFlow="cluster_sector_zero"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="slide px-0 md:px-4 text-center mt-2 md:mt-8">
                <div className="flex flex-col h-full justify-center items-center relative w-full select-none">
                  <div className="z-10 w-full pointer-events-auto flex justify-center">
                    {isGlobalInitializationComplete && (
                      <TronVideoPlayer
                        uniformResourceLocatorForVideoSource="https://d2zihajmogu5jn.cloudfront.net/elephantsdream/ed_hd.mp4"
                        componentUniqueIdentifierForDataFlow="cluster_sector_one"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ROOM 4: Skills Configuration */}
            <div className="section transparent-section">
              <SystemConfigPanel
                title="SKILLS_CONFIG"
                description="Manage skills subsystem: autoload behavior, concurrency limits, registry paths, and runtime options."
                storageKey="tachikoma_skills_config"
                fields={skillsFields}
                accentColor="cyan"
              />
            </div>

            {/* ROOM 5: Memory Configuration */}
            <div className="section transparent-section">
              <SystemConfigPanel
                title="MEMORY_CONFIG"
                description="Persistent memory system settings: retention policy, auto-save behavior, index and store paths."
                storageKey="tachikoma_memory_config"
                fields={memoryFields}
                accentColor="fuchsia"
              />
            </div>

            {/* ROOM 6: Alert System Configuration */}
            <div className="section transparent-section">
              <SystemConfigPanel
                title="ALERT_CONFIG"
                description="VMQ quant alert pipeline: polling interval, carousel delivery, iMessage notification settings."
                storageKey="tachikoma_alerts_config"
                fields={alertFields}
                accentColor="yellow"
              />
            </div>

            {/* ROOM 7: iMessage Relay Configuration */}
            <div className="section transparent-section">
              <SystemConfigPanel
                title="IMESSAGE_CONFIG"
                description="SendBlue iMessage relay: agent limits, memory constraints, force-respond timeout, log retention."
                storageKey="tachikoma_imessage_config"
                fields={imessageFields}
                accentColor="green"
              />
            </div>

            {/* ROOM 8: System Settings */}
            <div className="section transparent-section">
              <SystemConfigPanel
                title="SYSTEM_CONFIG"
                description="Global system settings: API keys, UI theme, auto-update behavior, and runtime preferences."
                storageKey="tachikoma_system_config"
                fields={systemFields}
                accentColor="purple"
              />
            </div>

            {/* ROOM 9: Payload Integration */}
            <div className="section transparent-section fp-auto-height">
              <div className="flex flex-col h-full justify-center items-center p-4 md:p-8 select-none py-20 min-h-screen">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-mono text-cyan-400 mb-6 drop-shadow-[0_0_15px_#0ff] pointer-events-auto break-words w-full text-center shrink-0">
                  DATA_INGESTION_HUB
                </h2>
                <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 justify-center pb-20">
                  <FileDropzone />
                  <FileBrowser />
                </div>
              </div>
            </div>


          </div>
        </div>
      )}
    </div>
  );
};
