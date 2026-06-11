import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { HandType } from "../../../store/gameStore";
import {
  emitMobileCast,
  emitMobileControl,
  type MobileCastPhase,
  type MobileGameplayButton,
} from "./mobileTouchEvents";

export const mobileActionButtonClass = "mobile-action-button pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/35 bg-black/55 text-[10px] text-white active:scale-95 active:bg-white/20";

type ElementRef<T extends HTMLElement> = {
  current: T | null;
};

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

export type MobileStickVector = {
  x: number;
  y: number;
};

export function getMobileHotbarDirectionFromPoint(clientY: number, rect: RectLike): 1 | -1 {
  return clientY < rect.top + rect.height / 2 ? -1 : 1;
}

export function getMobileHotbarDirectionFromDelta(deltaY: number, threshold = 18): 1 | -1 | null {
  if (Math.abs(deltaY) < threshold) return null;
  return deltaY > 0 ? 1 : -1;
}

export function getMobileStickVector(clientX: number, clientY: number, rect: RectLike): MobileStickVector {
  return getMobileStickVectorInto(clientX, clientY, rect, { x: 0, y: 0 });
}

export function getMobileStickVectorInto(
  clientX: number,
  clientY: number,
  rect: RectLike,
  target: MobileStickVector,
): MobileStickVector {
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const rawX = (clientX - (rect.left + rect.width / 2)) / radius;
  const rawY = (clientY - (rect.top + rect.height / 2)) / radius;
  const length = Math.sqrt(rawX * rawX + rawY * rawY);
  const scale = length > 1 ? 1 / length : 1;
  target.x = rawX * scale;
  target.y = rawY * scale;
  return target;
}

export function getMobileStickKnobTransform(vector: MobileStickVector, rect: Pick<DOMRect, "width" | "height"> | null) {
  return getMobileStickKnobTransformFromValues(vector.x, vector.y, rect);
}

export function getMobileStickKnobTransformFromValues(
  x: number,
  y: number,
  rect: Pick<DOMRect, "width" | "height"> | null,
) {
  const travel = rect ? Math.min(rect.width, rect.height) * 0.3 : 34;
  return `translate(calc(-50% + ${x * travel}px), calc(-50% + ${y * travel}px))`;
}

export function useMobileTouchControlRuntime({
  joystickRef,
  joystickKnobRef,
}: {
  joystickRef: ElementRef<HTMLDivElement>;
  joystickKnobRef: ElementRef<HTMLDivElement>;
}) {
  const joystickPointerRef = useRef<number | null>(null);
  const lookPointerRef = useRef<number | null>(null);
  const lastLookRef = useRef({ x: 0, y: 0 });
  const pendingMoveRef = useRef<MobileStickVector>({ x: 0, y: 0 });
  const hasPendingMoveRef = useRef(false);
  const stickVectorRef = useRef<MobileStickVector>({ x: 0, y: 0 });
  const moveRafRef = useRef<number | null>(null);
  const pendingLookRef = useRef({ dx: 0, dy: 0 });
  const lookRafRef = useRef<number | null>(null);

  const setStickVisual = (x: number, y: number) => {
    if (!joystickKnobRef.current) return;
    const rect = joystickRef.current?.getBoundingClientRect() ?? null;
    joystickKnobRef.current.style.transform = getMobileStickKnobTransformFromValues(x, y, rect);
  };

  const flushQueuedMove = () => {
    moveRafRef.current = null;
    const move = pendingMoveRef.current;
    if (!hasPendingMoveRef.current) return;
    hasPendingMoveRef.current = false;
    emitMobileControl({ type: "move", x: move.x, y: move.y });
  };

  const queueMove = (x: number, y: number) => {
    pendingMoveRef.current.x = x;
    pendingMoveRef.current.y = y;
    hasPendingMoveRef.current = true;
    if (moveRafRef.current === null) {
      moveRafRef.current = window.requestAnimationFrame(flushQueuedMove);
    }
  };

  const flushQueuedLook = () => {
    lookRafRef.current = null;
    const pendingLook = pendingLookRef.current;
    const dx = pendingLook.dx;
    const dy = pendingLook.dy;
    pendingLook.dx = 0;
    pendingLook.dy = 0;
    if (dx !== 0 || dy !== 0) emitMobileControl({ type: "look", dx, dy });
  };

  const queueLook = (dx: number, dy: number) => {
    pendingLookRef.current.dx += dx;
    pendingLookRef.current.dy += dy;
    if (lookRafRef.current === null) {
      lookRafRef.current = window.requestAnimationFrame(flushQueuedLook);
    }
  };

  useEffect(() => () => {
    if (moveRafRef.current !== null) window.cancelAnimationFrame(moveRafRef.current);
    if (lookRafRef.current !== null) window.cancelAnimationFrame(lookRafRef.current);
  }, []);

  const resetMove = () => {
    joystickPointerRef.current = null;
    if (moveRafRef.current !== null) {
      window.cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    hasPendingMoveRef.current = false;
    setStickVisual(0, 0);
    emitMobileControl({ type: "move", x: 0, y: 0 });
  };

  const updateMove = (clientX: number, clientY: number) => {
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    const stickVector = getMobileStickVectorInto(clientX, clientY, rect, stickVectorRef.current);
    setStickVisual(stickVector.x, stickVector.y);
    queueMove(stickVector.x, stickVector.y);
  };

  const beginMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    joystickPointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateMove(e.clientX, e.clientY);
  };

  const moveStick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    updateMove(e.clientX, e.clientY);
  };

  const endMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    resetMove();
  };

  const beginLook = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    lookPointerRef.current = e.pointerId;
    lastLookRef.current.x = e.clientX;
    lastLookRef.current.y = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const moveLook = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerRef.current !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - lastLookRef.current.x;
    const dy = e.clientY - lastLookRef.current.y;
    lastLookRef.current.x = e.clientX;
    lastLookRef.current.y = e.clientY;
    queueLook(dx, dy);
  };

  const endLook = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointerRef.current !== e.pointerId) return;
    lookPointerRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const setButton = (button: MobileGameplayButton, pressed: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (pressed) {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    emitMobileControl({ type: "button", button, pressed });
  };

  const setCast = (hand: HandType, phase: MobileCastPhase) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (phase === "start") {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } else {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    emitMobileCast(hand, phase);
  };

  return {
    beginLook,
    beginMove,
    endLook,
    endMove,
    moveLook,
    moveStick,
    resetMove,
    setButton,
    setCast,
  };
}
