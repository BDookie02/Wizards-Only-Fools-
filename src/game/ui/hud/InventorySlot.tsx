import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { InventoryEntry } from "./inventoryPanelRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type InventorySlotProps = {
  entry: InventoryEntry | null;
  index: number;
  label?: string;
  visibleLabel?: string;
};

export function InventorySlot({ entry, index, label, visibleLabel = label }: InventorySlotProps) {
  const definition = entry?.definition;
  const quantity = entry?.quantity ?? 0;

  return (
    <div
      className={cn(
        "relative aspect-square min-w-[30px] overflow-hidden border bg-black/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] sm:min-w-[34px]",
        definition
          ? "border-emerald-100/55 bg-emerald-200/12"
          : "border-emerald-100/20 bg-[#020906]/70",
      )}
      title={definition ? `${definition.name} x${quantity}` : label ?? `Slot ${index + 1}`}
      aria-label={definition ? `${definition.name} x${quantity}` : label ?? `Empty slot ${index + 1}`}
    >
      <div className="absolute inset-[3px] border border-black/45 bg-gradient-to-br from-white/8 via-transparent to-black/35" />
      {definition ? (
        <>
          <div className="absolute inset-1 flex items-center justify-center text-[8px] font-bold uppercase text-emerald-50 sm:text-xs">
            <span className="flex h-[68%] w-[68%] max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap border border-emerald-100/35 bg-emerald-300/15 px-0.5 text-center leading-none shadow-[0_0_16px_rgba(110,231,183,0.14)]">
              {definition.name.slice(0, 2)}
            </span>
          </div>
          <div className="absolute bottom-0.5 right-0.5 max-w-[82%] overflow-hidden text-ellipsis whitespace-nowrap rounded-sm bg-black/70 px-1 text-[8px] font-bold leading-3 text-emerald-50 sm:right-1 sm:text-[10px] sm:leading-4">
            {quantity}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center text-[8px] uppercase text-emerald-100/20 sm:text-[9px]">
          {visibleLabel ?? index + 1}
        </div>
      )}
    </div>
  );
}
