import type { GameSystemDescriptor } from "../systems/systemCatalog";

export function EngineMenuSystemCard({ system }: { system: GameSystemDescriptor }) {
  return (
    <div className="border border-cyan-100/15 bg-cyan-200/5 p-2">
      <div className="text-[9px] tracking-widest text-yellow-100">{system.name}</div>
      <div className="mt-1 break-words text-[7px] leading-4 tracking-[0.12em] text-cyan-100/55 normal-case">
        {system.responsibility}
      </div>
      <div className="mt-1 truncate text-[7px] tracking-[0.14em] text-cyan-100/35">
        {system.extractionTarget}
      </div>
    </div>
  );
}
