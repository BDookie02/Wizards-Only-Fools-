import type { QuestScriptPoint } from "../../../store/gameStore";
import { QuestEventBuilder } from "./QuestEventBuilder";
import type { QuestEventBuilderKind } from "./questNpcEditorRuntime";

type QuestScriptPointFieldsProps = {
  selectedPoint: QuestScriptPoint;
  eventMessage: string;
  eventQuestId: string;
  eventFlag: string;
  onUpdatePoint: (updates: Partial<QuestScriptPoint>) => void;
  onEventMessageChange: (value: string) => void;
  onEventQuestIdChange: (value: string) => void;
  onEventFlagChange: (value: string) => void;
  onAppendPresetLine: (line: string) => void;
  onAppendEvent: (kind: QuestEventBuilderKind) => void;
};

export function QuestScriptPointFields({
  selectedPoint,
  eventMessage,
  eventQuestId,
  eventFlag,
  onUpdatePoint,
  onEventMessageChange,
  onEventQuestIdChange,
  onEventFlagChange,
  onAppendPresetLine,
  onAppendEvent,
}: QuestScriptPointFieldsProps) {
  return (
    <>
      <label className="block text-[9px] tracking-[0.2em] text-cyan-100/65">
        POINT TITLE
        <input
          className="normal-case mt-1 w-full border border-cyan-300/45 bg-black/65 px-2 py-2 text-sm tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={48}
          value={selectedPoint.title}
          onChange={(event) => onUpdatePoint({ title: event.currentTarget.value })}
        />
      </label>
      <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
        DIALOG
        <textarea
          className="normal-case mt-1 h-28 w-full resize-none border border-cyan-300/45 bg-black/65 px-2 py-2 text-sm leading-5 tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
          maxLength={900}
          value={selectedPoint.dialog}
          onChange={(event) => onUpdatePoint({ dialog: event.currentTarget.value })}
        />
      </label>
      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <label className="block text-[9px] tracking-[0.2em] text-cyan-100/65">
          EVENTS
          <textarea
            className="normal-case mt-1 h-44 w-full resize-none border border-cyan-300/45 bg-black/65 px-2 py-2 text-xs leading-5 tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
            maxLength={900}
            value={selectedPoint.eventScript}
            onChange={(event) => onUpdatePoint({ eventScript: event.currentTarget.value })}
            placeholder={"unlockSpell blink\nunlockRandomLockedSpell\nstartQuest town_01_fetch\ncompleteQuest town_01_fetch\nsetFlag town_01_quests=1\nmessage Good work, wizard."}
          />
        </label>
        <QuestEventBuilder
          eventMessage={eventMessage}
          eventQuestId={eventQuestId}
          eventFlag={eventFlag}
          onEventMessageChange={onEventMessageChange}
          onEventQuestIdChange={onEventQuestIdChange}
          onEventFlagChange={onEventFlagChange}
          onAppendPresetLine={onAppendPresetLine}
          onAppendEvent={onAppendEvent}
        />
      </div>
    </>
  );
}
