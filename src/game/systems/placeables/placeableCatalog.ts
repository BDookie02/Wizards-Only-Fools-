export type PlaceableCategory =
  | "huts"
  | "village"
  | "props"
  | "nature"
  | "training"
  | "magic";

export type PlaceablePreview =
  | { kind: "image"; src: string }
  | { kind: "swatch"; colors: [string, string, string?] };

export type PlaceableDefinition = {
  id: string;
  name: string;
  category: PlaceableCategory;
  description: string;
  preview: PlaceablePreview;
  footprintRadius: number;
  maxSlopeDelta: number;
  heightOffset?: number;
  yawMode: "player" | "random" | "fixed";
  tags: string[];
};

export const PLACEABLE_CATEGORY_LABELS: Record<PlaceableCategory, string> = {
  huts: "Huts",
  village: "Village",
  props: "Props",
  nature: "Nature",
  training: "Training",
  magic: "Magic",
};

export const PLACEABLE_CATEGORIES: PlaceableCategory[] = [
  "huts",
  "village",
  "props",
  "nature",
  "training",
  "magic",
];

export const PLACEABLE_CATALOG: PlaceableDefinition[] = [
  {
    id: "hut-mushroom-red",
    name: "Red Cap Mushroom Hut",
    category: "huts",
    description: "Rounded village hut with a red cap roof.",
    preview: { kind: "swatch", colors: ["#f3efe2", "#db0f27", "#ffffff"] },
    footprintRadius: 8,
    maxSlopeDelta: 1.8,
    yawMode: "player",
    tags: ["hut", "mushroom", "village", "home"],
  },
  {
    id: "hut-mushroom-lavender",
    name: "Lavender Mushroom Hut",
    category: "huts",
    description: "Soft purple mushroom hut variation.",
    preview: { kind: "swatch", colors: ["#f3efe2", "#b57edc", "#ffffff"] },
    footprintRadius: 8,
    maxSlopeDelta: 1.8,
    yawMode: "player",
    tags: ["hut", "mushroom", "village", "home"],
  },
  {
    id: "hut-grass-mound",
    name: "Grass Mound Hut",
    category: "huts",
    description: "Low rounded hut built into a grass mound.",
    preview: { kind: "swatch", colors: ["#5c4033", "#5f8f3d", "#b88a4a"] },
    footprintRadius: 10,
    maxSlopeDelta: 1.4,
    yawMode: "player",
    tags: ["hut", "grass", "earth", "home"],
  },
  {
    id: "hut-log-cabin",
    name: "Log Cabin Hut",
    category: "huts",
    description: "Simple squared log hut with readable doorway.",
    preview: { kind: "swatch", colors: ["#6b4423", "#8a5a2c", "#3a2517"] },
    footprintRadius: 10,
    maxSlopeDelta: 1.25,
    yawMode: "player",
    tags: ["hut", "cabin", "wood", "home"],
  },
  {
    id: "hut-dirt-grass-roof",
    name: "Dirt Hut Grass Roof",
    category: "huts",
    description: "Dirt-wall hut with a flat grassy roof.",
    preview: { kind: "swatch", colors: ["#5a3b22", "#6fa24f", "#2c1b12"] },
    footprintRadius: 10,
    maxSlopeDelta: 1.25,
    yawMode: "player",
    tags: ["hut", "dirt", "grass", "home"],
  },
  {
    id: "mountain-cabin",
    name: "Mountain Cabin",
    category: "village",
    description: "Steep-roof cabin sized for highland villages.",
    preview: { kind: "swatch", colors: ["#7a4d2d", "#c0894f", "#d9d7c5"] },
    footprintRadius: 11,
    maxSlopeDelta: 2.2,
    yawMode: "player",
    tags: ["mountain", "cabin", "village"],
  },
  {
    id: "swamp-treehouse-platform",
    name: "Swamp Treehouse Platform",
    category: "village",
    description: "Raised platform for swamp village staging.",
    preview: { kind: "swatch", colors: ["#4f3a23", "#7f5f36", "#315c35"] },
    footprintRadius: 13,
    maxSlopeDelta: 2,
    heightOffset: 2.2,
    yawMode: "player",
    tags: ["swamp", "treehouse", "platform", "village"],
  },
  {
    id: "campfire-small",
    name: "Small Campfire",
    category: "props",
    description: "Compact campfire prop for village staging.",
    preview: { kind: "swatch", colors: ["#3a2515", "#ff8a1d", "#ffd166"] },
    footprintRadius: 3,
    maxSlopeDelta: 1.2,
    yawMode: "random",
    tags: ["campfire", "prop", "light"],
  },
  {
    id: "bush-round",
    name: "Round Bush",
    category: "nature",
    description: "Low round bush for readable scene dressing.",
    preview: { kind: "swatch", colors: ["#244a24", "#4f8730", "#78b94f"] },
    footprintRadius: 3,
    maxSlopeDelta: 1.8,
    yawMode: "random",
    tags: ["bush", "nature", "foliage"],
  },
  {
    id: "training-spell-dummy",
    name: "Spell Dummy",
    category: "training",
    description: "Combat test target for spell damage and aim checks.",
    preview: { kind: "swatch", colors: ["#7f1d1d", "#facc15", "#111827"] },
    footprintRadius: 4,
    maxSlopeDelta: 1.4,
    yawMode: "player",
    tags: ["dummy", "combat", "qa", "training"],
  },
  {
    id: "magic-portal-marker",
    name: "Portal Marker",
    category: "magic",
    description: "Readable magical placement marker using the portal sprite.",
    preview: { kind: "image", src: "/sprites/misc/portal.gif" },
    footprintRadius: 5,
    maxSlopeDelta: 1.5,
    yawMode: "fixed",
    tags: ["portal", "magic", "marker"],
  },
  {
    id: "spellbook-pedestal",
    name: "Spellbook Pedestal",
    category: "magic",
    description: "Pedestal marker for spell and quest menu staging.",
    preview: { kind: "image", src: "/sprites/misc/spellbook_icon.png" },
    footprintRadius: 4,
    maxSlopeDelta: 1.2,
    yawMode: "player",
    tags: ["spellbook", "magic", "pedestal"],
  },
];

export function getPlaceableDefinition(id: string) {
  for (let index = 0; index < PLACEABLE_CATALOG.length; index += 1) {
    const placeable = PLACEABLE_CATALOG[index];
    if (placeable.id === id) return placeable;
  }
  return null;
}
