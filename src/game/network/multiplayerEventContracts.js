export const MULTIPLAYER_MAX_WORLD_COORDINATE = 10000000;
export const MULTIPLAYER_MAX_DAMAGE_PER_EVENT = 250;
export const MULTIPLAYER_MAX_STATUS_DURATION_MS = 15000;
export const MULTIPLAYER_MAX_ENGINE_PLACEABLES = 64;
export const MULTIPLAYER_MAX_VOICE_SDP_LENGTH = 65536;
export const MULTIPLAYER_MAX_VOICE_ICE_CANDIDATE_LENGTH = 4096;

export const MULTIPLAYER_NETWORK_EVENTS = Object.freeze({
  APPLY_STATUS_EFFECT: "applyStatusEffect",
  CAST_SPELL: "castSpell",
  CLEAR_STATUS_EFFECT: "clearStatusEffect",
  DAMAGE_HEALTH: "damageHealth",
  ENGINE_PLACEABLE_DELETE: "enginePlaceableDelete",
  ENGINE_PLACEABLE_SNAPSHOT: "enginePlaceableSnapshot",
  ENGINE_PLACEABLE_UPSERT: "enginePlaceableUpsert",
  GRAB_CONTROL: "grabControl",
  GRAB_RELEASE: "grabRelease",
  HIT_PLAYER: "hitPlayer",
  MANA_PULSE: "manaPulse",
  SET_ARMOR: "setArmor",
  UPDATE_ME: "updateMe",
});

export const MULTIPLAYER_NETWORK_SPELL_TYPES = Object.freeze([
  "fireball",
  "iceshard",
  "arcanebeam",
  "healspell",
  "icespell",
  "ringsofpower",
  "lightning",
  "smokebomb",
  "portal",
  "blink",
  "grab",
  "tornado",
  "meteorshower",
  "flamethrower",
  "discshield",
  "orbshield",
  "kunai",
  "healingcrystals",
  "magicarmor",
  "jumpboost",
  "speedboost",
  "tungstonballsack",
  "sleep",
  "poison",
  "acid",
  "magicglassorb",
  "__manaPulseAura",
]);

export const MULTIPLAYER_NETWORK_STATUS_EFFECTS = Object.freeze(["slow", "sleep", "poison", "acid"]);

const MULTIPLAYER_NETWORK_ANIMATIONS = new Set([
  "idle",
  "sleep",
  "grabbed",
  "meditate",
  "slide",
  "crouchwalk",
  "crouch",
  "walk",
  "holding",
  "jump",
  "casting",
  "sprint",
]);

const MULTIPLAYER_CHARACTER_STYLE_OPTIONS = Object.freeze({
  topStyle: new Set(["simple", "robe", "vest", "tunic"]),
  pantsStyle: new Set(["pants", "shorts", "skirt", "robe"]),
  shoesStyle: new Set(["boots", "shoes", "sandals", "barefoot"]),
  hatStyle: new Set(["none", "wizard", "floppy-wizard", "cap", "hood", "pharaoh"]),
  hairStyle: new Set(["none", "short", "bob", "spikes", "long"]),
  facialHairStyle: new Set(["none", "mustache", "goatee", "beard"]),
  eyeStyle: new Set(["calm", "wide", "angry", "sleepy", "content", "dull", "sus", "sus-shadow", "terrified", "sad", "hard-shut", "done", "happy", "nervous", "nervous-teary"]),
  mouthStyle: new Set(["neutral", "smile", "frown", "open"]),
});

function hasOwnProperties(value) {
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) return true;
  }
  return false;
}

const MULTIPLAYER_CHARACTER_COLOR_KEYS = Object.freeze([
  "skinColor",
  "topColor",
  "pantsColor",
  "shoesColor",
  "hatColor",
  "hairColor",
  "facialHairColor",
]);

const SPELL_TYPE_SET = new Set(MULTIPLAYER_NETWORK_SPELL_TYPES);
const STATUS_EFFECT_SET = new Set(MULTIPLAYER_NETWORK_STATUS_EFFECTS);
const VOICE_DESCRIPTION_TYPES = new Set(["answer", "offer", "pranswer", "rollback"]);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function sanitizeFiniteNumber(value, fallback = 0, min = -MULTIPLAYER_MAX_WORLD_COORDINATE, max = MULTIPLAYER_MAX_WORLD_COORDINATE) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function sanitizeVectorComponent(value) {
  return sanitizeFiniteNumber(value, 0);
}

