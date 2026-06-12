import { SURVIVAL_BLOCK_SIZE, type GameMode } from "../store/gameStore";
import { makeRuntimeRandomId } from "./systems/random/runtimeRandom";

export const NAV_RECORDING_VERSION = 1;
export const NAV_SAMPLE_INTERVAL_MS = 125;
export const MAX_SAMPLES_PER_SESSION = 9000;

type Vec3 = [number, number, number];
type ChunkCoord = [number, number];

export interface NavigationSampleInput {
  gameMode: GameMode;
  pos: Vec3;
  rot: Vec3;
  aimDir: Vec3;
  velocity: Vec3;
  input: {
    forward: number;
    strafe: number;
    sprint: boolean;
    jump: boolean;
    slide: boolean;
    vclip: boolean;
  };
  state: {
    grounded: boolean;
    moving: boolean;
    sliding: boolean;
    sprinting: boolean;
    spellMenuOpen: boolean;
  };
}

export interface NavigationSample extends NavigationSampleInput {
  t: number;
  chunk: ChunkCoord;
}

export interface NavigationRecordingSession {
  id: string;
  label: string;
  version: number;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  sampleIntervalMs: number;
  samples: NavigationSample[];
}

export interface ActiveNavigationRecording {
  id: string;
  label: string;
  startedAt: number;
  lastSampleAt: number;
  samples: NavigationSample[];
}

export interface NavigationRecorderResult {
  ok: boolean;
  message: string;
  session?: NavigationRecordingSession;
}

let activeRecording: ActiveNavigationRecording | null = null;

export function getNavigationRecorderNowMs() {
  return Date.now();
}

function makeRecordingId() {
  return makeRuntimeRandomId("nav", 6);
}

function roundNumber(value: number, places = 3) {
  if (!Number.isFinite(value)) return 0;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function roundVec3(value: Vec3, places = 3): Vec3 {
  return [
    roundNumber(value[0], places),
    roundNumber(value[1], places),
    roundNumber(value[2], places),
  ];
}

function sanitizeRecordingLabel(value?: string) {
  return (value || "survival navigation")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .slice(0, 48) || "survival navigation";
}

export function makeNavigationRecordingSession(
  recording: ActiveNavigationRecording,
  endedAt = getNavigationRecorderNowMs(),
): NavigationRecordingSession {
  return {
    id: recording.id,
    label: recording.label,
    version: NAV_RECORDING_VERSION,
    startedAt: recording.startedAt,
    endedAt,
    durationMs: Math.max(0, endedAt - recording.startedAt),
    sampleIntervalMs: NAV_SAMPLE_INTERVAL_MS,
    samples: recording.samples,
  };
}

export function getActiveNavigationRecordingSession() {
  return activeRecording ? makeNavigationRecordingSession(activeRecording) : null;
}

export function clearActiveNavigationRecording() {
  activeRecording = null;
}

export function isNavigationRecordingActive() {
  return activeRecording !== null;
}

export function startNavigationRecordingRuntime(label?: string): NavigationRecorderResult {
  if (activeRecording) {
    return {
      ok: false,
      message: `Navigation recording already running: ${activeRecording.label}`,
    };
  }

  activeRecording = {
    id: makeRecordingId(),
    label: sanitizeRecordingLabel(label),
    startedAt: getNavigationRecorderNowMs(),
    lastSampleAt: 0,
    samples: [],
  };

  return {
    ok: true,
    message: `Navigation recording started: ${activeRecording.label}`,
  };
}

export function recordNavigationSample(input: NavigationSampleInput, now = getNavigationRecorderNowMs()) {
  if (!activeRecording) return;

  if (now - activeRecording.lastSampleAt < NAV_SAMPLE_INTERVAL_MS) return;
  activeRecording.lastSampleAt = now;

  if (activeRecording.samples.length >= MAX_SAMPLES_PER_SESSION) return;

  const pos = roundVec3(input.pos);
  const sample: NavigationSample = {
    ...input,
    t: now - activeRecording.startedAt,
    pos,
    rot: roundVec3(input.rot, 4),
    aimDir: roundVec3(input.aimDir, 4),
    velocity: roundVec3(input.velocity),
    input: {
      ...input.input,
      forward: roundNumber(input.input.forward, 3),
      strafe: roundNumber(input.input.strafe, 3),
    },
    chunk: [
      Math.floor(pos[0] / SURVIVAL_BLOCK_SIZE),
      Math.floor(pos[2] / SURVIVAL_BLOCK_SIZE),
    ],
  };

  activeRecording.samples.push(sample);
}

export function stopNavigationRecordingRuntime(): NavigationRecorderResult {
  if (!activeRecording) {
    return { ok: false, message: "No navigation recording is running" };
  }

  const session = makeNavigationRecordingSession(activeRecording);
  activeRecording = null;

  return {
    ok: true,
    message: `Navigation recording stopped: ${session.samples.length} samples`,
    session,
  };
}

export function getActiveNavigationRecorderStatus() {
  const sampleCount = activeRecording?.samples.length ?? 0;
  const durationMs = activeRecording ? getNavigationRecorderNowMs() - activeRecording.startedAt : 0;

  return {
    active: Boolean(activeRecording),
    label: activeRecording?.label ?? "",
    sampleCount,
    durationMs,
  };
}
