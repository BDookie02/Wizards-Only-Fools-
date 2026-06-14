import { GAME_SYSTEM_CATALOG } from "../systems/systemCatalog";
import { EngineMenuSystemCard } from "./EngineMenuSystemCard";

export function EngineMenuSystemsPanel() {
  return (
    <div className="min-h-0 min-w-0 overflow-hidden">
      <div className="mb-2 text-[10px] tracking-[0.24em] text-cyan-100">Systems</div>
      <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-1">
        {GAME_SYSTEM_CATALOG.map((system) => (
          <EngineMenuSystemCard key={system.id} system={system} />
        ))}
      </div>
    </div>
  );
}