function sanitizeVector3Object(value, fallback = null) {
  if (!value || typeof value !== "object") return fallback;
  const x = Array.isArray(value) ? value[0] : value.x;
  const y = Array.isArray(value) ? value[1] : value.y;
  const z = Array.isArray(value) ? value[2] : value.z;
  return {
    x: sanitizeVectorComponent(x),
    y: sanitizeVectorComponent(y),
    z: sanitizeVectorComponent(z),
  };
}

function sanitizeVector3Array(value, fallback = null) {
  const vector = sanitizeVector3Object(value, null);
  return vector ? [vector.x, vector.y, vector.z] : fallback;
}

function sanitizeDirectionVector(value, fallback = { x: 0, y: 0, z: -1 }) {
  const vector = sanitizeVector3Object(value, fallback);
  if (!vector) return null;
  const lengthSq = vector.x * vector.x + vector.y * vector.y + vector.z * vector.z;
  if (lengthSq < 0.000001) return fallback ? { ...fallback } : null;
  const invLength = 1 / Math.sqrt(lengthSq);
  return {
    x: vector.x * invLength,
    y: vector.y * invLength,
    z: vector.z * invLength,
  };
}

function sanitizeNetworkString(value, maxLength = 96) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function sanitizeVoiceSignalString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").slice(0, maxLength);
}

export function sanitizeNetworkPlayerId(value) {
  return sanitizeNetworkString(value, 128);
}

export function sanitizeNetworkDamage(value) {
  return sanitizeFiniteNumber(value, 0, 0, MULTIPLAYER_MAX_DAMAGE_PER_EVENT);
}

export function sanitizeNetworkArmor(value, maxArmor = 50) {
  return sanitizeFiniteNumber(value, 0, 0, maxArmor);
}

export function sanitizeNetworkStatusEffect(value) {
  return STATUS_EFFECT_SET.has(value) ? value : null;
}

export function sanitizeStatusEffectsList(value) {
  if (!Array.isArray(value)) return [];
  const safeEffects = [];
  let hasSlow = false;
  let hasSleep = false;
  let hasPoison = false;
  let hasAcid = false;
  for (let index = 0; index < value.length && safeEffects.length < MULTIPLAYER_NETWORK_STATUS_EFFECTS.length; index += 1) {
    const effect = sanitizeNetworkStatusEffect(value[index]);
    if (effect === "slow") {
      if (hasSlow) continue;
      hasSlow = true;
    } else if (effect === "sleep") {
      if (hasSleep) continue;
      hasSleep = true;
    } else if (effect === "poison") {
      if (hasPoison) continue;
      hasPoison = true;
    } else if (effect === "acid") {
      if (hasAcid) continue;
      hasAcid = true;
    } else {
      continue;
    }
    safeEffects.push(effect);
  }
  return safeEffects;
}

export function sanitizeCharacterCustomizationPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const safe = {};
  for (let index = 0; index < MULTIPLAYER_CHARACTER_COLOR_KEYS.length; index += 1) {
    const key = MULTIPLAYER_CHARACTER_COLOR_KEYS[index];
    const color = typeof value[key] === "string" ? value[key].trim().toLowerCase() : "";
    if (HEX_COLOR_PATTERN.test(color)) {
      safe[key] = color;
    }
  }
  for (const key in MULTIPLAYER_CHARACTER_STYLE_OPTIONS) {
    const optionSet = MULTIPLAYER_CHARACTER_STYLE_OPTIONS[key];
    const option = sanitizeNetworkString(value[key], 32);
    if (optionSet.has(option)) {
      safe[key] = option;
    }
  }
  return hasOwnProperties(safe) ? safe : null;
}

