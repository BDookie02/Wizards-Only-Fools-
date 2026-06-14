import { type CSSProperties } from "react";
import { type SpellType } from "../../../store/gameStore";

const EMPTY_THUMBNAIL_MASK: CSSProperties = {};

const PORTAL_THUMBNAIL_MASK: CSSProperties = {
  mixBlendMode: "screen",
  filter: "brightness(1.45) contrast(1.25) saturate(1.35)",
  WebkitMaskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
  maskImage: "radial-gradient(circle at center, transparent 0 28%, black 34%, black 51%, transparent 61%)",
};

export function usesCanvasOnlySpellThumbnail(spell: SpellType) {
  switch (spell) {
    case "portal":
    case "blink":
    case "smokebomb":
    case "kunai":
    case "healingcrystals":
    case "orbshield":
    case "grab":
    case "tornado":
    case "meteorshower":
    case "magicarmor":
    case "jumpboost":
    case "speedboost":
    case "tungstonballsack":
    case "sleep":
    case "poison":
    case "acid":
    case "magicglassorb":
      return true;
    default:
      return false;
  }
}

export function getSpellThumbnailPortalMask(
  spell: SpellType,
  canvasOnlyThumbnail: boolean
) {
  return spell === "portal" && !canvasOnlyThumbnail
    ? PORTAL_THUMBNAIL_MASK
    : EMPTY_THUMBNAIL_MASK;
}
