let villagerAudioContext: AudioContext | null = null;

export function clampVillagerYelpVolume(volume: number) {
  return Math.max(0.12, Math.min(0.8, volume));
}

export function playVillagerYelp(volume: number) {
  if (typeof window === "undefined") return;

  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const ctx = villagerAudioContext ?? new AudioContextCtor();
    villagerAudioContext = ctx;
    void ctx.resume();

    const now = ctx.currentTime + 0.01;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const safeVolume = clampVillagerYelpVolume(volume);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(760, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
    oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18 * safeVolume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.31);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  } catch {
    // Audio can still be blocked before the first user gesture; the villager reaction should continue visually.
  }
}
