import { ALL_SPELLS, type HandType, type SpellType } from "../../../store/gameStore";
import { getSpriteUrl } from "../../SpriteManifest";
import {
  SPELL_CATALOG,
  spellThumbnails,
  type SpellCatalogEntry,
} from "../../systems/spells/spellCatalog";
import { hotkeyLabels } from "./hudHotkeyLabels";
export { hotkeyLabels };

export type SpellFamilyFilter = SpellCatalogEntry["family"] | "all";

export const spellFamilyLabels: Record<SpellFamilyFilter, string> = {
  all: "All",
  damage: "Damage",
  movement: "Movement",
  defense: "Defense",
  utility: "Utility",
  status: "Status",
  quest: "Quest",
};

export const spellFamilyFilters: SpellFamilyFilter[] = [
  "all",
  "damage",
  "movement",
  "defense",
  "utility",
  "status",
  "quest",
];

export const SPELL_MENU_NAV_CLOSE_INDEX = 0;
export const SPELL_MENU_NAV_FAMILY_BASE = 20;
export const SPELL_MENU_NAV_LEFT_HOTBAR_BASE = 100;
export const SPELL_MENU_NAV_SPELL_BASE = 200;
export const SPELL_MENU_NAV_RIGHT_HOTBAR_BASE = 500;
export const SPELL_MENU_NAV_COUNT = 620;
export const SPELL_MENU_NAV_SELECTOR = "[data-spell-menu-nav-index]";
export const SPELL_MENU_NAV_ATTRIBUTE = "data-spell-menu-nav-index";

export type SpellMenuNavTarget =
  | { type: "close" }
  | { type: "family"; family: SpellFamilyFilter }
  | { type: "hotbar"; hand: HandType; slotIndex: number }
  | { type: "spell"; spell: SpellType; spellIndex: number };

const SPELL_MENU_FALLBACK_THUMBNAIL = "/sprites/fireball/fireball_1.png";

const cachedSpellMenuFamilyCounts: Record<SpellFamilyFilter, number> = {
  all: ALL_SPELLS.length,
  damage: 0,
  movement: 0,
  defense: 0,
  utility: 0,
  status: 0,
  quest: 0,
};

const cachedVisibleSpellMenuSpells: Record<SpellFamilyFilter, readonly SpellType[]> = {
  all: ALL_SPELLS,
  damage: [],
  movement: [],
  defense: [],
  utility: [],
  status: [],
  quest: [],
};

const cachedFirstSpellInFamily: Record<SpellFamilyFilter, SpellType | null> = {
  all: null,
  damage: null,
  movement: null,
  defense: null,
  utility: null,
  status: null,
  quest: null,
};

const cachedSpellMenuIndexBySpell = {} as Record<SpellType, number>;

for (let index = 0; index < ALL_SPELLS.length; index += 1) {
  const spell = ALL_SPELLS[index];
  const family = SPELL_CATALOG[spell].family;
  cachedSpellMenuIndexBySpell[spell] = index;
  cachedSpellMenuFamilyCounts[family] += 1;
  (cachedVisibleSpellMenuSpells[family] as SpellType[]).push(spell);
  cachedFirstSpellInFamily[family] ??= spell;
}

export function getFallbackSpellThumbnail() {
  return getSpriteUrl(SPELL_MENU_FALLBACK_THUMBNAIL) || SPELL_MENU_FALLBACK_THUMBNAIL;
}

export function getSpellThumbnail(spell: SpellType) {
  const thumbnail = spellThumbnails[spell] ?? SPELL_MENU_FALLBACK_THUMBNAIL;
  return getSpriteUrl(thumbnail) || thumbnail;
}

export function isAnimatedThumbnailSource(src: string) {
  return /\.gif(?:[?#]|$)/i.test(src);
}

export function getSpellMenuFamilyForSpell(spell: SpellType) {
  return SPELL_CATALOG[spell].family;
}

export function getSpellMenuFamilyCounts() {
  return cachedSpellMenuFamilyCounts;
}

export function getVisibleSpellMenuSpells(activeFamily: SpellFamilyFilter) {
  return cachedVisibleSpellMenuSpells[activeFamily];
}

export function getFirstSpellInFamily(activeFamily: SpellFamilyFilter) {
  return cachedFirstSpellInFamily[activeFamily];
}

export function getSpellMenuIndex(spell: SpellType) {
  return cachedSpellMenuIndexBySpell[spell];
}

export function getSpellMenuFamilyNavIndex(family: SpellFamilyFilter) {
  return SPELL_MENU_NAV_FAMILY_BASE + Math.max(0, spellFamilyFilters.indexOf(family));
}

export function getSpellMenuHotbarNavIndex(hand: HandType, slotIndex: number) {
  return (hand === "right" ? SPELL_MENU_NAV_RIGHT_HOTBAR_BASE : SPELL_MENU_NAV_LEFT_HOTBAR_BASE) + slotIndex;
}

export function getSpellMenuSpellNavIndex(spellIndex: number) {
  return SPELL_MENU_NAV_SPELL_BASE + spellIndex;
}

export function getSpellMenuNavTarget(navIndex: number): SpellMenuNavTarget | null {
  if (navIndex === SPELL_MENU_NAV_CLOSE_INDEX) return { type: "close" };

  if (navIndex >= SPELL_MENU_NAV_FAMILY_BASE && navIndex < SPELL_MENU_NAV_FAMILY_BASE + spellFamilyFilters.length) {
    return { type: "family", family: spellFamilyFilters[navIndex - SPELL_MENU_NAV_FAMILY_BASE] };
  }

  if (navIndex >= SPELL_MENU_NAV_LEFT_HOTBAR_BASE && navIndex < SPELL_MENU_NAV_LEFT_HOTBAR_BASE + hotkeyLabels.length) {
    return { type: "hotbar", hand: "left", slotIndex: navIndex - SPELL_MENU_NAV_LEFT_HOTBAR_BASE };
  }

  if (navIndex >= SPELL_MENU_NAV_SPELL_BASE && navIndex < SPELL_MENU_NAV_SPELL_BASE + ALL_SPELLS.length) {
    const spellIndex = navIndex - SPELL_MENU_NAV_SPELL_BASE;
    return { type: "spell", spell: ALL_SPELLS[spellIndex], spellIndex };
  }

  if (navIndex >= SPELL_MENU_NAV_RIGHT_HOTBAR_BASE && navIndex < SPELL_MENU_NAV_RIGHT_HOTBAR_BASE + hotkeyLabels.length) {
    return { type: "hotbar", hand: "right", slotIndex: navIndex - SPELL_MENU_NAV_RIGHT_HOTBAR_BASE };
  }

  return null;
}

export type SpellMenuHotbarSlotLookup = Partial<Record<SpellType, number>>;

export function createSpellMenuHotbarSlotLookup(spells: readonly SpellType[]) {
  const lookup: SpellMenuHotbarSlotLookup = {};
  for (let index = 0; index < spells.length; index += 1) {
    const spell = spells[index];
    lookup[spell] ??= index;
  }
  return lookup;
}

export function getSpellMenuAssignedSlot(
  lookup: SpellMenuHotbarSlotLookup,
  spell: SpellType
) {
  return lookup[spell] ?? -1;
}
