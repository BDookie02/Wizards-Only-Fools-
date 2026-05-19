import { startTransition, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useGameStore } from "../store/gameStore";
import { isMobilePerformanceMode } from "../game/performanceMode";

type LiveMapPosition = {
  x: number;
  z: number;
  angle: number;
};

function isEditableMapTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
}

export function MiniMap() {
  const isExpanded = useGameStore(s => s.isMapExpanded);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isPauseMenuOpen = useGameStore(s => s.isPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const toggleMap = useGameStore(s => s.toggleMap);
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

  const [displayCoords, setDisplayCoords] = useState({ x: 0, z: 0 });
  const lastUpdate = useRef(0);

  const requestMapToggle = useCallback(() => {
    const now = performance.now();
    if (now - lastMapToggleRef.current < 180) return;
    lastMapToggleRef.current = now;
    startTransition(toggleMap);
  }, [toggleMap]);

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
           
           <div className="minimap-coords absolute -bottom-2 left-1/2 -translate-x-1/2 text-center w-full flex justify-center z-10">
             <span className="bg-black/80 text-[10px] text-white px-2 py-0.5 rounded-full font-mono tracking-wider drop-shadow-[2px_2px_0_theme(colors.black)]">
               X:{displayCoords.x} Z:{displayCoords.z}
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
           <div className="absolute left-[clamp(12px,3cqw,24px)] top-[clamp(12px,3cqh,24px)] flex flex-col gap-1 font-mono uppercase drop-shadow-[2px_2px_0_theme(colors.black)]">
            <div className="text-[clamp(1rem,3.1cqw,2rem)] tracking-[0.16em] text-white">
              Live Map
            </div>
            <div className="text-[clamp(0.6rem,1.4cqw,0.85rem)] tracking-[0.18em] text-cyan-100">
              X:{displayCoords.x} Z:{displayCoords.z}
            </div>
           </div>
           <button 
             className="absolute right-[clamp(12px,3cqw,24px)] top-[clamp(12px,3cqh,24px)] border-4 border-[#888] border-b-[#222] border-r-[#222] bg-[#555] px-4 py-1.5 font-mono text-[clamp(0.75rem,1.9cqw,1.25rem)] tracking-wider text-white hover:bg-[#666] pointer-events-auto"
             onClick={() => requestMapToggle()}
           >
             CLOSE
           </button>
           <div
             className="absolute left-1/2 top-1/2 h-[min(80cqw,80cqh,800px)] w-[min(80cqw,80cqh,800px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border-4 border-[#6d517d] shadow-[0_0_0_4px_#18101f,0_0_32px_rgba(0,0,0,0.85)]"
             aria-label="Expanded live map"
           >
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
               className="absolute left-1/2 top-1/2 z-10 h-10 w-10 filter drop-shadow-[0_2px_4px_black]"
               id="minimap-expanded-player-icon"
               ref={expandedPlayerIconRef}
               style={{
                  transformOrigin: '50% 50%',
                  transform: `translate(-50%, -50%)`
               }}
             >
               <svg width="100%" height="100%" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                 <path d="M20 3L34 35L20 27L6 35L20 3Z" fill="#00e5ff" stroke="black" strokeWidth="3" strokeLinejoin="round"/>
                 <path d="M20 8L25 25L20 22L15 25L20 8Z" fill="#fff7a8" />
               </svg>
             </div>
             <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border-2 border-[#76628a] bg-black/80 px-3 py-1 font-mono text-[clamp(0.6rem,1.5cqw,0.9rem)] tracking-[0.16em] text-cyan-100 shadow-[3px_3px_0_#120a18]">
               LIVE X:{displayCoords.x} Z:{displayCoords.z}
             </div>
           </div>
        </div>
      )}
    </>
  );
}
