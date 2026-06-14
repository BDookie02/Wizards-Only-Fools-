import { useRef } from "react";
import { getSpriteUrl } from "../../SpriteManifest";
import { MobileHotbarWheel } from "./MobileHotbarWheel";
import {
  mobileActionButtonClass,
  useMobileTouchControlRuntime,
} from "./mobileTouchControlsRuntime";

export function MobileTouchControls({
  openSpellMenu,
  pauseTouchGameplay,
  openEngineMenu,
  showEngineMenuButton = false,
}: {
  openSpellMenu: () => void;
  pauseTouchGameplay: () => void;
  openEngineMenu?: () => void;
  showEngineMenuButton?: boolean;
}) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const {
    beginLook,
    beginMove,
    endLook,
    endMove,
    moveLook,
    moveStick,
    resetMove,
    setButton,
    setCast,
  } = useMobileTouchControlRuntime({ joystickRef, joystickKnobRef });
  const spellbookIconUrl =
    getSpriteUrl("/sprites/misc/spellbook_icon.png") ||
    getSpriteUrl("/sprites/misc/spellbook.gif") ||
    "/sprites/misc/spellbook_icon.png";

  return (
    <div data-testid="mobile-touch-controls" data-wof-hud-qa="mobile-touch-controls" className="mobile-touch-controls pointer-events-none absolute inset-0 z-[85] select-none">
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 w-[58%]"
        style={{ touchAction: "none" }}
        onPointerDown={beginLook}
        onPointerMove={moveLook}
        onPointerUp={endLook}
        onPointerCancel={endLook}
      />

      <div className="mobile-top-actions absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-2">
        <button
          data-testid="mobile-open-spell-menu"
          aria-label="Open spell book"
          title="Open spell book"
          className="mobile-spellbook-button pointer-events-auto flex h-12 w-12 items-center justify-center overflow-visible border-0 bg-transparent p-0 text-[9px] text-cyan-50 active:scale-95"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); openSpellMenu(); }}
        >
          <img
            src={spellbookIconUrl}
            alt=""
            crossOrigin="anonymous"
            decoding="async"
            className="h-full w-full object-contain [image-rendering:pixelated]"
            style={{
              filter: "brightness(1.12) contrast(1.1) saturate(1.08)",
            }}
            onError={(e) => {
              e.currentTarget.classList.add("hidden");
              e.currentTarget.nextElementSibling?.classList.remove("hidden");
            }}
          />
          <span className="hidden font-mono tracking-widest">SPELL</span>
        </button>
        <button
          data-testid="mobile-pause"
          aria-label="Pause"
          title="Pause"
          className="mobile-pause-button pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border-2 border-cyan-100/40 bg-black/55 active:scale-95 active:bg-white/15"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); pauseTouchGameplay(); }}
        >
          <span className="flex h-5 w-4 items-center justify-between" aria-hidden="true">
            <span className="h-full w-1.5 rounded-sm bg-cyan-50" />
            <span className="h-full w-1.5 rounded-sm bg-cyan-50" />
          </span>
        </button>
        {showEngineMenuButton && openEngineMenu && (
          <button
            data-testid="mobile-open-engine-menu"
            aria-label="Open engine menu"
            title="Open engine menu"
            className="mobile-engine-button pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border-2 border-yellow-100/45 bg-yellow-300/15 text-[10px] font-bold tracking-widest text-yellow-50 active:scale-95 active:bg-yellow-200/25"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); openEngineMenu(); }}
          >
            DEV
          </button>
        )}
      </div>

      <div className="mobile-joystick-zone absolute left-3 bottom-[118px] z-10 flex flex-col gap-2">
        <div
          ref={joystickRef}
          className="mobile-joystick pointer-events-auto relative h-28 w-28 rounded-full border-2 border-cyan-100/35 bg-black/40"
          style={{ touchAction: "none" }}
          onPointerDown={beginMove}
          onPointerMove={moveStick}
          onPointerUp={endMove}
          onPointerCancel={resetMove}
        >
          <div className="mobile-joystick-center absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100/25" />
          <div
            ref={joystickKnobRef}
            className="mobile-joystick-knob absolute left-1/2 top-1/2 h-12 w-12 rounded-full border border-cyan-100/55 bg-cyan-200/20"
            style={{
              transform: "translate(calc(-50% + 0px), calc(-50% + 0px))",
            }}
          />
        </div>
      </div>

      <div className="mobile-action-cluster absolute right-3 bottom-[108px] z-10 flex items-end gap-4">
        <div className="flex flex-col items-center gap-2">
          <MobileHotbarWheel hand="left" />
          <button
            data-testid="mobile-left-cast"
            className={mobileActionButtonClass}
            onPointerDown={setCast("left", "start")}
            onPointerUp={setCast("left", "end")}
            onPointerCancel={setCast("left", "end")}
          >
            L
          </button>
        </div>
        <div className="mobile-movement-column mb-1 flex flex-col items-center gap-4">
          <button
            data-testid="mobile-jump"
            className={mobileActionButtonClass}
            onPointerDown={setButton("jump", true)}
            onPointerUp={setButton("jump", false)}
            onPointerCancel={setButton("jump", false)}
          >
            JUMP
          </button>
          <button
            data-testid="mobile-slide"
            className={mobileActionButtonClass}
            onPointerDown={setButton("slide", true)}
            onPointerUp={setButton("slide", false)}
            onPointerCancel={setButton("slide", false)}
          >
            SLIDE
          </button>
          <button
            data-testid="mobile-sprint"
            className={mobileActionButtonClass}
            onPointerDown={setButton("sprint", true)}
            onPointerUp={setButton("sprint", false)}
            onPointerCancel={setButton("sprint", false)}
          >
            RUN
          </button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MobileHotbarWheel hand="right" />
          <button
            data-testid="mobile-right-cast"
            className={mobileActionButtonClass}
            onPointerDown={setCast("right", "start")}
            onPointerUp={setCast("right", "end")}
            onPointerCancel={setCast("right", "end")}
          >
            R
          </button>
        </div>
      </div>
    </div>
  );
}
