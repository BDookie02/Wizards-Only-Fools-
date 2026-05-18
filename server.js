import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import os from "os";
import path from "path";
async function startServer() {
    const app = express();
    const useHttps = process.argv.includes("--https") || process.env.WIZARDS_HTTPS === "1";
    const PORT = Number(process.env.PORT || (useHttps ? 3443 : 3000));
    const HTTP_REDIRECT_PORT = Number(process.env.HTTP_REDIRECT_PORT || 3000);
    const getLanAddresses = () => Object.values(os.networkInterfaces())
        .flat()
        .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
        .map((entry) => entry.address);
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
    const emptyRoomCleanupTimers = new Map();
    const EMPTY_ROOM_TTL_MS = 10000;
    const ARMOR_MAX = 50;
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
        const usedColors = new Set(Array.from(room.values())
            .map((player) => player.playerColor)
            .filter(Boolean));
        const paletteColor = PLAYER_COLOR_PALETTE.find((color) => !usedColors.has(color));
        if (paletteColor) {
            return paletteColor;
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
    const getPlayerDisplayName = (player, fallbackId = "") => sanitizePlayerName(player?.playerName, `Wizard ${fallbackId.slice(0, 4).toUpperCase() || "????"}`);
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
            }
            emptyRoomCleanupTimers.delete(roomCode);
        }, EMPTY_ROOM_TTL_MS);
        emptyRoomCleanupTimers.set(roomCode, timer);
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
            const roomCode = sanitizeRoomCode(typeof payload === "object" && payload ? payload.roomCode : "");
            const playerName = sanitizePlayerName(typeof payload === "object" && payload ? payload.playerName : "", "");
            if (!roomCode || playerName.length < 2) {
                socket.emit("joinRejected", {
                    reason: !roomCode ? "room-required" : "name-required",
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
                character: normalizePlayerCharacter({ topColor: playerColor }, playerColor),
                isSpeaking: false
            };
            room.set(socket.id, newPlayer);
            // Send the current room state
            const players = Array.from(rooms.get(roomCode).values());
            socket.emit("roomState", players);
            // Broadcast to others
            socket.to(roomCode).emit("playerJoined", newPlayer);
        });
        socket.on("updateMe", (data) => {
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room && room.has(socket.id)) {
                const p = room.get(socket.id);
                if (data?.character) {
                    data.character = normalizePlayerCharacter(data.character, p.playerColor);
                }
                Object.assign(p, data);
                socket.to(currentRoom).emit("playerMoved", { id: socket.id, ...data });
            }
        });
        socket.on("castSpell", (data) => {
            if (!currentRoom)
                return;
            // Broadcast spell cast (position, direction, type)
            socket.to(currentRoom).emit("spellCasted", { id: socket.id, ...data });
        });
        socket.on("manaPulse", () => {
            if (!currentRoom)
                return;
            socket.to(currentRoom).emit("manaPulse", { id: socket.id });
        });
        socket.on("setArmor", (armor) => {
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(socket.id))
                return;
            const p = room.get(socket.id);
            p.armor = Math.max(0, Math.min(ARMOR_MAX, Number(armor) || 0));
            io.to(currentRoom).emit("playerArmor", { id: socket.id, armor: p.armor });
        });
        socket.on("applyStatusEffect", ({ targetId, effect, durationMs }) => {
            if (!currentRoom || !targetId || !STATUS_DURATIONS[effect])
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(targetId))
                return;
            const p = room.get(targetId);
            const safeDuration = Math.max(0, Math.min(Number(durationMs) || STATUS_DURATIONS[effect], STATUS_DURATIONS[effect]));
            const until = Date.now() + safeDuration;
            const key = `${effect}Until`;
            p[key] = until;
            io.to(currentRoom).emit("playerStatusEffect", { id: targetId, effect, until });
        });
        socket.on("clearStatusEffect", ({ targetId, effects }) => {
            if (!currentRoom || !targetId)
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(targetId))
                return;
            const p = room.get(targetId);
            const safeEffects = Array.isArray(effects) ? effects.filter((effect) => STATUS_DURATIONS[effect]) : [];
            safeEffects.forEach((effect) => {
                p[`${effect}Until`] = 0;
            });
            if (safeEffects.length > 0) {
                io.to(currentRoom).emit("playerStatusCleared", { id: targetId, effects: safeEffects });
            }
        });
        socket.on("damageHealth", (targetId, damage) => {
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room && room.has(targetId)) {
                const p = room.get(targetId);
                const incomingDamage = Math.max(0, Number(damage) || 0);
                const previousHealth = p.health;
                if (incomingDamage <= 0 || previousHealth <= 0)
                    return;
                p.health = Math.max(0, p.health - incomingDamage);
                io.to(currentRoom).emit("playerHealth", { id: targetId, health: p.health });
                if (previousHealth > 0 && p.health === 0) {
                    announcePlayerDeath(currentRoom, targetId, p);
                    respawnPlayer(currentRoom, targetId, p);
                }
            }
        });
        socket.on("grabControl", (data) => {
            if (!currentRoom)
                return;
            socket.to(currentRoom).emit("grabControl", { id: socket.id, ...data });
        });
        socket.on("grabRelease", (data) => {
            if (!currentRoom)
                return;
            socket.to(currentRoom).emit("grabRelease", { id: socket.id, ...data });
        });
        const relayVoiceSignal = (eventName, data) => {
            if (!currentRoom || !data?.targetId)
                return;
            const room = rooms.get(currentRoom);
            if (!room || !room.has(data.targetId))
                return;
            socket.to(data.targetId).emit(eventName, { fromId: socket.id, ...data });
        };
        socket.on("voiceOffer", (data) => relayVoiceSignal("voiceOffer", data));
        socket.on("voiceAnswer", (data) => relayVoiceSignal("voiceAnswer", data));
        socket.on("voiceIceCandidate", (data) => relayVoiceSignal("voiceIceCandidate", data));
        socket.on("hitPlayer", (targetId, damage) => {
            if (!currentRoom)
                return;
            const room = rooms.get(currentRoom);
            if (room && room.has(targetId)) {
                const p = room.get(targetId);
                const incomingDamage = Math.max(0, Number(damage) || 0);
                const previousHealth = p.health;
                if (incomingDamage <= 0 || previousHealth <= 0)
                    return;
                const armorDamage = Math.min(p.armor || 0, incomingDamage);
                const healthDamage = incomingDamage - armorDamage;
                p.armor = Math.max(0, (p.armor || 0) - armorDamage);
                p.health = Math.max(0, p.health - healthDamage);
                io.to(currentRoom).emit("playerArmor", { id: targetId, armor: p.armor });
                io.to(currentRoom).emit("playerHealth", { id: targetId, health: p.health });
                if (previousHealth > 0 && p.health === 0) {
                    announcePlayerDeath(currentRoom, targetId, p);
                    respawnPlayer(currentRoom, targetId, p);
                }
            }
        });
        socket.on("disconnect", () => {
            removeSocketFromCurrentRoom();
        });
    });
    // API route for checking health
    app.get("/api/health", (req, res) => {
        res.json({ status: "ok" });
    });
    if (process.env.NODE_ENV !== "production") {
        app.get("/api/debug/rooms/:roomCode", (req, res) => {
            const roomCode = sanitizeRoomCode(req.params.roomCode);
            const room = rooms.get(roomCode);
            res.json({
                exists: Boolean(room),
                size: room?.size ?? 0,
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
            getLanAddresses().forEach((address) => {
                console.log(`LAN gameplay fallback: http://${address}:${HTTP_REDIRECT_PORT}`);
            });
        });
    }
    httpServer.listen(PORT, "0.0.0.0", () => {
        const protocol = useHttps ? "https" : "http";
        console.log(`Server running at ${protocol}://localhost:${PORT}`);
        getLanAddresses().forEach((address) => {
            console.log(`LAN URL: ${protocol}://${address}:${PORT}`);
        });
        if (useHttps) {
            console.log("LAN voice workaround active: HTTPS is still available for mic/voice after trusting the local certificate.");
        }
    });
}
startServer();
