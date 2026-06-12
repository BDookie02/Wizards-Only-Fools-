import { GAME_SYSTEM_CATALOG } from "../systems/systemCatalog";

export function EngineMenuSystemsPanel() {
  return (
    <div className="min-h-0 min-w-0 overflow-hidden">
      <div className="mb-2 text-[10px] tracking-[0.24em] text-cyan-100">Systems</div>
      <div className="flex max-h-full flex-col gap-2 overflow-y-auto pr-1">
        {GAME_SYSTEM_CATALOG.map((system) => (
          <div key={system.id} className="border border-cyan-100/15 bg-cyan-200/5 p-2">
            <div className="text-[9px] tracking-widest text-yellow-100">{system.name}</div>
            <div className="mt-1 break-words text-[7px] leading-4 tracking-[0.12em] text-cyan-100/55 normal-case">
              {system.responsibility}
            </div>
            <div className="mt-1 truncate text-[7px] tracking-[0.14em] text-cyan-100/35">
              {system.extractionTarget}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
