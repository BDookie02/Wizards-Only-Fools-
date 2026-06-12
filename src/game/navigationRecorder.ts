import {
  clearActiveNavigationRecording,
  getActiveNavigationRecorderStatus,
  getActiveNavigationRecordingSession,
  getNavigationRecorderNowMs,
  startNavigationRecordingRuntime,
  stopNavigationRecordingRuntime,
  type NavigationRecorderResult,
  type NavigationRecordingSession,
} from "./navigationRecorderRuntime";

const NAV_RECORDING_STORAGE_KEY = "wizards-only-fools-navigation-recordings";
const MAX_STORED_SESSIONS = 8;

function safeGetStoredSessions(): NavigationRecordingSession[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(NAV_RECORDING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const sessions: NavigationRecordingSession[] = [];
    for (let index = 0; index < parsed.length; index += 1) {
      const session = parsed[index];
      if (
        Boolean(session) &&
        typeof session.id === "string" &&
        Array.isArray(session.samples)
      ) {
        sessions.push(session);
      }
    }
    return sessions;
  } catch {
    return [];
  }
}

function getCappedStoredSessions(sessions: NavigationRecordingSession[]) {
  const startIndex = Math.max(0, sessions.length - MAX_STORED_SESSIONS);
  const nextSessions = new Array<NavigationRecordingSession>(sessions.length - startIndex);
  let writeIndex = 0;
  for (let index = startIndex; index < sessions.length; index += 1) {
    nextSessions[writeIndex] = sessions[index];
    writeIndex += 1;
  }
  return nextSessions;
}

function safeSetStoredSessions(sessions: NavigationRecordingSession[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      NAV_RECORDING_STORAGE_KEY,
      JSON.stringify(getCappedStoredSessions(sessions))
    );
  } catch {
    // Recording should never break gameplay if storage is unavailable.
  }
}

function appendNavigationSession(sessions: NavigationRecordingSession[], session: NavigationRecordingSession) {
  const nextSessions = new Array<NavigationRecordingSession>(sessions.length + 1);
  for (let index = 0; index < sessions.length; index += 1) {
    nextSessions[index] = sessions[index];
  }
  nextSessions[sessions.length] = session;
  return nextSessions;
}

function persistSession(session: NavigationRecordingSession) {
  const sessions = safeGetStoredSessions();
  safeSetStoredSessions(appendNavigationSession(sessions, session));
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

export function startNavigationRecording(label?: string): NavigationRecorderResult {
  return startNavigationRecordingRuntime(label);
}

export function stopNavigationRecording(): NavigationRecorderResult {
  const result = stopNavigationRecordingRuntime();
  if (result.session) persistSession(result.session);
  return result;
}

export function exportNavigationRecording(): NavigationRecorderResult {
  const activeSession = getActiveNavigationRecordingSession();
  const storedSessions = safeGetStoredSessions();
  const sessions = activeSession ? appendNavigationSession(storedSessions, activeSession) : storedSessions;

  if (sessions.length === 0) {
    return { ok: false, message: "No navigation recordings to export" };
  }

  const latest = sessions[sessions.length - 1];
  const safeLabel = latest.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `wizards-nav-${safeLabel || "recording"}-${latest.id}.json`;
  const downloaded = downloadJson(filename, {
    exportedAt: getNavigationRecorderNowMs(),
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
  clearActiveNavigationRecording();
  safeSetStoredSessions([]);
  return { ok: true, message: "Navigation recordings cleared" };
}

export function getNavigationRecorderStatus() {
  const storedSessions = safeGetStoredSessions();
  const activeStatus = getActiveNavigationRecorderStatus();

  return {
    ...activeStatus,
    storedSessionCount: storedSessions.length,
  };
}
