import {
  DARREL_QUEST_CHUNK,
  DARREL_QUEST_SPAWN,
  DARREL_QUEST_SPAWN_YAW,
  LILY_COIL_QUEST_CHUNK,
  SURVIVAL_BLOCK_SIZE,
  getDarrelQuestSpawn,
  getLilyCoilQuestSpawn,
} from "../../store/gameStore";
import type { DevFastTravelSpawn } from "./manualFastTravelSpawn";

export type DevFastTravelLocation = {
  id: string;
  label: string;
  detail: string;
  chunk: { cx: number; cz: number };
  getSpawn: () => DevFastTravelSpawn;
  spawnSpellDummies?: boolean;
};

function makeDevFastTravelSpawn(
  cx: number,
  cz: number,
  options: { y?: number; localX?: number; localZ?: number; yaw?: number } = {},
): DevFastTravelSpawn {
  return {
    x: cx * SURVIVAL_BLOCK_SIZE + (options.localX ?? 0),
    y: options.y ?? 150,
    z: cz * SURVIVAL_BLOCK_SIZE + (options.localZ ?? 214),
    yaw: options.yaw,
  };
}

function getDevFastTravelChunkCoord(value: number) {
  return Math.floor((value + SURVIVAL_BLOCK_SIZE / 2) / SURVIVAL_BLOCK_SIZE);
}

function getDevDarrelQuestSpawn(): DevFastTravelSpawn {
  const spawn = getDarrelQuestSpawn();
  const spawnCx = getDevFastTravelChunkCoord(spawn.x);
  const spawnCz = getDevFastTravelChunkCoord(spawn.z);
  if (spawnCx === DARREL_QUEST_CHUNK.cx && spawnCz === DARREL_QUEST_CHUNK.cz) {
    return spawn;
  }

  return { ...DARREL_QUEST_SPAWN, yaw: DARREL_QUEST_SPAWN_YAW };
}

export const DEV_FAST_TRAVEL_LOCATIONS: DevFastTravelLocation[] = [
  {
    id: "spiral-dimension",
    label: "Spiral Dimension",
    detail: "Lily Coil realm",
    chunk: { cx: LILY_COIL_QUEST_CHUNK.cx, cz: LILY_COIL_QUEST_CHUNK.cz },
    getSpawn: getLilyCoilQuestSpawn,
  },
  {
    id: "darrel-grove",
    label: "Darrel Grove",
    detail: "Unfinished garden realm",
    chunk: { cx: DARREL_QUEST_CHUNK.cx, cz: DARREL_QUEST_CHUNK.cz },
    getSpawn: getDevDarrelQuestSpawn,
  },
  {
    id: "base-village",
    label: "Base Village",
    detail: "Original survival town",
    chunk: { cx: 0, cz: 0 },
    getSpawn: () => ({ x: 0, y: 15, z: 30, yaw: 0 }),
  },
  {
    id: "swamp-village",
    label: "Swamp Village",
    detail: "Route town",
    chunk: { cx: 0, cz: -3 },
    getSpawn: () => makeDevFastTravelSpawn(0, -3, { y: 150, localZ: 214 }),
  },
  {
    id: "chicago-city",
    label: "Chicago City",
    detail: "Dense authored city chunk",
    chunk: { cx: -3, cz: -3 },
    getSpawn: () => makeDevFastTravelSpawn(-3, -3, { y: 150, localZ: 214 }),
  },
  {
    id: "desert-village",
    label: "Desert Village",
    detail: "Meadow route settlement",
    chunk: { cx: 4, cz: -4 },
    getSpawn: () => makeDevFastTravelSpawn(4, -4, { y: 150, localZ: 214 }),
  },
  {
    id: "mountain-village",
    label: "Mountain Village",
    detail: "Highland authored village",
    chunk: { cx: 3, cz: 0 },
    getSpawn: () => makeDevFastTravelSpawn(3, 0, { y: 86, localX: -36, localZ: 182, yaw: 1.68 }),
  },
  {
    id: "graveyard-village",
    label: "Graveyard Village",
    detail: "Ring quest landmark",
    chunk: { cx: 5, cz: 2 },
    getSpawn: () => makeDevFastTravelSpawn(5, 2, { y: 92, localZ: 132 }),
  },
  {
    id: "spell-dummy-range",
    label: "Spell Dummy Range",
    detail: "Health targets for combat QA",
    chunk: { cx: 4, cz: -3 },
    getSpawn: () => makeDevFastTravelSpawn(4, -3, { y: 150, localZ: 214, yaw: 0 }),
    spawnSpellDummies: true,
  },
];

function publishDevFastTravelTelemetry(location: DevFastTravelLocation, spawn: DevFastTravelSpawn) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.wofFastTravelTarget = location.id;
  document.documentElement.dataset.wofFastTravelX = String(Math.round(spawn.x));
  document.documentElement.dataset.wofFastTravelY = String(Math.round(spawn.y));
  document.documentElement.dataset.wofFastTravelZ = String(Math.round(spawn.z));
}

export function runDevFastTravelLocation(location: DevFastTravelLocation) {
  const spawn = location.getSpawn();
  publishDevFastTravelTelemetry(location, spawn);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("wof-reset-perf-stats"));
    window.dispatchEvent(new CustomEvent("teleportPlayer", {
      detail: {
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        yaw: Number.isFinite(spawn.yaw) ? spawn.yaw : undefined,
      },
    }));

    if (location.spawnSpellDummies) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("wof-spawn-spell-dummies", {
          detail: {
            x: spawn.x,
            y: spawn.y,
            z: spawn.z,
            yaw: Number.isFinite(spawn.yaw) ? spawn.yaw : 0,
          },
        }));
      }, 120);
    }
  }

  return spawn;
}
