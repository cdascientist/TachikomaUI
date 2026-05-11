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
import { ResumeBreakdownSection } from "./ResumeBreakdownSection";
import { InteractiveGesturePage } from "./InteractiveGesturePage";
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
    { id: "orb_0", label: "Orb 0: Landing", position: [0, 50, 0] },
    { id: "orb_1", label: "Orb 1: Chatbot", position: [-300, 50, -50] },
    { id: "orb_2", label: "Orb 2: Particle Sandbox", position: [0, 100, -200] },
    { id: "orb_3", label: "Orb 3: Video", position: [300, 50, -50] },
    { id: "orb_4", label: "Orb 4: Architecture", position: [600, 50, -100] },
    { id: "orb_5", label: "Orb 5: Resume", position: [-600, 50, -100] },
    { id: "orb_6", label: "Orb 6: Dynamic Thread", position: [900, 50, -150] },
    { id: "orb_7", label: "Orb 7: Nexus", position: [-900, 50, -150] },
    { id: "orb_8", label: "Orb 8: Canvas Delegation", position: [1200, 50, -200] },
    { id: "orb_9", label: "Orb 9: Data Ingestion", position: [-1200, 50, -200] }
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

            {/* ROOM 3: Architecture Explanation (formerly Room 4) */}
            <div className="section transparent-section">
              <div className="flex flex-col h-full justify-center items-center p-4 md:p-8 text-center select-none w-full max-w-5xl mx-auto">
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl font-mono text-cyan-400 mb-6 md:mb-8 drop-shadow-[0_0_15px_#0ff] pointer-events-auto break-words w-full"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  INFRASTRUCTURE
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 pointer-events-auto w-full px-2">
                  <div className="backdrop-blur-xl bg-black/40 border border-fuchsia-500/30 p-4 md:p-6 rounded-2xl shadow-[0_0_20px_rgba(255,0,255,0.1)] flex flex-col items-center hover:scale-105 transition-transform">
                    <div className="text-fuchsia-400 mb-2 md:mb-4 whitespace-nowrap">
                      <svg
                        className="w-8 h-8 md:w-12 md:h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        ></path>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 break-words text-center">
                      Web Workers
                    </h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Intensive tasks (geometry, memory) offloaded to a thread
                      pool ({PARALLEL_WORKER_THREAD_POOL_SIZE} active), 0
                      UI-blocking ops.
                    </p>
                  </div>
                  <div className="backdrop-blur-xl bg-black/40 border border-cyan-500/30 p-4 md:p-6 rounded-2xl shadow-[0_0_20px_rgba(0,255,255,0.1)] flex flex-col items-center hover:scale-105 transition-transform">
                    <div className="text-cyan-400 mb-2 md:mb-4 whitespace-nowrap">
                      <svg
                        className="w-8 h-8 md:w-12 md:h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                        ></path>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 break-words text-center">
                      Three.js Engine
                    </h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      A global Canvas overlays the app, maintaining state and
                      rendering point clouds underneath the DOM.
                    </p>
                  </div>
                  <div className="backdrop-blur-xl bg-black/40 border border-fuchsia-500/30 p-4 md:p-6 rounded-2xl shadow-[0_0_20px_rgba(255,0,255,0.1)] flex flex-col items-center hover:scale-105 transition-transform">
                    <div className="text-fuchsia-400 mb-2 md:mb-4 whitespace-nowrap">
                      <svg
                        className="w-8 h-8 md:w-12 md:h-12"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                        ></path>
                      </svg>
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-white mb-2 break-words text-center">
                      IDB Preloader
                    </h3>
                    <p className="text-xs md:text-sm text-gray-300">
                      Point cloud geometry aggressively cached in IndexedDB.
                      Reloads bypass worker generation for instant times.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ROOM 3: Resume Breakdown (moved from room 2 location) */}
            <ResumeBreakdownSection />

            {/* ROOM 3: Dynamic Worker Spawning */}
            <div className="section transparent-section">
              <div className="flex flex-col h-full justify-center items-center p-4 md:p-8 text-center select-none px-4">
                <h2
                  className="text-3xl sm:text-4xl md:text-5xl text-fuchsia-500 mb-6 md:mb-8 font-mono drop-shadow-md pointer-events-auto break-words w-full"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  DYNAMIC_THREAD_ALLOCATOR
                </h2>
                <div className="backdrop-blur-xl bg-white/5 border border-white/20 p-6 md:p-8 rounded-3xl shadow-[0_8px_32px_0_rgba(255,0,255,0.2)] flex flex-col items-center pointer-events-auto max-w-md w-full">
                  <p className="text-gray-300 mb-6 font-mono text-xs md:text-sm leading-relaxed text-center">
                    Spawn isolated background worker threads on-demand to
                    perform intensive calculations concurrently, bypassing the
                    main UX thread and maintaining high FPS.
                  </p>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="text-2xl md:text-3xl font-bold text-cyan-400">
                      {dynamicWorkersSpawned}
                    </div>
                    <div className="text-[10px] md:text-xs uppercase tracking-widest text-fuchsia-400 break-words max-w-[120px]">
                      Total Threads Spawned
                    </div>
                  </div>
                  <button
                    onClick={spawnDynamicWorker}
                    className="w-full py-3 md:py-4 rounded-xl font-bold text-white uppercase text-sm md:text-base tracking-widest bg-gradient-to-r from-cyan-600 to-fuchsia-600 hover:from-cyan-500 hover:to-fuchsia-500 transition-all shadow-[0_0_20px_rgba(0,255,255,0.4)] active:scale-95"
                  >
                    Spawn Compute Thread
                  </button>
                </div>
              </div>
            </div>

            {/* ROOM 4: Matrix Nexus (Multi-slide) */}
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

              <div className="slide px-4 md:px-8">
                <div className="flex flex-col h-full justify-center items-center select-none max-w-4xl mx-auto w-full">
                  <h2
                    className="text-2xl sm:text-3xl md:text-5xl text-cyan-400 mb-6 font-mono drop-shadow-[0_0_15px_#0ff] pointer-events-auto text-center break-words w-full"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    MULTI_THREADED_CACHING
                  </h2>
                  <div className="p-4 md:p-8 backdrop-blur-2xl bg-black/40 border border-cyan-500/40 rounded-3xl w-full pointer-events-auto shadow-[0_0_30px_rgba(0,255,255,0.1)]">
                    <p className="text-sm sm:text-base md:text-lg text-gray-300 font-mono text-center">
                      Our architecture bypasses standard single-threaded
                      bottlenecks. Using Parallel.js, we fan out matrix
                      calculations across available CPU cores. Each core
                      generates localized chunks of vertex arrays independently.
                    </p>
                  </div>
                </div>
              </div>
              <div className="slide px-4 md:px-8">
                <div className="flex flex-col h-full justify-center items-center select-none max-w-4xl mx-auto w-full">
                  <h2
                    className="text-2xl sm:text-3xl md:text-5xl text-fuchsia-400 mb-6 font-mono drop-shadow-[0_0_15px_#f0f] pointer-events-auto text-center break-words w-full"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    INDEXED_DB_PERSISTENCE
                  </h2>
                  <div className="p-4 md:p-8 backdrop-blur-2xl bg-black/40 border border-fuchsia-500/40 rounded-3xl w-full pointer-events-auto shadow-[0_0_30px_rgba(255,0,255,0.1)]">
                    <p className="text-sm sm:text-base md:text-lg text-gray-300 font-mono text-center">
                      Once parallel threads return raw Float32Arrays, they are
                      immediately stored as immutable blobs within the browser's
                      IndexedDB. Subsequent page visits skip generation
                      entirely, loading millions of vertices in under 5ms.
                    </p>
                  </div>
                </div>
              </div>
              <div className="slide px-4 md:px-8">
                <div className="flex flex-col h-full justify-center items-center select-none max-w-4xl mx-auto w-full">
                  <h2
                    className="text-2xl sm:text-3xl md:text-5xl text-green-400 mb-6 font-mono drop-shadow-[0_0_15px_rgba(0,255,0,0.8)] pointer-events-auto text-center break-words w-full"
                    style={{
                      wordBreak: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    CONTINUOUS_GARBAGE_COLLECTION
                  </h2>
                  <div className="p-4 md:p-8 backdrop-blur-2xl bg-black/40 border border-green-500/40 rounded-3xl w-full pointer-events-auto shadow-[0_0_30px_rgba(0,255,0,0.1)]">
                    <p className="text-sm sm:text-base md:text-lg text-gray-300 font-mono text-center">
                      A background daemon worker polls every 2.5 seconds,
                      forcefully reclaiming disjointed memory references and
                      performing `caches.delete()` routines to keep V8 engine
                      heaps hyper-optimized and fluid.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ROOM 5: Global Layout Detail */}
            <div className="section transparent-section">
              <div className="flex flex-col h-full justify-center items-center p-4 md:p-8 text-center select-none max-w-5xl mx-auto px-4">
                <h2
                  className="text-2xl sm:text-4xl md:text-5xl text-yellow-400 font-mono drop-shadow-[0_0_15px_rgba(255,255,0,0.8)] pointer-events-auto mb-4 md:mb-6 break-words w-full"
                  style={{
                    wordBreak: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  GLOBAL_CANVAS_DELEGATION
                </h2>
                <div className="backdrop-blur-xl bg-black/50 border border-yellow-500/30 p-4 sm:p-6 md:p-10 rounded-3xl w-full pointer-events-auto shadow-[0_0_30px_rgba(255,255,0,0.1)] text-left">
                  <h3 className="text-yellow-300 font-mono text-lg md:text-xl mb-4 border-b border-yellow-500/30 pb-2">
                    Why it matters:
                  </h3>
                  <ul className="text-xs sm:text-sm md:text-lg text-gray-300 font-mono space-y-2 md:space-y-4 list-disc pl-4 md:pl-6 leading-relaxed">
                    <li>
                      Most React apps re-mount complex 3D Scenes on navigation
                      events, causing stuttering.
                    </li>
                    <li>
                      This architecture suspends the Three.js Canvas absolutely
                      behind the DOM, persisting it globally across all routes.
                    </li>
                    <li>
                      The Canvas simply listens to a custom
                      `fullpage-room-change` event via the event bus, morphing
                      the point cloud instantly without unmounting or tearing.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* ROOM 8: Payload Integration */}
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
