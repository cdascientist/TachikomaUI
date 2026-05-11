import React, { useEffect, useRef, useState } from 'react';

interface TronVideoPlayerInternalImplementationProps {
  uniformResourceLocatorForVideoSource: string;
  componentUniqueIdentifierForDataFlow: string;
}

export const TronVideoPlayer: React.FC<TronVideoPlayerInternalImplementationProps> = ({ 
  uniformResourceLocatorForVideoSource, 
  componentUniqueIdentifierForDataFlow 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(undefined);

  // Generate thumbnail from video source dynamically
  useEffect(() => {
    let isMounted = true;
    const computeThumbnail = async () => {
      try {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous'; // Important for CORS
        video.muted = true;
        video.playsInline = true;
        
        // Use a promise to wait for the video to load
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
             // Jump slightly into the video to avoid black starting frames
            video.currentTime = Math.min(1, video.duration / 2);
          };
          video.onseeked = () => resolve();
          video.onerror = (e) => reject(e);
          // Setting src triggers the load
          video.src = uniformResourceLocatorForVideoSource;
        });

        if (!isMounted) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setThumbnailUrl(dataUrl);
        }
      } catch (err) {
        console.warn("Could not generate thumbnail for", uniformResourceLocatorForVideoSource, err);
      }
    };

    computeThumbnail();

    return () => {
      isMounted = false;
    };
  }, [uniformResourceLocatorForVideoSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset video internal state if source changes
    video.load();

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
        if (video.duration) {
            setProgress((video.currentTime / video.duration) * 100);
        }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [uniformResourceLocatorForVideoSource]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(console.error);
      }
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  };

  const jump = (amount: number) => {
    if (videoRef.current) {
        videoRef.current.currentTime = videoRef.current.currentTime + amount;
    }
  }

  return (
    <div 
      className="relative flex flex-col items-center mx-auto pointer-events-auto shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] backdrop-blur-xl bg-black/50 border border-cyan-500/30 rounded-3xl overflow-hidden group w-[90vw] h-[80vh] md:w-[calc(100vw-10rem)] md:h-auto md:aspect-video max-w-[1000px] bg-black/80"
    >
      {/* iOS Liquid Glass Video Container */}
      <div className="absolute inset-0 w-full h-full bg-transparent overflow-hidden rounded-3xl">
        {thumbnailUrl && !isPlaying && progress === 0 && (
          <img 
            src={thumbnailUrl} 
            alt="Video Thumbnail" 
            className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
          />
        )}
        <video
            ref={videoRef}
            src={uniformResourceLocatorForVideoSource}
            id={componentUniqueIdentifierForDataFlow}
            playsInline
            crossOrigin="anonymous"
            preload="metadata"
            className={`w-full h-full object-cover relative z-10 transition-opacity duration-300 ${(!isPlaying && progress === 0) ? 'opacity-0' : 'opacity-100'}`}
        />
      </div>

      {/* Play Overlay Button for better UX when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-black/50 border border-cyan-500/50 backdrop-blur-md flex items-center justify-center text-cyan-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)] shadow-[0_0_30px_rgba(0,255,255,0.3)]">
            <svg className="w-8 h-8 md:w-12 md:h-12 ml-2" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        </div>
      )}

      {/* External Controls layered on top in liquid glass style - Aligned along bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-col w-full backdrop-blur-xl bg-black/40 border-t border-white/20 p-3 md:p-5 gap-2 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        {/* Progress Bar */}
        <div 
          className="w-full h-1 md:h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer backdrop-blur-md"
          onClick={seek}
        >
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(0,255,255,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Buttons */}
        <div className="flex justify-center items-center gap-4 md:gap-6 mt-1 md:mt-0">
          <button 
            className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/20 backdrop-blur-xl text-white shadow-[0_4px_10px_rgba(0,255,255,0.2)] transition-all transform hover:scale-105 active:scale-95"
            onClick={() => jump(-10)}
          >
            <svg className="w-4 h-4 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
          </button>

          <button 
            className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/80 to-fuchsia-500/80 hover:from-cyan-400 hover:to-fuchsia-400 border border-white/30 backdrop-blur-2xl text-white shadow-[0_0_20px_rgba(255,0,255,0.4)] transition-all transform hover:scale-105 active:scale-95"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 md:w-8 md:h-8" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
              <svg className="w-5 h-5 md:w-8 md:h-8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
          </button>

          <button 
            className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/20 backdrop-blur-xl text-white shadow-[0_4px_10px_rgba(0,255,255,0.2)] transition-all transform hover:scale-105 active:scale-95"
            onClick={() => jump(+10)}
          >
            <svg className="w-4 h-4 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
  );
};


