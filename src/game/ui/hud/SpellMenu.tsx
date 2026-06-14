import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_SPELLS, type HandType, type SpellType, useGameStore } from "../../../store/gameStore";
import {
  createSpellMenuHotbarSlotLookup,
  getSpellMenuAssignedSlot,
  getSpellMenuFamilyNavIndex,
  getFirstSpellInFamily,
  getSpellMenuIndex,
  getSpellMenuFamilyCounts,
  getSpellMenuFamilyForSpell,
  getSpellMenuNavTarget,
  getSpellMenuSpellNavIndex,
  getVisibleSpellMenuSpells,
  SPELL_MENU_NAV_ATTRIBUTE,
  SPELL_MENU_NAV_COUNT,
  SPELL_MENU_NAV_SELECTOR,
  type SpellFamilyFilter,
} from "./spellMenuRuntime";
import { SpellMenuBindStatus } from "./SpellMenuBindStatus";
import { SpellMenuCard } from "./SpellMenuCard";
import { SpellMenuFilterRow } from "./SpellMenuFilterRow";
import { SpellMenuFooter } from "./SpellMenuFooter";
import { SpellMenuHeader } from "./SpellMenuHeader";
import { SpellMenuHotbarColumn } from "./SpellMenuHotbarColumn";
import { findDirectionalMenuIndex, type MenuDirection } from "./hudMenuNavigation";

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
        <SpellMenuHeader
          controllerFocusIndex={controllerFocusIndex}
          onFocusClose={setControllerFocusIndex}
          onClose={onClose}
        />

        <div className="spell-menu-layout relative mt-3 grid grid-cols-[78px_minmax(0,1fr)_78px] gap-2">
          <SpellMenuHotbarColumn
            hand="left"
            spells={leftHotbarSpells}
            selectedIndex={leftSelectedHotbarIndex}
            bindingHand={bindingHand}
            controllerFocusIndex={controllerFocusIndex}
            onFocusSlot={applyControllerFocus}
          />

          <div className="spell-menu-spell-panel min-w-0 border border-cyan-300/20 bg-black/10 p-2">
            <SpellMenuBindStatus
              bindingHand={bindingHand}
              bindingSelectedIndex={bindingSelectedIndex}
              leftCurrentSpell={leftCurrentSpell}
              rightCurrentSpell={rightCurrentSpell}
            />

            <SpellMenuFilterRow
              activeFamily={activeFamily}
              familyCounts={familyCounts}
              controllerFocusIndex={controllerFocusIndex}
              visibleCount={visibleSpells.length}
              onFocusNav={setControllerFocusIndex}
              onSelectFamily={(selectedFamily, navIndex) => {
                setControllerFocusIndex(navIndex);
                selectFamily(selectedFamily);
              }}
            />

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

                return (
                  <SpellMenuCard
                    key={spell}
                    spell={spell}
                    spellIndex={index}
                    navIndex={navIndex}
                    bindingHand={bindingHand}
                    assignedSlot={assignedSlot}
                    leftAssignedSlot={leftAssignedSlot}
                    rightAssignedSlot={rightAssignedSlot}
                    highlighted={isHighlighted}
                    focused={isControllerFocused}
                    current={isCurrent}
                    onFocusCard={() => applyControllerFocus(navIndex)}
                    onSelectCard={() => {
                      applyControllerFocus(navIndex);
                      assignSpellToSlot(bindingSelectedIndex, spell);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <SpellMenuHotbarColumn
            hand="right"
            spells={rightHotbarSpells}
            selectedIndex={rightSelectedHotbarIndex}
            bindingHand={bindingHand}
            controllerFocusIndex={controllerFocusIndex}
            onFocusSlot={applyControllerFocus}
          />
        </div>

        <SpellMenuFooter
          bindingHand={bindingHand}
          bindingSelectedIndex={bindingSelectedIndex}
          highlightedSpell={highlightedSpell}
        />
      </div>
    </div>
  );
}, (previous, next) => (
  previous.menuSpellIndex === next.menuSpellIndex &&
  previous.bindingHand === next.bindingHand
));
