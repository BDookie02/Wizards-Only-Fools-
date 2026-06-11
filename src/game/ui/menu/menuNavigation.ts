export type MenuDirection = "up" | "down" | "left" | "right";

export function clampMenuIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

export function findDirectionalMenuIndex(
  selector: string,
  attribute: string,
  currentIndex: number,
  direction: MenuDirection,
  count: number,
) {
  if (typeof document === "undefined") return clampMenuIndex(currentIndex, count);

  const elements = document.querySelectorAll<HTMLElement>(selector);
  let currentRect: DOMRect | null = null;

  for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
    const element = elements[elementIndex];
    const index = Number(element.getAttribute(attribute));
    if (!Number.isFinite(index) || element.hasAttribute("disabled")) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (index === currentIndex) {
      currentRect = rect;
      break;
    }
  }

  if (!currentRect) {
    const fallbackDelta = direction === "down" || direction === "right" ? 1 : -1;
    return clampMenuIndex(currentIndex + fallbackDelta, count);
  }

  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  const isVertical = direction === "up" || direction === "down";
  let bestIndex = currentIndex;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
    const element = elements[elementIndex];
    const index = Number(element.getAttribute(attribute));
    if (!Number.isFinite(index) || index === currentIndex || element.hasAttribute("disabled")) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const primaryDistance =
      direction === "up" ? currentCenterY - centerY :
      direction === "down" ? centerY - currentCenterY :
      direction === "left" ? currentCenterX - centerX :
      centerX - currentCenterX;
    if (primaryDistance <= 4) continue;

    const perpendicularDistance = isVertical
      ? Math.abs(centerX - currentCenterX)
      : Math.abs(centerY - currentCenterY);
    const overlaps = isVertical
      ? rect.right >= currentRect.left && rect.left <= currentRect.right
      : rect.bottom >= currentRect.top && rect.top <= currentRect.bottom;
    const score = primaryDistance * 1000 + perpendicularDistance + (overlaps ? 0 : 500);

    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}
