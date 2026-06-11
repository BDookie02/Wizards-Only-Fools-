import spriteManifest from "./manifest.json";

const SPRITE_MANIFEST = spriteManifest as Record<string, boolean>;
const SPRITE_PATHS = Object.keys(SPRITE_MANIFEST);
const SPRITE_PATH_SET = new Set(SPRITE_PATHS);

export function getSpriteUrl(path: string): string | null {
  const normalizedPath = path.startsWith('/public/') ? path.slice('/public'.length) : path;
  if (SPRITE_PATH_SET.has(normalizedPath)) {
    return normalizedPath;
  }

  const lastSlashIndex = path.lastIndexOf('/');
  const filename = lastSlashIndex >= 0 ? path.slice(lastSlashIndex + 1) : path;
  for (const key of SPRITE_PATHS) {
    if (key.endsWith('/' + filename) || key === filename) {
      return key;
    }
  }

  console.warn(`Sprite not found in manifest: ${path}`);
  return null;
}
