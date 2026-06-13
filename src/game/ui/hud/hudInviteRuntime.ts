import { sanitizePlayerName } from "../../../store/gameStore";
import {
  getCurrentLanMobileInviteUrl,
  resolveInviteRoomJoin,
  type InviteRoomJoinResolution,
  type LanInfoResponse,
} from "../../network/inviteRoom";

export type HudInviteClipboardWriter = (value: string) => Promise<void> | void | undefined;

export type HudInviteCopyOptions = {
  fallbackUrl: string;
  fetchLanInfo: () => Promise<LanInfoResponse | null | undefined>;
  writeClipboard?: HudInviteClipboardWriter;
};

export async function copyHudInviteUrl({
  fallbackUrl,
  fetchLanInfo,
  writeClipboard,
}: HudInviteCopyOptions) {
  let inviteUrl = fallbackUrl;

  try {
    const lanInfo = await fetchLanInfo();
    if (lanInfo) inviteUrl = getCurrentLanMobileInviteUrl(lanInfo, fallbackUrl);
  } catch {
    // Keep the visible room URL when the LAN helper is unavailable.
  }

  try {
    await writeClipboard?.(inviteUrl);
  } catch {
    // Clipboard access is best-effort; returning the resolved URL keeps callers deterministic.
  }

  return inviteUrl;
}

export function resolveHudInviteJoin(
  inviteInput: string,
  currentRoomCode: string,
  currentHref: string,
): InviteRoomJoinResolution {
  return resolveInviteRoomJoin(inviteInput, currentRoomCode, currentHref);
}

export function resolveHudSubmittedPlayerName(value: string) {
  const cleaned = sanitizePlayerName(value);
  return cleaned.length >= 2 ? cleaned : null;
}
