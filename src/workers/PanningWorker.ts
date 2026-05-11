export const positionWorkerCode = `
  self.onmessage = function(e) {
      if (e.data.type === 'CALCULATE_POS') {
          const { c, t } = e.data;
          const steps = 120; // Pre-calc 120 frames
          const trajectory = [];
          let current = [...c];
          
          for (let i = 0; i < steps; i++) {
              // Smooth easing out (exponential decay approximation with discrete steps)
              const lerpF = 1 - Math.exp(-6 * (1/60));
              current[0] += (t[0] - current[0]) * lerpF;
              current[1] += (t[1] - current[1]) * lerpF;
              current[2] += (t[2] - current[2]) * lerpF;
              trajectory.push([...current]);
          }

          // Force the final position directly to eliminate drifting
          trajectory.push([...t]);

          self.postMessage({ type: 'POS_RESULT', trajectory });
          self.close();
      }
  }
`;

export const lookAtWorkerCode = `
  self.onmessage = function(e) {
      if (e.data.type === 'CALCULATE_LOOKAT') {
          const { c, t } = e.data;
          const steps = 120;
          const trajectory = [];
          let current = [...c];
          
          for (let i = 0; i < steps; i++) {
              const lerpF = 1 - Math.exp(-6 * (1/60));
              current[0] += (t[0] - current[0]) * lerpF;
              current[1] += (t[1] - current[1]) * lerpF;
              current[2] += (t[2] - current[2]) * lerpF;
              trajectory.push([...current]);
          }

          trajectory.push([...t]);
          self.postMessage({ type: 'LOOKAT_RESULT', trajectory });
          self.close();
      }
  }
`;

