type QuestNpcEditorHeaderProps = {
  displayName: string;
  defaultName: string;
  onSave: () => void;
  onClose: () => void;
};

export function QuestNpcEditorHeader({
  displayName,
  defaultName,
  onSave,
  onClose,
}: QuestNpcEditorHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/35 px-3 py-2">
      <div>
        <div className="text-[9px] tracking-[0.26em] text-cyan-100/55">QUEST NPC DEV</div>
        <div className="normal-case text-lg font-bold tracking-wide text-yellow-100">
          {displayName || defaultName}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px] tracking-widest">
        <button className="border border-emerald-200/70 bg-emerald-400/10 px-3 py-2 text-emerald-50 hover:bg-emerald-300/20" onClick={onSave}>SAVE</button>
        <button className="border border-cyan-200/60 bg-cyan-300/10 px-3 py-2 text-cyan-50 hover:bg-cyan-200/20" onClick={onClose}>CLOSE</button>
      </div>
    </div>
  );
}
