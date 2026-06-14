import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { QuestScriptPoint } from "../../../store/gameStore";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type QuestScriptPointListProps = {
  scriptPoints: readonly QuestScriptPoint[];
  selectedPointId: string | null;
  onSelectPoint: (pointId: string) => void;
  onMoveSelected: (direction: -1 | 1) => void;
  onDuplicateSelected: () => void;
};

export function QuestScriptPointList({
  scriptPoints,
  selectedPointId,
  onSelectPoint,
  onMoveSelected,
  onDuplicateSelected,
}: QuestScriptPointListProps) {
  return (
    <div className="min-h-0">
      <div className="mb-2 text-[9px] tracking-[0.22em] text-cyan-100/60">SCRIPTPOINTS</div>
      <div className="flex max-h-52 flex-col gap-1 overflow-y-auto pr-1 lg:max-h-none">
        {scriptPoints.map((point, index) => (
          <button
            key={point.id}
            className={cn(
              "normal-case border px-2 py-2 text-left text-xs leading-4 transition-colors",
              selectedPointId === point.id
                ? "border-yellow-200 bg-yellow-200/12 text-yellow-50"
                : "border-cyan-300/25 bg-black/30 text-cyan-100/75 hover:border-cyan-200/70",
            )}
            onClick={() => onSelectPoint(point.id)}
          >
            <span className="mr-1 text-[9px] text-cyan-100/45">{index + 1}.</span>
            {point.title || `Point ${index + 1}`}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[9px] tracking-widest">
        <button className="border border-cyan-200/45 bg-cyan-300/10 px-2 py-2 hover:bg-cyan-200/20" onClick={() => onMoveSelected(-1)}>UP</button>
        <button className="border border-cyan-200/45 bg-cyan-300/10 px-2 py-2 hover:bg-cyan-200/20" onClick={() => onMoveSelected(1)}>DOWN</button>
        <button className="border border-cyan-200/45 bg-cyan-300/10 px-2 py-2 hover:bg-cyan-200/20" onClick={onDuplicateSelected}>COPY</button>
      </div>
    </div>
  );
}
