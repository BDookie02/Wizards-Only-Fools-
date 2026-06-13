import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ALL_SPELLS, type HandType, type SpellType, useGameStore } from "../../../store/gameStore";
import { spellColors, spellNames } from "../../systems/spells/spellCatalog";
import {
  createSpellMenuHotbarSlotLookup,
  getSpellMenuAssignedSlot,
  getSpellMenuFamilyNavIndex,
  getSpellMenuHotbarNavIndex,
  getFirstSpellInFamily,
  getSpellMenuIndex,
  getSpellMenuFamilyCounts,
  getSpellMenuFamilyForSpell,
  getSpellMenuNavTarget,
  getSpellMenuSpellNavIndex,
  getVisibleSpellMenuSpells,
  hotkeyLabels,
  spellFamilyFilters,
  spellFamilyLabels,
  SPELL_MENU_NAV_ATTRIBUTE,
  SPELL_MENU_NAV_CLOSE_INDEX,
  SPELL_MENU_NAV_COUNT,
  SPELL_MENU_NAV_SELECTOR,
  type SpellFamilyFilter,
} from "./spellMenuRuntime";
import { SpellThumbnail } from "./SpellThumbnail";
import { findDirectionalMenuIndex, type MenuDirection } from "./hudMenuNavigation";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SpellMenu = memo(function SpellMenu({
  menuSpellIndex,
  setMenuSpellIndex,
  setMenuBindingHand,
  onClose,
  bindingHand,
}: {
  menuSpellIndex: number;
  setMenuSpellIndex: (value: number | ((prev: number) => number)) => void;
  setMenuBindingHand: (hand: HandType) => void;
  onClose: () => void;
  bindingHand: HandType;
}) {
  const leftHotbarSpells = useGameStore(s => s.leftHotbarSpells);
  const rightHotbarSpells = useGameStore(s => s.rightHotbarSpells);
  const leftSelectedHotbarIndex = useGameStore(s => s.leftSelectedHotbarIndex);
  const rightSelectedHotbarIndex = useGameStore(s => s.rightSelectedHotbarIndex);
  const leftCurrentSpell = useGameStore(s => s.leftCurrentSpell);
  const rightCurrentSpell = useGameStore(s => s.rightCurrentSpell);
  const setHotbarSpell = useGameStore(s => s.setHotbarSpell);
  const selectHotbarSlot = useGameStore(s => s.selectHotbarSlot);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeFamily, setActiveFamily] = useState<SpellFamilyFilter>("all");
  const [controllerFocusIndex, setControllerFocusIndex] = useState(() => getSpellMenuSpellNavIndex(menuSpellIndex));

  const highlightedSpell = ALL_SPELLS[menuSpellIndex];
  const bindingSelectedIndex = bindingHand === "right" ? rightSelectedHotbarIndex : leftSelectedHotbarIndex;
  const familyCounts = useMemo(getSpellMenuFamilyCounts, []);
  const visibleSpells = useMemo(
    () => getVisibleSpellMenuSpells(activeFamily),
    [activeFamily]
  );
  const leftHotbarSlotLookup = useMemo(
    () => createSpellMenuHotbarSlotLookup(leftHotbarSpells),
    [leftHotbarSpells]
  );
  const rightHotbarSlotLookup = useMemo(
    () => createSpellMenuHotbarSlotLookup(rightHotbarSpells),
    [rightHotbarSpells]
  );
  const bindingHotbarSlotLookup = bindingHand === "right" ? rightHotbarSlotLookup : leftHotbarSlotLookup;

  const applyControllerFocus = useCallback((navIndex: number) => {
    const target = getSpellMenuNavTarget(navIndex);
    if (!target) return;

    setControllerFocusIndex(navIndex);
    if (target.type === "spell") {
      setMenuSpellIndex(target.spellIndex);
      return;
    }
    if (target.type === "hotbar") {
      setMenuBindingHand(target.hand);
      selectHotbarSlot(target.slotIndex, target.hand);
    }
  }, [selectHotbarSlot, setMenuBindingHand, setMenuSpellIndex]);

  useEffect(() => {
    if (activeFamily === "all") return;
    if (getSpellMenuFamilyForSpell(highlightedSpell) === activeFamily) return;
    setActiveFamily("all");
  }, [activeFamily, highlightedSpell]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const focusedElement = root.querySelector<HTMLElement>(
      `[${SPELL_MENU_NAV_ATTRIBUTE}="${controllerFocusIndex}"]`,
    );
    if (focusedElement) {
      focusedElement.scrollIntoView({ block: "nearest", inline: "nearest" });
      return;
    }

    const fallbackSpell = visibleSpells.includes(highlightedSpell) ? highlightedSpell : visibleSpells[0];
    if (!fallbackSpell) {
      setControllerFocusIndex(getSpellMenuFamilyNavIndex("all"));
      return;
    }

    const nextSpellIndex = getSpellMenuIndex(fallbackSpell);
    setControllerFocusIndex(getSpellMenuSpellNavIndex(nextSpellIndex));
    setMenuSpellIndex(nextSpellIndex);
  }, [controllerFocusIndex, highlightedSpell, menuSpellIndex, setMenuSpellIndex, visibleSpells]);

  useEffect(() => {
    const handleControllerScroll = (event: Event) => {
      const amount = (event as CustomEvent<number>).detail ?? 0;
      if (!scrollRef.current || amount === 0) return;
      scrollRef.current.scrollTop += amount;
    };

    window.addEventListener("spell-menu-controller-scroll", handleControllerScroll);
    return () => window.removeEventListener("spell-menu-controller-scroll", handleControllerScroll);
  }, []);

  const assignSpellToSlot = useCallback((slotIndex: number, spell: SpellType, hand: HandType = bindingHand) => {
    setMenuBindingHand(hand);
    setHotbarSpell(slotIndex, spell, hand);
    selectHotbarSlot(slotIndex, hand);
  }, [bindingHand, selectHotbarSlot, setHotbarSpell, setMenuBindingHand]);

  const selectFamily = useCallback((family: SpellFamilyFilter) => {
    setActiveFamily(family);
    const nextSpell = family === "all"
      ? highlightedSpell
      : getFirstSpellInFamily(family);
    const nextIndex = nextSpell ? getSpellMenuIndex(nextSpell) : 0;
    if (nextIndex >= 0) setMenuSpellIndex(nextIndex);
  }, [highlightedSpell, setMenuSpellIndex]);

  const activateControllerFocus = useCallback(() => {
    const target = getSpellMenuNavTarget(controllerFocusIndex);
    if (!target) return;

    if (target.type === "close") {
      onClose();
      return;
    }

    if (target.type === "family") {
      const nextSpell = target.family === "all"
        ? highlightedSpell
        : getFirstSpellInFamily(target.family);
      selectFamily(target.family);
      if (nextSpell) {
        const nextIndex = getSpellMenuIndex(nextSpell);
        setControllerFocusIndex(getSpellMenuSpellNavIndex(nextIndex));
      }
      return;
    }

    if (target.type === "hotbar") {
      setMenuBindingHand(target.hand);
      selectHotbarSlot(target.slotIndex, target.hand);
      return;
    }

    assignSpellToSlot(bindingSelectedIndex, target.spell);
  }, [assignSpellToSlot, bindingSelectedIndex, controllerFocusIndex, highlightedSpell, onClose, selectFamily, selectHotbarSlot, setMenuBindingHand]);

  useEffect(() => {
    const handleControllerNavigate = (event: Event) => {
      const direction = (event as CustomEvent<{ direction?: MenuDirection }>).detail?.direction;
      if (direction !== "up" && direction !== "down" && direction !== "left" && direction !== "right") return;
      const nextIndex = findDirectionalMenuIndex(
        SPELL_MENU_NAV_SELECTOR,
        SPELL_MENU_NAV_ATTRIBUTE,
        controllerFocusIndex,
        direction,
        SPELL_MENU_NAV_COUNT,
      );
      applyControllerFocus(nextIndex);
    };

    const handleControllerSelect = () => {
      activateControllerFocus();
    };

    window.addEventListener("spell-menu-controller-navigate", handleControllerNavigate);
    window.addEventListener("spell-menu-controller-select", handleControllerSelect);
    return () => {
      window.removeEventListener("spell-menu-controller-navigate", handleControllerNavigate);
      window.removeEventListener("spell-menu-controller-select", handleControllerSelect);
    };
  }, [activateControllerFocus, applyControllerFocus, controllerFocusIndex]);

  const renderHotbarColumn = (hand: HandType, spells: SpellType[], selectedIndex: number) => (
    <div
      className={cn(
        "spell-menu-hotbar-column relative min-w-0 border p-1.5 shadow-[0_0_22px_rgba(8,47,73,0.75),inset_0_0_20px_rgba(34,211,238,0.12)]",
        hand === "right"
          ? "border-fuchsia-300/55 bg-fuchsia-950/55"
          : "border-yellow-200/55 bg-yellow-950/45",
        bindingHand === hand ? "ring-1 ring-white/70" : ""
      )}
    >
      <div className={cn(
        "border-b pb-1 text-center text-[8px] tracking-[0.25em]",
        hand === "right" ? "border-fuchsia-300/35 text-fuchsia-100" : "border-yellow-200/35 text-yellow-100"
      )}>
        {hand === "left" ? "LEFT" : "RIGHT"}
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        {spells.map((spell, index) => {
          const navIndex = getSpellMenuHotbarNavIndex(hand, index);
          const isControllerFocused = controllerFocusIndex === navIndex;
          return (
            <button
              key={`${hand}-${spell}-${index}`}
              data-spell-menu-nav-index={navIndex}
              className={cn(
                "spell-menu-hotbar-slot grid h-8 min-w-0 grid-cols-[16px_1fr] items-center gap-1 border bg-black/45 px-1 text-left transition-all",
                selectedIndex === index
                  ? hand === "right"
                    ? "border-fuchsia-200 bg-fuchsia-300/20 text-fuchsia-50 shadow-[0_0_14px_rgba(217,70,239,0.65)]"
                    : "border-yellow-200 bg-yellow-200/20 text-yellow-50 shadow-[0_0_14px_rgba(253,224,71,0.55)]"
                  : hand === "right"
                    ? "border-fuchsia-300/25 text-fuchsia-100/75 hover:border-fuchsia-200/80"
                    : "border-yellow-200/25 text-yellow-100/75 hover:border-yellow-100/80",
                bindingHand === hand ? "brightness-125" : "",
                isControllerFocused ? "ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.65)]" : ""
              )}
              onMouseEnter={() => applyControllerFocus(navIndex)}
              onFocus={() => applyControllerFocus(navIndex)}
              onClick={() => {
                applyControllerFocus(navIndex);
              }}
            >
              <div className="text-center text-[9px] text-white/80">{hotkeyLabels[index]}</div>
              <div className="truncate text-[7px] leading-3">{spellNames[spell]}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 z-[130] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-[#02040c]/55 pointer-events-none" />
      <div
        ref={scrollRef}
        data-testid="spell-menu"
        data-wof-hud-qa="spell-menu"
        className="spell-menu-hologram relative overflow-x-hidden overflow-y-auto rounded-[2px] border border-cyan-200/60 bg-[#12071f]/92 p-3 text-cyan-100 shadow-[0_0_35px_rgba(34,211,238,0.45)] backdrop-blur-[2px]"
        style={{
          width: 'min(920px, calc(var(--app-vw, 100dvw) - 32px))',
          maxHeight: 'calc(var(--app-vh, 100dvh) - 96px)',
        }}
      >
        <div className="spell-menu-scanline pointer-events-none absolute inset-0 opacity-40" />
        <div className="spell-menu-header sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-cyan-300/40 bg-[#12071f]/95 pb-3 backdrop-blur-[2px]">
          <div className="min-w-0">
            <div className="spell-menu-kicker text-[10px] tracking-[0.4em] text-cyan-300/80">ARCANE LOADOUT</div>
            <div className="spell-menu-title mt-2 text-2xl text-white drop-shadow-[0_0_8px_rgba(103,232,249,0.9)]">SPELL BOOK</div>
          </div>
          <button
            data-testid="spell-menu-close"
            data-spell-menu-nav-index={SPELL_MENU_NAV_CLOSE_INDEX}
            className={cn(
              "spell-menu-close-button border border-cyan-300/70 bg-cyan-300/10 px-3 py-2 text-[10px] tracking-widest text-cyan-100 hover:bg-cyan-200/20",
              controllerFocusIndex === SPELL_MENU_NAV_CLOSE_INDEX ? "ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.65)]" : ""
            )}
            onFocus={() => setControllerFocusIndex(SPELL_MENU_NAV_CLOSE_INDEX)}
            onMouseEnter={() => setControllerFocusIndex(SPELL_MENU_NAV_CLOSE_INDEX)}
            onClick={onClose}
          >
            E CLOSE
          </button>
        </div>

        <div className="spell-menu-layout relative mt-3 grid grid-cols-[78px_minmax(0,1fr)_78px] gap-2">
          {renderHotbarColumn("left", leftHotbarSpells, leftSelectedHotbarIndex)}

          <div className="spell-menu-spell-panel min-w-0 border border-cyan-300/20 bg-black/10 p-2">
            <div className="spell-menu-bind-status mb-2 grid grid-cols-3 gap-2 text-[8px] tracking-widest text-cyan-100/70">
              <div className="min-w-0 border border-cyan-300/20 bg-cyan-300/5 px-2 py-1.5">
                <div className="text-cyan-200/60">BINDING</div>
                <div className="truncate text-cyan-50">{bindingHand.toUpperCase()} SLOT {hotkeyLabels[bindingSelectedIndex]}</div>
              </div>
              <div className="min-w-0 border border-yellow-200/20 bg-yellow-200/5 px-2 py-1.5">
                <div className="text-yellow-100/60">LEFT</div>
                <div className="truncate text-yellow-50">{spellNames[leftCurrentSpell]}</div>
              </div>
              <div className="min-w-0 border border-fuchsia-200/20 bg-fuchsia-200/5 px-2 py-1.5">
                <div className="text-fuchsia-100/60">RIGHT</div>
                <div className="truncate text-fuchsia-50">{spellNames[rightCurrentSpell]}</div>
              </div>
            </div>

            <div
              className="spell-menu-family-filters mb-2 grid grid-cols-4 gap-1.5 md:grid-cols-[repeat(8,minmax(0,1fr))]"
              data-testid="spell-menu-family-filters"
            >
              {spellFamilyFilters.map((family) => {
                const navIndex = getSpellMenuFamilyNavIndex(family);
                const isControllerFocused = controllerFocusIndex === navIndex;
                return (
                  <button
                    key={family}
                    type="button"
                    data-testid={`spell-family-${family}`}
                    data-spell-menu-nav-index={navIndex}
                    aria-pressed={activeFamily === family}
                    className={cn(
                      "spell-menu-family-filter min-w-0 border px-2 py-1 text-[8px] tracking-widest transition-all",
                      activeFamily === family
                        ? "border-yellow-200 bg-yellow-200/15 text-yellow-50 shadow-[0_0_12px_rgba(250,204,21,0.28)]"
                        : "border-cyan-300/25 bg-cyan-300/5 text-cyan-100/75 hover:border-cyan-200/70 hover:text-cyan-50",
                      isControllerFocused ? "ring-2 ring-white shadow-[0_0_16px_rgba(255,255,255,0.65)]" : ""
                    )}
                    onFocus={() => setControllerFocusIndex(navIndex)}
                    onMouseEnter={() => setControllerFocusIndex(navIndex)}
                    onClick={() => {
                      setControllerFocusIndex(navIndex);
                      selectFamily(family);
                    }}
                  >
                    <span>{spellFamilyLabels[family]}</span>
                    <span className="spell-menu-family-count ml-1 text-cyan-100/45">{familyCounts[family]}</span>
                  </button>
                );
              })}
              <div
                data-testid="spell-menu-visible-count"
                className="spell-menu-visible-count border border-cyan-300/20 bg-black/20 px-2 py-1 text-center text-[8px] tracking-widest text-cyan-100/60"
              >
                {visibleSpells.length} SHOWN
              </div>
            </div>

            <div className="spell-menu-grid grid grid-cols-3 gap-2 md:grid-cols-5">
              {visibleSpells.map((spell) => {
                const index = getSpellMenuIndex(spell);
                const navIndex = getSpellMenuSpellNavIndex(index);
                const isHighlighted = index === menuSpellIndex;
                const isControllerFocused = controllerFocusIndex === navIndex;
                const leftAssignedSlot = getSpellMenuAssignedSlot(leftHotbarSlotLookup, spell);
                const rightAssignedSlot = getSpellMenuAssignedSlot(rightHotbarSlotLookup, spell);
                const assignedSlot = getSpellMenuAssignedSlot(bindingHotbarSlotLookup, spell);
                const isCurrent = spell === leftCurrentSpell || spell === rightCurrentSpell;
                const familyLabel = spellFamilyLabels[getSpellMenuFamilyForSpell(spell)];

                return (
                  <button
                    key={spell}
                    data-spell-index={index}
                    data-spell-menu-nav-index={navIndex}
                    className={cn(
                      "spell-menu-card group relative min-h-[84px] min-w-0 border p-1.5 text-left transition-all",
                      isHighlighted
                        ? "border-yellow-200 bg-yellow-200/10 text-yellow-100 shadow-[0_0_20px_rgba(250,204,21,0.45)]"
                        : "border-cyan-300/30 bg-cyan-400/5 text-cyan-100 hover:border-cyan-200/80 hover:bg-cyan-300/10",
                      isCurrent ? "ring-1 ring-white/70" : "",
                      isControllerFocused ? "ring-2 ring-white shadow-[0_0_18px_rgba(255,255,255,0.7)]" : ""
                    )}
                    onMouseEnter={() => applyControllerFocus(navIndex)}
                    onFocus={() => applyControllerFocus(navIndex)}
                    onClick={() => {
                      applyControllerFocus(navIndex);
                      assignSpellToSlot(bindingSelectedIndex, spell);
                    }}
                  >
                    <div className="spell-menu-card-badges mb-1 flex min-w-0 items-center justify-between gap-1 text-[6px] tracking-widest">
                      <span className="truncate text-cyan-100/45">{familyLabel}</span>
                      {isCurrent && <span className="text-white/75">ACTIVE</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "spell-menu-thumb relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/30",
                        spell === "portal" ? "bg-indigo-300/10" : "bg-cyan-300/5"
                      )}>
                        <SpellThumbnail spell={spell} animate={isHighlighted} deferRank={index} />
                      </div>
                      <div className="min-w-0">
                        <div className={cn("truncate text-[8px] leading-4", spellColors[spell])}>{spellNames[spell]}</div>
                        <div className="text-[8px] tracking-widest text-cyan-100/60">
                          {assignedSlot === -1 ? "UNBOUND" : `${bindingHand.toUpperCase()} ${hotkeyLabels[assignedSlot]}`}
                        </div>
                        <div className="text-[7px] tracking-widest text-cyan-100/35">
                          {leftAssignedSlot === -1 ? "" : `L${hotkeyLabels[leftAssignedSlot]} `}
                          {rightAssignedSlot === -1 ? "" : `R${hotkeyLabels[rightAssignedSlot]}`}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-[2px] bg-cyan-200/20">
                      <div className={cn("h-full transition-all", isHighlighted ? "w-full bg-yellow-200" : "w-1/3 bg-cyan-300/70")} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {renderHotbarColumn("right", rightHotbarSpells, rightSelectedHotbarIndex)}
        </div>

        <div className="spell-menu-footer relative mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-cyan-300/30 pt-3 text-[9px] tracking-widest text-cyan-100/70">
          <span>ARROWS/WHEEL/D-PAD SELECT SPELL</span>
          <span>PRESS 1-0 OR A TO BIND, HOLD Q OR LB/RB CHOOSE HAND</span>
          <span>HIGHLIGHTED: {bindingHand.toUpperCase()} {hotkeyLabels[bindingSelectedIndex]} / {spellNames[highlightedSpell]}</span>
        </div>
      </div>
    </div>
  );
}, (previous, next) => (
  previous.menuSpellIndex === next.menuSpellIndex &&
  previous.bindingHand === next.bindingHand
));
