export type LanInfoResponse = {
  lanAddresses?: string[];
  httpPort?: number;
  httpsPort?: number | null;
  secure?: boolean;
};

export function sanitizeInviteRoomCode(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 64);
}

export function extractInviteRoomCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(trimmed, origin);
    const room = url.searchParams.get("room");
    if (room) return sanitizeInviteRoomCode(room);
  } catch {
    // Treat non-URL input as a raw room code below.
  }

  const roomParamMatch = trimmed.match(/[?&]room=([^&\s]+)/i);
  if (roomParamMatch?.[1]) {
    return sanitizeInviteRoomCode(decodeURIComponent(roomParamMatch[1]));
  }

  return sanitizeInviteRoomCode(trimmed);
}

export function getCurrentInviteRoomCode(fallback = "lobby") {
  if (typeof window === "undefined") return fallback;
  return sanitizeInviteRoomCode(new URL(window.location.href).searchParams.get("room") || fallback);
}

export function isLocalInviteHttpHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function shouldRequireSecureOriginForVoice(isSecureContext: boolean, hostname: string) {
  return !isSecureContext && !isLocalInviteHttpHost(hostname);
}

export type InviteRoomJoinResolution = {
  status: "invalid" | "current" | "navigate";
  roomCode: string;
  message: string;
  nextUrl: string;
};

export function resolveInviteRoomJoin(
  inviteInput: string,
  currentRoomCode: string,
  currentHref = typeof window === "undefined" ? "http://localhost" : window.location.href,
): InviteRoomJoinResolution {
  const roomCode = extractInviteRoomCode(inviteInput);
  if (!roomCode) {
    return {
      status: "invalid",
      roomCode: "",
      message: "ENTER A VALID CODE",
      nextUrl: "",
    };
  }

  if (roomCode === currentRoomCode) {
    return {
      status: "current",
      roomCode,
      message: "ALREADY IN THIS ROOM",
      nextUrl: "",
    };
  }

  const nextUrl = new URL(currentHref);
  nextUrl.searchParams.set("room", roomCode);
  return {
    status: "navigate",
    roomCode,
    message: "",
    nextUrl: nextUrl.toString(),
  };
}

export function getCurrentLanMobileInviteUrl(
  lanInfo?: LanInfoResponse,
  fallbackUrl = typeof window === "undefined" ? "" : window.location.href,
) {
  if (typeof window === "undefined") return fallbackUrl;

  try {
    const currentUrl = new URL(window.location.href);
    const params = new URLSearchParams(currentUrl.search);
    if (!params.has("mobilePerf")) params.set("mobilePerf", "1");

    const lanAddress = lanInfo?.lanAddresses?.[0];
    const httpPort = lanInfo?.httpPort || 3000;
    if (lanAddress) {
      return `http://${lanAddress}:${httpPort}${currentUrl.pathname}?${params.toString()}`;
    }
  } catch {
    // Fall back to the visible room URL if the browser URL is malformed.
  }

  return fallbackUrl;
}

export function getMobileInviteUrl(roomCode: string, lanInfo?: LanInfoResponse) {
  if (typeof window === "undefined") return "";
  const room = extractInviteRoomCode(roomCode);
  if (!room) return "";

  const url = new URL(window.location.href);
  url.searchParams.set("room", room);
  url.searchParams.set("mobilePerf", "1");

  const lanAddress = lanInfo?.lanAddresses?.[0];
  const httpPort = lanInfo?.httpPort;
  if (lanAddress && httpPort) {
    return `http://${lanAddress}:${httpPort}${url.pathname}?${url.searchParams.toString()}`;
  }

  return url.toString();
}

export function applyInviteRoomCode(value: string) {
  if (typeof window === "undefined") return "";
  const room = extractInviteRoomCode(value);
  const url = new URL(window.location.href);
  if (room) url.searchParams.set("room", room);
  else url.searchParams.delete("room");
  window.history.replaceState(null, "", url.toString());
  return room;
}
