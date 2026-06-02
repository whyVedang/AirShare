import WebSocket from "ws";
import crypto from "crypto";

import {
    redis,
    redisPub,
    redisSub
} from "../config/config.redis.js";

import { config } from "../config/config.env.js";

const SERVER_ID = crypto.randomUUID();

const localPeers = new Map();

const ROOM_KEY = (roomID) => `room:${roomID}`;
const PEERS_KEY = (roomID) => `room:${roomID}:peers`;

const PEER_ROOM_KEY = (peerID) => `peer:${peerID}:room`;
const PEER_SERVER_KEY = (peerID) => `peer:${peerID}:server`;

const SIGNAL_CHANNEL = (serverID) => `signal:${serverID}`;
const BROADCAST_CHANNEL = "room-broadcast";

const sendData = (ws, data) => {
    if (!ws) return;

    if (ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify(data));
};

const refreshTTL = async (roomID) => {
    await redis
        .multi()
        .expire(ROOM_KEY(roomID), config.ROOM_TTL)
        .expire(PEERS_KEY(roomID), config.ROOM_TTL)
        .exec();
};

await redisSub.subscribe(SIGNAL_CHANNEL(SERVER_ID));
await redisSub.subscribe(BROADCAST_CHANNEL);

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

            const peers = await redis.smembers(
                PEERS_KEY(roomID)
            );

            for (const peerID of peers) {
                if (peerID === excludePeerID) continue;

                const ws = localPeers.get(peerID);

                sendData(ws, payload);
            }
        }
    } catch (err) {
        console.error("Redis subscriber error:", err);
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

    localPeers.set(peerID, ws);

    ws.roomID = roomID;
    ws.peerID = peerID;
    ws.isAlive = true;

    ws.on("pong", () => {
        ws.isAlive = true;
    });

    ws.on("close", async () => {
        await handleDisconnect(peerID);
    });

    ws.on("error", async () => {
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

    const peers = await redis.smembers(
        PEERS_KEY(roomID)
    );

    for (const peerID of peers) {
        if (peerID === excludePeerID) continue;

        const ws = localPeers.get(peerID);

        sendData(ws, payload);
    }

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

    const localWs =
        localPeers.get(targetPeerID);

    if (
        localWs &&
        localWs.readyState === WebSocket.OPEN
    ) {
        sendData(localWs, payload);

        return;
    }

    const targetServerID = await redis.get(
        PEER_SERVER_KEY(targetPeerID)
    );

    if (!targetServerID) {
        return;
    }

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
        console.error(
            "Disconnect cleanup error:",
            err
        );
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