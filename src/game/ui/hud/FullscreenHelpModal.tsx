import { createPortal } from "react-dom";

type FullscreenHelpModalProps = {
  onTryAgain: () => void;
  onClose: () => void;
};

export function FullscreenHelpModal({ onTryAgain, onClose }: FullscreenHelpModalProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="fullscreen-help"
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/72 px-4 font-mono uppercase text-white pointer-events-auto"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="max-w-[520px] border-2 border-cyan-200/70 bg-[#090510]/95 p-4 text-center shadow-[0_0_32px_rgba(34,211,238,0.38)]">
        <div className="text-lg tracking-[0.22em] text-cyan-100">Full Screen</div>
        <div className="mt-3 text-[10px] leading-5 tracking-widest text-cyan-50/80">
          Android Chrome can enter full screen from the FULL button. iOS Safari blocks that API, so use Share, Add to Home Screen, then launch Wizards from the new icon for the cleanest full-screen mode.
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            className="border border-cyan-200/70 bg-cyan-300/10 px-4 py-2 text-[10px] tracking-widest text-cyan-50 hover:bg-cyan-200/20"
            onClick={onTryAgain}
          >
            Try Again
          </button>
          <button
            className="border border-yellow-200/70 bg-yellow-300/10 px-4 py-2 text-[10px] tracking-widest text-yellow-50 hover:bg-yellow-200/20"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
