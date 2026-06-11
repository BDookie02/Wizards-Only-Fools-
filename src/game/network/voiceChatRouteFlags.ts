export type VoiceChatRouteFlags = {
  soundboardTestActive: boolean;
  autoStartTestActive: boolean;
};

const EMPTY_VOICE_CHAT_ROUTE_FLAGS: VoiceChatRouteFlags = {
  soundboardTestActive: false,
  autoStartTestActive: false,
};

const VOICE_TEST_VALUES = new Set(["1", "true", "soundboard"]);
let cachedVoiceChatRouteSearch: string | null = null;
let cachedVoiceChatRouteFlags = EMPTY_VOICE_CHAT_ROUTE_FLAGS;

function getLowercaseParam(params: URLSearchParams, name: string) {
  return params.get(name)?.toLowerCase() ?? "";
}

export function readVoiceChatRouteFlagsFromSearch(search: string): VoiceChatRouteFlags {
  if (search === cachedVoiceChatRouteSearch) return cachedVoiceChatRouteFlags;
  cachedVoiceChatRouteSearch = search;
  try {
    const params = new URLSearchParams(search);
    const voiceAutoStart = getLowercaseParam(params, "voiceAutoStart");
    cachedVoiceChatRouteFlags = {
      soundboardTestActive:
        VOICE_TEST_VALUES.has(getLowercaseParam(params, "voiceTest")) ||
        VOICE_TEST_VALUES.has(getLowercaseParam(params, "voiceSoundboard")),
      autoStartTestActive: voiceAutoStart === "1" || voiceAutoStart === "true",
    };
  } catch {
    cachedVoiceChatRouteFlags = EMPTY_VOICE_CHAT_ROUTE_FLAGS;
  }
  return cachedVoiceChatRouteFlags;
}

export function readCurrentVoiceChatRouteFlags() {
  if (typeof window === "undefined") return EMPTY_VOICE_CHAT_ROUTE_FLAGS;
  return readVoiceChatRouteFlagsFromSearch(window.location.search);
}
