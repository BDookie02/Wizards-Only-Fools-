import {
  questEventPresetButtons,
  type QuestEventBuilderKind,
} from "./questNpcEditorRuntime";

type QuestEventBuilderProps = {
  eventMessage: string;
  eventQuestId: string;
  eventFlag: string;
  onEventMessageChange: (value: string) => void;
  onEventQuestIdChange: (value: string) => void;
  onEventFlagChange: (value: string) => void;
  onAppendPresetLine: (line: string) => void;
  onAppendEvent: (kind: QuestEventBuilderKind) => void;
};

export function QuestEventBuilder({
  eventMessage,
  eventQuestId,
  eventFlag,
  onEventMessageChange,
  onEventQuestIdChange,
  onEventFlagChange,
  onAppendPresetLine,
  onAppendEvent,
}: QuestEventBuilderProps) {
  return (
    <div className="border border-cyan-300/30 bg-cyan-950/15 p-2">
      <div className="text-[9px] tracking-[0.22em] text-cyan-100/60">EVENT BUILDER</div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] tracking-widest">
        {questEventPresetButtons.map((preset) => (
          <button
            key={preset.label}
            className="border border-cyan-200/40 bg-black/35 px-2 py-2 text-cyan-50 hover:bg-cyan-200/15"
            onClick={() => onAppendPresetLine(preset.line)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-[8px] tracking-[0.18em] text-cyan-100/55">
        MESSAGE
        <input
          className="normal-case mt-1 w-full border border-cyan-300/35 bg-black/60 px-2 py-1.5 text-[11px] tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={120}
          value={eventMessage}
          onChange={(event) => onEventMessageChange(event.currentTarget.value)}
        />
      </label>
      <button className="mt-1 w-full border border-cyan-200/40 bg-cyan-300/10 px-2 py-1.5 text-[9px] tracking-widest hover:bg-cyan-200/20" onClick={() => onAppendEvent("message")}>ADD MESSAGE</button>
      <label className="mt-2 block text-[8px] tracking-[0.18em] text-cyan-100/55">
        QUEST ID
        <input
          className="normal-case mt-1 w-full border border-cyan-300/35 bg-black/60 px-2 py-1.5 text-[11px] tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={80}
          value={eventQuestId}
          onChange={(event) => onEventQuestIdChange(event.currentTarget.value)}
        />
      </label>
      <div className="mt-1 grid grid-cols-2 gap-1 text-[9px] tracking-widest">
        <button className="border border-cyan-200/40 bg-cyan-300/10 px-2 py-1.5 hover:bg-cyan-200/20" onClick={() => onAppendEvent("startQuest")}>START</button>
        <button className="border border-cyan-200/40 bg-cyan-300/10 px-2 py-1.5 hover:bg-cyan-200/20" onClick={() => onAppendEvent("completeQuest")}>COMPLETE</button>
      </div>
      <label className="mt-2 block text-[8px] tracking-[0.18em] text-cyan-100/55">
        FLAG
        <input
          className="normal-case mt-1 w-full border border-cyan-300/35 bg-black/60 px-2 py-1.5 text-[11px] tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={120}
          value={eventFlag}
          onChange={(event) => onEventFlagChange(event.currentTarget.value)}
        />
      </label>
      <button className="mt-1 w-full border border-cyan-200/40 bg-cyan-300/10 px-2 py-1.5 text-[9px] tracking-widest hover:bg-cyan-200/20" onClick={() => onAppendEvent("setFlag")}>SET FLAG</button>
    </div>
  );
}
