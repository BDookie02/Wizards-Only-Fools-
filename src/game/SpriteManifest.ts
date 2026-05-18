const SPRITE_MANIFEST = import.meta.glob('/public/**/*.{png,gif}', {
  query: '?url',
  import: 'default'
}) as Record<string, () => Promise<string>>;

const SPRITE_PATHS = Object.keys(SPRITE_MANIFEST);
const SPRITE_PATH_SET = new Set(SPRITE_PATHS);

export function getSpriteUrl(path: string): string | null {
  // First, try an exact match (assuming path starts with /sprites/...)
  const normalizedPath = path.startsWith('/public/') ? path.slice('/public'.length) : path;
  const exactKey = '/public' + normalizedPath;
  if (SPRITE_PATH_SET.has(exactKey)) {
    return normalizedPath;
  }

  // Fallback: Find by exact filename match
  const filename = path.split('/').pop() || path;
  for (const key of SPRITE_PATHS) {
    if (key.endsWith('/' + filename) || key === filename) {
      return key.slice('/public'.length);
    }
  }

  console.warn(`Sprite not found in manifest: ${path}`);
  return null;
}
