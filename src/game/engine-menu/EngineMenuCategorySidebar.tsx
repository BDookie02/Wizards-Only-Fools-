import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  PLACEABLE_CATEGORIES,
  PLACEABLE_CATEGORY_LABELS,
  type PlaceableCategory,
} from "../systems/placeables/placeableCatalog";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function EngineMenuCategorySidebar({
  activeCategory,
  categoryCounts,
  onSelectCategory,
}: {
  activeCategory: PlaceableCategory;
  categoryCounts: Record<PlaceableCategory, number>;
  onSelectCategory: (category: PlaceableCategory) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto pr-1">
      {PLACEABLE_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={cn(
            "border px-3 py-2 text-left text-[10px] tracking-widest transition",
            activeCategory === category
              ? "border-yellow-200 bg-yellow-200/12 text-yellow-50"
              : "border-cyan-100/25 bg-black/25 text-cyan-50/75 hover:border-cyan-100/55"
          )}
          onClick={() => onSelectCategory(category)}
        >
          <span className="flex items-center justify-between gap-2">
            <span>{PLACEABLE_CATEGORY_LABELS[category]}</span>
            <span className="text-[8px] text-cyan-100/45">{categoryCounts[category]}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
