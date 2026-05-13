import { WebSocketServer } from "ws";
import * as CM from "../services/connectionManager.services.js";
import crypto from "crypto";

export const WebSocketINIT = (server) => {
    const wss = new WebSocketServer({ server });
    CM.setupHeartbeat(wss);
    wss.on("connection", (ws) => {

        ws.peerID = crypto.randomUUID();

        ws.send(JSON.stringify({
            type: "welcome",
            payload: { peerID: ws.peerID }
        }));
        ws.on("message", async (raw) => {
            try {
                const data = JSON.parse(raw);
                await handleMessage(ws, data);
            } catch (err) {
                console.error("Invalid WebSocket message:", err.message);
            }
        });
    });
};

const handleMessage = async (ws, data) => {
    const { type, payload } = data;
    const JWT_SECRET = process.env.JWT_SECRET;
    const expiresIn = process.env.expiresIn;


    switch (type) {
        case "join-room":
            const validation = await CM.validateRoom(payload.roomID);
            if (!validation.valid) {
                ws.send(JSON.stringify({ type: "error", message: validation.error }));
                return;
            }
            await CM.joinRoom(payload.roomID, ws.peerID, ws);
            break;

        case "offer":
        case "answer":
        case "ice-candidate":
            await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, {
                type: type,
                payload: payload
            });
            break;
        default:
            console.warn("Unknown WebSocket message type:", type);
    }
};