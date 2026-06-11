import { useEffect, useRef, useState } from "react";
import { getPublishedLastPlayerYaw, getPublishedLocalPlayerPosition } from "../../systems/player/playerEventBridge";
import { isHudMapSuppressedByToolOverlay } from "./hudMapSuppressionRuntime";
import type { LiveMapPosition } from "./mapOverlayRuntime";

export type MiniMapDisplayCoords = {
  x: number;
  z: number;
};

type MiniMapPlayerTrackingOptions = {
  isVisible: boolean;
  mobilePerformanceMode: boolean;
};

const STATE_UPDATE_INTERVAL_MS = 100;
const MOBILE_DOM_UPDATE_INTERVAL_MS = 1000 / 15;

function toFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sameLiveMapPosition(a: LiveMapPosition, b: LiveMapPosition) {
  return a.x === b.x && a.z === b.z && a.angle === b.angle;
}

function applyPlayerIconRotation(node: HTMLDivElement | null, angle: number) {
  if (!node) return;
  node.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
}

function syncMiniMapPositionFromPublishedState(target: LiveMapPosition) {
  const publishedPosition = getPublishedLocalPlayerPosition();
  if (publishedPosition) {
    target.x = publishedPosition.x;
    target.z = publishedPosition.z;
  }

  const publishedYaw = getPublishedLastPlayerYaw();
  if (publishedYaw !== undefined) {
    target.angle = publishedYaw;
  }

  return target;
}

export function useMiniMapPlayerTracking({
  isVisible,
  mobilePerformanceMode,
}: MiniMapPlayerTrackingOptions) {
  const playerIconRef = useRef<HTMLDivElement>(null);
  const expandedPlayerIconRef = useRef<HTMLDivElement>(null);
  const currentPositionRef = useRef<LiveMapPosition>({ x: 0, z: 0, angle: 0 });
  const pendingMoveRef = useRef<LiveMapPosition>({ x: 0, z: 0, angle: 0 });
  const hasPendingMoveRef = useRef(false);
  const moveRafRef = useRef<number | null>(null);
  const isVisibleRef = useRef(isVisible);
  const lastStateUpdateRef = useRef(0);
  const lastDomMoveUpdateRef = useRef(0);

  const [displayCoords, setDisplayCoords] = useState<MiniMapDisplayCoords>({ x: 0, z: 0 });
  const [playerPosition, setPlayerPosition] = useState<LiveMapPosition>({ x: 0, z: 0, angle: 0 });

  useEffect(() => {
    isVisibleRef.current = isVisible;
    if (!isVisible || isHudMapSuppressedByToolOverlay()) return;

    const position = syncMiniMapPositionFromPublishedState(currentPositionRef.current);
    const roundedX = Math.round(position.x);
    const roundedZ = Math.round(position.z);
    setDisplayCoords((current) => (
      current.x === roundedX && current.z === roundedZ
        ? current
        : { x: roundedX, z: roundedZ }
    ));
    setPlayerPosition((current) => (
      sameLiveMapPosition(current, position)
        ? current
        : { x: position.x, z: position.z, angle: position.angle }
    ));
    applyPlayerIconRotation(playerIconRef.current, position.angle);
    applyPlayerIconRotation(expandedPlayerIconRef.current, position.angle);
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      hasPendingMoveRef.current = false;
      if (moveRafRef.current !== null) {
        window.cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
      return;
    }

    const applyPlayerMove = (frameTime: number) => {
      moveRafRef.current = null;
      if (!hasPendingMoveRef.current) return;
      hasPendingMoveRef.current = false;

      const move = pendingMoveRef.current;
      const position = currentPositionRef.current;
      position.x = move.x;
      position.z = move.z;
      position.angle = move.angle;
      if (!isVisibleRef.current || isHudMapSuppressedByToolOverlay()) return;

      if (frameTime - lastStateUpdateRef.current > STATE_UPDATE_INTERVAL_MS) {
        lastStateUpdateRef.current = frameTime;
        const roundedX = Math.round(position.x);
        const roundedZ = Math.round(position.z);
        setDisplayCoords((current) => (
          current.x === roundedX && current.z === roundedZ
            ? current
            : { x: roundedX, z: roundedZ }
        ));
        setPlayerPosition((current) => (
          sameLiveMapPosition(current, position)
            ? current
            : { x: position.x, z: position.z, angle: position.angle }
        ));
      }

      if (mobilePerformanceMode && frameTime - lastDomMoveUpdateRef.current < MOBILE_DOM_UPDATE_INTERVAL_MS) return;
      lastDomMoveUpdateRef.current = frameTime;

      applyPlayerIconRotation(playerIconRef.current, position.angle);
      applyPlayerIconRotation(expandedPlayerIconRef.current, position.angle);
    };

    const handlePlayerMove = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      const previous = currentPositionRef.current;
      const pendingMove = pendingMoveRef.current;
      pendingMove.x = toFiniteNumber(detail.x, previous.x);
      pendingMove.z = toFiniteNumber(detail.z, previous.z);
      pendingMove.angle = toFiniteNumber(detail.angle, previous.angle);
      hasPendingMoveRef.current = true;
      if (moveRafRef.current === null) {
        moveRafRef.current = window.requestAnimationFrame(applyPlayerMove);
      }
    };

    window.addEventListener("player-moved", handlePlayerMove);
    return () => {
      window.removeEventListener("player-moved", handlePlayerMove);
      hasPendingMoveRef.current = false;
      if (moveRafRef.current !== null) window.cancelAnimationFrame(moveRafRef.current);
    };
  }, [isVisible, mobilePerformanceMode]);

  return {
    displayCoords,
    expandedPlayerIconRef,
    playerIconRef,
    playerPosition,
  };
}
