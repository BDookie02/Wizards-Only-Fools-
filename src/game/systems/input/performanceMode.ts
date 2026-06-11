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

function getNativeMobileSignature() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "";

  return [
    navigator.userAgent || "",
    navigator.platform || "",
    navigator.maxTouchPoints || 0,
    window.screen?.width || 0,
    window.screen?.height || 0,
    window.innerWidth || 0,
    window.innerHeight || 0,
  ].join("|");
}

let cachedNativeMobileSignature = "";
let cachedNativeMobileLikeDevice = false;

function isNativeMobileLikeDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;

  const signature = getNativeMobileSignature();
  if (cachedNativeMobileSignature === signature) return cachedNativeMobileLikeDevice;

  const userAgent = navigator.userAgent || "";
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  const shortSide = Math.min(window.screen?.width || window.innerWidth, window.screen?.height || window.innerHeight);
  const androidLike = /Android/i.test(userAgent);
  const mobileUserAgent = /Mobile|Tablet|iPhone|iPad|iPod/i.test(userAgent);

  cachedNativeMobileSignature = signature;
  if (isIOSLikeDevice() || androidLike) {
    cachedNativeMobileLikeDevice = true;
    return cachedNativeMobileLikeDevice;
  }
  if (isDesktopUserAgent(userAgent)) {
    cachedNativeMobileLikeDevice = false;
    return cachedNativeMobileLikeDevice;
  }

  cachedNativeMobileLikeDevice = mobileUserAgent || (hasTouch && shortSide <= 900);
  return cachedNativeMobileLikeDevice;
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

function getStoredPerformancePreference(key: string) {
  try {
    return window.localStorage?.getItem(key) ?? "";
  } catch {
    return "";
  }
}

let cachedMobilePerformanceSignature = "";
let cachedMobilePerformanceMode = false;

export function isMobilePerformanceMode() {
  if (typeof window !== "undefined") {
    const search = window.location.search || "";
    const qualityPreference = getStoredPerformancePreference("wizards-quality-performance");
    const mobilePreference = getStoredPerformancePreference("wizards-mobile-performance");
    const signature = [
      search,
      qualityPreference,
      mobilePreference,
      getNativeMobileSignature(),
    ].join("|");

    if (cachedMobilePerformanceSignature === signature) return cachedMobilePerformanceMode;

    const params = getQaParams();
    cachedMobilePerformanceSignature = signature;
    if (params?.get("perf") === "quality" || params?.get("quality") === "1") {
      cachedMobilePerformanceMode = false;
      return cachedMobilePerformanceMode;
    }
    if (params?.get("mobilePerf") === "1" || params?.get("perf") === "mobile") {
      cachedMobilePerformanceMode = true;
      return cachedMobilePerformanceMode;
    }
    if (qualityPreference === "1") {
      cachedMobilePerformanceMode = false;
      return cachedMobilePerformanceMode;
    }
    if (mobilePreference === "1") {
      cachedMobilePerformanceMode = true;
      return cachedMobilePerformanceMode;
    }
  }

  cachedMobilePerformanceMode = isMobileLikeDevice();
  return cachedMobilePerformanceMode;
}
