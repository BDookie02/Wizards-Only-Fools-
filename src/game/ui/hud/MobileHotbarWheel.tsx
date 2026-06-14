import type { HandType } from "../../../store/gameStore";
import { useMobileHotbarWheelRuntime } from "./mobileTouchControlsRuntime";

export function MobileHotbarWheel({ hand }: { hand: HandType }) {
  const { beginWheel, cancelWheel, endWheel, handleKeyDown, handleWheel, moveWheel } =
    useMobileHotbarWheelRuntime(hand);

  return (
    <div
      data-testid={`mobile-${hand}-hotbar-wheel`}
      aria-label={`${hand} spell scroll wheel`}
      role="button"
      tabIndex={0}
      className="mobile-scroll-wheel pointer-events-auto relative h-16 w-12 overflow-hidden rounded-full border-2 border-cyan-100/45 bg-black/55 text-cyan-50 active:scale-95"
      style={{ touchAction: "none" }}
      onPointerDown={beginWheel}
      onPointerMove={moveWheel}
      onPointerUp={endWheel}
      onPointerCancel={cancelWheel}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-x-0 top-1 flex justify-center text-[10px] leading-none text-cyan-100/80">^</div>
      <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-cyan-100/35" />
      <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/55 bg-cyan-200/15 shadow-[inset_0_0_10px_rgba(125,211,252,0.25)]">
        <div className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-cyan-100/30" />
        <div className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-cyan-100/30" />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold tracking-widest text-cyan-50">
        {hand === "left" ? "L" : "R"}
      </div>
      <div className="absolute inset-x-0 bottom-1 flex justify-center text-[10px] leading-none text-cyan-100/80">v</div>
    </div>
  );
}
