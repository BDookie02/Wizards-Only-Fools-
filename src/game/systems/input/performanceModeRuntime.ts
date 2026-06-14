export type PerformanceModeDeviceMetrics = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  screenWidth?: number;
  screenHeight?: number;
  innerWidth?: number;
  innerHeight?: number;
};

export type DeviceModeOptions = {
  params?: URLSearchParams | null;
  nativeMobileLikeDevice: boolean;
};

export type MobilePerformanceModeOptions = DeviceModeOptions & {
  qualityPreference?: string;
  mobilePreference?: string;
};

function resolveDimension(primary = 0, fallback = 0) {
  return Number.isFinite(primary) && primary > 0 ? primary : fallback;
}

export function isIOSLikeDeviceFromMetrics({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
}: PerformanceModeDeviceMetrics) {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function isDesktopUserAgent(userAgent: string) {
  return /Windows NT|Macintosh|X11|Linux x86_64/i.test(userAgent);
}

export function getNativeMobileSignatureFromMetrics({
  userAgent = "",
  platform = "",
  maxTouchPoints = 0,
  screenWidth = 0,
  screenHeight = 0,
  innerWidth = 0,
  innerHeight = 0,
}: PerformanceModeDeviceMetrics) {
  return [userAgent, platform, maxTouchPoints, screenWidth, screenHeight, innerWidth, innerHeight].join("|");
}

export function resolveNativeMobileLikeDevice(metrics: PerformanceModeDeviceMetrics) {
  const userAgent = metrics.userAgent || "";
  const maxTouchPoints = metrics.maxTouchPoints || 0;
  const hasTouch = maxTouchPoints > 0;
  const shortSide = Math.min(
    resolveDimension(metrics.screenWidth, metrics.innerWidth),
    resolveDimension(metrics.screenHeight, metrics.innerHeight),
  );
  const androidLike = /Android/i.test(userAgent);
  const mobileUserAgent = /Mobile|Tablet|iPhone|iPad|iPod/i.test(userAgent);

  if (isIOSLikeDeviceFromMetrics(metrics) || androidLike) return true;
  if (isDesktopUserAgent(userAgent)) return false;
  return mobileUserAgent || (hasTouch && shortSide <= 900);
}

export function resolveForcedMobileQaMode(params?: URLSearchParams | null) {
  if (!params) return false;
  return (
    params.get("qaTouchLayout") === "1" ||
    params.get("qaMobileLayout") === "1" ||
    params.get("touchControls") === "1" ||
    params.get("qaTouchControls") === "1"
  );
}

export function resolveForcedTouchControlsQaMode(params?: URLSearchParams | null) {
  if (!params) return false;
  return params.get("touchControls") === "1" || params.get("qaTouchControls") === "1";
}

export function resolveMobileLikeDevice({ params, nativeMobileLikeDevice }: DeviceModeOptions) {
  return resolveForcedMobileQaMode(params) || nativeMobileLikeDevice;
}

export function resolveTouchGameplayDevice({ params, nativeMobileLikeDevice }: DeviceModeOptions) {
  return resolveForcedTouchControlsQaMode(params) || nativeMobileLikeDevice;
}

export function resolveMobilePerformanceMode({
  params,
  qualityPreference = "",
  mobilePreference = "",
  nativeMobileLikeDevice,
}: MobilePerformanceModeOptions) {
  if (params?.get("perf") === "quality" || params?.get("quality") === "1") return false;
  if (params?.get("mobilePerf") === "1" || params?.get("perf") === "mobile") return true;
  if (qualityPreference === "1") return false;
  if (mobilePreference === "1") return true;
  return resolveMobileLikeDevice({ params, nativeMobileLikeDevice });
}
