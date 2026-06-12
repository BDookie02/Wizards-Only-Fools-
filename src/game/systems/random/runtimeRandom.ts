const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

let fallbackRandomCounter = 0;
let fallbackRandomState = 0x6d2b79f5;

export function getRuntimeRandomNowMs() {
  return Date.now();
}

function getFallbackRandomUnit() {
  fallbackRandomCounter += 1;
  fallbackRandomState = Math.imul(
    fallbackRandomState ^ getRuntimeRandomNowMs() ^ fallbackRandomCounter,
    1664525,
  ) + 1013904223;

  let value = fallbackRandomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export function getRuntimeRandomUnit() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] / 4294967296;
  }

  return getFallbackRandomUnit();
}

export function getRandomBase36Suffix(length: number) {
  const size = Math.max(0, Math.floor(length));
  let suffix = "";
  for (let index = 0; index < size; index += 1) {
    suffix += BASE36_ALPHABET[Math.floor(getRuntimeRandomUnit() * BASE36_ALPHABET.length)];
  }
  return suffix;
}

export function makeRuntimeRandomId(prefix: string, suffixLength = 6, nowMs = getRuntimeRandomNowMs()) {
  return `${prefix}-${nowMs.toString(36)}-${getRandomBase36Suffix(suffixLength)}`;
}
