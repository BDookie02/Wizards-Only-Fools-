import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { SURVIVAL_BLOCK_SIZE, getActiveQuestNavigationTargets, useGameStore, type ExpandedMapPage, type MapWaypoint } from "../store/gameStore";
import { getGamepadAxis, getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from "../game/controllerInput";
import { isMobilePerformanceMode } from "../game/performanceMode";

type LiveMapPosition = {
  x: number;
  z: number;
  angle: number;
};

const FULL_MAP_IMAGE_SRC = "/maps/dagamemap.png";
const FULL_MAP_ASPECT_RATIO = "4096 / 2979";
const FULL_MAP_BOUNDS = {
  minX: -2304,
  maxX: 3328,
  minZ: -2304,
  maxZ: 1792,
};
const LOCAL_MINIMAP_WORLD_RADIUS = 80;

type VillageFastTravelTarget = {
  key: string;
  label: string;
  x: number;
  y: number;
  z: number;
};

type FullMapLandmarkLabel = {
  key: string;
  label: string;
  x: number;
  z: number;
};

type MapControlId = "page-live" | "page-world" | "close" | "clear-waypoint" | `travel-${string}`;
type MapDirection = "up" | "down" | "left" | "right";

const MAP_CONTROLLER_AXIS_THRESHOLD = 0.72;
const MAP_CONTROLLER_REPEAT_FIRST_DELAY = 320;
const MAP_CONTROLLER_REPEAT_DELAY = 180;

const VILLAGE_FAST_TRAVEL_TARGETS: VillageFastTravelTarget[] = [
  { key: "base", label: "BASE", x: 0, y: 15, z: 30 },
  { key: "chicago", label: "CHICAGO", x: -3 * SURVIVAL_BLOCK_SIZE, y: 140, z: -3 * SURVIVAL_BLOCK_SIZE + 214 },
  { key: "swamp", label: "SWAMP", x: 0, y: 140, z: -3 * SURVIVAL_BLOCK_SIZE + 214 },
  { key: "desert", label: "DESERT", x: 4 * SURVIVAL_BLOCK_SIZE, y: 140, z: -4 * SURVIVAL_BLOCK_SIZE + 214 },
  { key: "mountain", label: "MOUNTAIN", x: 3 * SURVIVAL_BLOCK_SIZE, y: 270, z: 62 },
  { key: "graveyard", label: "GRAVEYARD", x: 5 * SURVIVAL_BLOCK_SIZE, y: 92, z: 2 * SURVIVAL_BLOCK_SIZE + 132 },
];

const FULL_MAP_LANDMARK_LABELS: FullMapLandmarkLabel[] = [
  { key: "chicago", label: "Chicago city", x: -3 * SURVIVAL_BLOCK_SIZE, z: -3 * SURVIVAL_BLOCK_SIZE },
  { key: "swamp", label: "Swamp village", x: 0, z: -3 * SURVIVAL_BLOCK_SIZE },
  { key: "desert", label: "Desert village", x: 4 * SURVIVAL_BLOCK_SIZE, z: -4 * SURVIVAL_BLOCK_SIZE },
  { key: "base", label: "Base village", x: 0, z: 0 },
  { key: "mountain", label: "Mountain village", x: 3 * SURVIVAL_BLOCK_SIZE, z: 0 },
  { key: "graveyard", label: "Graveyard", x: 5 * SURVIVAL_BLOCK_SIZE, z: 2 * SURVIVAL_BLOCK_SIZE },
];

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getFullMapMarkerPosition(point: MapWaypoint) {
  return {
    left: clampPercent(((point.x - FULL_MAP_BOUNDS.minX) / (FULL_MAP_BOUNDS.maxX - FULL_MAP_BOUNDS.minX)) * 100),
    top: clampPercent(((point.z - FULL_MAP_BOUNDS.minZ) / (FULL_MAP_BOUNDS.maxZ - FULL_MAP_BOUNDS.minZ)) * 100),
  };
}

function getSurvivalBlockCenter(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE) * SURVIVAL_BLOCK_SIZE;
}

function getSurvivalBlockBounds(position: LiveMapPosition) {
  const centerX = getSurvivalBlockCenter(position.x);
  const centerZ = getSurvivalBlockCenter(position.z);
  const halfBlock = SURVIVAL_BLOCK_SIZE / 2;
  return {
    minX: centerX - halfBlock,
    minZ: centerZ - halfBlock,
  };
}

function getBlockMapMarkerPosition(point: MapWaypoint, blockBounds: ReturnType<typeof getSurvivalBlockBounds>, insetPercent = 0) {
  const rawLeft = ((point.x - blockBounds.minX) / SURVIVAL_BLOCK_SIZE) * 100;
  const rawTop = ((point.z - blockBounds.minZ) / SURVIVAL_BLOCK_SIZE) * 100;
  const min = insetPercent;
  const max = 100 - insetPercent;
  return {
    left: Math.min(max, Math.max(min, rawLeft)),
    top: Math.min(max, Math.max(min, rawTop)),
    pinned: rawLeft < min || rawLeft > max || rawTop < min || rawTop > max,
  };
}

