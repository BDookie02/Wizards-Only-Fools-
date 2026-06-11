import type { SpellType } from "../../../store/gameStore";

export type SpellCatalogEntry = {
  id: SpellType;
  name: string;
  colorClass: string;
  thumbnail?: string;
  family: "damage" | "movement" | "defense" | "utility" | "status" | "quest";
};

export const SPELL_CATALOG: Record<SpellType, SpellCatalogEntry> = {
  fireball: {
    id: "fireball",
    name: "Fireball",
    colorClass: "text-orange-500",
    thumbnail: "/sprites/fireball/fireball_1.png",
    family: "damage",
  },
  iceshard: {
    id: "iceshard",
    name: "Biden Blast",
    colorClass: "text-cyan-400",
    thumbnail: "/sprites/iceshard/spells_1.png",
    family: "damage",
  },
  arcanebeam: {
    id: "arcanebeam",
    name: "Hands",
    colorClass: "text-fuchsia-500",
    thumbnail: "/sprites/misc/idle_1.png",
    family: "utility",
  },
  healspell: {
    id: "healspell",
    name: "Heal",
    colorClass: "text-emerald-400",
    thumbnail: "/sprites/healspell/healspell_1.png",
    family: "utility",
  },
  icespell: {
    id: "icespell",
    name: "Plasma Flash",
    colorClass: "text-blue-300",
    thumbnail: "/sprites/icespell/icespell_1.png",
    family: "damage",
  },
  ringsofpower: {
    id: "ringsofpower",
    name: "Rings of Power",
    colorClass: "text-purple-400",
    thumbnail: "/sprites/ringsofpower/ringsofpower_1.png",
    family: "damage",
  },
  lightning: {
    id: "lightning",
    name: "Chidori",
    colorClass: "text-blue-200",
    thumbnail: "/sprites/lightning/lightning_1.png",
    family: "damage",
  },
  smokebomb: {
    id: "smokebomb",
    name: "Smoke Bomb",
    colorClass: "text-gray-400",
    thumbnail: "/sprites/misc/smoke_bomb.gif",
    family: "utility",
  },
  portal: {
    id: "portal",
    name: "Portal",
    colorClass: "text-indigo-400",
    thumbnail: "/sprites/misc/portal.gif",
    family: "movement",
  },
  blink: {
    id: "blink",
    name: "Blink",
    colorClass: "text-teal-300",
    thumbnail: "/sprites/misc/blink.gif",
    family: "movement",
  },
  grab: {
    id: "grab",
    name: "Grab",
    colorClass: "text-pink-300",
    family: "utility",
  },
  tornado: {
    id: "tornado",
    name: "Tornado",
    colorClass: "text-gray-300",
    family: "damage",
  },
  meteorshower: {
    id: "meteorshower",
    name: "Meteor Shower",
    colorClass: "text-orange-300",
    family: "damage",
  },
  flamethrower: {
    id: "flamethrower",
    name: "Flamethrower",
    colorClass: "text-red-500",
    thumbnail: "/sprites/fireball/castfireball_1.png",
    family: "damage",
  },
  discshield: {
    id: "discshield",
    name: "Disc Shield",
    colorClass: "text-purple-500",
    thumbnail: "/sprites/shields/disc_shield.png",
    family: "defense",
  },
  orbshield: {
    id: "orbshield",
    name: "Orb Shield",
    colorClass: "text-pink-500",
    thumbnail: "/sprites/shields/orb_shield.png",
    family: "defense",
  },
  kunai: {
    id: "kunai",
    name: "Kunai",
    colorClass: "text-gray-200",
    thumbnail: "/sprites/misc/kunai.gif",
    family: "damage",
  },
  healingcrystals: {
    id: "healingcrystals",
    name: "Healing Crystals",
    colorClass: "text-green-300",
    thumbnail: "/sprites/misc/healing_gems.gif",
    family: "quest",
  },
  magicarmor: {
    id: "magicarmor",
    name: "Magic Armor",
    colorClass: "text-sky-300",
    family: "defense",
  },
  jumpboost: {
    id: "jumpboost",
    name: "Up and Over!",
    colorClass: "text-lime-300",
    family: "movement",
  },
  speedboost: {
    id: "speedboost",
    name: "Speed Boost",
    colorClass: "text-yellow-300",
    family: "movement",
  },
  tungstonballsack: {
    id: "tungstonballsack",
    name: "Tungston Ballsack",
    colorClass: "text-slate-300",
    family: "status",
  },
  sleep: {
    id: "sleep",
    name: "Sleep",
    colorClass: "text-sky-200",
    family: "status",
  },
  poison: {
    id: "poison",
    name: "Poison",
    colorClass: "text-purple-300",
    family: "status",
  },
  acid: {
    id: "acid",
    name: "Acid",
    colorClass: "text-green-300",
    family: "status",
  },
  magicglassorb: {
    id: "magicglassorb",
    name: "Magic Glass Orb",
    colorClass: "text-cyan-100",
    family: "utility",
  },
};

function buildSpellCatalogLookups() {
  const colors = {} as Record<SpellType, string>;
  const names = {} as Record<SpellType, string>;
  const thumbnails = {} as Partial<Record<SpellType, string>>;
  for (const spellId in SPELL_CATALOG) {
    const spell = SPELL_CATALOG[spellId as SpellType];
    colors[spell.id] = spell.colorClass;
    names[spell.id] = spell.name;
    if (spell.thumbnail) thumbnails[spell.id] = spell.thumbnail;
  }
  return { colors, names, thumbnails };
}

const spellCatalogLookups = buildSpellCatalogLookups();

export const spellColors = spellCatalogLookups.colors;
export const spellNames = spellCatalogLookups.names;
export const spellThumbnails = spellCatalogLookups.thumbnails;
