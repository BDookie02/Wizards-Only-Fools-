import type {
  QuestNpcEditorTarget,
  QuestNpcProgram,
  QuestNpcRole,
} from "../../../store/gameStore";
import { questNpcRoles } from "./questNpcEditorRuntime";

type QuestNpcEditorSidebarProps = {
  draft: QuestNpcProgram;
  target: QuestNpcEditorTarget;
  unlockedSpellCount: number;
  onUpdateDraft: (updates: Partial<QuestNpcProgram>) => void;
  onAddScriptPoint: () => void;
  onRemoveSelectedPoint: () => void;
  onResetProgram: () => void;
};

export function QuestNpcEditorSidebar({
  draft,
  target,
  unlockedSpellCount,
  onUpdateDraft,
  onAddScriptPoint,
  onRemoveSelectedPoint,
  onResetProgram,
}: QuestNpcEditorSidebarProps) {
  return (
    <div className="border-b border-cyan-300/25 bg-cyan-950/25 p-3 md:border-b-0 md:border-r">
      <label className="block text-[9px] tracking-[0.2em] text-cyan-100/65">
        NAME
        <input
          className="normal-case mt-1 w-full border border-cyan-300/45 bg-black/65 px-2 py-2 text-sm tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={42}
          value={draft.displayName}
          onChange={(event) => onUpdateDraft({ displayName: event.currentTarget.value })}
        />
      </label>
      <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
        ROLE
        <select
          className="mt-1 w-full border border-cyan-300/45 bg-black/80 px-2 py-2 text-xs tracking-widest text-cyan-50 outline-none focus:border-yellow-200"
          value={draft.role}
          onChange={(event) => onUpdateDraft({ role: event.currentTarget.value as QuestNpcRole })}
        >
          {questNpcRoles.map((role) => (
            <option key={role} value={role}>{role.toUpperCase()}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
        TOWN
        <input
          className="normal-case mt-1 w-full border border-cyan-300/45 bg-black/65 px-2 py-2 text-xs tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={64}
          value={draft.townId}
          onChange={(event) => onUpdateDraft({ townId: event.currentTarget.value })}
        />
      </label>
      <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
        OPENING LINE
        <textarea
          className="normal-case mt-1 h-24 w-full resize-none border border-cyan-300/45 bg-black/65 px-2 py-2 text-xs leading-5 tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={900}
          value={draft.greeting}
          onChange={(event) => onUpdateDraft({ greeting: event.currentTarget.value })}
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] tracking-widest">
        <button className="border border-cyan-200/55 bg-cyan-300/10 px-2 py-2 hover:bg-cyan-200/20" onClick={onAddScriptPoint}>ADD POINT</button>
        <button className="border border-red-200/55 bg-red-400/10 px-2 py-2 text-red-50 hover:bg-red-300/20" onClick={onRemoveSelectedPoint}>DELETE</button>
      </div>
      <button className="mt-2 w-full border border-zinc-300/45 bg-zinc-500/10 px-2 py-2 text-[9px] tracking-widest text-zinc-100 hover:bg-zinc-300/15" onClick={onResetProgram}>RESET NPC</button>
      <div className="normal-case mt-3 text-[10px] leading-4 text-cyan-100/45">
        {target.npcId} - {target.theme ?? "village"} - unlocked spells tracked: {unlockedSpellCount}
      </div>
    </div>
  );
}
