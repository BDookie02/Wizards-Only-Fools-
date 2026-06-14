import type { ReactNode } from "react";
import type { PlaceableDefinition } from "../systems/placeables/placeableCatalog";
import { EngineMenuPlacementControls } from "./EngineMenuPlacementControls";
import { EngineMenuPlacementSummary } from "./EngineMenuPlacementSummary";

export function EngineMenuPlacementPanel({
  selectedPlaceable,
  placementStatus,
  gridSize,
  snapToGrid,
  onSelectGridSize,
  onRotateSelected,
  onToggleSnapToGrid,
  onPlaceSelected,
  onClearPlaceables,
  children,
}: {
  selectedPlaceable: PlaceableDefinition | null;
  placementStatus: string;
  gridSize: number;
  snapToGrid: boolean;
  onSelectGridSize: (gridSize: number) => void;
  onRotateSelected: (delta: number) => void;
  onToggleSnapToGrid: () => void;
  onPlaceSelected: () => void;
  onClearPlaceables: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 min-w-0 overflow-y-auto border border-yellow-100/25 bg-yellow-200/8 p-2">
      <EngineMenuPlacementSummary
        selectedPlaceable={selectedPlaceable}
        placementStatus={placementStatus}
      />
      <EngineMenuPlacementControls
        gridSize={gridSize}
        snapToGrid={snapToGrid}
        canPlaceSelected={Boolean(selectedPlaceable)}
        onSelectGridSize={onSelectGridSize}
        onRotateSelected={onRotateSelected}
        onToggleSnapToGrid={onToggleSnapToGrid}
        onPlaceSelected={onPlaceSelected}
        onClearPlaceables={onClearPlaceables}
      />
      {children}
    </div>
  );
}
