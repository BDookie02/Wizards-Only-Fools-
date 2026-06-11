export function isIOSLikeDevice() {
  if (typeof navigator === "undefined") return false;

  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

function isDesktopUserAgent(userAgent: string) {
  return /Windows NT|Macintosh|X11|Linux x86_64/i.test(userAgent);
}

function isNativeMobileLikeDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  const shortSide = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  const androidLike = /Android/i.test(userAgent);
  const mobileUserAgent = /Mobile|Tablet|iPhone|iPad|iPod/i.test(userAgent);

  if (isIOSLikeDevice() || androidLike) return true;
  if (isDesktopUserAgent(userAgent)) return false;

  return mobileUserAgent || (hasTouch && shortSide <= 900);
}

let cachedQaSearch = "";
let cachedQaParams: URLSearchParams | null = null;

function getQaParams() {
  if (typeof window === "undefined") return null;
  const search = window.location.search || "";
  if (cachedQaParams && cachedQaSearch === search) return cachedQaParams;
  cachedQaSearch = search;
  cachedQaParams = new URLSearchParams(search);
  return cachedQaParams;
}

export function isForcedMobileQaMode() {
  const params = getQaParams();
  if (!params) return false;
  return (
    params.get("qaTouchLayout") === "1" ||
    params.get("qaMobileLayout") === "1" ||
    params.get("touchControls") === "1" ||
    params.get("qaTouchControls") === "1"
  );
}

export function isForcedTouchControlsQaMode() {
  const params = getQaParams();
  if (!params) return false;
  return params.get("touchControls") === "1" || params.get("qaTouchControls") === "1";
}

export function isMobileLikeDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (isForcedMobileQaMode()) return true;
  return isNativeMobileLikeDevice();
}

export function isTouchGameplayDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (isForcedTouchControlsQaMode()) return true;
  return isNativeMobileLikeDevice();
}

export function isMobilePerformanceMode() {
  if (typeof window !== "undefined") {
    const params = getQaParams();
    if (params?.get("perf") === "quality" || params?.get("quality") === "1") return false;
    if (params?.get("mobilePerf") === "1" || params?.get("perf") === "mobile") return true;
    if (window.localStorage?.getItem("wizards-quality-performance") === "1") return false;
    if (window.localStorage?.getItem("wizards-mobile-performance") === "1") return true;
  }

  return isMobileLikeDevice();
}
