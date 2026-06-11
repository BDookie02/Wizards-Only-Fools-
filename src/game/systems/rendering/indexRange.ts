const indexRangeCache = new Map<number, readonly number[]>();

export function getCachedIndexRange(count: number) {
  const safeCount = Math.max(0, Math.floor(count));
  const cached = indexRangeCache.get(safeCount);
  if (cached) return cached;

  const indices = new Array<number>(safeCount);
  for (let index = 0; index < safeCount; index += 1) {
    indices[index] = index;
  }
  indexRangeCache.set(safeCount, indices);
  return indices;
}