export function sanitizePlayerUpdatePayload(data) {
  if (!data || typeof data !== "object") return null;
  const safe = {};
  const pos = sanitizeVector3Array(data.pos, null);
  if (pos) safe.pos = pos;
  const rot = sanitizeVector3Array(data.rot, null);
  if (rot) safe.rot = rot;
  const aimDir = sanitizeVector3Array(sanitizeDirectionVector(data.aimDir), null);
  if (aimDir) safe.aimDir = aimDir;
  const anim = sanitizeNetworkString(data.anim, 32);
  if (MULTIPLAYER_NETWORK_ANIMATIONS.has(anim)) {
    safe.anim = anim;
  }
  const character = sanitizeCharacterCustomizationPayload(data.character);
  if (character) safe.character = character;
  if (data.survivalLevel !== undefined) {
    safe.survivalLevel = sanitizeFiniteNumber(data.survivalLevel, 1, 1, 999);
  }
  if (data.isSpeaking !== undefined) {
    safe.isSpeaking = data.isSpeaking === true;
  }
  return hasOwnProperties(safe) ? safe : null;
}

export function sanitizeSpellCastPayload(data) {
  if (!data || typeof data !== "object") return null;
  const type = sanitizeNetworkString(data.type, 40);
  if (!SPELL_TYPE_SET.has(type)) return null;
  const pos = sanitizeVector3Object(data.pos, null);
  if (!pos) return null;
  const dir = sanitizeDirectionVector(data.dir);
  const safe = { type, pos, dir };
  const hand = data.hand === "right" ? "right" : data.hand === "left" ? "left" : null;
  if (hand) safe.hand = hand;
  const grabId = sanitizeNetworkString(data.grabId, 96);
  if (grabId) safe.grabId = grabId;
  if (data.grabPhase === "cast" || data.grabPhase === "release") {
    safe.grabPhase = data.grabPhase;
  }
  return safe;
}

export function sanitizeGrabPayload(data) {
  if (!data || typeof data !== "object") return null;
  const grabId = sanitizeNetworkString(data.grabId, 96);
  if (!grabId) return null;
  const safe = { grabId };
  const hand = data.hand === "right" ? "right" : data.hand === "left" ? "left" : null;
  if (hand) safe.hand = hand;
  const origin = sanitizeVector3Object(data.origin, null);
  if (origin) safe.origin = origin;
  const aimDir = sanitizeDirectionVector(data.aimDir ?? data.dir, null);
  if (aimDir) {
    safe.aimDir = aimDir;
    safe.dir = aimDir;
  }
  return safe;
}

export function sanitizeStatusEffectPayload(data) {
  if (!data || typeof data !== "object") return null;
  const targetId = sanitizeNetworkPlayerId(data.targetId);
  const effect = sanitizeNetworkStatusEffect(data.effect);
  if (!targetId || !effect) return null;
  const durationMs = sanitizeFiniteNumber(data.durationMs, MULTIPLAYER_MAX_STATUS_DURATION_MS, 0, MULTIPLAYER_MAX_STATUS_DURATION_MS);
  return { targetId, effect, durationMs };
}

export function sanitizeClearStatusEffectPayload(data) {
  if (!data || typeof data !== "object") return null;
  const targetId = sanitizeNetworkPlayerId(data.targetId);
  const effects = sanitizeStatusEffectsList(data.effects);
  if (!targetId || effects.length === 0) return null;
  return { targetId, effects };
}

export function sanitizeDamageEventArgs(targetId, damage) {
  const safeTargetId = sanitizeNetworkPlayerId(targetId);
  const safeDamage = sanitizeNetworkDamage(damage);
  if (!safeTargetId || safeDamage <= 0) return null;
  return [safeTargetId, safeDamage];
}

export function sanitizeEnginePlaceableObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const instanceId = sanitizeNetworkString(value.instanceId, 96);
  const placeableId = sanitizeNetworkString(value.placeableId, 80);
  const label = sanitizeNetworkString(value.label, 80);
  if (!instanceId || !placeableId) return null;
  return {
    instanceId,
    placeableId,
    label: label || placeableId,
    x: sanitizeFiniteNumber(value.x),
    y: sanitizeFiniteNumber(value.y),
    z: sanitizeFiniteNumber(value.z),
    yaw: sanitizeFiniteNumber(value.yaw, 0, -Math.PI * 8, Math.PI * 8),
  };
}

export function sanitizeEnginePlaceableUpsertPayload(data) {
  const object = sanitizeEnginePlaceableObject(data?.object ?? data);
  return object ? { object } : null;
}

