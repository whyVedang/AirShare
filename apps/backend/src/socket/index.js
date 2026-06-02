import WebSocket, { WebSocketServer } from "ws";
import * as CM from "../services/connectionManager.services.js";
import crypto from "crypto";
import logger from "../config/config.logger.js";

export const WebSocketINIT = (server) => {
    const wss = new WebSocketServer({
        server,
        maxPayload: 64 * 1024
    });
    CM.setupHeartbeat(wss);
    
    wss.on("connection", (ws) => {
        ws.peerID = crypto.randomUUID();

        ws.send(JSON.stringify({
            type: "welcome",
            payload: { peerID: ws.peerID }
        }));

        ws.on("message", async (raw) => {
            try {
                const data = JSON.parse(raw.toString());
                await handleMessage(ws, data);
            } catch (err) {
                sendError(ws, "Invalid WebSocket message");
            }
        });

        ws.on("error", (err) => {
            if (err.code !== "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH") {
                logger.warn({ err }, "WebSocket connection error");
            }
        });

    });
};

const isPlainObject = (value) => (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
);

const sendError = (ws, message) => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: "error",
            payload: { message }
        }));
    }
};

const handleMessage = async (ws, data) => {
    if (!isPlainObject(data) || typeof data.type !== "string") {
        sendError(ws, "Invalid WebSocket message");
        return;
    }

    const { type, payload } = data;

    switch (type) {
        case "join-room":
            if (
                !isPlainObject(payload) ||
                typeof payload.roomID !== "string" ||
                (payload.peerID !== undefined && typeof payload.peerID !== "string")
            ) {
                sendError(ws, "Invalid join-room payload");
                return;
            }

            ws.peerID = payload.peerID || ws.peerID;
            await CM.joinRoom(payload.roomID, ws.peerID, ws);
            break;

        case "offer":
        case "answer":
        case "ice-candidate":
            if (
                !isPlainObject(payload) ||
                typeof payload.roomID !== "string" ||
                typeof payload.targetPeerID !== "string"
            ) {
                sendError(ws, `Invalid ${type} payload`);
                return;
            }

            if (payload.targetPeerID !== "server") {
                await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, data);
            }
            break;

        default:
            sendError(ws, "Unknown WebSocket message type");
    }
};
