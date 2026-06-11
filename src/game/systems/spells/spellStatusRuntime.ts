export function getStatusEffectExpiryMs(nowMs: number, durationMs: number) {
  const baseMs = Number.isFinite(nowMs) ? nowMs : 0;
  const safeDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  return baseMs + safeDurationMs;
}
