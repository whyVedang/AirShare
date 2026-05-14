import WebSocket from "ws";
import crypto from "crypto";

import {
    redis,
    redisPub,
    redisSub
} from "../config/config.redis.js";

import { config } from "../config/config.env.js";
import logger from "../config/config.logger.js";

const SERVER_ID = crypto.randomUUID();

const localPeers = new Map();

const ROOM_KEY = (roomID) => `room:${roomID}`;
const PEERS_KEY = (roomID) => `room:${roomID}:peers`;

const PEER_ROOM_KEY = (peerID) => `peer:${peerID}:room`;
const PEER_SERVER_KEY = (peerID) => `peer:${peerID}:server`;

const SIGNAL_CHANNEL = (serverID) => `signal:${serverID}`;
const BROADCAST_CHANNEL = "room-broadcast";

const sendData = (ws, data) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
    }

    ws.send(JSON.stringify(data));
    return true;
};

const refreshTTL = async (roomID) => {
    await redis
        .multi()
        .expire(ROOM_KEY(roomID), config.ROOM_TTL)
        .expire(PEERS_KEY(roomID), config.ROOM_TTL)
        .exec();
};

const subscriptionReady = Promise.all([
    redisSub.subscribe(SIGNAL_CHANNEL(SERVER_ID)),
    redisSub.subscribe(BROADCAST_CHANNEL)
]).catch((err) => {
    logger.error({ err }, "Failed to subscribe to signaling channels");
    return [];
});

redisSub.on("message", async (channel, rawMessage) => {
    try {
        const data = JSON.parse(rawMessage);

        if (channel === SIGNAL_CHANNEL(SERVER_ID)) {
            const ws = localPeers.get(data.targetPeerID);
            sendData(ws, data.payload);
            return;
        }

        if (channel === BROADCAST_CHANNEL) {
            const {
                roomID,
                excludePeerID,
                payload
            } = data;

            localPeers.forEach((ws, peerID) => {
                if (peerID !== excludePeerID && ws.roomID === roomID) {
                    sendData(ws, payload);
                }
            });
        }
    } catch (err) {
        logger.error({ err }, "Redis subscriber error");
    }
});

export const createRoom = async (roomID) => {
    if (!roomID) {
        throw new Error("Invalid roomID");
    }

    await redis
        .multi()
        .hsetnx(ROOM_KEY(roomID), "id", roomID)
        .hsetnx(
            ROOM_KEY(roomID),
            "createdAt",
            new Date().toISOString()
        )
        .expire(ROOM_KEY(roomID), config.ROOM_TTL)
        .expire(PEERS_KEY(roomID), config.ROOM_TTL)
        .exec();

    return roomID;
};

export const getRoom = async (roomID) => {
    const room = await redis.hgetall(
        ROOM_KEY(roomID)
    );

    if (!room || Object.keys(room).length === 0) {
        return null;
    }

    const peers = await redis.smembers(
        PEERS_KEY(roomID)
    );

    return {
        ...room,
        peers
    };
};

export const validateRoom = async (roomID) => {
    const room = await getRoom(roomID);

    if (!room) {
        return {
            valid: false,
            error: "Room not found"
        };
    }

    const peerCount = await redis.scard(
        PEERS_KEY(roomID)
    );

    if (peerCount >= 50) {
        return {
            valid: false,
            error: "Room full"
        };
    }

    return {
        valid: true,
        room,
        peerCount
    };
};

