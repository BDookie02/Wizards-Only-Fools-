import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useGameStore, type QuestDialogSession } from "../../../store/gameStore";
import {
  createControllerPollScheduler,
  GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS,
  getPrimaryGamepad,
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadButtonName,
  type GamepadStickAxes,
} from "../../systems/input/controllerInput";
import { isEditableTarget } from "../../systems/input/editableTargets";
import { getNumberSlotFromCode } from "../../systems/input/playerInputState";
import {
  consumeHudControllerPress,
  consumeHudControllerRepeat,
  resetHudControllerButtonState,
} from "./hudControllerRuntime";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const questDialogStickScratch: GamepadStickAxes = { x: 0, y: 0 };

export function QuestDialogPanel() {
  const session = useGameStore(s => s.questDialogSession);

  if (!session) return null;

  return <ActiveQuestDialogPanel session={session} />;
}

function ActiveQuestDialogPanel({ session }: { session: QuestDialogSession }) {
  const closeQuestDialog = useGameStore(s => s.closeQuestDialog);
  const chooseQuestDialogChoice = useGameStore(s => s.chooseQuestDialogChoice);
  const controllerBindings = useGameStore(s => s.controllerBindings);
  const [controllerChoiceIndex, setControllerChoiceIndex] = useState(0);
  const controllerChoiceIndexRef = useRef(0);
  const controllerButtonsRef = useRef<Record<string, boolean>>({});
  const controllerRepeatRef = useRef<Partial<Record<string, number>>>({});

  useEffect(() => {
    controllerChoiceIndexRef.current = 0;
    setControllerChoiceIndex(0);
    resetHudControllerButtonState(controllerButtonsRef, controllerRepeatRef);
  }, [session?.line, session?.npcId, session?.choices.length]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeQuestDialog();
        return;
      }

      const slotIndex = getNumberSlotFromCode(event.code);
      const choice = slotIndex >= 0 ? session.choices[slotIndex] : undefined;
      if (!choice) return;

      event.preventDefault();
      event.stopPropagation();
      chooseQuestDialogChoice(choice.id);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [chooseQuestDialogChoice, closeQuestDialog, session]);

  useEffect(() => {
    const moveChoice = (direction: 1 | -1) => {
      const choiceCount = session.choices.length;
      if (choiceCount <= 0) return;
      const nextIndex = (controllerChoiceIndexRef.current + direction + choiceCount) % choiceCount;
      controllerChoiceIndexRef.current = nextIndex;
      setControllerChoiceIndex(nextIndex);
    };

    let controllerPollScheduler: ReturnType<typeof createControllerPollScheduler>;
    const pollQuestDialogController = (now: number) => {
      const gamepad = getPrimaryGamepad();
      if (!gamepad) {
        resetHudControllerButtonState(controllerButtonsRef, controllerRepeatRef);
        controllerPollScheduler.schedule(GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
        return;
      }

      readGamepadStickAxesInto(gamepad, "left", questDialogStickScratch, 0.55);
      const selectPressed = consumeHudControllerPress(controllerButtonsRef, "questDialogSelect", isGamepadButtonPressed(gamepad, controllerBindings.menuSelect as GamepadButtonName));
      const backPressed = consumeHudControllerPress(controllerButtonsRef, "questDialogBack", isGamepadButtonPressed(gamepad, controllerBindings.menuBack as GamepadButtonName));
      const startPressed = consumeHudControllerPress(controllerButtonsRef, "questDialogStart", isGamepadButtonPressed(gamepad, controllerBindings.pause as GamepadButtonName));
      const nextPressed = consumeHudControllerRepeat(
        controllerButtonsRef,
        controllerRepeatRef,
        "questDialogNext",
        isGamepadButtonPressed(gamepad, "dpadDown") || questDialogStickScratch.y > 0.6,
        now,
        260,
        160,
      );
      const prevPressed = consumeHudControllerRepeat(
        controllerButtonsRef,
        controllerRepeatRef,
        "questDialogPrev",
        isGamepadButtonPressed(gamepad, "dpadUp") || questDialogStickScratch.y < -0.6,
        now,
        260,
        160,
      );

      if (nextPressed) {
        moveChoice(1);
      } else if (prevPressed) {
        moveChoice(-1);
      }

      if (selectPressed) {
        const choice = session.choices[controllerChoiceIndexRef.current] ?? session.choices[0];
        if (choice) {
          chooseQuestDialogChoice(choice.id);
        }
      } else if (backPressed || startPressed) {
        closeQuestDialog();
      }

      controllerPollScheduler.schedule(0);
    };

    controllerPollScheduler = createControllerPollScheduler(pollQuestDialogController);
    controllerPollScheduler.schedule(0);
    return () => {
      controllerPollScheduler.cancel();
      resetHudControllerButtonState(controllerButtonsRef, controllerRepeatRef);
    };
  }, [chooseQuestDialogChoice, closeQuestDialog, controllerBindings, session]);

  return createPortal(
    <div
      data-no-resume-click
      data-testid="quest-dialog-panel"
      data-wof-hud-qa="quest-dialog-panel"
      className="fixed inset-0 z-[244] flex items-end justify-center bg-black/35 px-3 pb-5 pt-20 font-mono normal-case text-slate-50 pointer-events-auto sm:items-center sm:py-5"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`${session.displayName} quest dialog`}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="w-[min(760px,calc(var(--app-vw,100dvw)-24px))] border-2 border-yellow-100/65 bg-[#070611]/96 shadow-[0_0_36px_rgba(250,204,21,0.2)]">
        <div className="flex items-center justify-between gap-3 border-b border-yellow-100/25 px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-yellow-100/60">Quest</div>
            <div className="text-xl font-bold tracking-wide text-yellow-50">{session.displayName}</div>
          </div>
          <button
            className="border border-yellow-100/50 bg-yellow-200/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-yellow-50 hover:bg-yellow-100/20"
            onClick={closeQuestDialog}
          >
            Close
          </button>
        </div>
        <div className="px-4 py-4">
          <div className="whitespace-pre-line border border-cyan-200/20 bg-cyan-950/20 px-3 py-3 text-sm leading-6 text-cyan-50">
            {session.line}
          </div>
          <div className="mt-3 grid gap-2">
            {session.choices.map((choice, index) => (
              <button
                key={choice.id}
                className={cn(
                  "flex min-h-12 items-center gap-3 border px-3 py-2 text-left text-sm leading-5 text-yellow-50 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-100/60",
                  index === controllerChoiceIndex
                    ? "border-yellow-100 bg-yellow-100/18 shadow-[0_0_18px_rgba(250,204,21,0.26)]"
                    : "border-yellow-100/40 bg-black/35 hover:border-yellow-100/75 hover:bg-yellow-100/15",
                )}
                onMouseEnter={() => {
                  controllerChoiceIndexRef.current = index;
                  setControllerChoiceIndex(index);
                }}
                onClick={() => chooseQuestDialogChoice(choice.id)}
              >
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center border text-xs uppercase text-yellow-100",
                  index === controllerChoiceIndex ? "border-yellow-50 bg-yellow-200/25" : "border-yellow-100/50 bg-yellow-200/10",
                )}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{choice.label}</span>
              </button>
            ))}
            <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-yellow-100/45">
              D-Pad / Stick choose - A select - B close
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
