export const HUD_MAP_SUPPRESSED_DATASET_KEY = "wofHudMapSuppressed";

export function setHudMapSuppressedByToolOverlay(suppressed: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (suppressed) {
    root.dataset[HUD_MAP_SUPPRESSED_DATASET_KEY] = "1";
  } else {
    delete root.dataset[HUD_MAP_SUPPRESSED_DATASET_KEY];
  }
}

export function isHudMapSuppressedByToolOverlay() {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset[HUD_MAP_SUPPRESSED_DATASET_KEY] === "1";
}
