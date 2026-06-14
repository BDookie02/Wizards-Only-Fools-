import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createDefaultQuestNpcProgram,
  type QuestNpcEditorTarget,
  type QuestNpcProgram,
  type QuestNpcRole,
  type QuestScriptPoint,
  useGameStore,
} from "../../../store/gameStore";
import {
  appendQuestEventScriptLine,
  buildQuestEventLine,
  cloneQuestNpcProgram,
  countQuestScriptPointEvents,
  createQuestScriptPoint,
  duplicateQuestScriptPoint,
  formatQuestScriptPointEventSummary,
  getQuestDialogPreviewLine,
  getQuestScriptPointIndex,
  getSelectedQuestScriptPoint,
  insertQuestScriptPointAfter,
  moveQuestScriptPointById,
  questNpcRoles,
  removeQuestScriptPointById,
  sanitizeQuestNpcProgramDraft,
  updateQuestScriptPointDraft,
  type QuestEventBuilderKind,
} from "./questNpcEditorRuntime";
import { QuestEventBuilder } from "./QuestEventBuilder";
import { QuestScriptPointList } from "./QuestScriptPointList";

export function QuestNpcEditor() {
  const target = useGameStore(s => s.questNpcEditorTarget);

  if (!target) return null;

  return <ActiveQuestNpcEditor key={target.npcId} target={target} />;
}

