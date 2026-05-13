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
            await CM.joinRoom(payload.roomID, ws.peerID, ws);
            break;

        case "host-offer":
            SFU.handleHostOffer(payload.roomID, ws.peerID, payload.sdp, wsSend);
            break;

        case "receiver-request":
            SFU.handleReceiverJoin(payload.roomID, ws.peerID, wsSend);
            break;

        case "receiver-answer":
            SFU.handleClientAnswer(payload.roomID, ws.peerID, payload.sdp);
            break;

        case "ice-candidate":
            SFU.addClientIceCandidate(payload.roomID, ws.peerID, payload.candidate);
            break;

        default:
            console.warn("Unknown WebSocket message type:", type);
    }
};