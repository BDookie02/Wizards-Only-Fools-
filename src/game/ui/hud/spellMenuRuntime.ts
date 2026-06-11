import { ALL_SPELLS, type SpellType } from "../../../store/gameStore";
import { getSpriteUrl } from "../../SpriteManifest";
import {
  SPELL_CATALOG,
  spellThumbnails,
  type SpellCatalogEntry,
} from "../../systems/spells/spellCatalog";
export { hotkeyLabels } from "./hudHotkeyLabels";

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
