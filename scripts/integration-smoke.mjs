import { io } from "socket.io-client";

const baseUrl = process.env.TEST_SERVER_URL || "https://localhost:3443";
const allowSelfSignedLocalCert = /^https:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(baseUrl);
const emptyRoomGraceMs = 10000;

if (allowSelfSignedLocalCert) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const room = `integration-${Math.random().toString(36).slice(2, 7)}`;
const invalidRoom = `${room}-invalid`;
const bareStringRoom = `${room}-bare`;
const results = {
  room,
  health: null,
  joinRejected: {},
  join: {},
  roomLifecycle: {},
  voiceRelay: {},
  speakingSync: {},
  sleep: {},
  death: {},
  respawn: {},
  errors: [],
};

async function checkHealth() {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  results.health = { ok: response.ok && body.status === "ok", status: response.status, body };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDebugRoom(roomCode) {
  const response = await fetch(`${baseUrl}/api/debug/rooms/${encodeURIComponent(roomCode)}`);
  if (!response.ok) {
    throw new Error(`debug room request failed: ${response.status}`);
  }
  return response.json();
}

function makeClient(label) {
  return io(baseUrl, {
    transports: ["websocket"],
    rejectUnauthorized: !allowSelfSignedLocalCert,
    timeout: 7000,
    forceNew: true,
    reconnection: false,
    autoConnect: false,
    query: { label },
  });
}

function waitFor(socket, event, timeoutMs = 8000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`${socket.id || "socket"} timed out waiting for ${event}`));
    }, timeoutMs);

    const handler = (...args) => {
      const payload = args.length > 1 ? args : args[0];
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function waitConnect(socket) {
  if (socket.connected) return Promise.resolve(socket.id);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("connect timeout")), 8000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket.id);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    socket.connect();
  });
}

const a = makeClient("A");
const b = makeClient("B");
let c = null;

