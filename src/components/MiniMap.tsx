import { startTransition, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useGameStore } from "../store/gameStore";
import { isMobilePerformanceMode } from "../game/performanceMode";

export function MiniMap() {
  const isExpanded = useGameStore(s => s.isMapExpanded);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isPauseMenuOpen = useGameStore(s => s.isPauseMenuOpen);
  const isScoreboardOpen = useGameStore(s => s.isScoreboardOpen);
  const toggleMap = useGameStore(s => s.toggleMap);
  const smallMapSize = 'var(--live-minimap-size, clamp(82px, 18vmin, 176px))';
  const smallMapInset = 'var(--live-minimap-inset, clamp(8px, 2vmin, 16px))';
  
  // Refs to avoid re-renders at 60fps
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const playerIconRef = useRef<HTMLDivElement>(null);
  const expandedPlayerIconRef = useRef<HTMLDivElement>(null);
  const mobilePerformanceMode = useRef(isMobilePerformanceMode());
  const pendingMoveRef = useRef<{ x: number; z: number; angle: number } | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const lastDomMoveUpdate = useRef(0);
  const lastMapToggleRef = useRef(0);

  const [displayCoords, setDisplayCoords] = useState({ x: 0, y: 0 });
  const lastUpdate = useRef(0);

  const requestMapToggle = () => {
    const now = performance.now();
    if (now - lastMapToggleRef.current < 180) return;
    lastMapToggleRef.current = now;
    startTransition(toggleMap);
  };

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
        setDisplayCoords({ x: Math.round(x), y: Math.round(z) });
      }

      const domNow = performance.now();
      if (mobilePerformanceMode.current && domNow - lastDomMoveUpdate.current < 1000 / 15) return;
      lastDomMoveUpdate.current = domNow;

      // Update small map transforms (avoids re-rendering by using refs)
      if (mapContainerRef.current) {
        const scale = 3;
        mapContainerRef.current.style.transform = `translate(${-x * scale}px, ${-z * scale}px)`;
      }
      
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
      if (e.key === 'm' || e.key === 'M') {
        const state = useGameStore.getState();
        if (state.isSpellMenuOpen || state.isPauseMenuOpen || state.isScoreboardOpen) return;
        e.preventDefault();
        requestMapToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMap]);

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
               X:{displayCoords.x} Y:{displayCoords.y}
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
           <div className="absolute top-[20px] left-[20px] flex items-start gap-4">
            <div className="text-white text-3xl drop-shadow-[2px_2px_0_theme(colors.black)] font-mono tracking-widest uppercase">
              Press 'M' To Close
            </div>
           </div>
           <button 
             className="absolute top-[20px] right-[20px] bg-[#555] hover:bg-[#666] text-white px-6 py-2 text-xl font-mono tracking-wider border-4 border-[#888] border-b-[#222] border-r-[#222] pointer-events-auto"
             onClick={() => requestMapToggle()}
           >
             CLOSE
           </button>
           
           {/* Crosshair indicator for Expanded Map player position */}
           <div className="absolute filter drop-shadow-[0_2px_4px_black]"
             id="minimap-expanded-player-icon"
             ref={expandedPlayerIconRef}
             style={{
                left: `calc(50% + ${(displayCoords.x / 520) * Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, 800)}px)`,
                top: `calc(50% + ${(displayCoords.y / 520) * Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, 800)}px)`,
                width: '32px',
                height: '32px',
                transformOrigin: '50% 50%',
                transform: `translate(-50%, -50%)`
             }}>
             <svg width="100%" height="100%" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
               <path d="M16 2L28 28L16 22L4 28L16 2Z" fill="#00e5ff" stroke="black" strokeWidth="2" strokeLinejoin="round"/>
             </svg>
           </div>
           
        </div>
      )}
    </>
  );
}
