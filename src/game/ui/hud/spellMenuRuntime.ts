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
  const counts = {} as Record<SpellFamilyFilter, number>;
  for (const family of spellFamilyFilters) {
    counts[family] = 0;
  }
  counts.all = ALL_SPELLS.length;
  for (const spell of ALL_SPELLS) {
    counts[getSpellMenuFamilyForSpell(spell)] += 1;
  }
  return counts;
}

export function getVisibleSpellMenuSpells(activeFamily: SpellFamilyFilter) {
  if (activeFamily === "all") return ALL_SPELLS;

  const visibleSpells: SpellType[] = [];
  for (const spell of ALL_SPELLS) {
    if (getSpellMenuFamilyForSpell(spell) === activeFamily) {
      visibleSpells.push(spell);
    }
  }
  return visibleSpells;
}

export function getFirstSpellInFamily(activeFamily: SpellFamilyFilter) {
  if (activeFamily === "all") return null;
  for (const spell of ALL_SPELLS) {
    if (getSpellMenuFamilyForSpell(spell) === activeFamily) {
      return spell;
    }
  }
  return null;
}
