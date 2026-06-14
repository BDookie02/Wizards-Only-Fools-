import {
  getNativeMobileSignatureFromMetrics,
  isIOSLikeDeviceFromMetrics,
  resolveForcedMobileQaMode,
  resolveForcedTouchControlsQaMode,
  resolveMobileLikeDevice,
  resolveMobilePerformanceMode,
  resolveNativeMobileLikeDevice,
  resolveTouchGameplayDevice,
  type PerformanceModeDeviceMetrics,
} from "./performanceModeRuntime";

function readDeviceMetrics(): PerformanceModeDeviceMetrics | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  return {
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    maxTouchPoints: navigator.maxTouchPoints || 0,
    screenWidth: window.screen?.width || 0,
    screenHeight: window.screen?.height || 0,
    innerWidth: window.innerWidth || 0,
    innerHeight: window.innerHeight || 0,
  };
}

export function isIOSLikeDevice() {
  const metrics = readDeviceMetrics();
  return metrics ? isIOSLikeDeviceFromMetrics(metrics) : false;
}

function getNativeMobileSignature() {
  const metrics = readDeviceMetrics();
  return metrics ? getNativeMobileSignatureFromMetrics(metrics) : "";
}

let cachedNativeMobileSignature = "";
let cachedNativeMobileLikeDevice = false;

function isNativeMobileLikeDevice() {
  const metrics = readDeviceMetrics();
  if (!metrics) return false;

  const signature = getNativeMobileSignature();
  if (cachedNativeMobileSignature === signature) return cachedNativeMobileLikeDevice;

  cachedNativeMobileSignature = signature;
  cachedNativeMobileLikeDevice = resolveNativeMobileLikeDevice(metrics);
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
  return resolveForcedMobileQaMode(params);
}

export function isForcedTouchControlsQaMode() {
  const params = getQaParams();
  return resolveForcedTouchControlsQaMode(params);
}

export function isMobileLikeDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return resolveMobileLikeDevice({
    params: getQaParams(),
    nativeMobileLikeDevice: isNativeMobileLikeDevice(),
  });
}

export function isTouchGameplayDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return resolveTouchGameplayDevice({
    params: getQaParams(),
    nativeMobileLikeDevice: isNativeMobileLikeDevice(),
  });
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
    cachedMobilePerformanceMode = resolveMobilePerformanceMode({
      params,
      qualityPreference,
      mobilePreference,
      nativeMobileLikeDevice: isMobileLikeDevice(),
    });
    return cachedMobilePerformanceMode;
  }

  cachedMobilePerformanceMode = isMobileLikeDevice();
  return cachedMobilePerformanceMode;
}
