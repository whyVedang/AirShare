import { WebSocketServer } from "ws";
import * as CM from "../services/connectionManager.services.js";

export const WebSocketINIT = (server) => {
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws) => {
        ws.on("message", async (raw) => {
            try {
                const data = JSON.parse(raw);
                await handleMessage(ws, data);
            } catch (err) {
                console.error("Invalid WebSocket message:", err.message);
            }
        });

        ws.on("close", async () => {
            if (ws.peerID) {
                await CM.handleDisconnect(ws.peerID);
            }
        });
    });
};

const handleMessage = async (ws, data) => {
    const { type, payload } = data;

    switch (type) {
        case "join-room":
            await CM.createRoom(payload.roomID);
            await CM.joinRoom(payload.roomID, payload.peerID, ws);
            break;

        case "offer":
            await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, {
                type: "offer",
                payload: { sdp: payload.sdp }
            });
            break;

        case "answer":
            await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, {
                type: "answer",
                payload: { sdp: payload.sdp }
            });
            break;

        case "ice-candidate":
            await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, {
                type: "ice-candidate",
                payload: { candidate: payload.candidate }
            });
            break;

        default:
            console.warn("Unknown WebSocket message type:", type);
    }
};