function ActiveQuestNpcEditor({ target }: { target: QuestNpcEditorTarget }) {
  const savedProgram = useGameStore(s => {
    return s.questNpcPrograms[target.npcId];
  });
  const questUnlockedSpellCount = useGameStore(s => s.questUnlockedSpells.length);
  const upsertQuestNpcProgram = useGameStore(s => s.upsertQuestNpcProgram);
  const removeQuestNpcProgram = useGameStore(s => s.removeQuestNpcProgram);
  const closeQuestNpcEditor = useGameStore(s => s.closeQuestNpcEditor);
  const runQuestScriptPoint = useGameStore(s => s.runQuestScriptPoint);
  const addLobbyMessage = useGameStore(s => s.addLobbyMessage);
  const [draft, setDraft] = useState<QuestNpcProgram | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [eventMessage, setEventMessage] = useState("Good work, wizard.");
  const [eventQuestId, setEventQuestId] = useState("town_01_quest");
  const [eventFlag, setEventFlag] = useState("town_01_quests=1");

  useEffect(() => {
    const program = savedProgram ?? createDefaultQuestNpcProgram(target);
    setDraft(cloneQuestNpcProgram(program));
    setSelectedPointId(program.scriptPoints[0]?.id ?? null);
  }, [savedProgram, target]);

  if (!draft) return null;

  const selectedPoint = getSelectedQuestScriptPoint(draft, selectedPointId);
  const selectedIndex = getQuestScriptPointIndex(draft, selectedPoint);
  const selectedEventCount = countQuestScriptPointEvents(selectedPoint);

  const updateDraft = (updates: Partial<QuestNpcProgram>) => {
    setDraft((current) => current ? { ...current, ...updates } : current);
  };

  const updatePoint = (updates: Partial<QuestScriptPoint>) => {
    if (!selectedPoint) return;
    setDraft((current) => {
      if (!current) return current;
      return updateQuestScriptPointDraft(current, selectedPoint.id, updates);
    });
  };

  const addScriptPoint = () => {
    const nextPoint = createQuestScriptPoint(draft.scriptPoints.length);
    setDraft((current) => current ? {
      ...current,
      scriptPoints: [...current.scriptPoints, nextPoint],
    } : current);
    setSelectedPointId(nextPoint.id);
  };

  const duplicateSelectedPoint = () => {
    if (!selectedPoint) return;
    const nextPoint = duplicateQuestScriptPoint(selectedPoint);
    setDraft((current) => current ? insertQuestScriptPointAfter(current, selectedPoint.id, nextPoint) : current);
    setSelectedPointId(nextPoint.id);
  };

  const moveSelectedPoint = (direction: -1 | 1) => {
    if (!selectedPoint || selectedIndex < 0) return;
    const nextIndex = selectedIndex + direction;
    if (nextIndex < 0 || nextIndex >= draft.scriptPoints.length) return;
    setDraft((current) => current ? moveQuestScriptPointById(current, selectedPoint.id, direction) : current);
  };

  const appendEventLine = (line: string) => {
    if (!selectedPoint) return;
    const eventScript = appendQuestEventScriptLine(selectedPoint.eventScript, line);
    if (eventScript === selectedPoint.eventScript) return;
    updatePoint({ eventScript });
  };

  const appendEventFromBuilder = (kind: QuestEventBuilderKind) => {
    appendEventLine(buildQuestEventLine(kind, {
      message: eventMessage,
      questId: eventQuestId,
      flag: eventFlag,
    }));
  };

  const removeSelectedPoint = () => {
    if (!selectedPoint) return;
    const removal = removeQuestScriptPointById(draft, selectedPoint.id, selectedIndex);
    if (!removal) {
      addLobbyMessage("A dialog needs at least one scriptpoint", "system");
      return;
    }
    setDraft((current) => current ? { ...current, scriptPoints: removal.scriptPoints } : current);
    setSelectedPointId(removal.nextSelectedPointId);
  };

  const saveDraft = () => {
    const cleanedDraft = sanitizeQuestNpcProgramDraft(draft, target);
    upsertQuestNpcProgram(cleanedDraft);
    addLobbyMessage(`Saved ${cleanedDraft.displayName}`, "system");
  };

  const resetProgram = () => {
    removeQuestNpcProgram(target.npcId);
    const fresh = createDefaultQuestNpcProgram(target);
    setDraft(fresh);
    setSelectedPointId(fresh.scriptPoints[0]?.id ?? null);
    addLobbyMessage("NPC program reset", "system");
  };

  const runSelectedPoint = () => {
    if (!selectedPoint) return;
    saveDraft();
    window.setTimeout(() => {
      runQuestScriptPoint(target.npcId, selectedPoint.id);
    }, 0);
  };

  return createPortal(
    <div
      data-testid="quest-npc-editor"
      className="fixed inset-0 z-[245] flex items-center justify-center bg-black/72 px-3 py-3 font-mono text-cyan-50 pointer-events-auto"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex max-h-[min(800px,calc(var(--app-vh,100dvh)-24px))] w-[min(1180px,calc(var(--app-vw,100dvw)-24px))] flex-col overflow-hidden border-2 border-cyan-200/70 bg-[#050711]/96 shadow-[0_0_36px_rgba(34,211,238,0.28)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/35 px-3 py-2">
          <div>
            <div className="text-[9px] tracking-[0.26em] text-cyan-100/55">QUEST NPC DEV</div>
            <div className="normal-case text-lg font-bold tracking-wide text-yellow-100">{draft.displayName || target.defaultName}</div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] tracking-widest">
            <button className="border border-emerald-200/70 bg-emerald-400/10 px-3 py-2 text-emerald-50 hover:bg-emerald-300/20" onClick={saveDraft}>SAVE</button>
            <button className="border border-cyan-200/60 bg-cyan-300/10 px-3 py-2 text-cyan-50 hover:bg-cyan-200/20" onClick={closeQuestNpcEditor}>CLOSE</button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="border-b border-cyan-300/25 bg-cyan-950/25 p-3 md:border-b-0 md:border-r">
            <label className="block text-[9px] tracking-[0.2em] text-cyan-100/65">
              NAME
              <input
                className="normal-case mt-1 w-full border border-cyan-300/45 bg-black/65 px-2 py-2 text-sm tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
                maxLength={42}
                value={draft.displayName}
                onChange={(e) => updateDraft({ displayName: e.currentTarget.value })}
              />
            </label>
            <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
              ROLE
              <select
                className="mt-1 w-full border border-cyan-300/45 bg-black/80 px-2 py-2 text-xs tracking-widest text-cyan-50 outline-none focus:border-yellow-200"
                value={draft.role}
                onChange={(e) => updateDraft({ role: e.currentTarget.value as QuestNpcRole })}
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
                onChange={(e) => updateDraft({ townId: e.currentTarget.value })}
              />
            </label>
            <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
              OPENING LINE
              <textarea
                className="normal-case mt-1 h-24 w-full resize-none border border-cyan-300/45 bg-black/65 px-2 py-2 text-xs leading-5 tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
                maxLength={900}
                value={draft.greeting}
                onChange={(e) => updateDraft({ greeting: e.currentTarget.value })}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] tracking-widest">
              <button className="border border-cyan-200/55 bg-cyan-300/10 px-2 py-2 hover:bg-cyan-200/20" onClick={addScriptPoint}>ADD POINT</button>
              <button className="border border-red-200/55 bg-red-400/10 px-2 py-2 text-red-50 hover:bg-red-300/20" onClick={removeSelectedPoint}>DELETE</button>
            </div>
            <button className="mt-2 w-full border border-zinc-300/45 bg-zinc-500/10 px-2 py-2 text-[9px] tracking-widest text-zinc-100 hover:bg-zinc-300/15" onClick={resetProgram}>RESET NPC</button>
            <div className="normal-case mt-3 text-[10px] leading-4 text-cyan-100/45">
              {target.npcId} - {target.theme ?? "village"} - unlocked spells tracked: {questUnlockedSpellCount}
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[190px_minmax(0,1fr)]">
            <QuestScriptPointList
              scriptPoints={draft.scriptPoints}
              selectedPointId={selectedPoint?.id ?? null}
              onSelectPoint={setSelectedPointId}
              onMoveSelected={moveSelectedPoint}
              onDuplicateSelected={duplicateSelectedPoint}
            />

            {selectedPoint && (
              <div className="min-w-0">
                <label className="block text-[9px] tracking-[0.2em] text-cyan-100/65">
                  POINT TITLE
                  <input
                    className="normal-case mt-1 w-full border border-cyan-300/45 bg-black/65 px-2 py-2 text-sm tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
                    maxLength={48}
                    value={selectedPoint.title}
                    onChange={(e) => updatePoint({ title: e.currentTarget.value })}
                  />
                </label>
                <label className="mt-3 block text-[9px] tracking-[0.2em] text-cyan-100/65">
                  DIALOG
                  <textarea
                    className="normal-case mt-1 h-28 w-full resize-none border border-cyan-300/45 bg-black/65 px-2 py-2 text-sm leading-5 tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
                    maxLength={900}
                    value={selectedPoint.dialog}
                    onChange={(e) => updatePoint({ dialog: e.currentTarget.value })}
                  />
                </label>
                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <label className="block text-[9px] tracking-[0.2em] text-cyan-100/65">
                    EVENTS
                    <textarea
                      className="normal-case mt-1 h-44 w-full resize-none border border-cyan-300/45 bg-black/65 px-2 py-2 text-xs leading-5 tracking-wide text-cyan-50 outline-none focus:border-yellow-200"
                      maxLength={900}
                      value={selectedPoint.eventScript}
                      onChange={(e) => updatePoint({ eventScript: e.currentTarget.value })}
                      placeholder={"unlockSpell blink\nunlockRandomLockedSpell\nstartQuest town_01_fetch\ncompleteQuest town_01_fetch\nsetFlag town_01_quests=1\nmessage Good work, wizard."}
                    />
                  </label>
                  <QuestEventBuilder
                    eventMessage={eventMessage}
                    eventQuestId={eventQuestId}
                    eventFlag={eventFlag}
                    onEventMessageChange={setEventMessage}
                    onEventQuestIdChange={setEventQuestId}
                    onEventFlagChange={setEventFlag}
                    onAppendPresetLine={appendEventLine}
                    onAppendEvent={appendEventFromBuilder}
                  />
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="border border-cyan-300/25 bg-black/35 p-2">
                    <div className="text-[9px] tracking-[0.22em] text-cyan-100/60">PREVIEW</div>
                    <div className="normal-case mt-2 text-sm font-bold tracking-wide text-yellow-100">{draft.displayName || target.defaultName}</div>
                    <div className="normal-case mt-1 min-h-12 border border-cyan-300/20 bg-cyan-950/10 px-2 py-2 text-xs leading-5 tracking-wide text-cyan-50">
                      {getQuestDialogPreviewLine(selectedPoint, draft.greeting)}
                    </div>
                  </div>
                  <div className="flex flex-col justify-between gap-2 border border-yellow-200/35 bg-yellow-300/5 p-2">
                    <div>
                      <div className="text-[9px] tracking-[0.22em] text-yellow-100/65">SCRIPTPOINT</div>
                      <div className="normal-case mt-1 text-xs leading-5 text-yellow-50">
                        {formatQuestScriptPointEventSummary(selectedPoint, selectedIndex, selectedEventCount)}
                      </div>
                    </div>
                    <button
                      className="border border-yellow-200/70 bg-yellow-300/10 px-3 py-2 text-[10px] tracking-widest text-yellow-50 hover:bg-yellow-200/20"
                      onClick={runSelectedPoint}
                    >
                      TEST POINT
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
