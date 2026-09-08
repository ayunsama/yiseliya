export function usePerformance() {
  function measureFps(samples = 60): Promise<number> {
    return new Promise((resolve) => {
      let count = 0;
      let last = 0;
      let total = 0;

      function frame(now: number) {
        if (count > 0) {
          total += now - last;
        }
        last = now;
        count++;
        if (count <= samples) {
          requestAnimationFrame(frame);
        } else {
          const avg = total / samples;
          resolve(Math.round(1000 / avg));
        }
      }

      requestAnimationFrame(frame);
    });
  }

  async function detectReduceMotion(ownerDoc: Document = document): Promise<boolean> {
    const win = ownerDoc.defaultView ?? window;
    if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    const fps = await measureFps(30);
    return fps < 30;
  }

  return { measureFps, detectReduceMotion };
}
