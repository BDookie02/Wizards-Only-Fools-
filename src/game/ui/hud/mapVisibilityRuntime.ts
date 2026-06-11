export type MapBlockingMenuState = {
  isInventoryOpen: boolean;
  isPauseMenuOpen: boolean;
  isScoreboardOpen: boolean;
  isSpellMenuOpen: boolean;
};

export type CompactMapOpenState = MapBlockingMenuState & {
  isMapExpanded: boolean;
};

export function isMapUiBlockedByModal({
  isInventoryOpen,
  isPauseMenuOpen,
  isScoreboardOpen,
  isSpellMenuOpen,
}: MapBlockingMenuState) {
  return isInventoryOpen || isPauseMenuOpen || isScoreboardOpen || isSpellMenuOpen;
}

export function canOpenCompactMap(state: CompactMapOpenState) {
  return !state.isMapExpanded && !isMapUiBlockedByModal(state);
}
