import type { PointerEventHandler } from "react";
import type { HandType } from "../../../store/gameStore";
import { MobileHotbarWheel } from "./MobileHotbarWheel";
import {
  type MobileCastPhase,
  type MobileGameplayButton,
} from "./mobileTouchEvents";
import { mobileActionButtonClass } from "./mobileTouchControlsRuntime";

type MobileButtonHandler = PointerEventHandler<HTMLButtonElement>;

export function MobileActionCluster({
  setButton,
  setCast,
}: {
  setButton: (button: MobileGameplayButton, pressed: boolean) => MobileButtonHandler;
  setCast: (hand: HandType, phase: MobileCastPhase) => MobileButtonHandler;
}) {
  return (
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
  );
}