function getWaypointNavigationMarker(
  waypoint: MapWaypoint | null,
  playerPosition: LiveMapPosition,
  radiusPercent: number,
) {
  if (!waypoint) return null;
  const dx = waypoint.x - playerPosition.x;
  const dz = waypoint.z - playerPosition.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 1) {
    return { left: 50, top: 50, distance, pinned: false };
  }

  const scale = Math.min(1, LOCAL_MINIMAP_WORLD_RADIUS / distance);
  const edgeScale = distance > LOCAL_MINIMAP_WORLD_RADIUS ? 0.92 : 1;
  const markerRadius = radiusPercent * scale * edgeScale;
  return {
    left: 50 + (dx / distance) * markerRadius,
    top: 50 + (dz / distance) * markerRadius,
    distance,
    pinned: distance > LOCAL_MINIMAP_WORLD_RADIUS,
  };
}

function isEditableMapTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

function scrollFocusedControlIntoPanel(panel: HTMLDivElement, control: HTMLButtonElement) {
  const panelRect = panel.getBoundingClientRect();
  const controlRect = control.getBoundingClientRect();
  const margin = 10;
  if (controlRect.top < panelRect.top + margin) {
    panel.scrollTop -= panelRect.top + margin - controlRect.top;
  } else if (controlRect.bottom > panelRect.bottom - margin) {
    panel.scrollTop += controlRect.bottom - (panelRect.bottom - margin);
  }
}

function findDirectionalMapControlId(
  controls: Map<MapControlId, HTMLButtonElement>,
  visibleIds: MapControlId[],
  currentId: MapControlId,
  direction: MapDirection,
) {
  const fallbackId = visibleIds.find((id) => controls.get(id)) ?? currentId;
  const currentControl = controls.get(currentId) ?? controls.get(fallbackId);
  if (!currentControl) return fallbackId;

  const currentRect = currentControl.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  let bestId: MapControlId | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  visibleIds.forEach((id) => {
    if (id === currentId) return;
    const control = controls.get(id);
    if (!control) return;
    const rect = control.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = centerX - currentCenterX;
    const dy = centerY - currentCenterY;
    const mainDistance =
      direction === "up" ? -dy :
        direction === "down" ? dy :
          direction === "left" ? -dx :
            dx;
    if (mainDistance <= 4) return;

    const crossDistance = direction === "up" || direction === "down" ? Math.abs(dx) : Math.abs(dy);
    const overlap =
      direction === "up" || direction === "down"
        ? Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left))
        : Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top));
    const overlapBonus = overlap > 0 ? -160 : 0;
    const score = mainDistance * 10 + crossDistance + overlapBonus;
    if (score < bestScore) {
      bestScore = score;
      bestId = id;
    }
  });

  return bestId ?? currentId;
}

