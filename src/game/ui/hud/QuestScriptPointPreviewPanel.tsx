import type { QuestScriptPoint } from "../../../store/gameStore";
import {
  countQuestScriptPointEvents,
  formatQuestScriptPointEventSummary,
  getQuestDialogPreviewLine,
} from "./questNpcEditorRuntime";

type QuestScriptPointPreviewPanelProps = {
  selectedPoint: QuestScriptPoint;
  selectedIndex: number;
  displayName: string;
  defaultName: string;
  greeting: string;
  onRunSelectedPoint: () => void;
};

export function QuestScriptPointPreviewPanel({
  selectedPoint,
  selectedIndex,
  displayName,
  defaultName,
  greeting,
  onRunSelectedPoint,
}: QuestScriptPointPreviewPanelProps) {
  const eventCount = countQuestScriptPointEvents(selectedPoint);

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="border border-cyan-300/25 bg-black/35 p-2">
        <div className="text-[9px] tracking-[0.22em] text-cyan-100/60">PREVIEW</div>
        <div className="normal-case mt-2 text-sm font-bold tracking-wide text-yellow-100">
          {displayName || defaultName}
        </div>
        <div className="normal-case mt-1 min-h-12 border border-cyan-300/20 bg-cyan-950/10 px-2 py-2 text-xs leading-5 tracking-wide text-cyan-50">
          {getQuestDialogPreviewLine(selectedPoint, greeting)}
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2 border border-yellow-200/35 bg-yellow-300/5 p-2">
        <div>
          <div className="text-[9px] tracking-[0.22em] text-yellow-100/65">SCRIPTPOINT</div>
          <div className="normal-case mt-1 text-xs leading-5 text-yellow-50">
            {formatQuestScriptPointEventSummary(selectedPoint, selectedIndex, eventCount)}
          </div>
        </div>
        <button
          className="border border-yellow-200/70 bg-yellow-300/10 px-3 py-2 text-[10px] tracking-widest text-yellow-50 hover:bg-yellow-200/20"
          onClick={onRunSelectedPoint}
        >
          TEST POINT
        </button>
      </div>
    </div>
  );
}
