import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import os from "os";
import path from "path";
import {
    MULTIPLAYER_JOIN_REJECTION_REASONS,
    MULTIPLAYER_MAX_PLAYERS_PER_ROOM,
    MULTIPLAYER_SERVER_SEND_RATE_HZ,
    canRoomAcceptPlayer,
    getServerEventBudget,
} from "./src/game/network/multiplayerSessionConfig.js";
import {
    MULTIPLAYER_MAX_ENGINE_PLACEABLES,
    sanitizeClearStatusEffectPayload,
    sanitizeDamageEventArgs,
    sanitizeEnginePlaceableDeletePayload,
    sanitizeEnginePlaceableSnapshotPayload,
    sanitizeEnginePlaceableUpsertPayload,
    sanitizeGrabPayload,
    sanitizeNetworkArmor,
    sanitizePlayerUpdatePayload,
    sanitizeSpellCastPayload,
    sanitizeStatusEffectPayload,
    sanitizeVoiceDescriptionSignalPayload,
    sanitizeVoiceIceCandidateSignalPayload,
} from "./src/game/network/multiplayerEventContracts.js";
import {
    isServerActionOriginNearPlayer,
    isServerDamageTargetAllowed,
    markServerPlayerPose,
    MULTIPLAYER_MAX_STATUS_TARGET_DISTANCE,
} from "./src/game/network/multiplayerServerValidation.js";
async function startServer() {
    const app = express();
    const useHttps = process.argv.includes("--https") || process.env.WIZARDS_HTTPS === "1";
    const PORT = Number(process.env.PORT || (useHttps ? 3443 : 3000));
    const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT || 3000);
    const getLanAddresses = () => {
        const addresses = [];
        const interfaces = os.networkInterfaces();
        for (const name in interfaces) {
            const entries = interfaces[name];
            if (!entries) continue;
            for (let index = 0; index < entries.length; index += 1) {
                const entry = entries[index];
                if (entry && entry.family === "IPv4" && !entry.internal) {
                    addresses.push(entry.address);
                }
            }
        }
        return addresses;
    };
    const loadHttpsOptions = () => {
        const certDir = path.join(process.cwd(), "certs");
        const pfxPath = path.join(certDir, "lan-cert.pfx");
        const passPath = path.join(certDir, "lan-cert.pass");
        if (!fs.existsSync(pfxPath) || !fs.existsSync(passPath)) {
            throw new Error("Missing LAN HTTPS certificate. Run `npm run cert:lan` first, then `npm run dev:https`.");
        }
        return {
            pfx: fs.readFileSync(pfxPath),
            passphrase: fs.readFileSync(passPath, "utf8").trim(),
        };
    };
    // Add CORS middleware for all requests (fixes canvas crossOrigin issues in middleware mode)
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        if (req.method === "OPTIONS") {
            return res.sendStatus(200);
        }
        next();
    });
    const httpServer = useHttps
        ? createHttpsServer(loadHttpsOptions(), app)
        : createHttpServer(app);
    const io = new Server({
        cors: { origin: "*" }
    });
    io.attach(httpServer);
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
    // Basic game state
    const rooms = new Map();
    const roomPlaceables = new Map();
    const emptyRoomCleanupTimers = new Map();
    const EMPTY_ROOM_TTL_MS = 10000;
    const ARMOR_MAX = 50;
    const PLAYER_MOVE_BROADCAST_INTERVAL_MS = 1000 / MULTIPLAYER_SERVER_SEND_RATE_HZ;
    const PLAYER_MOVE_FORCE_BROADCAST_DELTA_SQ = 4;
    const STATUS_DURATIONS = {
        slow: 8000,
        sleep: 8000,
        poison: 10000,
        acid: 10000,
    };
    const DEFAULT_CHARACTER_CUSTOMIZATION = {
        skinColor: "#d6cf91",
        topColor: "#7c3aed",
        pantsColor: "#334155",
        shoesColor: "#1f2937",
        hatColor: "#7c3aed",
        hairColor: "#3f2a1d",
        facialHairColor: "#3f2a1d",
        topStyle: "simple",
        pantsStyle: "pants",
        shoesStyle: "boots",
        hatStyle: "floppy-wizard",
        hairStyle: "none",
        facialHairStyle: "none",
        eyeStyle: "calm",
        mouthStyle: "neutral",
    };
    const PLAYER_COLOR_PALETTE = [
        "#7c3aed",
        "#2563eb",
        "#dc2626",
        "#16a34a",
        "#f59e0b",
        "#0891b2",
        "#db2777",
        "#65a30d",
        "#ea580c",
        "#4f46e5",
        "#0f766e",
        "#be123c",
        "#9333ea",
        "#ca8a04",
        "#0284c7",
        "#84cc16",
    ];
    const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
    const normalizeHexColor = (value, fallback) => {
        if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value.trim())) {
            return fallback;
        }
        const trimmed = value.trim().toLowerCase();
        if (trimmed.length === 4) {
            return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
        }
        return trimmed;
    };
    const hslToHex = (hue, saturation, lightness) => {
        const s = saturation / 100;
        const l = lightness / 100;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = l - c / 2;
        const [r1, g1, b1] = hue < 60
            ? [c, x, 0]
            : hue < 120
                ? [x, c, 0]
                : hue < 180
                    ? [0, c, x]
                    : hue < 240
                        ? [0, x, c]
                        : hue < 300
                            ? [x, 0, c]
                            : [c, 0, x];
        const channel = (value) => Math.round((value + m) * 255).toString(16).padStart(2, "0");
        return `#${channel(r1)}${channel(g1)}${channel(b1)}`;
    };
    const getRoomPlayerColor = (room) => {
        const usedColors = new Set();
        for (const player of room.values()) {
            if (player.playerColor) {
                usedColors.add(player.playerColor);
            }
        }
        for (let index = 0; index < PLAYER_COLOR_PALETTE.length; index += 1) {
            const paletteColor = PLAYER_COLOR_PALETTE[index];
            if (!usedColors.has(paletteColor)) {
                return paletteColor;
            }
        }
        let hue = room.size * 47;
        for (let attempts = 0; attempts < 64; attempts += 1) {
            const color = hslToHex(hue % 360, 82, 52);
            if (!usedColors.has(color)) {
                return color;
            }
            hue += 47;
        }
        return hslToHex(Date.now() % 360, 82, 52);
    };
    const normalizePlayerCharacter = (character = {}, assignedColor = DEFAULT_CHARACTER_CUSTOMIZATION.topColor) => {
        const topColor = normalizeHexColor(character.topColor, assignedColor);
        return {
            ...DEFAULT_CHARACTER_CUSTOMIZATION,
            ...character,
            topColor,
            hatColor: topColor,
        };
    };
    const sanitizeRoomCode = (value) => String(value ?? "")
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, 64);
    const sanitizePlayerName = (value, fallback = "Nameless Wizard") => {
        const cleaned = String(value || "")
            .replace(/[\u0000-\u001f\u007f]/g, "")
            .replace(/\s+/g, " ")
            .replace(/[^a-zA-Z0-9 _-]/g, "")
            .trim()
            .slice(0, 18);
        return cleaned || fallback;
    };
    const sanitizeSurvivalLevel = (value) => {
        const level = Number(value);
        return Number.isFinite(level) ? Math.max(1, Math.min(999, Math.floor(level))) : 1;
    };
    const getPlayerDisplayName = (player, fallbackId = "") => sanitizePlayerName(player?.playerName, `Wizard ${fallbackId.slice(0, 4).toUpperCase() || "????"}`);
    const getPositionDeltaSq = (from, to) => {
        if (!Array.isArray(from) || !Array.isArray(to)) {
            return Number.POSITIVE_INFINITY;
        }
        const dx = (Number(to[0]) || 0) - (Number(from[0]) || 0);
        const dy = (Number(to[1]) || 0) - (Number(from[1]) || 0);
        const dz = (Number(to[2]) || 0) - (Number(from[2]) || 0);
        return dx * dx + dy * dy + dz * dz;
    };
    const clearRoomCleanup = (roomCode) => {
        const timer = emptyRoomCleanupTimers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
        }
        emptyRoomCleanupTimers.delete(roomCode);
    };
    const scheduleEmptyRoomCleanup = (roomCode) => {
        const room = rooms.get(roomCode);
        if (!room || room.size > 0 || emptyRoomCleanupTimers.has(roomCode)) {
            return;
        }
        const timer = setTimeout(() => {
            const latestRoom = rooms.get(roomCode);
            if (latestRoom && latestRoom.size === 0) {
                rooms.delete(roomCode);
                roomPlaceables.delete(roomCode);
            }
            emptyRoomCleanupTimers.delete(roomCode);
        }, EMPTY_ROOM_TTL_MS);
        emptyRoomCleanupTimers.set(roomCode, timer);
    };
    const getRoomPlaceables = (roomCode) => roomPlaceables.get(roomCode) ?? [];
    const setRoomPlaceables = (roomCode, objects) => {
        const nextObjects = Array.isArray(objects)
            ? objects.slice(-MULTIPLAYER_MAX_ENGINE_PLACEABLES)
            : [];
        roomPlaceables.set(roomCode, nextObjects);
        return nextObjects;
    };
    const upsertRoomPlaceable = (roomCode, object) => {
        const currentObjects = getRoomPlaceables(roomCode);
        let existingIndex = -1;
        for (let index = 0; index < currentObjects.length; index += 1) {
            if (currentObjects[index].instanceId === object.instanceId) {
                existingIndex = index;
                break;
            }
        }
        if (existingIndex >= 0) {
            const nextObjects = currentObjects.slice();
            nextObjects[existingIndex] = object;
            return setRoomPlaceables(roomCode, nextObjects);
        }
        return setRoomPlaceables(roomCode, [...currentObjects, object]);
    };
    const deleteRoomPlaceable = (roomCode, instanceId) => {
        const currentObjects = getRoomPlaceables(roomCode);
        const nextObjects = [];
        for (let index = 0; index < currentObjects.length; index += 1) {
            const candidate = currentObjects[index];
            if (candidate.instanceId !== instanceId) nextObjects.push(candidate);
        }
        return setRoomPlaceables(roomCode, nextObjects);
    };
    const announcePlayerDeath = (roomCode, targetId, player) => {
        io.to(roomCode).emit("playerDied", {
            id: targetId,
            playerName: getPlayerDisplayName(player, targetId),
        });
    };
    // rooms: roomCode -> Map of players
    const clearPlayerStatuses = (player) => {
        player.slowUntil = 0;
        player.sleepUntil = 0;
        player.poisonUntil = 0;
        player.acidUntil = 0;
    };
    const respawnPlayer = (roomCode, targetId, player) => {
        setTimeout(() => {
            player.health = 100;
            player.armor = 0;
            player.pos = [0, 5, 0];
            clearPlayerStatuses(player);
            io.to(roomCode).emit("playerArmor", { id: targetId, armor: player.armor });
            io.to(roomCode).emit("playerHealth", { id: targetId, health: player.health });
            io.to(roomCode).emit("playerStatusCleared", { id: targetId, effects: ["slow", "sleep", "poison", "acid"] });
            io.to(roomCode).emit("playerRespawn", { id: targetId, pos: player.pos });
        }, 3000);
    };
    io.on("connection", (socket) => {
        let currentRoom = "";
        let lastPlayerMoveBroadcastAt = 0;
        let lastPlayerMoveBroadcastPos = [0, 2, 0];
        const eventRateState = new Map();
        const allowServerEvent = (eventName) => {
            const budget = getServerEventBudget(eventName);
            if (!budget)
                return true;
            const now = Date.now();
            const state = eventRateState.get(eventName);
            if (!state || now - state.windowStartedAt >= budget.windowMs) {
                eventRateState.set(eventName, { windowStartedAt: now, count: 1 });
                return true;
            }
            if (state.count >= budget.maxEvents) {
                return false;
            }
            state.count += 1;
            return true;
        };
        const removeSocketFromCurrentRoom = () => {
            if (!currentRoom) {
                return;
            }
            const previousRoom = currentRoom;
            const room = rooms.get(previousRoom);
            if (room?.delete(socket.id)) {
                io.to(previousRoom).emit("playerLeft", socket.id);
            }
            socket.leave(previousRoom);
            currentRoom = "";
            if (room?.size === 0) {
                scheduleEmptyRoomCleanup(previousRoom);
            }
        };
        socket.on("join", (payload) => {
            if (!allowServerEvent("join"))
                return;
            const roomCode = sanitizeRoomCode(typeof payload === "object" && payload ? payload.roomCode : "");
            const playerName = sanitizePlayerName(typeof payload === "object" && payload ? payload.playerName : "", "");
            const survivalLevel = sanitizeSurvivalLevel(typeof payload === "object" && payload ? payload.survivalLevel : 1);
            if (!roomCode || playerName.length < 2) {
                socket.emit("joinRejected", {
                    reason: !roomCode
                        ? MULTIPLAYER_JOIN_REJECTION_REASONS.ROOM_REQUIRED
                        : MULTIPLAYER_JOIN_REJECTION_REASONS.NAME_REQUIRED,
                });
                return;
            }
            const existingRoom = rooms.get(roomCode);
            const isRejoiningCurrentRoom = currentRoom === roomCode && existingRoom?.has(socket.id);
            if (!isRejoiningCurrentRoom && existingRoom && !canRoomAcceptPlayer(existingRoom.size)) {
                socket.emit("joinRejected", {
                    reason: MULTIPLAYER_JOIN_REJECTION_REASONS.ROOM_FULL,
                    maxPlayers: MULTIPLAYER_MAX_PLAYERS_PER_ROOM,
                });
                return;
            }
            removeSocketFromCurrentRoom();
            currentRoom = roomCode;
            socket.join(roomCode);
            if (!rooms.has(roomCode)) {
                rooms.set(roomCode, new Map());
            }
            clearRoomCleanup(roomCode);
            const room = rooms.get(roomCode);
            const playerColor = getRoomPlayerColor(room);
            const newPlayer = {
                id: socket.id,
                pos: [0, 2, 0],
                rot: [0, 0, 0],
                aimDir: [0, 0, -1],
                anim: "idle",
                health: 100,
                armor: 0,
                slowUntil: 0,
                sleepUntil: 0,
                poisonUntil: 0,
                acidUntil: 0,
                playerColor,
                playerName,
                survivalLevel,
                character: normalizePlayerCharacter({ topColor: playerColor }, playerColor),
                isSpeaking: false
            };
            room.set(socket.id, newPlayer);
            lastPlayerMoveBroadcastAt = 0;
            lastPlayerMoveBroadcastPos = newPlayer.pos;
            // Send the current room state
            const players = [];
            for (const player of room.values()) {
                players.push(player);
            }
            socket.emit("roomState", players);
            socket.emit("enginePlaceableSnapshot", {
                objects: getRoomPlaceables(roomCode),
                id: "server",
            });
            // Broadcast to others
            socket.to(roomCode).emit("playerJoined", newPlayer);
        });
        socket.on("updateMe", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("updateMe"))
                return;
            const room = rooms.get(currentRoom);
            if (room && room.has(socket.id)) {
                const p = room.get(socket.id);
                const safeData = sanitizePlayerUpdatePayload(data);
                if (!safeData)
                    return;
                if (safeData.character) {
                    safeData.character = normalizePlayerCharacter(safeData.character, p.playerColor);
                }
                if (safeData.survivalLevel !== undefined) {
                    safeData.survivalLevel = sanitizeSurvivalLevel(safeData.survivalLevel);
                }
                const now = Date.now();
                const importantUpdate =
                    Boolean(safeData.character) ||
                    (safeData.anim !== undefined && safeData.anim !== p.anim) ||
                    (safeData.survivalLevel !== undefined && safeData.survivalLevel !== p.survivalLevel) ||
                    (safeData.isSpeaking !== undefined && safeData.isSpeaking !== p.isSpeaking);
                const forcedPoseDelta = safeData.pos
                    ? getPositionDeltaSq(lastPlayerMoveBroadcastPos, safeData.pos) >= PLAYER_MOVE_FORCE_BROADCAST_DELTA_SQ
                    : false;
                const shouldBroadcastMove =
                    importantUpdate ||
                    forcedPoseDelta ||
                    now - lastPlayerMoveBroadcastAt >= PLAYER_MOVE_BROADCAST_INTERVAL_MS;
                Object.assign(p, safeData);
                if (safeData.pos) {
                    markServerPlayerPose(p);
                }
                if (shouldBroadcastMove) {
                    lastPlayerMoveBroadcastAt = now;
                    if (safeData.pos) {
                        lastPlayerMoveBroadcastPos = safeData.pos;
                    }
                    socket.to(currentRoom).emit("playerMoved", { ...safeData, id: socket.id });
                }
            }
        });
        socket.on("castSpell", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("castSpell"))
                return;
            const safeData = sanitizeSpellCastPayload(data);
            if (!safeData)
                return;
            const room = rooms.get(currentRoom);
            const p = room?.get(socket.id);
            if (!isServerActionOriginNearPlayer(p, safeData.pos))
                return;
            socket.to(currentRoom).emit("spellCasted", { ...safeData, id: socket.id });
        });
        socket.on("manaPulse", () => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("manaPulse"))
                return;
            socket.to(currentRoom).emit("manaPulse", { id: socket.id });
        });
        socket.on("setArmor", (armor) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("setArmor"))
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(socket.id))
                return;
            const p = room.get(socket.id);
            p.armor = sanitizeNetworkArmor(armor, ARMOR_MAX);
            io.to(currentRoom).emit("playerArmor", { id: socket.id, armor: p.armor });
        });
        socket.on("applyStatusEffect", (payload) => {
            if (!allowServerEvent("applyStatusEffect"))
                return;
            const safePayload = sanitizeStatusEffectPayload(payload);
            if (!currentRoom || !safePayload || !STATUS_DURATIONS[safePayload.effect])
                return;
            const { targetId, effect, durationMs } = safePayload;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(targetId))
                return;
            const attacker = room.get(socket.id);
            const p = room.get(targetId);
            if (!isServerDamageTargetAllowed(attacker, p, socket.id, targetId, MULTIPLAYER_MAX_STATUS_TARGET_DISTANCE))
                return;
            const safeDuration = Math.max(0, Math.min(Number(durationMs) || STATUS_DURATIONS[effect], STATUS_DURATIONS[effect]));
            const until = Date.now() + safeDuration;
            const key = `${effect}Until`;
            p[key] = until;
            io.to(currentRoom).emit("playerStatusEffect", { id: targetId, effect, until });
        });
        socket.on("clearStatusEffect", (payload) => {
            if (!allowServerEvent("clearStatusEffect"))
                return;
            const safePayload = sanitizeClearStatusEffectPayload(payload);
            if (!currentRoom || !safePayload)
                return;
            const { targetId, effects } = safePayload;
            if (targetId !== socket.id)
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(targetId))
                return;
            const p = room.get(targetId);
            const safeEffects = [];
            for (let index = 0; index < effects.length; index += 1) {
                const effect = effects[index];
                if (!STATUS_DURATIONS[effect])
                    continue;
                p[`${effect}Until`] = 0;
                safeEffects.push(effect);
            }
            if (safeEffects.length > 0) {
                io.to(currentRoom).emit("playerStatusCleared", { id: targetId, effects: safeEffects });
            }
        });
        socket.on("damageHealth", (targetId, damage) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("damageHealth"))
                return;
            const safeDamageArgs = sanitizeDamageEventArgs(targetId, damage);
            if (!safeDamageArgs)
                return;
            const [safeTargetId, incomingDamage] = safeDamageArgs;
            if (safeTargetId !== socket.id)
                return;
            const room = rooms.get(currentRoom);
            if (room && room.has(safeTargetId)) {
                const p = room.get(safeTargetId);
                const previousHealth = p.health;
                if (incomingDamage <= 0 || previousHealth <= 0)
                    return;
                p.health = Math.max(0, p.health - incomingDamage);
                io.to(currentRoom).emit("playerHealth", { id: safeTargetId, health: p.health });
                if (previousHealth > 0 && p.health === 0) {
                    announcePlayerDeath(currentRoom, safeTargetId, p);
                    respawnPlayer(currentRoom, safeTargetId, p);
                }
            }
        });
        socket.on("grabControl", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("grabControl"))
                return;
            const safeData = sanitizeGrabPayload(data);
            if (!safeData)
                return;
            const room = rooms.get(currentRoom);
            const p = room?.get(socket.id);
            if (!isServerActionOriginNearPlayer(p, safeData.origin))
                return;
            socket.to(currentRoom).emit("grabControl", { ...safeData, id: socket.id });
        });
        socket.on("grabRelease", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("grabRelease"))
                return;
            const safeData = sanitizeGrabPayload(data);
            if (!safeData)
                return;
            const room = rooms.get(currentRoom);
            const p = room?.get(socket.id);
            if (!isServerActionOriginNearPlayer(p, safeData.origin))
                return;
            socket.to(currentRoom).emit("grabRelease", { ...safeData, id: socket.id });
        });
        socket.on("enginePlaceableUpsert", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("enginePlaceableUpsert"))
                return;
            const safeData = sanitizeEnginePlaceableUpsertPayload(data);
            if (!safeData)
                return;
            upsertRoomPlaceable(currentRoom, safeData.object);
            socket.to(currentRoom).emit("enginePlaceableUpserted", { ...safeData, id: socket.id });
        });
        socket.on("enginePlaceableDelete", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("enginePlaceableDelete"))
                return;
            const safeData = sanitizeEnginePlaceableDeletePayload(data);
            if (!safeData)
                return;
            deleteRoomPlaceable(currentRoom, safeData.instanceId);
            socket.to(currentRoom).emit("enginePlaceableDeleted", { ...safeData, id: socket.id });
        });
        socket.on("enginePlaceableSnapshot", (data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("enginePlaceableSnapshot"))
                return;
            const safeData = sanitizeEnginePlaceableSnapshotPayload(data);
            if (!safeData)
                return;
            setRoomPlaceables(currentRoom, safeData.objects);
            socket.to(currentRoom).emit("enginePlaceableSnapshot", { ...safeData, id: socket.id });
        });
        const relayVoiceSignal = (eventName, data) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent(eventName))
                return;
            const safeData = eventName === "voiceIceCandidate"
                ? sanitizeVoiceIceCandidateSignalPayload(data)
                : sanitizeVoiceDescriptionSignalPayload(data, eventName === "voiceOffer" ? "offer" : "answer");
            if (!safeData)
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(safeData.targetId))
                return;
            socket.to(safeData.targetId).emit(eventName, { ...safeData, fromId: socket.id });
        };
        socket.on("voiceOffer", (data) => relayVoiceSignal("voiceOffer", data));
        socket.on("voiceAnswer", (data) => relayVoiceSignal("voiceAnswer", data));
        socket.on("voiceIceCandidate", (data) => relayVoiceSignal("voiceIceCandidate", data));
        socket.on("hitPlayer", (targetId, damage) => {
            if (!currentRoom)
                return;
            if (!allowServerEvent("hitPlayer"))
                return;
            const safeDamageArgs = sanitizeDamageEventArgs(targetId, damage);
            if (!safeDamageArgs)
                return;
            const [safeTargetId, incomingDamage] = safeDamageArgs;
            const room = rooms.get(currentRoom);
            if (room && room.has(safeTargetId)) {
                const attacker = room.get(socket.id);
                const p = room.get(safeTargetId);
                if (!isServerDamageTargetAllowed(attacker, p, socket.id, safeTargetId))
                    return;
                const previousHealth = p.health;
                if (incomingDamage <= 0 || previousHealth <= 0)
                    return;
                const armorDamage = Math.min(p.armor || 0, incomingDamage);
                const healthDamage = incomingDamage - armorDamage;
                p.armor = Math.max(0, (p.armor || 0) - armorDamage);
                p.health = Math.max(0, p.health - healthDamage);
                io.to(currentRoom).emit("playerArmor", { id: safeTargetId, armor: p.armor });
                io.to(currentRoom).emit("playerHealth", { id: safeTargetId, health: p.health });
                if (previousHealth > 0 && p.health === 0) {
                    announcePlayerDeath(currentRoom, safeTargetId, p);
                    respawnPlayer(currentRoom, safeTargetId, p);
                }
            }
        });
        socket.on("disconnect", () => {
            removeSocketFromCurrentRoom();
        });
    });
    // API route for checking health
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok", maxPlayersPerRoom: MULTIPLAYER_MAX_PLAYERS_PER_ROOM });
    });
    if (process.env.NODE_ENV !== "production") {
        app.get("/api/debug/rooms/:roomCode", (req, res) => {
            const roomCode = sanitizeRoomCode(req.params.roomCode);
            const room = rooms.get(roomCode);
            res.json({
                exists: Boolean(room),
                size: room?.size ?? 0,
                maxPlayers: MULTIPLAYER_MAX_PLAYERS_PER_ROOM,
                availableSlots: Math.max(0, MULTIPLAYER_MAX_PLAYERS_PER_ROOM - (room?.size ?? 0)),
                placeables: getRoomPlaceables(roomCode).length,
                cleanupPending: emptyRoomCleanupTimers.has(roomCode),
            });
        });
    }
    app.get("/api/lan-info", (req, res) => {
        res.json({
            lanAddresses: getLanAddresses(),
            httpPort: useHttps && HTTP_REDIRECT_PORT !== PORT ? HTTP_REDIRECT_PORT : PORT,
            httpsPort: useHttps ? PORT : null,
            secure: useHttps,
        });
    });
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: {
                middlewareMode: true,
                hmr: {
                    server: httpServer,
                    protocol: useHttps ? "wss" : "ws",
                    clientPort: PORT,
                },
            },
            appType: "spa",
        });
        app.use(vite.middlewares);
    }
    else {
        // Basic compilation for start script needs esbuild or similar, or just node dist/server.cjs.
        // Assuming Vite build handles client
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }
    if (useHttps && HTTP_REDIRECT_PORT !== PORT) {
        const lanHttpServer = createHttpServer(app);
        io.attach(lanHttpServer);
        lanHttpServer.on("error", (error) => {
            console.warn(`Could not start HTTP LAN fallback on port ${HTTP_REDIRECT_PORT}: ${error.message}`);
        });
        lanHttpServer.listen(HTTP_REDIRECT_PORT, "0.0.0.0", () => {
            console.log(`HTTP LAN fallback running at http://localhost:${HTTP_REDIRECT_PORT} (no certificate, voice disabled)`);
            const lanAddresses = getLanAddresses();
            for (let index = 0; index < lanAddresses.length; index += 1) {
                const address = lanAddresses[index];
                console.log(`LAN gameplay fallback: http://${address}:${HTTP_REDIRECT_PORT}`);
            }
        });
    }
    httpServer.listen(PORT, "0.0.0.0", () => {
        const protocol = useHttps ? "https" : "http";
        console.log(`Server running at ${protocol}://localhost:${PORT}`);
        const lanAddresses = getLanAddresses();
        for (let index = 0; index < lanAddresses.length; index += 1) {
            const address = lanAddresses[index];
            console.log(`LAN URL: ${protocol}://${address}:${PORT}`);
        }
        if (useHttps) {
            console.log("LAN voice workaround active: HTTPS is still available for mic/voice after trusting the local certificate.");
        }
    });
}
startServer();