export function MiniMap() {
  const isExpanded = useGameStore(s => s.isMapExpanded);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isPauseMenuOpen = useGameStore(s => s.isPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const expandedMapPage = useGameStore(s => s.expandedMapPage);
  const mapWaypoint = useGameStore(s => s.mapWaypoint);
  const questFlags = useGameStore(s => s.questFlags);
  const spellQuestAssignments = useGameStore(s => s.spellQuestAssignments);
  const questUnlockedSpells = useGameStore(s => s.questUnlockedSpells);
  const questNpcPrograms = useGameStore(s => s.questNpcPrograms);
  const toggleMap = useGameStore(s => s.toggleMap);
  const setExpandedMapPage = useGameStore(s => s.setExpandedMapPage);
  const setMapWaypoint = useGameStore(s => s.setMapWaypoint);
  const clearMapWaypoint = useGameStore(s => s.clearMapWaypoint);
  const controllerBindings = useGameStore(s => s.controllerBindings);
  const smallMapSize = 'var(--live-minimap-size, clamp(82px, 18vmin, 176px))';
  const smallMapInset = 'var(--live-minimap-inset, clamp(8px, 2vmin, 16px))';
  
  // Refs to avoid re-renders at 60fps
  const playerIconRef = useRef<HTMLDivElement>(null);
  const expandedPlayerIconRef = useRef<HTMLDivElement>(null);
  const mobilePerformanceMode = useRef(isMobilePerformanceMode());
  const pendingMoveRef = useRef<LiveMapPosition | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const lastDomMoveUpdate = useRef(0);
  const lastMapToggleRef = useRef(0);
  const mapControlRefs = useRef(new Map<MapControlId, HTMLButtonElement>());
  const villageControlsRef = useRef<HTMLDivElement>(null);
  const controllerFocusIdRef = useRef<MapControlId>("page-live");
  const visibleMapControlIdsRef = useRef<MapControlId[]>(["page-live", "page-world", "close"]);

  const [displayCoords, setDisplayCoords] = useState({ x: 0, z: 0 });
  const [playerPosition, setPlayerPosition] = useState<LiveMapPosition>({ x: 0, z: 0, angle: 0 });
  const [fullMapUnavailable, setFullMapUnavailable] = useState(false);
  const [controllerFocusId, setControllerFocusId] = useState<MapControlId>("page-live");
  const lastUpdate = useRef(0);

  const setControllerFocus = useCallback((id: MapControlId) => {
    controllerFocusIdRef.current = id;
    setControllerFocusId(id);
  }, []);

  const requestMapToggle = useCallback(() => {
    const now = performance.now();
    if (now - lastMapToggleRef.current < 180) return;
    lastMapToggleRef.current = now;
    startTransition(toggleMap);
  }, [toggleMap]);

  const setMapControlRef = useCallback((id: MapControlId) => (node: HTMLButtonElement | null) => {
    if (node) {
      mapControlRefs.current.set(id, node);
    } else {
      mapControlRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const applyPlayerMove = () => {
      moveRafRef.current = null;
      const move = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (!move) return;

      const { x, z, angle } = move;
      const now = Date.now();
      if (now - lastUpdate.current > 100) {
        lastUpdate.current = now;
        setDisplayCoords({ x: Math.round(x), z: Math.round(z) });
        setPlayerPosition({ x, z, angle });
      }

      const domNow = performance.now();
      if (mobilePerformanceMode.current && domNow - lastDomMoveUpdate.current < 1000 / 15) return;
      lastDomMoveUpdate.current = domNow;
      
      const playerIcon = playerIconRef.current;
      if (playerIcon) {
        playerIcon.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      }
      
      const expandedIcon = expandedPlayerIconRef.current;
      if (expandedIcon) {
        expandedIcon.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      }
    };

    const handlePlayerMove = (e: Event) => {
      const { x, z, angle } = (e as CustomEvent).detail;
      pendingMoveRef.current = { x, z, angle };
      if (moveRafRef.current === null) {
        moveRafRef.current = window.requestAnimationFrame(applyPlayerMove);
      }
    };

    window.addEventListener('player-moved', handlePlayerMove);
    return () => {
      window.removeEventListener('player-moved', handlePlayerMove);
      if (moveRafRef.current !== null) window.cancelAnimationFrame(moveRafRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || isEditableMapTarget(e.target)) return;
      if (e.key === 'm' || e.key === 'M') {
        const state = useGameStore.getState();
        if (state.isSpellMenuOpen || state.isPauseMenuOpen || state.isScoreboardOpen) return;
        e.preventDefault();
        requestMapToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestMapToggle]);

  const openMapFromMiniMap = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const state = useGameStore.getState();
    if (state.isSpellMenuOpen || state.isPauseMenuOpen || state.isScoreboardOpen || state.isMapExpanded) return;
    requestMapToggle();
  };

  const openMapFromKeyboard = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    const state = useGameStore.getState();
    if (state.isSpellMenuOpen || state.isPauseMenuOpen || state.isScoreboardOpen || state.isMapExpanded) return;
    requestMapToggle();
  };

  const fullMapPlayerMarker = getFullMapMarkerPosition(playerPosition);
  const fullMapWaypointMarker = mapWaypoint ? getFullMapMarkerPosition(mapWaypoint) : null;
  const questNavigationTargets = useMemo(() => getActiveQuestNavigationTargets({
    spellQuestAssignments,
    questFlags,
    questUnlockedSpells,
    questNpcPrograms,
  }), [questFlags, questNpcPrograms, questUnlockedSpells, spellQuestAssignments]);
  const primaryQuestTarget = questNavigationTargets[0] ?? null;
  const compactWaypointMarker = getWaypointNavigationMarker(mapWaypoint, playerPosition, 38);
  const currentBlockBounds = getSurvivalBlockBounds(playerPosition);
  const expandedPlayerMarker = getBlockMapMarkerPosition(playerPosition, currentBlockBounds, 0);
  const expandedWaypointMarker = mapWaypoint ? getBlockMapMarkerPosition(mapWaypoint, currentBlockBounds, 4) : null;
  const waypointDistance = mapWaypoint ? Math.round(Math.hypot(mapWaypoint.x - playerPosition.x, mapWaypoint.z - playerPosition.z)) : null;
  const questDistance = primaryQuestTarget ? Math.round(Math.hypot(primaryQuestTarget.x - playerPosition.x, primaryQuestTarget.z - playerPosition.z)) : null;
  const compactStatusText = waypointDistance === null
    ? questDistance === null
      ? `X:${displayCoords.x} Z:${displayCoords.z}`
      : `Q ${questDistance}m`
    : `WP ${waypointDistance}m`;
  const expandedWorldStatusText = waypointDistance === null
    ? questDistance === null
      ? `WORLD X:${displayCoords.x} Z:${displayCoords.z}`
      : `QUEST ${questDistance}m`
    : `WP ${waypointDistance}m`;
  const expandedLiveStatusText = waypointDistance === null
    ? questDistance === null
      ? `LIVE X:${displayCoords.x} Z:${displayCoords.z}`
      : `QUEST ${questDistance}m`
    : `WP ${waypointDistance}m`;
  const visibleMapControlIds = useMemo<MapControlId[]>(() => {
    const ids: MapControlId[] = ["page-live", "page-world"];
    if (expandedMapPage === "world") {
      VILLAGE_FAST_TRAVEL_TARGETS.forEach((target) => ids.push(`travel-${target.key}`));
      if (mapWaypoint) ids.push("clear-waypoint");
    }
    ids.push("close");
    return ids;
  }, [expandedMapPage, mapWaypoint]);
  const expandedMapFrameStyle = expandedMapPage === 'world'
    ? { width: 'min(92cqw, calc(82cqh * 4096 / 2979), 1120px)', aspectRatio: FULL_MAP_ASPECT_RATIO }
    : { width: 'min(80cqw, 80cqh, 800px)', aspectRatio: '1 / 1' };
  const controllerFocusClass = (id: MapControlId) => (
    isExpanded && controllerFocusId === id
      ? " ring-2 ring-amber-300 ring-offset-2 ring-offset-black"
      : ""
  );
  const mapPageButtonClass = (page: ExpandedMapPage) => [
    "border-2 px-3 py-1 font-mono text-[clamp(0.62rem,1.35cqw,0.82rem)] tracking-[0.14em] transition-colors pointer-events-auto",
    expandedMapPage === page
      ? "border-cyan-200 bg-cyan-200 text-[#10151d]"
      : "border-[#666] bg-black/70 text-cyan-100 hover:border-cyan-100 hover:bg-[#202a33]",
  ].join(" ");
  const mapCommandButtonClass = "min-h-[30px] border-2 border-[#666] bg-black/75 px-2.5 py-1 font-mono text-[clamp(0.56rem,1.05cqw,0.76rem)] tracking-[0.1em] text-cyan-100 shadow-[2px_2px_0_#120a18] transition-colors hover:border-cyan-100 hover:bg-[#202a33] pointer-events-auto";

  const handleFullMapPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (expandedMapPage !== 'world' || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const zRatio = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setMapWaypoint({
      x: FULL_MAP_BOUNDS.minX + xRatio * (FULL_MAP_BOUNDS.maxX - FULL_MAP_BOUNDS.minX),
      z: FULL_MAP_BOUNDS.minZ + zRatio * (FULL_MAP_BOUNDS.maxZ - FULL_MAP_BOUNDS.minZ),
    });
  };

  const fastTravelToVillage = (target: VillageFastTravelTarget) => {
    setControllerFocus(`travel-${target.key}`);
    window.dispatchEvent(new CustomEvent('teleportPlayer', {
      detail: { x: target.x, y: target.y, z: target.z },
    }));
    requestMapToggle();
  };

  useEffect(() => {
    if (!isExpanded) return;
    visibleMapControlIdsRef.current = visibleMapControlIds;
    const current = controllerFocusIdRef.current;
    if (!visibleMapControlIds.includes(current)) {
      setControllerFocus(visibleMapControlIds[0] ?? "page-live");
    }
  }, [isExpanded, setControllerFocus, visibleMapControlIds]);

  useEffect(() => {
    visibleMapControlIdsRef.current = visibleMapControlIds;
  }, [visibleMapControlIds]);

  useEffect(() => {
    controllerFocusIdRef.current = controllerFocusId;
  }, [controllerFocusId]);

  const focusCurrentMapControl = useCallback(() => {
    const control = mapControlRefs.current.get(controllerFocusIdRef.current);
    if (!control) return;
    control.focus({ preventScroll: true });
    const villagePanel = villageControlsRef.current;
    if (villagePanel?.contains(control)) {
      scrollFocusedControlIntoPanel(villagePanel, control);
    }
  }, []);

  useEffect(() => {
    if (!isExpanded || isSpellMenuOpen || isPauseMenuOpen || isScoreboardOpen) return;
    focusCurrentMapControl();
  }, [controllerFocusId, expandedMapPage, focusCurrentMapControl, isExpanded, isPauseMenuOpen, isScoreboardOpen, isSpellMenuOpen, mapWaypoint]);

  useEffect(() => {
    if (!isExpanded || isSpellMenuOpen || isPauseMenuOpen || isScoreboardOpen) return undefined;

    const buttonDownRef: Partial<Record<string, boolean>> = {};
    const repeatAtRef: Record<string, number> = {};
    let ignoreNavigationUntilNeutral = true;
    let raf = 0;

    const consumePress = (key: string, pressed: boolean) => {
      const wasPressed = buttonDownRef[key] ?? false;
      buttonDownRef[key] = pressed;
      return pressed && !wasPressed;
    };

    const consumeRepeat = (
      key: string,
      pressed: boolean,
      firstDelay = MAP_CONTROLLER_REPEAT_FIRST_DELAY,
      repeatDelay = MAP_CONTROLLER_REPEAT_DELAY,
    ) => {
      const now = performance.now();
      const wasPressed = buttonDownRef[key] ?? false;
      buttonDownRef[key] = pressed;

      if (!pressed) {
        delete repeatAtRef[key];
        return false;
      }

      if (!wasPressed) {
        repeatAtRef[key] = now + firstDelay;
        return true;
      }

      if (now >= (repeatAtRef[key] ?? 0)) {
        repeatAtRef[key] = now + repeatDelay;
        return true;
      }

      return false;
    };

    const moveFocus = (direction: MapDirection) => {
      const ids = visibleMapControlIdsRef.current;
      if (ids.length === 0) return;
      const current = controllerFocusIdRef.current;
      setControllerFocus(findDirectionalMapControlId(mapControlRefs.current, ids, current, direction));
    };

    const pollMapController = () => {
      const gamepad = getPrimaryGamepad();
      const leftPagePressed = consumePress(
        "mapPageLeft",
        isGamepadButtonPressed(gamepad, "leftBumper") || isGamepadButtonPressed(gamepad, "leftTrigger"),
      );
      const rightPagePressed = consumePress(
        "mapPageRight",
        isGamepadButtonPressed(gamepad, "rightBumper") || isGamepadButtonPressed(gamepad, "rightTrigger"),
      );
      const selectPressed = consumePress("mapSelect", isGamepadButtonPressed(gamepad, controllerBindings.menuSelect as GamepadButtonName));
      const backPressed = consumePress("mapBack", isGamepadButtonPressed(gamepad, controllerBindings.menuBack as GamepadButtonName));
      const axisX = getGamepadAxis(gamepad, 0, 0.55);
      const axisY = getGamepadAxis(gamepad, 1, 0.55);
      const navUpHeld = isGamepadButtonPressed(gamepad, "dpadUp") || axisY < -MAP_CONTROLLER_AXIS_THRESHOLD;
      const navDownHeld = isGamepadButtonPressed(gamepad, "dpadDown") || axisY > MAP_CONTROLLER_AXIS_THRESHOLD;
      const navLeftHeld = isGamepadButtonPressed(gamepad, "dpadLeft") || axisX < -MAP_CONTROLLER_AXIS_THRESHOLD;
      const navRightHeld = isGamepadButtonPressed(gamepad, "dpadRight") || axisX > MAP_CONTROLLER_AXIS_THRESHOLD;
      const navHeld = navUpHeld || navDownHeld || navLeftHeld || navRightHeld;
      if (ignoreNavigationUntilNeutral) {
        if (!navHeld) ignoreNavigationUntilNeutral = false;
      }
      const upPressed = !ignoreNavigationUntilNeutral && consumeRepeat("mapUp", navUpHeld);
      const downPressed = !ignoreNavigationUntilNeutral && consumeRepeat("mapDown", navDownHeld);
      const leftPressed = !ignoreNavigationUntilNeutral && consumeRepeat("mapLeft", navLeftHeld);
      const rightPressed = !ignoreNavigationUntilNeutral && consumeRepeat("mapRight", navRightHeld);

      if (leftPagePressed) {
        setExpandedMapPage("live");
        setControllerFocus("page-live");
      } else if (rightPagePressed) {
        setExpandedMapPage("world");
        setControllerFocus("page-world");
      } else if (upPressed && visibleMapControlIdsRef.current.length > 0) {
        moveFocus("up");
      } else if (downPressed && visibleMapControlIdsRef.current.length > 0) {
        moveFocus("down");
      } else if (leftPressed && visibleMapControlIdsRef.current.length > 0) {
        moveFocus("left");
      } else if (rightPressed && visibleMapControlIdsRef.current.length > 0) {
        moveFocus("right");
      }

      if (selectPressed) {
        mapControlRefs.current.get(controllerFocusIdRef.current)?.click();
      } else if (backPressed) {
        requestMapToggle();
      }

      raf = window.requestAnimationFrame(pollMapController);
    };

    raf = window.requestAnimationFrame(pollMapController);
    return () => window.cancelAnimationFrame(raf);
  }, [
    controllerBindings.menuBack,
    controllerBindings.menuSelect,
    isExpanded,
    isPauseMenuOpen,
    isScoreboardOpen,
    isSpellMenuOpen,
    requestMapToggle,
    setExpandedMapPage,
    setControllerFocus,
  ]);

  return (
    <>
      {/* HUD Minimap Label (Top Right) - Map rendering is done in LiveMiniMap */}
      {!isExpanded && !isSpellMenuOpen && !isPauseMenuOpen && !isScoreboardOpen && (
        <div
          data-testid="minimap-toggle"
          role="button"
          tabIndex={0}
          aria-label="Open map"
          className="minimap-label absolute pointer-events-auto z-[95] flex cursor-pointer items-center justify-center filter drop-shadow-[0_2px_4px_black]"
          style={{
            top: smallMapInset,
            right: smallMapInset,
            width: smallMapSize,
            height: smallMapSize,
            touchAction: 'manipulation',
          }}
          onPointerDown={openMapFromMiniMap}
          onKeyDown={openMapFromKeyboard}
        >
           <div className="absolute top-1 left-1/2 -translate-x-1/2 text-amber-500 text-[10px] font-serif font-bold drop-shadow-[0_2px_2px_black] z-10">N</div>
           <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-amber-500 text-[10px] font-serif font-bold drop-shadow-[0_2px_2px_black] z-10">S</div>
           <div className="absolute top-1/2 right-1 -translate-y-1/2 text-amber-500 text-[10px] font-serif font-bold drop-shadow-[0_2px_2px_black] z-10">E</div>
           <div className="absolute top-1/2 left-1 -translate-y-1/2 text-amber-500 text-[10px] font-serif font-bold drop-shadow-[0_2px_2px_black] z-10">W</div>

           {/* The exact center of the 192x192 minimap is the player in the local minimap */}
           <div className="absolute z-[250] filter drop-shadow-[0_2px_4px_black]"
             id="minimap-player-icon"
             ref={playerIconRef}
             style={{
                left: '50%',
                top: '50%',
                width: '16px',
                height: '24px',
                transformOrigin: '50% 50%',
                transform: `translate(-50%, -50%)`
             }}>
             <svg width="100%" height="100%" viewBox="0 0 16 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
               <path d="M8 2L14 20L8 16L2 20L8 2Z" fill="#ffeb3b" stroke="black" strokeWidth="2" strokeLinejoin="round"/>
             </svg>
           </div>

           {compactWaypointMarker && (
             <div
               className="absolute z-[240] flex h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-amber-300 shadow-[0_0_8px_rgba(255,235,59,0.7)]"
               style={{
                 left: `${compactWaypointMarker.left}%`,
                 top: `${compactWaypointMarker.top}%`,
                 opacity: compactWaypointMarker.pinned ? 1 : 0.88,
               }}
               aria-hidden="true"
             >
               <div className="h-2.5 w-2.5 rotate-45 bg-cyan-500" />
             </div>
           )}

           <div className="minimap-coords absolute -bottom-1 left-1/2 -translate-x-1/2 text-center w-full flex justify-center z-10">
             <span className="bg-black/80 text-[8px] leading-none text-white px-1.5 py-px rounded-full font-mono tracking-wide drop-shadow-[2px_2px_0_theme(colors.black)]">
               {compactStatusText}
             </span>
           </div>

           <div className="minimap-open-hint absolute right-0 z-10 flex justify-end" style={{ bottom: 'calc(-1 * clamp(26px, 5.5vmin, 40px))' }}>
             <div
               className="bg-black text-[#888] px-1.5 py-0.5 border-2 border-[#555] font-mono whitespace-nowrap"
               style={{ fontSize: 'clamp(7px, 1.4vmin, 10px)' }}
             >
                TAP MAP / M
             </div>
           </div>
        </div>
      )}

      {/* Expanded Large Map Modal (DOOM Full Screen Map Style) */}
      {isExpanded && !isSpellMenuOpen && (
        <div className="absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
           <div className="map-expanded-title absolute left-[clamp(12px,3cqw,24px)] top-[clamp(12px,3cqh,24px)] z-40 flex flex-col gap-1 font-mono uppercase drop-shadow-[2px_2px_0_theme(colors.black)]">
            <div className="text-[clamp(1rem,3.1cqw,2rem)] tracking-[0.16em] text-white">
              {expandedMapPage === 'world' ? 'World Map' : 'Live Map'}
            </div>
            <div className="text-[clamp(0.6rem,1.4cqw,0.85rem)] tracking-[0.18em] text-cyan-100">
              X:{displayCoords.x} Z:{displayCoords.z}
            </div>
           </div>
           <div className="map-page-tabs absolute left-1/2 top-[clamp(12px,3cqh,24px)] z-40 flex -translate-x-1/2 gap-2">
             <button
               type="button"
               aria-pressed={expandedMapPage === 'live'}
               ref={setMapControlRef("page-live")}
               className={`${mapPageButtonClass('live')}${controllerFocusClass("page-live")}`}
               onClick={() => {
                 setExpandedMapPage('live');
                 setControllerFocus("page-live");
               }}
             >
               LOCAL
             </button>
             <button
               type="button"
               aria-pressed={expandedMapPage === 'world'}
               ref={setMapControlRef("page-world")}
               className={`${mapPageButtonClass('world')}${controllerFocusClass("page-world")}`}
               onClick={() => {
                 setExpandedMapPage('world');
                 setControllerFocus("page-world");
               }}
             >
               FULL MAP
             </button>
           </div>
           <button 
             ref={setMapControlRef("close")}
             className={`map-close-button absolute right-[clamp(12px,3cqw,24px)] top-[clamp(12px,3cqh,24px)] z-40 border-4 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-1.5 font-mono text-[clamp(0.75rem,1.9cqw,1.25rem)] tracking-wider text-white hover:bg-[#666] pointer-events-auto${controllerFocusClass("close")}`}
             onClick={() => {
               setControllerFocus("close");
               requestMapToggle();
             }}
           >
             CLOSE
           </button>
           {expandedMapPage === 'world' && (
             <div
               ref={villageControlsRef}
               className="map-village-controls absolute bottom-[clamp(12px,3cqh,24px)] left-[clamp(12px,3cqw,24px)] z-30 grid max-h-[min(44cqh,340px)] w-[clamp(232px,30cqw,348px)] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain pointer-events-auto"
             >
               <div className="col-span-2 border-2 border-[#76628a] bg-black/80 px-2 py-1 font-mono text-[clamp(0.56rem,1.15cqw,0.76rem)] tracking-[0.14em] text-amber-200 shadow-[2px_2px_0_#120a18]">
                 VILLAGES
               </div>
               {VILLAGE_FAST_TRAVEL_TARGETS.map((target) => (
                 <button
                   key={target.key}
                   type="button"
                   ref={setMapControlRef(`travel-${target.key}`)}
                   className={`${mapCommandButtonClass}${controllerFocusClass(`travel-${target.key}`)}`}
                   onClick={() => fastTravelToVillage(target)}
                 >
                   {target.label}
                 </button>
               ))}
               {mapWaypoint && (
                 <>
                   <div className="col-span-2 mt-1 border-2 border-[#76628a] bg-black/80 px-2 py-1 font-mono text-[clamp(0.52rem,1.05cqw,0.72rem)] tracking-[0.12em] text-cyan-100 shadow-[2px_2px_0_#120a18]">
                     WP {Math.round(mapWaypoint.x)} {Math.round(mapWaypoint.z)}
                   </div>
                   <button
                     type="button"
                     ref={setMapControlRef("clear-waypoint")}
                     className={`col-span-2 ${mapCommandButtonClass}${controllerFocusClass("clear-waypoint")}`}
                     onClick={() => {
                       setControllerFocus("clear-waypoint");
                       clearMapWaypoint();
                     }}
                   >
                     CLEAR WP
                   </button>
                 </>
               )}
             </div>
           )}
           <div
             className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden border-4 border-[#6d517d] shadow-[0_0_0_4px_#18101f,0_0_32px_rgba(0,0,0,0.85)] pointer-events-auto"
             style={expandedMapFrameStyle}
             aria-label={expandedMapPage === 'world' ? 'Expanded full world map' : 'Expanded live map'}
             onPointerDown={handleFullMapPointerDown}
           >
             {expandedMapPage === 'world' ? (
               <>
                 {fullMapUnavailable ? (
                   <div className="absolute inset-0 flex items-center justify-center bg-black font-mono text-[clamp(0.8rem,1.6cqw,1.1rem)] tracking-[0.18em] text-amber-200">
                     MAP UNAVAILABLE
                   </div>
                 ) : (
                   <img
                     src={FULL_MAP_IMAGE_SRC}
                     crossOrigin="anonymous"
                     alt=""
                     draggable={false}
                     className="absolute inset-0 h-full w-full object-cover"
                     onError={() => setFullMapUnavailable(true)}
                   />
                 )}
                 <div className="absolute inset-0 border border-cyan-200/20" />
                 <div className="absolute left-1/2 top-2 z-20 -translate-x-1/2 font-serif text-[clamp(0.7rem,1.4cqw,1rem)] font-bold text-amber-300 drop-shadow-[0_2px_2px_black]">N</div>
                 {FULL_MAP_LANDMARK_LABELS.map((landmark) => {
                   const marker = getFullMapMarkerPosition(landmark);
                   return (
                     <div
                       key={landmark.key}
                       className="absolute z-20 max-w-[clamp(92px,13cqw,172px)] -translate-x-1/2 -translate-y-1/2 rounded border-2 border-black bg-black/85 px-2 py-1 text-center font-mono text-[clamp(0.68rem,1.08cqw,0.96rem)] font-bold leading-tight text-amber-100 shadow-[2px_2px_0_#120a18] pointer-events-none"
                       style={{
                         left: `${marker.left}%`,
                         top: `${marker.top}%`,
                       }}
                     >
                       {landmark.label}
                     </div>
                   );
                 })}
                 <div
                   className="absolute z-20 h-7 w-7 filter drop-shadow-[0_2px_5px_black]"
                   style={{
                     left: `${fullMapPlayerMarker.left}%`,
                     top: `${fullMapPlayerMarker.top}%`,
                     transformOrigin: '50% 50%',
                     transform: `translate(-50%, -50%) rotate(${playerPosition.angle}rad)`,
                   }}
                 >
                   <svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                     <path d="M20 3L34 35L20 27L6 35L20 3Z" fill="#ffeb3b" stroke="black" strokeWidth="3" strokeLinejoin="round"/>
                     <path d="M20 8L25 25L20 22L15 25L20 8Z" fill="#00e5ff" />
                   </svg>
                 </div>
                 {fullMapWaypointMarker && (
                   <div
                     className="absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-amber-300 shadow-[0_0_10px_rgba(255,235,59,0.75)]"
                     style={{
                       left: `${fullMapWaypointMarker.left}%`,
                       top: `${fullMapWaypointMarker.top}%`,
                     }}
                     aria-hidden="true"
                   >
                     <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-cyan-500" />
                   </div>
                 )}
                 <div className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-2 border-[#76628a] bg-black/80 px-3 py-1 font-mono text-[clamp(0.58rem,1.2cqw,0.82rem)] tracking-[0.14em] text-cyan-100 shadow-[3px_3px_0_#120a18]">
                   {expandedWorldStatusText}
                 </div>
               </>
             ) : (
               <>
                 <div className="absolute inset-0 border border-cyan-200/20" />
                 <div
                   className="absolute inset-0 opacity-40"
                   style={{
                     backgroundImage: "linear-gradient(rgba(210,238,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(210,238,255,0.16) 1px, transparent 1px)",
                     backgroundSize: "12.5% 12.5%",
                   }}
                 />
                 <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-100/25" />
                 <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-cyan-100/25" />
                 <div className="absolute left-1/2 top-2 -translate-x-1/2 font-serif text-[clamp(0.8rem,1.8cqw,1.2rem)] font-bold text-amber-400 drop-shadow-[0_2px_2px_black]">N</div>
                 <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-serif text-[clamp(0.8rem,1.8cqw,1.2rem)] font-bold text-amber-400 drop-shadow-[0_2px_2px_black]">S</div>
                 <div className="absolute right-2 top-1/2 -translate-y-1/2 font-serif text-[clamp(0.8rem,1.8cqw,1.2rem)] font-bold text-amber-400 drop-shadow-[0_2px_2px_black]">E</div>
                 <div className="absolute left-2 top-1/2 -translate-y-1/2 font-serif text-[clamp(0.8rem,1.8cqw,1.2rem)] font-bold text-amber-400 drop-shadow-[0_2px_2px_black]">W</div>
                 <div
                   className="absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 filter drop-shadow-[0_2px_4px_black]"
                   id="minimap-expanded-player-icon"
                   ref={expandedPlayerIconRef}
                   style={{
                      left: `${expandedPlayerMarker.left}%`,
                      top: `${expandedPlayerMarker.top}%`,
                      transformOrigin: '50% 50%',
                      transform: `translate(-50%, -50%)`
                   }}
                 >
                   <svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                     <path d="M20 3L34 35L20 27L6 35L20 3Z" fill="#00e5ff" stroke="black" strokeWidth="3" strokeLinejoin="round"/>
                     <path d="M20 8L25 25L20 22L15 25L20 8Z" fill="#fff7a8" />
                   </svg>
                 </div>
                 {expandedWaypointMarker && (
                   <div
                     className="absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-amber-300 shadow-[0_0_10px_rgba(255,235,59,0.7)]"
                     style={{
                       left: `${expandedWaypointMarker.left}%`,
                       top: `${expandedWaypointMarker.top}%`,
                       opacity: expandedWaypointMarker.pinned ? 1 : 0.9,
                     }}
                     aria-hidden="true"
                   >
                     <div className="h-3 w-3 rotate-45 bg-cyan-500" />
                   </div>
                 )}
                 <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border-2 border-[#76628a] bg-black/80 px-3 py-1 font-mono text-[clamp(0.6rem,1.5cqw,0.9rem)] tracking-[0.16em] text-cyan-100 shadow-[3px_3px_0_#120a18]">
                   {expandedLiveStatusText}
                 </div>
               </>
             )}
           </div>
        </div>
      )}
    </>
  );
}
