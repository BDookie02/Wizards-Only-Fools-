import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socket";
import {
  DEFAULT_VOICE_OUTPUT_VOLUME,
  DEFAULT_VOICE_PROXIMITY_RANGE,
  useGameStore,
} from "../store/gameStore";
import { getPrimaryGamepad, isGamepadButtonPressed, type GamepadButtonName } from "./controllerInput";
import { isMobilePerformanceMode } from "./performanceMode";

type VoiceDescriptionSignal = {
  fromId: string;
  targetId?: string;
  sdp: RTCSessionDescriptionInit;
};

type VoiceIceSignal = {
  fromId: string;
  targetId?: string;
  candidate: RTCIceCandidateInit;
};

type PeerRecord = {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  stream?: MediaStream;
  iceQueue: RTCIceCandidateInit[];
};

type VoiceSource = {
  stream: MediaStream;
  label: string;
  cleanup: () => void;
};

const ICE_CONFIGURATION: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const SPEAKING_THRESHOLD = 0.026;
const SPEAKING_HANG_MS = 180;
const VOLUME_REFRESH_MS = 120;
const VOICE_TEST_VALUES = new Set(["1", "true", "soundboard"]);

function getVoiceTestParam(name: string) {
  try {
    return new URLSearchParams(window.location.search).get(name)?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

function isVoiceSoundboardTestActive() {
  return VOICE_TEST_VALUES.has(getVoiceTestParam("voiceTest")) || VOICE_TEST_VALUES.has(getVoiceTestParam("voiceSoundboard"));
}

function isVoiceAutoStartTestActive() {
  return getVoiceTestParam("voiceAutoStart") === "1" || getVoiceTestParam("voiceAutoStart") === "true";
}

function createSoundboardTestStream(): VoiceSource {
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("AudioContext is not available for soundboard voice testing.");
  }

  const context = new AudioContextCtor();
  const destination = context.createMediaStreamDestination();
  const masterGain = context.createGain();
  masterGain.gain.value = 0.24;
  masterGain.connect(destination);

  const resume = () => {
    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }
  };

  const playSoundboardBlip = () => {
    resume();
    const now = context.currentTime;
    const notes = [
      { frequency: 392, offset: 0, duration: 0.16 },
      { frequency: 523.25, offset: 0.18, duration: 0.18 },
      { frequency: 659.25, offset: 0.39, duration: 0.2 },
    ];

    notes.forEach(({ frequency, offset, duration }) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const start = now + offset + 0.02;
      const end = start + duration;

      oscillator.type = "square";
      oscillator.frequency.value = frequency;
      noteGain.gain.setValueAtTime(0.001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.42, start + 0.018);
      noteGain.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(end + 0.03);
    });
  };

  const interval = window.setInterval(playSoundboardBlip, 950);
  window.addEventListener("pointerdown", resume, { passive: true });
  window.addEventListener("keydown", resume);
  void context.resume().catch(() => {});
  playSoundboardBlip();

  return {
    stream: destination.stream,
    label: "Soundboard",
    cleanup: () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
      destination.stream.getTracks().forEach(track => track.stop());
      void context.close().catch(() => {});
    },
  };
}

function serializeDescription(description: RTCSessionDescription | null): RTCSessionDescriptionInit | null {
  if (!description) return null;
  return { type: description.type, sdp: description.sdp };
}

