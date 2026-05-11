import React, { useEffect, useState } from 'react';
import { Hand, Move, ZoomIn } from 'lucide-react';

export const InteractiveGesturePage: React.FC = React.memo(() => {
    const [isInteracting, setIsInteracting] = useState(false);

    useEffect(() => {
        let timeout: any;
        const handlePan = (e: any) => {
            const { type } = e.detail;
            if (type === 'panstart' || type === 'panmove') {
                setIsInteracting(true);
                clearTimeout(timeout);
                timeout = setTimeout(() => setIsInteracting(false), 500); // safety fallback
            } else if (type === 'panend') {
                setIsInteracting(false);
            }
        };

        const handleDoubleTap = () => {
            setIsInteracting(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => setIsInteracting(false), 800);
        };

        window.addEventListener('hammer-pan', handlePan);
        window.addEventListener('hammer-doubletap', handleDoubleTap);
        return () => {
            window.removeEventListener('hammer-pan', handlePan);
            window.removeEventListener('hammer-doubletap', handleDoubleTap);
            clearTimeout(timeout);
        };
    }, []);

    return (
        <div className="absolute inset-0 flex flex-col items-start justify-center w-full h-full p-6 md:p-12 pointer-events-none select-none z-20">
            {/* iOS-like gesture guide */}
            <div className={`transition-opacity duration-500 ease-in-out flex flex-col items-start justify-center text-left max-w-sm ${isInteracting ? 'opacity-10' : 'opacity-90'}`}>
                
                <div className="relative mb-6 ml-4">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse z-0"></div>
                    <Hand className="w-12 h-12 text-cyan-400 relative z-10 animate-pulse" strokeWidth={1.5} />
                </div>
                
                <div className="mb-6">
                    <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-fuchsia-400 font-mono tracking-tight">
                        INTERACTIVE SPACE
                    </h2>
                </div>
                
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md shadow-[0_0_20px_rgba(0,255,255,0.05)] w-full">
                        <Move className="w-5 h-5 text-cyan-400" />
                        <span className="text-xs text-white font-mono tracking-widest font-bold uppercase">Drag to Pan</span>
                    </div>
                    
                    <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl px-5 py-3 backdrop-blur-md shadow-[0_0_20px_rgba(255,0,255,0.05)] w-full">
                        <ZoomIn className="w-5 h-5 text-fuchsia-400" />
                        <span className="text-xs text-white font-mono tracking-widest font-bold uppercase">Double Tap to Zoom</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
