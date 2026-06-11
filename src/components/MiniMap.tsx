import { startTransition, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { getActiveQuestNavigationTargets, useGameStore, type ExpandedMapPage } from "../store/gameStore";
import { isMobilePerformanceMode } from "../game/systems/input/performanceMode";
import { createControllerPollScheduler, GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS } from "../game/systems/input/controllerInput";
import {
  FULL_MAP_IMAGE_SRC,
  FULL_MAP_LANDMARK_LABELS,
  VILLAGE_FAST_TRAVEL_TARGETS,
  dispatchMapVillageFastTravel,
  findDirectionalMapControlId,
  getBlockMapMarkerPosition,
  getExpandedMapFrameStyle,
  getFullMapWaypointFromClientPoint,
  getFullMapMarkerPosition,
  getRoundedPlanarDistance,
  getSurvivalBlockBounds,
  getVisibleMapControlIds,
  getWaypointNavigationMarker,
  isMapControlIdVisible,
  scrollFocusedMapControlIntoPanel,
  shouldToggleMapFromKeyboardEvent,
  type MapControlId,
  type VillageFastTravelTarget,
} from "../game/ui/hud/mapOverlayRuntime";
import { getExpandedMapControllerPollResult, type MapDirection } from "../game/ui/hud/mapControllerRuntime";
import { canOpenCompactMap, isMapUiBlockedByModal } from "../game/ui/hud/mapVisibilityRuntime";
import { useMiniMapPlayerTracking } from "../game/ui/hud/useMiniMapPlayerTracking";

export function MiniMap() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.wofMiniMapMounted = "1";
    return () => {
      delete root.dataset.wofMiniMapMounted;
    };
  }, []);

  const isExpanded = useGameStore(s => s.isMapExpanded);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isPauseMenuOpen = useGameStore(s => s.isPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const isInventoryOpen = useGameStore(s => s.isInventoryOpen);
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
  const mapUiBlockedByModal = isMapUiBlockedByModal({
    isInventoryOpen,
    isPauseMenuOpen,
    isScoreboardOpen,
    isSpellMenuOpen,
  });
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  
  const lastMapToggleRef = useRef(0);
  const mapControlRefs = useRef(new Map<MapControlId, HTMLButtonElement>());
  const villageControlsRef = useRef<HTMLDivElement>(null);
  const controllerFocusIdRef = useRef<MapControlId>("page-live");
  const visibleMapControlIdsRef = useRef<MapControlId[]>(["page-live", "page-world", "close"]);

  const [fullMapUnavailable, setFullMapUnavailable] = useState(false);
  const [controllerFocusId, setControllerFocusId] = useState<MapControlId>("page-live");
  const {
    displayCoords,
    expandedPlayerIconRef,
    playerIconRef,
    playerPosition,
  } = useMiniMapPlayerTracking({
    isVisible: !mapUiBlockedByModal,
    mobilePerformanceMode,
  });

  const setControllerFocus = useCallback((id: MapControlId) => {
    controllerFocusIdRef.current = id;
    setControllerFocusId(id);
  }, []);

  const requestMapToggle = useCallback((timestamp: number) => {
    const now = timestamp;
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!shouldToggleMapFromKeyboardEvent(e)) return;
      const state = useGameStore.getState();
      if (!canOpenCompactMap(state)) return;
      e.preventDefault();
      requestMapToggle(e.timeStamp);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestMapToggle]);

  const openMapFromMiniMap = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const state = useGameStore.getState();
    if (!canOpenCompactMap(state)) return;
    requestMapToggle(e.timeStamp);
  };

  const openMapFromKeyboard = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.stopPropagation();
    const state = useGameStore.getState();
    if (!canOpenCompactMap(state)) return;
    requestMapToggle(e.timeStamp);
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
  const waypointDistance = mapWaypoint ? getRoundedPlanarDistance(mapWaypoint, playerPosition) : null;
  const questDistance = primaryQuestTarget ? getRoundedPlanarDistance(primaryQuestTarget, playerPosition) : null;
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
  const visibleMapControlIds = useMemo(
    () => getVisibleMapControlIds(expandedMapPage, Boolean(mapWaypoint)),
    [expandedMapPage, mapWaypoint],
  );
  const expandedMapFrameStyle = getExpandedMapFrameStyle(expandedMapPage);
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
    setMapWaypoint(getFullMapWaypointFromClientPoint(e.clientX, e.clientY, rect));
  };

  const fastTravelToVillage = (target: VillageFastTravelTarget, timestamp: number) => {
    setControllerFocus(`travel-${target.key}`);
    dispatchMapVillageFastTravel(target);
    requestMapToggle(timestamp);
  };

  useEffect(() => {
    if (!isExpanded) return;
    visibleMapControlIdsRef.current = visibleMapControlIds;
    const current = controllerFocusIdRef.current;
    if (!isMapControlIdVisible(visibleMapControlIds, current)) {
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
      scrollFocusedMapControlIntoPanel(villagePanel, control);
    }
  }, []);

  useEffect(() => {
    if (!isExpanded || mapUiBlockedByModal) return;
    focusCurrentMapControl();
  }, [controllerFocusId, expandedMapPage, focusCurrentMapControl, isExpanded, mapUiBlockedByModal, mapWaypoint]);

  useEffect(() => {
    if (!isExpanded || mapUiBlockedByModal) return undefined;

    const buttonDownRef = { current: {} as Record<string, boolean> };
    const repeatAtRef = { current: {} as Partial<Record<string, number>> };
    let ignoreNavigationUntilNeutral = true;
    let controllerPollScheduler: ReturnType<typeof createControllerPollScheduler>;

    const moveFocus = (direction: MapDirection) => {
      const ids = visibleMapControlIdsRef.current;
      if (ids.length === 0) return;
      const current = controllerFocusIdRef.current;
      setControllerFocus(findDirectionalMapControlId(mapControlRefs.current, ids, current, direction));
    };

    const pollMapController = (now: number) => {
      const controllerAction = getExpandedMapControllerPollResult({
        buttonDownRef,
        controllerBindings,
        ignoreNavigationUntilNeutral,
        now,
        repeatAtRef,
      });
      ignoreNavigationUntilNeutral = controllerAction.ignoreNavigationUntilNeutral;

      if (controllerAction.page === "live") {
        setExpandedMapPage("live");
        setControllerFocus("page-live");
      } else if (controllerAction.page === "world") {
        setExpandedMapPage("world");
        setControllerFocus("page-world");
      } else if (controllerAction.direction && visibleMapControlIdsRef.current.length > 0) {
        moveFocus(controllerAction.direction);
      }

      if (controllerAction.select) {
        mapControlRefs.current.get(controllerFocusIdRef.current)?.click();
      } else if (controllerAction.back) {
        requestMapToggle(now);
      }

      controllerPollScheduler.schedule(controllerAction.hasGamepad ? 0 : GAMEPAD_NO_DEVICE_POLL_INTERVAL_MS);
    };

    controllerPollScheduler = createControllerPollScheduler(pollMapController);
    controllerPollScheduler.schedule(0);
    return () => controllerPollScheduler.cancel();
  }, [
    controllerBindings.menuBack,
    controllerBindings.menuSelect,
    isExpanded,
    mapUiBlockedByModal,
    requestMapToggle,
    setExpandedMapPage,
    setControllerFocus,
  ]);

  return (
    <>
      {/* HUD Minimap Label (Top Right) - Map rendering is done in LiveMiniMap */}
      {!isExpanded && !mapUiBlockedByModal && (
        <div
          data-testid="minimap-toggle"
          data-wof-hud-qa="minimap-compact"
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
           <div className="minimap-compass-label minimap-compass-label-n absolute left-1/2 top-1 z-10 -translate-x-1/2 text-amber-500 drop-shadow-[0_2px_2px_black]">N</div>
           <div className="minimap-compass-label minimap-compass-label-s absolute bottom-1 left-1/2 z-10 -translate-x-1/2 text-amber-500 drop-shadow-[0_2px_2px_black]">S</div>
           <div className="minimap-compass-label minimap-compass-label-e absolute right-1 top-1/2 z-10 -translate-y-1/2 text-amber-500 drop-shadow-[0_2px_2px_black]">E</div>
           <div className="minimap-compass-label minimap-compass-label-w absolute left-1 top-1/2 z-10 -translate-y-1/2 text-amber-500 drop-shadow-[0_2px_2px_black]">W</div>

           {/* The exact center of the 192x192 minimap is the player in the local minimap */}
           <div className="minimap-player-icon absolute z-[250] filter drop-shadow-[0_2px_4px_black]"
             id="minimap-player-icon"
             ref={playerIconRef}
             style={{
                left: '50%',
                top: '50%',
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
      {isExpanded && !mapUiBlockedByModal && (
        <div data-wof-hud-qa="map-expanded" className="map-expanded-root absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
           <div className="map-expanded-topbar absolute left-[clamp(12px,3cqw,24px)] right-[clamp(12px,3cqw,24px)] top-[clamp(12px,3cqh,24px)] z-40 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
             <div className="map-expanded-title min-w-0 font-mono uppercase drop-shadow-[2px_2px_0_theme(colors.black)]">
              <div className="truncate text-[clamp(1rem,3.1cqw,2rem)] tracking-[0.16em] text-white">
                {expandedMapPage === 'world' ? 'World Map' : 'Live Map'}
              </div>
              <div className="map-expanded-coords truncate text-[clamp(0.6rem,1.4cqw,0.85rem)] tracking-[0.18em] text-cyan-100">
                X:{displayCoords.x} Z:{displayCoords.z}
              </div>
             </div>
             <div data-testid="map-page-tabs" className="map-page-tabs flex justify-self-center gap-2">
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
               className={`map-close-button justify-self-end border-4 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-1.5 font-mono text-[clamp(0.75rem,1.9cqw,1.25rem)] tracking-wider text-white hover:bg-[#666] pointer-events-auto${controllerFocusClass("close")}`}
               onClick={(event) => {
                 setControllerFocus("close");
                 requestMapToggle(event.timeStamp);
               }}
             >
               CLOSE
             </button>
           </div>
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
                   onClick={(event) => fastTravelToVillage(target, event.timeStamp)}
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
             data-testid="map-expanded-frame"
             className="map-expanded-frame absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden border-4 border-[#6d517d] shadow-[0_0_0_4px_#18101f,0_0_32px_rgba(0,0,0,0.85)] pointer-events-auto"
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
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => setFullMapUnavailable(true)}
                    />
                 )}
                 <div className="absolute inset-0 border border-cyan-200/20" />
                 <div className="map-compass-label absolute left-1/2 top-2 z-20 -translate-x-1/2 text-amber-300 drop-shadow-[0_2px_2px_black]">N</div>
                 {FULL_MAP_LANDMARK_LABELS.map((landmark) => {
                   const marker = getFullMapMarkerPosition(landmark);
                   return (
                     <div
                       key={landmark.key}
                       className="map-landmark-label absolute z-20 max-w-[clamp(92px,13cqw,172px)] -translate-x-1/2 -translate-y-1/2 rounded border-2 border-black bg-black/85 px-2 py-1 text-center font-mono text-[clamp(0.68rem,1.08cqw,0.96rem)] font-bold leading-tight text-amber-100 shadow-[2px_2px_0_#120a18] pointer-events-none"
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
                 <div className="map-expanded-status absolute bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap border-2 border-[#76628a] bg-black/80 px-3 py-1 font-mono text-[clamp(0.58rem,1.2cqw,0.82rem)] tracking-[0.14em] text-cyan-100 shadow-[3px_3px_0_#120a18]">
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
                 <div className="map-compass-label absolute left-1/2 top-2 -translate-x-1/2 text-amber-400 drop-shadow-[0_2px_2px_black]">N</div>
                 <div className="map-compass-label absolute bottom-2 left-1/2 -translate-x-1/2 text-amber-400 drop-shadow-[0_2px_2px_black]">S</div>
                 <div className="map-compass-label absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 drop-shadow-[0_2px_2px_black]">E</div>
                 <div className="map-compass-label absolute left-2 top-1/2 -translate-y-1/2 text-amber-400 drop-shadow-[0_2px_2px_black]">W</div>
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
                 <div className="map-expanded-status absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border-2 border-[#76628a] bg-black/80 px-3 py-1 font-mono text-[clamp(0.6rem,1.5cqw,0.9rem)] tracking-[0.16em] text-cyan-100 shadow-[3px_3px_0_#120a18]">
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
