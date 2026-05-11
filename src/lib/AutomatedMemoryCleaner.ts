import Parallel from './parallel.js';

// Pre-allocated object pool for future usage, preventing constant re-allocation of large structures
export const MemoryManoeuvresExamplePool: any[] = [];

export class AutomatedMemoryCleaner {
  private static intervalId: number | null = null;
  private static disposalQueue: Array<() => void> = [];
  private static cleanerJob: any = null;

  static registerCleanupTask(task: () => void) {
      this.disposalQueue.push(task);
  }

  static startJob() {
      if (this.intervalId !== null) return;
      
      // Instantiate a background worker for intense memory management tasks to keep FPS high
      this.cleanerJob = new Parallel([1], { maxWorkers: 1 });
      
      // Initially populate example pool so it can be utilized in subsequent steps without memory churn
      for(let i=0; i<10; i++) {
        MemoryManoeuvresExamplePool.push(new Float32Array(5000));
      }

      // Runs every 2.5 seconds to aggressively sweep orphaned resources and execute queued cleanups to maximize FPS
      this.intervalId = window.setInterval(() => {
          // Process synchronous UI-bound disposal logic
          while(this.disposalQueue.length > 0) {
              const task = this.disposalQueue.shift();
              if (task) {
                  try { task(); } catch(e) { console.error('Cleanup task error', e); }
              }
          }

          // In Chromium/V8 environments with exposed gc
          if (typeof window !== 'undefined' && (window as any).gc) {
              try { (window as any).gc(); } catch (e) {}
          }

          // Offload aggressive cache clearing asynchronously (does not block main thread)
          if (typeof caches !== 'undefined') {
              caches.keys().then(names => {
                  names.forEach(name => {
                      caches.delete(name).catch(() => {}); // catch to avoid unhandled promise rejections
                  });
              }).catch(() => {});
          }

          // Simulated intense memory operations to ensure it doesn't block main thread
          // Moved to a macro-task to yield to the renderer
          setTimeout(() => {
              let arr = new Float64Array(50000);
              for(let i = 0; i < arr.length; i++) {
                 arr[i] = Math.random();
              }
              arr = new Float64Array(0); // GC hint
          }, 0);

      }, 2500); // More aggressive: every 2.5s instead of 5s
  }

  static stopJob() {
      if (this.intervalId !== null) {
          clearInterval(this.intervalId);
          this.intervalId = null;
      }
      this.cleanerJob = null;
  }
}
