import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  SPELL_DISPLAY_NAMES,
  useGameStore,
} from "../../../store/gameStore";
import { isEditableTarget } from "../../systems/input/editableTargets";
import { InventoryWizardPreview } from "./InventoryWizardPreview";
import {
  getActiveInventoryQuestEntries,
  getDarrelQuestProgressRows,
  getInventoryEntries,
  getInventoryQuestStatus,
  getInventorySlotLayout,
  getSelectedInventoryQuestEntry,
  type InventoryControllerMoveDetail,
  type InventoryEntry,
  type InventoryHudPlayerState,
} from "./inventoryPanelRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function QuestInventoryIcon({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center border bg-black shadow-[inset_0_0_0_2px_rgba(255,255,255,0.05)] sm:h-14 sm:w-14",
        active ? "border-yellow-100/80" : "border-emerald-100/35",
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="h-8 w-8 sm:h-12 sm:w-12" role="img">
        <rect x="0" y="0" width="48" height="48" fill="#000000" />
        <path
          d="M12 9h19c3.6 0 6 2.2 6 5.6v22.7c0 .9-.7 1.7-1.7 1.7H15.8c-3.6 0-6-2.2-6-5.6V12c0-1.7 1.4-3 3.2-3Z"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <path d="M17 16h14M17 23h12M17 30h8" stroke="#ffffff" strokeWidth="3" strokeLinecap="square" />
        <path d="M32 10v27M12 36h23" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="square" />
        <path d="M34 18h7l-3.5 6 3.5 6h-7" fill="#ffffff" />
      </svg>
    </span>
  );
}

export function InventoryPanel({ playerState }: { playerState: InventoryHudPlayerState }) {
  const isOpen = useGameStore(s => s.isInventoryOpen);

  if (!isOpen) return null;

  return <ActiveInventoryPanel playerState={playerState} />;
}