export function sanitizeEnginePlaceableDeletePayload(data) {
  if (!data || typeof data !== "object") return null;
  const instanceId = sanitizeNetworkString(data.instanceId, 96);
  return instanceId ? { instanceId } : null;
}

export function sanitizeEnginePlaceableSnapshotPayload(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.objects)) return null;
  const objects = [];
  for (let index = 0; index < data.objects.length && objects.length < MULTIPLAYER_MAX_ENGINE_PLACEABLES; index += 1) {
    const object = sanitizeEnginePlaceableObject(data.objects[index]);
    if (object) objects.push(object);
  }
  return { objects };
}

export function sanitizeVoiceDescriptionSignalPayload(data, expectedType = "") {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const targetId = sanitizeNetworkPlayerId(data.targetId);
  const sourceDescription = data.sdp;
  if (!targetId || !sourceDescription || typeof sourceDescription !== "object" || Array.isArray(sourceDescription)) {
    return null;
  }
  const type = sanitizeNetworkString(sourceDescription.type, 16);
  if (!VOICE_DESCRIPTION_TYPES.has(type) || (expectedType && type !== expectedType)) {
    return null;
  }
  const sdp = sanitizeVoiceSignalString(sourceDescription.sdp, MULTIPLAYER_MAX_VOICE_SDP_LENGTH);
  if (type !== "rollback" && !sdp) {
    return null;
  }
  return { targetId, sdp: { type, sdp } };
}

export function sanitizeVoiceIceCandidateSignalPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const targetId = sanitizeNetworkPlayerId(data.targetId);
  const sourceCandidate = data.candidate;
  if (!targetId || !sourceCandidate || typeof sourceCandidate !== "object" || Array.isArray(sourceCandidate)) {
    return null;
  }
  const candidate = sanitizeVoiceSignalString(sourceCandidate.candidate, MULTIPLAYER_MAX_VOICE_ICE_CANDIDATE_LENGTH);
  if (!candidate) return null;
  const safeCandidate = { candidate };
  const sdpMid = sanitizeVoiceSignalString(sourceCandidate.sdpMid, 128);
  if (sdpMid) safeCandidate.sdpMid = sdpMid;
  const sdpMLineIndex = Number(sourceCandidate.sdpMLineIndex);
  if (Number.isFinite(sdpMLineIndex)) {
    safeCandidate.sdpMLineIndex = Math.max(0, Math.min(64, Math.floor(sdpMLineIndex)));
  }
  const usernameFragment = sanitizeVoiceSignalString(sourceCandidate.usernameFragment, 256);
  if (usernameFragment) safeCandidate.usernameFragment = usernameFragment;
  return { targetId, candidate: safeCandidate };
}

export function sanitizeOutgoingNetworkEventArgs(eventName, args) {
  switch (eventName) {
    case MULTIPLAYER_NETWORK_EVENTS.UPDATE_ME: {
      const payload = sanitizePlayerUpdatePayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.CAST_SPELL: {
      const payload = sanitizeSpellCastPayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.GRAB_CONTROL:
    case MULTIPLAYER_NETWORK_EVENTS.GRAB_RELEASE: {
      const payload = sanitizeGrabPayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.APPLY_STATUS_EFFECT: {
      const payload = sanitizeStatusEffectPayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.CLEAR_STATUS_EFFECT: {
      const payload = sanitizeClearStatusEffectPayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.ENGINE_PLACEABLE_UPSERT: {
      const payload = sanitizeEnginePlaceableUpsertPayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.ENGINE_PLACEABLE_DELETE: {
      const payload = sanitizeEnginePlaceableDeletePayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.ENGINE_PLACEABLE_SNAPSHOT: {
      const payload = sanitizeEnginePlaceableSnapshotPayload(args[0]);
      return payload ? [payload] : null;
    }
    case MULTIPLAYER_NETWORK_EVENTS.DAMAGE_HEALTH:
    case MULTIPLAYER_NETWORK_EVENTS.HIT_PLAYER:
      return sanitizeDamageEventArgs(args[0], args[1]);
    case MULTIPLAYER_NETWORK_EVENTS.SET_ARMOR:
      return [sanitizeNetworkArmor(args[0])];
    case MULTIPLAYER_NETWORK_EVENTS.MANA_PULSE:
      return [];
    default:
      return args;
  }
}
