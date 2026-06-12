import { memo, type ReactElement } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import { EngineMenuPlaceablePreview } from "./EngineMenuPlaceablePreview";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ENGINE_PLACEABLE_TAG_CHIP_LIMIT = 3;

function renderEnginePlaceableTagChips(tags: readonly string[]) {
  const tagCount = Math.min(tags.length, ENGINE_PLACEABLE_TAG_CHIP_LIMIT);
  const tagChips: ReactElement[] = [];
  for (let index = 0; index < tagCount; index += 1) {
    const tag = tags[index];
    tagChips.push(
      <span key={tag} className="max-w-full truncate border border-cyan-100/15 bg-cyan-200/6 px-1 py-0.5 text-[6px] tracking-[0.1em] text-cyan-100/45">
        {tag}
      </span>,
    );
  }
  return tagChips;
}

function EngineMenuPlaceableCardContent({
  placeable,
  selected,
  onPreviewPlaceable,
}: {
  placeable: PlaceableDefinition;
  selected: boolean;
  onPreviewPlaceable: (placeable: PlaceableDefinition) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`engine-placeable-${placeable.id}`}
      className={cn(
        "grid min-h-[194px] grid-rows-[78px_1fr] overflow-hidden border text-left transition",
        selected
          ? "border-yellow-200 bg-yellow-200/12 text-yellow-50 shadow-[0_0_18px_rgba(250,204,21,0.25)]"
          : "border-cyan-100/25 bg-black/28 text-cyan-50/85 hover:border-cyan-100/60 hover:bg-cyan-200/8"
      )}
      onClick={() => onPreviewPlaceable(placeable)}
    >
      <EngineMenuPlaceablePreview placeable={placeable} />
      <span className="flex min-w-0 flex-col gap-1 p-2">
        <span className="line-clamp-2 text-[10px] leading-4 tracking-widest">{placeable.name}</span>
        <span className="line-clamp-3 text-[8px] leading-4 tracking-[0.14em] text-cyan-100/55 normal-case">
          {placeable.description}
        </span>
        <span className="mt-auto grid gap-1 pt-1">
          <span className="truncate text-[7px] tracking-[0.12em] text-yellow-100/55">
            r{placeable.footprintRadius} / slope {placeable.maxSlopeDelta}
          </span>
          <span className="flex min-w-0 flex-wrap gap-1">
            {renderEnginePlaceableTagChips(placeable.tags)}
          </span>
        </span>
      </span>
    </button>
  );
}

export const EngineMenuPlaceableCard = memo(EngineMenuPlaceableCardContent);
