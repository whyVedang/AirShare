import { redis } from "../config/config.redis.js";
import { config } from "../config/config.env.js";

const localPeers = new Map();

const ROOM_KEY = (roomID) => `room:${roomID}`;
const PEERS_KEY = (roomID) => `room:${roomID}:peers`;
const SOCKET_KEY = (socketID) => `socket:${socketID}`;

const sendData = (ws, message) => {
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify(message));
    }
};

const refreshTTL = async (roomID) => {
    await redis.expire(ROOM_KEY(roomID), config.ROOM_TTL);
    await redis.expire(PEERS_KEY(roomID), config.ROOM_TTL);
};

export const createRoom = async (roomID) => {
    await redis.hsetnx(ROOM_KEY(roomID), "id", roomID);
    await redis.hsetnx(ROOM_KEY(roomID), "createdAt", new Date().toISOString());
    await redis.expire(ROOM_KEY(roomID), config.ROOM_TTL);
    await redis.expire(PEERS_KEY(roomID), config.ROOM_TTL);
    return roomID;
};

export const getRoom = async (roomID) => {
    const room = await redis.hgetall(ROOM_KEY(roomID));
    if (!room || Object.keys(room).length === 0) return null;
    const peers = await redis.smembers(PEERS_KEY(roomID));
    return { ...room, peers };
};

export const getAllRooms = async () => {
    const keys = await redis.keys("room:*");
    const roomKeys = keys.filter(key => key.split(":").length === 2);
    const rooms = await Promise.all(
        roomKeys.map(async (key) => {
            const roomID = key.split(":")[1];
            const peerCount = await redis.scard(PEERS_KEY(roomID));
            return { id: roomID, peerCount };
        })
    );
    return rooms;
};

export const validateRoom = async (roomID) => {
    const room = await getRoom(roomID);
    if (!room) return { valid: false, error: "Room not found" };
    const peerCount = await redis.scard(PEERS_KEY(roomID));
    if (peerCount >= 50) return { valid: false, error: "Room full" };
    return { valid: true, room, peerCount };
};

export const joinRoom = async (roomID, peerID, ws) => {
    const peerCount = await redis.scard(PEERS_KEY(roomID));
    if (peerCount >= 50) {
        sendData(ws, { type: "error", message: "Room full" });
        return;
    }
    const existingPeers = await redis.smembers(PEERS_KEY(roomID));
    await redis.sadd(PEERS_KEY(roomID), peerID);
    await redis.set(SOCKET_KEY(peerID), roomID, "EX", config.ROOM_TTL);
    await refreshTTL(roomID);
    localPeers.set(peerID, ws);
    ws.roomID = roomID;
    ws.peerID = peerID;
    sendData(ws, { type: "existing-peers", payload: existingPeers });
    await broadcast(roomID, peerID, { type: "new-peer", payload: peerID });
};

export const leaveRoom = async (roomID, peerID) => {
    await redis.srem(PEERS_KEY(roomID), peerID);
    await redis.del(SOCKET_KEY(peerID));
    localPeers.delete(peerID);
    await broadcast(roomID, peerID, { type: "peer-disconnected", payload: peerID });
    const remaining = await redis.scard(PEERS_KEY(roomID));
    if (remaining === 0) {
        await redis.del(ROOM_KEY(roomID));
        await redis.del(PEERS_KEY(roomID));
    }
};

export const broadcast = async (roomID, excludePeerID, message) => {
    const peers = await redis.smembers(PEERS_KEY(roomID));
    peers.forEach((peerID) => {
        if (peerID !== excludePeerID) {
            const ws = localPeers.get(peerID);
            sendData(ws, message);
        }
    });
};

export const relaySignal = async (roomID, fromPeerID, targetPeerID, message) => {
    await refreshTTL(roomID);
    const targetWs = localPeers.get(targetPeerID);
    sendData(targetWs, { ...message, from: fromPeerID });
};

export const handleDisconnect = async (peerID) => {
    const roomID = await redis.get(SOCKET_KEY(peerID));
    if (!roomID) return;
    await leaveRoom(roomID, peerID);
};