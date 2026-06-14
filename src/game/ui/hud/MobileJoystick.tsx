import type { PointerEventHandler, RefObject } from "react";

export function MobileJoystick({
  joystickRef,
  joystickKnobRef,
  beginMove,
  moveStick,
  endMove,
  resetMove,
}: {
  joystickRef: RefObject<HTMLDivElement | null>;
  joystickKnobRef: RefObject<HTMLDivElement | null>;
  beginMove: PointerEventHandler<HTMLDivElement>;
  moveStick: PointerEventHandler<HTMLDivElement>;
  endMove: PointerEventHandler<HTMLDivElement>;
  resetMove: () => void;
}) {
  return (
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
  );
}