function ActiveInventoryPanel({ playerState }: { playerState: InventoryHudPlayerState }) {
  const inventory = useGameStore(s => s.inventory);
  const setInventoryOpen = useGameStore(s => s.setInventoryOpen);
  const characterCustomization = useGameStore(s => s.characterCustomization);
  const spellQuestAssignments = useGameStore(s => s.spellQuestAssignments);
  const questFlags = useGameStore(s => s.questFlags);
  const questUnlockedSpells = useGameStore(s => s.questUnlockedSpells);
  const [isQuestJournalOpen, setQuestJournalOpen] = useState(false);
  const [selectedQuestIndex, setSelectedQuestIndex] = useState(0);

  const activeQuestEntries = useMemo(
    () => getActiveInventoryQuestEntries(spellQuestAssignments, questUnlockedSpells),
    [questUnlockedSpells, spellQuestAssignments],
  );
  const selectedQuestEntry = getSelectedInventoryQuestEntry(activeQuestEntries, selectedQuestIndex);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.code === "KeyJ") {
        event.preventDefault();
        event.stopPropagation();
        setQuestJournalOpen((open) => !open);
        return;
      }

      if (isQuestJournalOpen && (event.code === "ArrowDown" || event.code === "ArrowUp")) {
        event.preventDefault();
        event.stopPropagation();
        const direction = event.code === "ArrowDown" ? 1 : -1;
        setSelectedQuestIndex((index) => {
          const count = activeQuestEntries.length;
          return count > 0 ? (index + direction + count) % count : 0;
        });
        return;
      }

      if (event.code === "Enter" && !isQuestJournalOpen) {
        event.preventDefault();
        event.stopPropagation();
        setQuestJournalOpen(true);
        return;
      }

      if (event.code !== "Escape" && event.code !== "KeyI") return;
      event.preventDefault();
      event.stopPropagation();
      if (isQuestJournalOpen) {
        setQuestJournalOpen(false);
        return;
      }
      setInventoryOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeQuestEntries.length, isQuestJournalOpen, setInventoryOpen]);

  useEffect(() => {
    setSelectedQuestIndex((index) => Math.min(index, Math.max(0, activeQuestEntries.length - 1)));
  }, [activeQuestEntries.length]);

  useEffect(() => {
    const handleControllerSelect = () => {
      if (isQuestJournalOpen) return;
      setQuestJournalOpen(true);
    };

    const handleControllerBack = (event: Event) => {
      const detail = (event as CustomEvent<{ handled?: boolean }>).detail;
      if (!isQuestJournalOpen) return;
      if (detail) detail.handled = true;
      setQuestJournalOpen(false);
    };

    const handleControllerMove = (event: Event) => {
      if (!isQuestJournalOpen) return;
      const direction = (event as CustomEvent<InventoryControllerMoveDetail>).detail?.direction;
      if (direction !== 1 && direction !== -1) return;
      setSelectedQuestIndex((index) => {
        const count = activeQuestEntries.length;
        return count > 0 ? (index + direction + count) % count : 0;
      });
    };

    window.addEventListener("inventory-controller-select", handleControllerSelect);
    window.addEventListener("inventory-controller-back", handleControllerBack);
    window.addEventListener("inventory-controller-move", handleControllerMove);
    return () => {
      window.removeEventListener("inventory-controller-select", handleControllerSelect);
      window.removeEventListener("inventory-controller-back", handleControllerBack);
      window.removeEventListener("inventory-controller-move", handleControllerMove);
    };
  }, [activeQuestEntries.length, isQuestJournalOpen]);

  const entries = useMemo(() => getInventoryEntries(inventory), [inventory]);
  const { backpackSlots, quickSlots } = useMemo(() => getInventorySlotLayout(entries), [entries]);

  const renderInventorySlot = (
    entry: InventoryEntry | null,
    index: number,
    label?: string,
    visibleLabel = label
  ) => {
    const definition = entry?.definition;
    const quantity = entry?.quantity ?? 0;

    return (
      <div
        key={`${label ?? "slot"}-${index}`}
        className={cn(
          "relative aspect-square min-w-[30px] overflow-hidden border bg-black/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] sm:min-w-[34px]",
          definition
            ? "border-emerald-100/55 bg-emerald-200/12"
            : "border-emerald-100/20 bg-[#020906]/70"
        )}
        title={definition ? `${definition.name} x${quantity}` : label ?? `Slot ${index + 1}`}
        aria-label={definition ? `${definition.name} x${quantity}` : label ?? `Empty slot ${index + 1}`}
      >
        <div className="absolute inset-[3px] border border-black/45 bg-gradient-to-br from-white/8 via-transparent to-black/35" />
        {definition ? (
          <>
            <div className="absolute inset-1 flex items-center justify-center text-[8px] font-bold uppercase text-emerald-50 sm:text-xs">
              <span className="flex h-[68%] w-[68%] max-w-full items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap border border-emerald-100/35 bg-emerald-300/15 px-0.5 text-center leading-none shadow-[0_0_16px_rgba(110,231,183,0.14)]">
                {definition.name.slice(0, 2)}
              </span>
            </div>
            <div className="absolute bottom-0.5 right-0.5 max-w-[82%] overflow-hidden text-ellipsis whitespace-nowrap rounded-sm bg-black/70 px-1 text-[8px] font-bold leading-3 text-emerald-50 sm:right-1 sm:text-[10px] sm:leading-4">
              {quantity}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center text-[8px] uppercase text-emerald-100/20 sm:text-[9px]">
            {visibleLabel ?? index + 1}
          </div>
        )}
      </div>
    );
  };

  const renderDarrelProgress = () => {
    const stepRows = getDarrelQuestProgressRows(questFlags);

    return (
      <div className="mt-3 grid gap-1.5">
        {stepRows.map(({ label, done }) => {
          return (
            <div key={label} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border border-emerald-100/20 bg-black/25 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-emerald-50/75">
              <span className="min-w-0 break-words">{label}</span>
              <span className={cn("shrink-0", done ? "text-yellow-100" : "text-emerald-100/40")}>{done ? "Done" : "Needed"}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return createPortal(
    <div
      data-no-resume-click
      data-testid="inventory-panel"
      className="fixed inset-0 z-[243] flex items-end justify-center bg-black/45 px-3 pb-5 pt-20 font-mono normal-case text-slate-50 pointer-events-auto sm:items-center sm:py-5"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Inventory"
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div
        data-wof-hud-qa="inventory-panel"
        className="max-h-[min(760px,calc(var(--app-vh,100dvh)-24px))] w-[min(1060px,calc(var(--app-vw,100dvw)-24px))] overflow-hidden border-2 border-emerald-100/65 bg-[#06100c]/96 shadow-[0_0_38px_rgba(52,211,153,0.22)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-emerald-100/25 bg-emerald-950/20 px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-100/60">Survival Pack</div>
            <div className="truncate text-xl font-bold tracking-wide text-emerald-50">Inventory</div>
          </div>
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-emerald-100/50 bg-emerald-200/10 text-base font-bold text-emerald-50 hover:bg-emerald-100/20"
            aria-label="Close inventory"
            onClick={() => setInventoryOpen(false)}
          >
            X
          </button>
        </div>

        <div className="grid max-h-[calc(min(760px,calc(var(--app-vh,100dvh)-24px))-62px)] min-w-0 content-start gap-3 overflow-x-hidden overflow-y-auto overscroll-contain p-3 sm:gap-4 sm:p-4">
          <div className="grid min-w-0 grid-cols-1 items-start gap-3 min-[520px]:grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="grid min-w-0 content-start gap-2 overflow-hidden border border-emerald-100/30 bg-black/35 p-2 sm:p-3">
              <div className="truncate text-[10px] uppercase tracking-[0.22em] text-emerald-100/50">Wizard</div>
              <InventoryWizardPreview character={characterCustomization} playerState={playerState} />
              <button
                className={cn(
                  "mt-1 grid min-w-0 justify-items-center gap-1 overflow-hidden border px-1 py-2 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-100/60 sm:px-2 sm:tracking-[0.16em]",
                  isQuestJournalOpen
                    ? "border-yellow-100 bg-yellow-100/18 shadow-[0_0_18px_rgba(250,204,21,0.22)]"
                    : "border-emerald-100/40 bg-emerald-300/10 hover:border-emerald-100/70 hover:bg-emerald-200/18",
                )}
                aria-label={`Quests journal, ${activeQuestEntries.length} active`}
                title={`Quests journal (${activeQuestEntries.length} active)`}
                onClick={() => setQuestJournalOpen((open) => !open)}
              >
                <QuestInventoryIcon active={isQuestJournalOpen} />
                <span className={cn("block max-w-full truncate text-[10px] sm:text-[11px]", isQuestJournalOpen ? "text-yellow-50" : "text-emerald-50")}>Quests</span>
              </button>
            </div>
            {isQuestJournalOpen ? (
              <div className="grid min-w-0 content-start gap-3 overflow-hidden border border-yellow-100/35 bg-black/35 p-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-yellow-100/50">Quest Journal</div>
                    <div className="truncate text-sm font-bold uppercase tracking-[0.16em] text-yellow-50">Active Quests</div>
                  </div>
                  <button
                    className="shrink-0 border border-yellow-100/45 bg-yellow-200/10 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-yellow-50 hover:bg-yellow-100/20"
                    onClick={() => setQuestJournalOpen(false)}
                  >
                    Back
                  </button>
                </div>
                {activeQuestEntries.length === 0 ? (
                  <div className="grid min-h-36 min-w-0 place-items-center border border-emerald-100/20 bg-black/30 px-4 py-8 text-center text-xs uppercase tracking-[0.16em] text-emerald-100/45">
                    No active spell quests yet.
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                    <div className="grid max-h-64 min-w-0 content-start gap-1.5 overflow-y-auto pr-1">
                      {activeQuestEntries.map((entry, index) => {
                        const selected = index === selectedQuestIndex;
                        return (
                          <button
                            key={entry.assignment.npcId}
                            className={cn(
                              "min-h-14 min-w-0 overflow-hidden border px-2 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-100/60",
                              selected
                                ? "border-yellow-100 bg-yellow-100/18 shadow-[0_0_14px_rgba(250,204,21,0.22)]"
                                : "border-emerald-100/25 bg-black/35 hover:border-emerald-100/55 hover:bg-emerald-200/10",
                            )}
                            onMouseEnter={() => setSelectedQuestIndex(index)}
                            onClick={() => setSelectedQuestIndex(index)}
                          >
                            <div className="truncate text-xs font-bold uppercase tracking-[0.12em] text-emerald-50">{entry.definition.title}</div>
                            <div className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-emerald-100/45">
                              {entry.assignment.displayName} / {SPELL_DISPLAY_NAMES[entry.assignment.spell]}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="min-h-64 min-w-0 overflow-hidden border border-emerald-100/25 bg-[#030906]/75 p-3">
                      {selectedQuestEntry && (
                        <>
                          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[10px] uppercase tracking-[0.2em] text-yellow-100/50">Selected Quest</div>
                              <div className="mt-1 break-words text-sm font-black uppercase tracking-[0.1em] text-yellow-50 sm:text-lg sm:tracking-[0.12em]">{selectedQuestEntry.definition.title}</div>
                            </div>
                            <div className="max-w-full shrink-0 break-words border border-yellow-100/35 bg-yellow-200/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-yellow-50">
                              {getInventoryQuestStatus(selectedQuestEntry, questFlags)}
                            </div>
                          </div>
                          <div className="mt-3 grid min-w-0 gap-2 text-xs leading-5 text-emerald-50/80">
                            <div className="min-w-0 break-words"><span className="uppercase tracking-[0.14em] text-emerald-100/45">Giver:</span> {selectedQuestEntry.assignment.displayName}</div>
                            <div className="min-w-0 break-words"><span className="uppercase tracking-[0.14em] text-emerald-100/45">Reward:</span> {SPELL_DISPLAY_NAMES[selectedQuestEntry.assignment.spell]}</div>
                            <div className="max-h-36 min-w-0 overflow-y-auto break-words border border-cyan-100/15 bg-cyan-950/20 px-3 py-2 text-cyan-50/90">
                              {selectedQuestEntry.definition.objective}
                            </div>
                          </div>
                          {selectedQuestEntry.assignment.spell === "healingcrystals" && renderDarrelProgress()}
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="break-words text-[10px] uppercase tracking-[0.18em] text-yellow-100/40">
                  D-Pad / Stick choose / A open / B back
                </div>
              </div>
            ) : (
              <div className="grid min-w-0 content-start gap-3 overflow-hidden">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-100/50">Backpack</div>
                  <div className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-emerald-100/35">{entries.length}/36</div>
                </div>
                <div className="min-w-0 overflow-hidden border border-emerald-100/25 bg-black/35 p-1.5 sm:p-2">
                  <div className="grid min-w-0 grid-cols-[repeat(9,minmax(30px,1fr))] gap-0.5 sm:min-w-[468px] sm:grid-cols-[repeat(9,minmax(34px,1fr))] sm:gap-1.5">
                    {backpackSlots.map((entry, index) => renderInventorySlot(entry, index))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-1 truncate text-[10px] uppercase tracking-[0.22em] text-emerald-100/50">Quick Row</div>
          <div className="min-w-0 overflow-hidden border border-yellow-100/35 bg-yellow-200/8 p-1.5 sm:p-2">
            <div className="grid min-w-0 grid-cols-[repeat(9,minmax(30px,1fr))] gap-0.5 sm:min-w-[468px] sm:grid-cols-[repeat(9,minmax(34px,1fr))] sm:gap-1.5">
              {quickSlots.map((entry, index) => renderInventorySlot(entry, index, `${index + 1}`))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
