export const VOICE_SPEAKING_THRESHOLD = 0.026;
export const VOICE_SPEAKING_HANG_MS = 180;
export const VOICE_ANALYZER_INTERVAL_MS = 1000 / 30;
export const MOBILE_VOICE_ANALYZER_INTERVAL_MS = 1000 / 15;
export const VOICE_PROXIMITY_VOLUME_REFRESH_MS = 120;
export const VOICE_SOUNDBOARD_BLIP_MS = 950;
export const VOICE_DEBUG_PEER_SUMMARY_REFRESH_MS = 250;
export const VOICE_SOUNDBOARD_BLIP_NOTES: readonly { frequency: number; offset: number; duration: number }[] = [
  { frequency: 392, offset: 0, duration: 0.16 },
  { frequency: 523.25, offset: 0.18, duration: 0.18 },
  { frequency: 659.25, offset: 0.39, duration: 0.2 },
];

export function stopVoiceMediaStreamTracks(stream: MediaStream | null | undefined) {
  if (!stream) return;
  const tracks = stream.getTracks();
  for (let index = 0; index < tracks.length; index += 1) {
    tracks[index].stop();
  }
}

export function setVoiceMediaStreamAudioTracksEnabled(stream: MediaStream | null | undefined, enabled: boolean) {
  if (!stream) return;
  const tracks = stream.getAudioTracks();
  for (let index = 0; index < tracks.length; index += 1) {
    tracks[index].enabled = enabled;
  }
}

export function serializeVoiceDescription(description: RTCSessionDescription | null): RTCSessionDescriptionInit | null {
  if (!description) return null;
  return { type: description.type, sdp: description.sdp };
}

export function getVoiceAnalyzerIntervalMs(mobilePerformanceMode: boolean) {
  return mobilePerformanceMode ? MOBILE_VOICE_ANALYZER_INTERVAL_MS : VOICE_ANALYZER_INTERVAL_MS;
}

export function getVoiceProximityVolume({
  distanceSq,
  outputVolume,
  range,
}: {
  distanceSq: number;
  outputVolume: number;
  range: number;
}) {
  const safeRange = Math.max(1, range);
  const rangeSq = safeRange * safeRange;
  if (distanceSq >= rangeSq) return 0;
  const proximity = 1 - Math.sqrt(distanceSq) / safeRange;
  return Math.max(0, Math.min(1, outputVolume * proximity * proximity));
}
