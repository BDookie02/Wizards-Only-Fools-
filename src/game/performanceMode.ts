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

export function isMobileLikeDevice() {
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

export function isMobilePerformanceMode() {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "quality" || params.get("quality") === "1") return false;
    if (params.get("mobilePerf") === "1" || params.get("perf") === "mobile") return true;
    if (window.localStorage?.getItem("wizards-quality-performance") === "1") return false;
    if (window.localStorage?.getItem("wizards-mobile-performance") === "1") return true;
  }

  return isMobileLikeDevice();
}
