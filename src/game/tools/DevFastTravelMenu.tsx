import { createPortal } from "react-dom";
import type { DevFastTravelLocation } from "./devFastTravel";

type DevFastTravelMenuProps = {
  locations: DevFastTravelLocation[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onTravel: (location: DevFastTravelLocation) => void;
  onClose: () => void;
};

function getLocationButtonClass(focused: boolean) {
  const base = "grid grid-cols-[1fr_auto] gap-3 border px-3 py-2 text-left transition-all";
  return focused
    ? `${base} border-yellow-200 bg-yellow-200/12 text-yellow-50 shadow-[0_0_18px_rgba(250,204,21,0.35)]`
    : `${base} border-lime-200/25 bg-black/25 text-lime-50/85 hover:border-lime-100/65 hover:bg-lime-200/10`;
}

export function DevFastTravelMenu({
  locations,
  selectedIndex,
  onSelectIndex,
  onTravel,
  onClose,
}: DevFastTravelMenuProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="dev-fast-travel-menu"
      className="fixed inset-0 z-[215] flex items-center justify-center bg-black/70 px-4 font-mono uppercase text-white pointer-events-auto"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="w-[min(92vw,640px)] border-2 border-lime-200/70 bg-[#06110b]/95 p-3 shadow-[0_0_30px_rgba(132,204,22,0.28)]">
        <div className="flex items-center justify-between gap-3 border-b border-lime-200/25 pb-2">
          <div>
            <div className="text-[11px] tracking-[0.28em] text-lime-100/65">DEV</div>
            <div className="text-lg tracking-[0.18em] text-lime-50">Fast Travel</div>
          </div>
          <button
            type="button"
            className="border border-lime-100/45 bg-lime-300/10 px-3 py-1 text-[10px] tracking-widest text-lime-50 hover:bg-lime-200/20"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-3 grid max-h-[min(68dvh,520px)] gap-2 overflow-y-auto pr-1">
          {locations.map((location, index) => {
            const focused = index === selectedIndex;
            return (
              <button
                key={location.id}
                type="button"
                data-dev-fast-travel-index={index}
                data-testid={`dev-fast-travel-${location.id}`}
                className={getLocationButtonClass(focused)}
                onMouseEnter={() => onSelectIndex(index)}
                onClick={() => onTravel(location)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] tracking-widest">{location.label}</span>
                  <span className="mt-1 block truncate text-[9px] tracking-[0.18em] text-lime-100/50">{location.detail}</span>
                </span>
                <span className="self-center border border-lime-100/35 bg-lime-100/10 px-2 py-1 text-[10px] tracking-widest text-lime-50">
                  {location.chunk.cx},{location.chunk.cz}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-lime-200/20 pt-2 text-[8px] tracking-[0.2em] text-lime-100/45">
          <span>D-PAD / LEFT STICK</span>
          <span>A / ENTER TRAVEL</span>
          <span>B / ESC CLOSE</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
