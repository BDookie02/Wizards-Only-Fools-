import { GameMode, SURVIVAL_BLOCK_SIZE } from "../store/gameStore";

const NAV_RECORDING_STORAGE_KEY = "wizards-only-fools-navigation-recordings";
const NAV_RECORDING_VERSION = 1;
const NAV_SAMPLE_INTERVAL_MS = 125;
const MAX_SAMPLES_PER_SESSION = 9000;
const MAX_STORED_SESSIONS = 8;

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

interface ActiveNavigationRecording {
  id: string;
  label: string;
  startedAt: number;
  lastSampleAt: number;
  samples: NavigationSample[];
}

interface NavigationRecorderResult {
  ok: boolean;
  message: string;
  session?: NavigationRecordingSession;
}

let activeRecording: ActiveNavigationRecording | null = null;

function makeRecordingId() {
  return `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function safeGetStoredSessions(): NavigationRecordingSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(NAV_RECORDING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((session): session is NavigationRecordingSession =>
      Boolean(session) &&
      typeof session.id === "string" &&
      Array.isArray(session.samples)
    );
  } catch {
    return [];
  }
}

function safeSetStoredSessions(sessions: NavigationRecordingSession[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      NAV_RECORDING_STORAGE_KEY,
      JSON.stringify(sessions.slice(-MAX_STORED_SESSIONS))
    );
  } catch {
    // Recording should never break gameplay if storage is unavailable.
  }
}

function persistSession(session: NavigationRecordingSession) {
  const sessions = safeGetStoredSessions();
  safeSetStoredSessions([...sessions, session]);
}

function makeSession(recording: ActiveNavigationRecording, endedAt = Date.now()): NavigationRecordingSession {
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

function downloadJson(filename: string, payload: unknown) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;

  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export function isNavigationRecordingActive() {
  return activeRecording !== null;
}

export function startNavigationRecording(label?: string): NavigationRecorderResult {
  if (activeRecording) {
    return {
      ok: false,
      message: `Navigation recording already running: ${activeRecording.label}`,
    };
  }

  activeRecording = {
    id: makeRecordingId(),
    label: sanitizeRecordingLabel(label),
    startedAt: Date.now(),
    lastSampleAt: 0,
    samples: [],
  };

  return {
    ok: true,
    message: `Navigation recording started: ${activeRecording.label}`,
  };
}

export function recordNavigationSample(input: NavigationSampleInput) {
  if (!activeRecording) return;

  const now = Date.now();
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

export function stopNavigationRecording(): NavigationRecorderResult {
  if (!activeRecording) {
    return { ok: false, message: "No navigation recording is running" };
  }

  const session = makeSession(activeRecording);
  activeRecording = null;
  persistSession(session);

  return {
    ok: true,
    message: `Navigation recording stopped: ${session.samples.length} samples`,
    session,
  };
}

export function exportNavigationRecording(): NavigationRecorderResult {
  const activeSession = activeRecording ? makeSession(activeRecording) : null;
  const storedSessions = safeGetStoredSessions();
  const sessions = activeSession ? [...storedSessions, activeSession] : storedSessions;

  if (sessions.length === 0) {
    return { ok: false, message: "No navigation recordings to export" };
  }

  const latest = sessions[sessions.length - 1];
  const safeLabel = latest.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `wizards-nav-${safeLabel || "recording"}-${latest.id}.json`;
  const downloaded = downloadJson(filename, {
    exportedAt: Date.now(),
    activeRecording: Boolean(activeSession),
    sessions,
  });

  return {
    ok: downloaded,
    message: downloaded
      ? `Navigation recording exported: ${latest.samples.length} latest samples`
      : "Navigation export failed",
    session: latest,
  };
}

export function clearNavigationRecordings(): NavigationRecorderResult {
  activeRecording = null;
  safeSetStoredSessions([]);
  return { ok: true, message: "Navigation recordings cleared" };
}

export function getNavigationRecorderStatus() {
  const storedSessions = safeGetStoredSessions();
  const sampleCount = activeRecording?.samples.length ?? 0;
  const durationMs = activeRecording ? Date.now() - activeRecording.startedAt : 0;

  return {
    active: Boolean(activeRecording),
    label: activeRecording?.label ?? "",
    sampleCount,
    durationMs,
    storedSessionCount: storedSessions.length,
  };
}

