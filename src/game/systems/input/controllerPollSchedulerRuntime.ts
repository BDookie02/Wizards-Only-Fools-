export type ControllerPollScheduler = {
  schedule: (delayMs?: number) => void;
  cancel: () => void;
};

export function createControllerPollScheduler(callback: FrameRequestCallback): ControllerPollScheduler {
  let raf = 0;
  let timeout = 0;

  const cancel = () => {
    if (typeof window === "undefined") return;
    if (raf !== 0) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    if (timeout !== 0) {
      window.clearTimeout(timeout);
      timeout = 0;
    }
  };

  const schedule = (delayMs = 0) => {
    if (typeof window === "undefined") return;
    cancel();
    if (delayMs > 0) {
      timeout = window.setTimeout(() => {
        timeout = 0;
        raf = window.requestAnimationFrame(callback);
      }, delayMs);
      return;
    }

    raf = window.requestAnimationFrame(callback);
  };

  return { cancel, schedule };
}
