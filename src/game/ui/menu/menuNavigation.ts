export type MenuDirection = "up" | "down" | "left" | "right";

export function clampMenuIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

type MenuNavigationCandidate = {
  centerX: number;
  centerY: number;
  domOrder: number;
  index: number;
  rect: DOMRect;
};

const MENU_DIRECTION_EPSILON_PX = 4;

function isForwardDirection(direction: MenuDirection) {
  return direction === "down" || direction === "right";
}

function isVerticalDirection(direction: MenuDirection) {
  return direction === "up" || direction === "down";
}

function getVisibleMenuCandidates(selector: string, attribute: string) {
  const elements = document.querySelectorAll<HTMLElement>(selector);
  const candidates: MenuNavigationCandidate[] = [];

  for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
    const element = elements[elementIndex];
    const index = Number(element.getAttribute(attribute));
    if (!Number.isFinite(index) || element.hasAttribute("disabled")) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    candidates.push({
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      domOrder: elementIndex,
      index,
      rect,
    });
  }

  return candidates;
}

function getSequentialFallbackIndex(
  candidates: readonly MenuNavigationCandidate[],
  currentIndex: number,
  direction: MenuDirection,
  count: number,
) {
  if (candidates.length === 0) return clampMenuIndex(currentIndex, count);

  const forward = isForwardDirection(direction);
  let fallback: MenuNavigationCandidate | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (forward) {
      if (candidate.index <= currentIndex) continue;
      if (!fallback || candidate.index < fallback.index) fallback = candidate;
    } else {
      if (candidate.index >= currentIndex) continue;
      if (!fallback || candidate.index > fallback.index) fallback = candidate;
    }
  }

  if (fallback) return fallback.index;

  const clampedIndex = clampMenuIndex(currentIndex, count);
  return candidates.some((candidate) => candidate.index === clampedIndex)
    ? clampedIndex
    : candidates[0].index;
}

function getPrimaryDistance(
  candidate: MenuNavigationCandidate,
  current: MenuNavigationCandidate,
  direction: MenuDirection,
) {
  if (direction === "up") return current.centerY - candidate.centerY;
  if (direction === "down") return candidate.centerY - current.centerY;
  if (direction === "left") return current.centerX - candidate.centerX;
  return candidate.centerX - current.centerX;
}

function getRangeGap(startA: number, endA: number, startB: number, endB: number) {
  if (endA >= startB && endB >= startA) return 0;
  return startA > endB ? startA - endB : startB - endA;
}

function getDirectionalScore(
  candidate: MenuNavigationCandidate,
  current: MenuNavigationCandidate,
  direction: MenuDirection,
) {
  const vertical = isVerticalDirection(direction);
  const primaryDistance = getPrimaryDistance(candidate, current, direction);
  if (primaryDistance <= MENU_DIRECTION_EPSILON_PX) return Number.POSITIVE_INFINITY;

  const laneGap = vertical
    ? getRangeGap(candidate.rect.left, candidate.rect.right, current.rect.left, current.rect.right)
    : getRangeGap(candidate.rect.top, candidate.rect.bottom, current.rect.top, current.rect.bottom);
  const currentCenterInCandidateLane = vertical
    ? current.centerX >= candidate.rect.left - MENU_DIRECTION_EPSILON_PX &&
      current.centerX <= candidate.rect.right + MENU_DIRECTION_EPSILON_PX
    : current.centerY >= candidate.rect.top - MENU_DIRECTION_EPSILON_PX &&
      current.centerY <= candidate.rect.bottom + MENU_DIRECTION_EPSILON_PX;
  const candidateCenterInCurrentLane = vertical
    ? candidate.centerX >= current.rect.left - MENU_DIRECTION_EPSILON_PX &&
      candidate.centerX <= current.rect.right + MENU_DIRECTION_EPSILON_PX
    : candidate.centerY >= current.rect.top - MENU_DIRECTION_EPSILON_PX &&
      candidate.centerY <= current.rect.bottom + MENU_DIRECTION_EPSILON_PX;
  const isSameLane = currentCenterInCandidateLane || candidateCenterInCurrentLane || laneGap === 0;
  if (!isSameLane) return Number.POSITIVE_INFINITY;

  const perpendicularDistance = vertical
    ? Math.abs(candidate.centerX - current.centerX)
    : Math.abs(candidate.centerY - current.centerY);
  const indexDistance = Math.abs(candidate.index - current.index);

  return primaryDistance * 10000 + perpendicularDistance + indexDistance * 0.01 + candidate.domOrder * 0.001;
}

export function findDirectionalMenuIndex(
  selector: string,
  attribute: string,
  currentIndex: number,
  direction: MenuDirection,
  count: number,
) {
  if (typeof document === "undefined") return clampMenuIndex(currentIndex, count);

  const safeCount = Math.max(1, count);
  const candidates = getVisibleMenuCandidates(selector, attribute);
  const currentCandidate = candidates.find((candidate) => candidate.index === currentIndex);

  if (!currentCandidate) {
    return getSequentialFallbackIndex(candidates, currentIndex, direction, safeCount);
  }

  const clampedCurrentIndex = clampMenuIndex(currentIndex, safeCount);
  let bestIndex = currentIndex;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidate = candidates[candidateIndex];
    if (candidate.index === currentIndex) continue;

    const score = getDirectionalScore(candidate, currentCandidate, direction);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = candidate.index;
    }
  }

  return Number.isFinite(bestScore) ? bestIndex : clampedCurrentIndex;
}