try {
  await checkHealth();

  const unnamed = makeClient("unnamed");
  try {
    await waitConnect(unnamed);
    const rejected = waitFor(unnamed, "joinRejected");
    unnamed.emit("join", { roomCode: invalidRoom, playerName: "" });
    const rejection = await rejected;
    const invalidSnapshot = await fetchDebugRoom(invalidRoom);
    results.joinRejected.emptyNameRejected = rejection?.reason === "name-required";
    results.joinRejected.emptyNameDidNotCreateRoom = invalidSnapshot.exists === false;
  } finally {
    unnamed.disconnect();
  }

  const bareString = makeClient("bare-string");
  try {
    await waitConnect(bareString);
    const rejected = waitFor(bareString, "joinRejected");
    bareString.emit("join", bareStringRoom);
    const rejection = await rejected;
    const invalidSnapshot = await fetchDebugRoom(bareStringRoom);
    results.joinRejected.bareStringRejected = rejection?.reason === "room-required";
    results.joinRejected.bareStringDidNotCreateRoom = invalidSnapshot.exists === false;
  } finally {
    bareString.disconnect();
  }

  const [aId, bId] = await Promise.all([waitConnect(a), waitConnect(b)]);
  results.clients = { aId, bId };

  const aRoomState = waitFor(a, "roomState");
  a.emit("join", { roomCode: room, playerName: "Tester A" });
  const roomA = await aRoomState;

  const aSawJoin = waitFor(a, "playerJoined", 8000, (player) => player?.id === bId);
  const bRoomState = waitFor(b, "roomState");
  b.emit("join", { roomCode: room, playerName: "Tester B" });
  const [joinedPlayer, roomB] = await Promise.all([aSawJoin, bRoomState]);
  results.join = {
    aRoomStateIncludesSelf: Array.isArray(roomA) && roomA.some((player) => player.id === aId),
    aSawBJoin: joinedPlayer?.id === bId,
    bRoomStateContainsA: Array.isArray(roomB) && roomB.some((player) => player.id === aId),
    bRoomStateContainsB: Array.isArray(roomB) && roomB.some((player) => player.id === bId),
  };
  const playerA = roomB.find((player) => player.id === aId);
  const playerB = roomB.find((player) => player.id === bId);
  const playerAColor = playerA?.character?.topColor;
  const playerBColor = playerB?.character?.topColor;
  results.characterColors = {
    aHasColor: typeof playerAColor === "string" && playerAColor.length > 0,
    bHasColor: typeof playerBColor === "string" && playerBColor.length > 0,
    colorsAreUnique: playerAColor !== playerBColor,
    aHatMatchesTop: playerA?.character?.hatColor === playerAColor,
    bHatMatchesTop: playerB?.character?.hatColor === playerBColor,
    aColor: playerAColor,
    bColor: playerBColor,
  };

  const bOffer = waitFor(b, "voiceOffer");
  a.emit("voiceOffer", { targetId: bId, sdp: { type: "offer", sdp: "v=0\r\n" } });
  const offer = await bOffer;

  const aAnswer = waitFor(a, "voiceAnswer");
  b.emit("voiceAnswer", { targetId: aId, sdp: { type: "answer", sdp: "v=0\r\n" } });
  const answer = await aAnswer;

  const bIce = waitFor(b, "voiceIceCandidate");
  a.emit("voiceIceCandidate", {
    targetId: bId,
    candidate: {
      candidate: "candidate:0 1 udp 2122252543 127.0.0.1 9 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    },
  });
  const ice = await bIce;
  results.voiceRelay = {
    offerFromA: offer?.fromId === aId && offer?.targetId === bId,
    answerFromB: answer?.fromId === bId && answer?.targetId === aId,
    iceFromA: ice?.fromId === aId && ice?.targetId === bId,
  };

  const bSawSpeaking = waitFor(
    b,
    "playerMoved",
    8000,
    (payload) => payload?.id === aId && payload?.isSpeaking === true,
  );
  a.emit("updateMe", { isSpeaking: true, pos: [1, 2, 3], rot: [0, 0.5, 0], anim: "idle" });
  const speakingMove = await bSawSpeaking;
  results.speakingSync = {
    received: speakingMove?.id === aId && speakingMove?.isSpeaking === true,
    posSynced: JSON.stringify(speakingMove?.pos) === JSON.stringify([1, 2, 3]),
  };

  const aSleep = waitFor(a, "playerStatusEffect", 8000, (payload) => payload?.id === bId && payload?.effect === "sleep");
  const bSleep = waitFor(b, "playerStatusEffect", 8000, (payload) => payload?.id === bId && payload?.effect === "sleep");
  a.emit("applyStatusEffect", { targetId: bId, effect: "sleep", durationMs: 8000 });
  const [sleepA, sleepB] = await Promise.all([aSleep, bSleep]);
  results.sleep = {
    aSawSleep: sleepA?.until > Date.now(),
    bSawSleep: sleepB?.until > Date.now(),
  };

  const aDead = waitFor(a, "playerHealth", 8000, (payload) => payload?.id === bId && payload?.health === 0);
  const bDead = waitFor(b, "playerHealth", 8000, (payload) => payload?.id === bId && payload?.health === 0);
  a.emit("damageHealth", bId, 100);
  const [deadA, deadB] = await Promise.all([aDead, bDead]);
  results.death = {
    aSawDead: deadA?.health === 0,
    bSawDead: deadB?.health === 0,
  };

  const aRespawn = waitFor(a, "playerRespawn", 6000, (payload) => payload?.id === bId);
  const bRespawn = waitFor(b, "playerRespawn", 6000, (payload) => payload?.id === bId);
  const [respawnA, respawnB] = await Promise.all([aRespawn, bRespawn]);
  results.respawn = {
    aSawRespawn: Array.isArray(respawnA?.pos),
    bSawRespawn: Array.isArray(respawnB?.pos),
    pos: respawnA?.pos,
  };

  a.disconnect();
  b.disconnect();
  await delay(250);
  const emptySnapshot = await fetchDebugRoom(room);

  c = makeClient("C");
  const cId = await waitConnect(c);
  const cRoomState = waitFor(c, "roomState");
  c.emit("join", { roomCode: room, playerName: "Tester C" });
  const roomC = await cRoomState;
  const reconnectedSnapshot = await fetchDebugRoom(room);

  c.disconnect();
  await delay(250);
  const pendingAfterReconnect = await fetchDebugRoom(room);
  await delay(emptyRoomGraceMs + 900);
  const closedSnapshot = await fetchDebugRoom(room);
  results.roomLifecycle = {
    emptyRoomHeldForReconnect: emptySnapshot.exists === true && emptySnapshot.size === 0 && emptySnapshot.cleanupPending === true,
    reconnectRoomStateContainsSelf: Array.isArray(roomC) && roomC.some((player) => player.id === cId),
    reconnectCancelsCleanup: reconnectedSnapshot.exists === true && reconnectedSnapshot.size === 1 && reconnectedSnapshot.cleanupPending === false,
    cleanupRescheduledAfterReconnect: pendingAfterReconnect.exists === true && pendingAfterReconnect.size === 0 && pendingAfterReconnect.cleanupPending === true,
    emptyRoomClosedAfterGrace: closedSnapshot.exists === false,
  };
} catch (error) {
  results.errors.push(error instanceof Error ? error.stack || error.message : String(error));
} finally {
  a.disconnect();
  b.disconnect();
  c?.disconnect();
}

results.ok = results.errors.length === 0 && Object.values(results).every((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return true;
  return Object.values(value).every((nested) => typeof nested !== "boolean" || nested);
});

console.log(JSON.stringify(results, null, 2));
if (!results.ok) process.exit(1);