function getLocalPlayerPosition() {
  const pos = (window as any).localPlayerPos;
  if (!pos) return null;

  if (Array.isArray(pos)) {
    return { x: Number(pos[0]) || 0, y: Number(pos[1]) || 0, z: Number(pos[2]) || 0 };
  }

  return {
    x: Number(pos.x) || 0,
    y: Number(pos.y) || 0,
    z: Number(pos.z) || 0,
  };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

export function VoiceChat() {
  const voiceChatEnabled = useGameStore(s => s.voiceChatEnabled);
  const voiceInputMode = useGameStore(s => s.voiceInputMode);
  const voicePushToTalkKey = useGameStore(s => s.voicePushToTalkKey);
  const controllerVoiceButton = useGameStore(s => s.controllerBindings.voicePushToTalk);
  const playerIds = useGameStore(s => Object.keys(s.players).join(","));
  const debugVoiceStatus = useGameStore(s => s.voiceStatus);
  const debugVoiceError = useGameStore(s => s.voiceError);
  const debugIsSpeaking = useGameStore(s => s.isVoiceSpeaking);
  const voiceSoundboardTestActive = isVoiceSoundboardTestActive();
  const voiceAutoStartTestActive = isVoiceAutoStartTestActive();
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, PeerRecord>>({});
  const voiceSourceLabelRef = useRef("Mic");
  const pttHeldRef = useRef(false);
  const controllerPttHeldRef = useRef(false);
  const transmittingRef = useRef(false);
  const speakingRef = useRef(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [debugPeerSummary, setDebugPeerSummary] = useState("no peers");

  const setSpeaking = (speaking: boolean) => {
    if (speakingRef.current === speaking) return;
    speakingRef.current = speaking;
    useGameStore.getState().setVoiceSpeaking(speaking);
  };

  const setVoiceStatus = (status: string) => {
    useGameStore.getState().setVoiceStatus(status);
  };

  const setVoiceError = (error: string) => {
    useGameStore.getState().setVoiceError(error);
  };

  const refreshDebugPeerSummary = () => {
    if (!voiceSoundboardTestActive) return;
    const entries = Object.entries(peersRef.current);
    setDebugPeerSummary(entries.length > 0
      ? entries.map(([peerId, peer]) => `${peerId.slice(0, 4)}:${peer.pc.connectionState}`).join(" ")
      : "no peers"
    );
  };

  const refreshTransmitState = () => {
    const state = useGameStore.getState();
    const transmitting = state.voiceChatEnabled && (
      state.voiceInputMode === "openMic" ||
      pttHeldRef.current ||
      controllerPttHeldRef.current
    );

    transmittingRef.current = transmitting;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = transmitting;
    });

    if (!transmitting) {
      setSpeaking(false);
    }
  };

  const attachLocalTracks = (pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const senderTrackIds = new Set(pc.getSenders().map(sender => sender.track?.id).filter(Boolean));
    stream.getAudioTracks().forEach((track) => {
      if (!senderTrackIds.has(track.id)) {
        pc.addTrack(track, stream);
      }
    });
  };

  const closePeer = (peerId: string) => {
    const peer = peersRef.current[peerId];
    if (!peer) return;

    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    peer.audio.pause();
    peer.audio.srcObject = null;
    peer.audio.remove();
    delete peersRef.current[peerId];
    refreshDebugPeerSummary();
  };

  const closeAllPeers = () => {
    Object.keys(peersRef.current).forEach(closePeer);
  };

  const ensurePeer = (peerId: string) => {
    if (!peerId || peerId === socket.id) return null;
    const existing = peersRef.current[peerId];
    if (existing) {
      attachLocalTracks(existing.pc);
      return existing;
    }

    const pc = new RTCPeerConnection(ICE_CONFIGURATION);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "true");
    audio.volume = 0;
    audio.style.display = "none";
    document.body.appendChild(audio);

    const peer: PeerRecord = { pc, audio, iceQueue: [] };
    peersRef.current[peerId] = peer;
    refreshDebugPeerSummary();
    attachLocalTracks(pc);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit("voiceIceCandidate", {
        targetId: peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream || peer.stream === stream) return;
      peer.stream = stream;
      audio.srcObject = stream;
      void audio.play().catch(() => {});
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setVoiceStatus("Voice connected");
        setVoiceError("");
      } else if (pc.connectionState === "connecting") {
        setVoiceStatus("Connecting voice");
      } else if (pc.connectionState === "disconnected") {
        setVoiceStatus("Voice disconnected");
      }

      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        setVoiceStatus("Voice connection failed");
        closePeer(peerId);
      }
      refreshDebugPeerSummary();
    };

    return peer;
  };

  useEffect(() => {
    if (!voiceSoundboardTestActive || !voiceAutoStartTestActive) return;
    const state = useGameStore.getState();
    if (state.voiceInputMode !== "openMic") {
      state.setVoiceInputMode("openMic");
    }
    if (!state.voiceChatEnabled) {
      state.setVoiceChatEnabled(true);
    }
  }, [voiceAutoStartTestActive, voiceSoundboardTestActive]);

  useEffect(() => {
    if (!voiceSoundboardTestActive) return;
    const interval = window.setInterval(refreshDebugPeerSummary, 250);
    refreshDebugPeerSummary();
    return () => window.clearInterval(interval);
  }, [voiceSoundboardTestActive]);

  const flushQueuedIce = async (peer: PeerRecord) => {
    if (!peer.pc.remoteDescription || peer.iceQueue.length === 0) return;
    const queued = peer.iceQueue.splice(0);
    for (const candidate of queued) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
  };

  const makeOffer = async (peerId: string) => {
    const peer = ensurePeer(peerId);
    if (!peer || peer.pc.signalingState !== "stable") return;

    attachLocalTracks(peer.pc);
    const offer = await peer.pc.createOffer({ offerToReceiveAudio: true });
    await peer.pc.setLocalDescription(offer);
    const sdp = serializeDescription(peer.pc.localDescription);
    if (sdp) {
      socket.emit("voiceOffer", { targetId: peerId, sdp });
    }
  };

  useEffect(() => {
    refreshTransmitState();
  }, [voiceChatEnabled, voiceInputMode, voicePushToTalkKey, controllerVoiceButton]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = useGameStore.getState();
      if (event.code !== state.voicePushToTalkKey || event.repeat || isEditableTarget(event.target)) return;
      if (state.voiceInputMode === "pushToTalk") {
        event.preventDefault();
      }
      pttHeldRef.current = true;
      refreshTransmitState();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== useGameStore.getState().voicePushToTalkKey) return;
      pttHeldRef.current = false;
      refreshTransmitState();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let raf = 0;

    if (!voiceChatEnabled || voiceInputMode !== "pushToTalk") {
      controllerPttHeldRef.current = false;
      refreshTransmitState();
      return undefined;
    }

    const pollController = () => {
      const gamepad = getPrimaryGamepad();
      const button = useGameStore.getState().controllerBindings.voicePushToTalk as GamepadButtonName;
      const pressed = Boolean(gamepad && isGamepadButtonPressed(gamepad, button));

      if (pressed !== controllerPttHeldRef.current) {
        controllerPttHeldRef.current = pressed;
        refreshTransmitState();
      }

      raf = window.requestAnimationFrame(pollController);
    };

    raf = window.requestAnimationFrame(pollController);
    return () => window.cancelAnimationFrame(raf);
  }, [controllerVoiceButton, voiceChatEnabled, voiceInputMode]);

  useEffect(() => {
    let disposed = false;
    let analyzerFrame = 0;
    let audioContext: AudioContext | null = null;
    let sourceCleanup: (() => void) | null = null;

    const cleanupStream = () => {
      window.cancelAnimationFrame(analyzerFrame);
      sourceCleanup?.();
      sourceCleanup = null;
      void audioContext?.close().catch(() => {});
      audioContext = null;
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setStreamVersion(version => version + 1);
      closeAllPeers();
      voiceSourceLabelRef.current = "Mic";
      transmittingRef.current = false;
      pttHeldRef.current = false;
      controllerPttHeldRef.current = false;
      setSpeaking(false);
      setVoiceStatus("Off");
    };

    if (!voiceChatEnabled) {
      cleanupStream();
      return cleanupStream;
    }

    if (!voiceSoundboardTestActive && !navigator.mediaDevices?.getUserMedia) {
      useGameStore.getState().setVoiceChatEnabled(false);
      setVoiceStatus("Mic blocked");
      setVoiceError("Browser blocked microphone access. Use HTTPS LAN URL or localhost.");
      return cleanupStream;
    }

    setVoiceStatus(voiceSoundboardTestActive ? "Starting soundboard" : "Requesting microphone");
    setVoiceError("");
    const sourcePromise: Promise<VoiceSource> = voiceSoundboardTestActive
      ? Promise.resolve().then(createSoundboardTestStream)
      : navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        }).then((stream) => ({
          stream,
          label: "Mic",
          cleanup: () => {},
        }));

    sourcePromise.then((source) => {
      if (disposed) {
        source.cleanup();
        source.stream.getTracks().forEach(track => track.stop());
        return;
      }

      sourceCleanup = source.cleanup;
      voiceSourceLabelRef.current = source.label;
      localStreamRef.current = source.stream;
      source.stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      setStreamVersion(version => version + 1);
      refreshTransmitState();
      setVoiceStatus(`${source.label} ready`);
      setVoiceError("");

      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      audioContext = new AudioContextCtor();
      const sourceNode = audioContext.createMediaStreamSource(source.stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      sourceNode.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      let lastSoundAt = 0;
      let lastAnalyzeAt = 0;
      const analyzeInterval = isMobilePerformanceMode() ? 1000 / 15 : 0;

      const analyze = () => {
        const now = performance.now();
        if (analyzeInterval > 0 && now - lastAnalyzeAt < analyzeInterval) {
          analyzerFrame = window.requestAnimationFrame(analyze);
          return;
        }
        lastAnalyzeAt = now;

        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }

        const rms = Math.sqrt(sum / samples.length);
        if (transmittingRef.current && rms > SPEAKING_THRESHOLD) {
          lastSoundAt = now;
        }
        setSpeaking(transmittingRef.current && now - lastSoundAt < SPEAKING_HANG_MS);
        analyzerFrame = window.requestAnimationFrame(analyze);
      };

      analyzerFrame = window.requestAnimationFrame(analyze);
    }).catch((error) => {
      if (!disposed) {
        useGameStore.getState().setVoiceChatEnabled(false);
        setVoiceStatus(voiceSoundboardTestActive ? "Soundboard unavailable" : "Mic unavailable");
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        setVoiceError(message || (voiceSoundboardTestActive
          ? "Soundboard test input could not start."
          : "Microphone permission was denied or the browser does not trust this page."
        ));
        setSpeaking(false);
      }
    });

    return () => {
      disposed = true;
      cleanupStream();
    };
  }, [voiceChatEnabled, voiceSoundboardTestActive]);

  useEffect(() => {
    const handleOffer = async ({ fromId, sdp }: VoiceDescriptionSignal) => {
      if (!useGameStore.getState().voiceChatEnabled) return;
      const peer = ensurePeer(fromId);
      if (!peer) return;

      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {});
      await flushQueuedIce(peer);
      attachLocalTracks(peer.pc);

      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      const response = serializeDescription(peer.pc.localDescription);
      if (response) {
        socket.emit("voiceAnswer", { targetId: fromId, sdp: response });
      }
    };

    const handleAnswer = async ({ fromId, sdp }: VoiceDescriptionSignal) => {
      const peer = ensurePeer(fromId);
      if (!peer) return;
      await peer.pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(() => {});
      await flushQueuedIce(peer);
    };

    const handleIceCandidate = async ({ fromId, candidate }: VoiceIceSignal) => {
      const peer = ensurePeer(fromId);
      if (!peer || !candidate) return;

      if (!peer.pc.remoteDescription) {
        peer.iceQueue.push(candidate);
        return;
      }

      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    };

    socket.on("voiceOffer", handleOffer);
    socket.on("voiceAnswer", handleAnswer);
    socket.on("voiceIceCandidate", handleIceCandidate);

    return () => {
      socket.off("voiceOffer", handleOffer);
      socket.off("voiceAnswer", handleAnswer);
      socket.off("voiceIceCandidate", handleIceCandidate);
    };
  }, [streamVersion]);

  useEffect(() => {
    if (!voiceChatEnabled || !localStreamRef.current) return;

    const ids = playerIds.split(",").filter(id => id && id !== socket.id);
    const liveIds = new Set(ids);

    ids.forEach((peerId) => {
      ensurePeer(peerId);
      if (socket.id && socket.id < peerId) {
        void makeOffer(peerId).catch(() => {});
      }
    });

    if (ids.length === 0) {
      setVoiceStatus(`${voiceSourceLabelRef.current} ready, waiting for players`);
    } else {
      setVoiceStatus("Voice peer discovered");
    }

    Object.keys(peersRef.current).forEach((peerId) => {
      if (!liveIds.has(peerId)) {
        closePeer(peerId);
      }
    });
  }, [playerIds, streamVersion, voiceChatEnabled]);

  useEffect(() => {
    if (!voiceChatEnabled) return undefined;

    const interval = window.setInterval(() => {
      const localPos = getLocalPlayerPosition();
      const state = useGameStore.getState();
      const outputVolume = state.voiceOutputVolume ?? DEFAULT_VOICE_OUTPUT_VOLUME;
      const range = state.voiceProximityRange ?? DEFAULT_VOICE_PROXIMITY_RANGE;

      Object.entries(peersRef.current).forEach(([peerId, peer]) => {
        const remote = state.players[peerId];
        if (!localPos || !remote) {
          peer.audio.volume = 0;
          return;
        }

        const dx = remote.pos[0] - localPos.x;
        const dy = remote.pos[1] - localPos.y;
        const dz = remote.pos[2] - localPos.z;
        const distance = Math.hypot(dx, dy, dz);
        const proximity = Math.max(0, 1 - distance / Math.max(1, range));
        peer.audio.volume = Math.max(0, Math.min(1, outputVolume * proximity * proximity));
      });
    }, VOLUME_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [voiceChatEnabled]);

  useEffect(() => {
    return () => {
      closeAllPeers();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      setSpeaking(false);
    };
  }, []);

  if (!voiceSoundboardTestActive) return null;

  return (
    <div
      data-testid="voice-test-status"
      className="pointer-events-none fixed left-2 bottom-2 z-[9999] max-w-[320px] rounded border border-lime-300/60 bg-black/80 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-lime-100 shadow-[0_0_16px_rgba(132,204,22,0.35)]"
    >
      <div>Soundboard voice test</div>
      <div data-testid="voice-test-state">
        {debugVoiceStatus} | {debugIsSpeaking ? "speaking" : "quiet"} | {debugPeerSummary}
      </div>
      {debugVoiceError && (
        <div data-testid="voice-test-error" className="mt-1 text-red-200">
          {debugVoiceError}
        </div>
      )}
    </div>
  );
}
