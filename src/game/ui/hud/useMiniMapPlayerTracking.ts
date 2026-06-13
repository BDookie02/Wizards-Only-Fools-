import { useEffect, useRef, useState } from "react";
import { getPublishedLastPlayerYaw, getPublishedLocalPlayerPosition } from "../../systems/player/playerEventBridge";
import { isHudMapSuppressedByToolOverlay } from "./hudMapSuppressionRuntime";
import type { LiveMapPosition } from "./mapOverlayRuntime";
import {
  areLiveMapPositionsEqual,
  getMiniMapPlayerAngleCssValue,
  getRoundedMiniMapDisplayCoords,
  resolveMiniMapMoveDetail,
  syncMiniMapPositionWithPublishedState,
  type MiniMapDisplayCoords,
} from "./miniMapPlayerTrackingRuntime";

type MiniMapPlayerTrackingOptions = {
  isVisible: boolean;
  mobilePerformanceMode: boolean;
};

const STATE_UPDATE_INTERVAL_MS = 100;
const MOBILE_DOM_UPDATE_INTERVAL_MS = 1000 / 15;

function applyPlayerIconRotation(node: HTMLDivElement | null, angle: number) {
  if (!node) return;
  node.style.setProperty("--minimap-player-angle", getMiniMapPlayerAngleCssValue(angle));
}

function syncMiniMapPositionFromPublishedState(target: LiveMapPosition) {
  return syncMiniMapPositionWithPublishedState(
    target,
    getPublishedLocalPlayerPosition(),
    getPublishedLastPlayerYaw(),
  );
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
    const roundedCoords = getRoundedMiniMapDisplayCoords(position);
    setDisplayCoords((current) => (
      current.x === roundedCoords.x && current.z === roundedCoords.z
        ? current
        : roundedCoords
    ));
    setPlayerPosition((current) => (
      areLiveMapPositionsEqual(current, position)
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
        const roundedCoords = getRoundedMiniMapDisplayCoords(position);
        setDisplayCoords((current) => (
          current.x === roundedCoords.x && current.z === roundedCoords.z
            ? current
            : roundedCoords
        ));
        setPlayerPosition((current) => (
          areLiveMapPositionsEqual(current, position)
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
      const nextMove = resolveMiniMapMoveDetail(detail, previous);
      pendingMove.x = nextMove.x;
      pendingMove.z = nextMove.z;
      pendingMove.angle = nextMove.angle;
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
