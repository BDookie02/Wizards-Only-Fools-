export function getGamepadScanNowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