export const joinRoom = async (
    roomID,
    peerID,
    ws
) => {
    if (!roomID || !peerID || !ws) {
        return;
    }

    const peerCount = await redis.scard(
        PEERS_KEY(roomID)
    );

    if (peerCount >= 50) {
        sendData(ws, {
            type: "error",
            message: "Room full"
        });

        return;
    }

    const existingPeers = await redis.smembers(
        PEERS_KEY(roomID)
    );

    await redis
        .multi()
        .sadd(PEERS_KEY(roomID), peerID)
        .set(
            PEER_ROOM_KEY(peerID),
            roomID,
            "EX",
            config.ROOM_TTL
        )
        .set(
            PEER_SERVER_KEY(peerID),
            SERVER_ID,
            "EX",
            config.ROOM_TTL
        )
        .expire(
            PEERS_KEY(roomID),
            config.ROOM_TTL
        )
        .exec();

    const previousSocket = localPeers.get(peerID);
    if (
        previousSocket &&
        previousSocket !== ws &&
        previousSocket.readyState === WebSocket.OPEN
    ) {
        previousSocket.skipDisconnectCleanup = true;
        previousSocket.close();
    }

    localPeers.set(peerID, ws);

    ws.roomID = roomID;
    ws.peerID = peerID;
    ws.isAlive = true;
    ws.skipDisconnectCleanup = false;

    ws.on("pong", () => {
        ws.isAlive = true;
    });

    ws.on("close", async () => {
        if (ws.skipDisconnectCleanup) {
            return;
        }

        await handleDisconnect(peerID);
    });

    ws.on("error", async () => {
        if (ws.skipDisconnectCleanup) {
            return;
        }

        await handleDisconnect(peerID);
    });

    sendData(ws, {
        type: "existing-peers",
        payload: existingPeers
    });

    await broadcast(roomID, peerID, {
        type: "new-peer",
        payload: peerID
    });
};

export const leaveRoom = async (
    roomID,
    peerID
) => {
    await redis
        .multi()
        .srem(PEERS_KEY(roomID), peerID)
        .del(PEER_ROOM_KEY(peerID))
        .del(PEER_SERVER_KEY(peerID))
        .exec();

    localPeers.delete(peerID);

    await broadcast(roomID, peerID, {
        type: "peer-disconnected",
        payload: peerID
    });

    const remaining = await redis.scard(
        PEERS_KEY(roomID)
    );

    if (remaining === 0) {
        await redis
            .multi()
            .del(ROOM_KEY(roomID))
            .del(PEERS_KEY(roomID))
            .exec();
    }
};

export const broadcast = async (
    roomID,
    excludePeerID,
    payload
) => {
    await subscriptionReady;
    await redisPub.publish(
        BROADCAST_CHANNEL,
        JSON.stringify({
            roomID,
            excludePeerID,
            payload
        })
    );
};

export const relaySignal = async (
    roomID,
    fromPeerID,
    targetPeerID,
    message
) => {
    const payload = {
        type: message.type,
        payload: {
            ...message.payload,
            from: fromPeerID
        }
    };

    const localWs = localPeers.get(targetPeerID);

    if (sendData(localWs, payload)) {
        await refreshTTL(roomID);
        return;
    }

    const targetServerID = await redis.get(
        PEER_SERVER_KEY(targetPeerID)
    );

    if (!targetServerID) {
        return;
    }

    await subscriptionReady;
    await redisPub.publish(
        SIGNAL_CHANNEL(targetServerID),
        JSON.stringify({
            targetPeerID,
            payload
        })
    );

    await refreshTTL(roomID);
};

export const handleDisconnect = async (
    peerID
) => {
    try {
        const roomID = await redis.get(
            PEER_ROOM_KEY(peerID)
        );

        if (!roomID) {
            localPeers.delete(peerID);
            return;
        }

        await leaveRoom(roomID, peerID);
    } catch (err) {
        logger.error({ err }, "Disconnect cleanup error");
    }
};

export const setupHeartbeat = (wss) => {
    setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }

            ws.isAlive = false;

            ws.ping();
        });
    }, 30000);
};

export const getAllRooms = async () => {
    let cursor = "0";

    const roomIDs = [];

    do {
        const [nextCursor, keys] =
            await redis.scan(
                cursor,
                "MATCH",
                "room:*",
                "COUNT",
                100
            );

        cursor = nextCursor;

        for (const key of keys) {
            const parts = key.split(":");

            if (parts.length === 2) {
                roomIDs.push(parts[1]);
            }
        }
    } while (cursor !== "0");

    const rooms = await Promise.all(
        roomIDs.map(async (roomID) => {
            const peerCount =
                await redis.scard(
                    PEERS_KEY(roomID)
                );

            return {
                id: roomID,
                peerCount
            };
        })
    );

    return rooms;
};
