import { WebSocketServer } from "ws";
import * as CM from "../services/connectionManager.services.js";
import * as SFU from "../services/sfu.services.js";
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

        // NEW: Tell the SFU Engine to clean up RAM when someone drops
        ws.on("close", () => {
            if (ws.roomID && ws.peerID) {
                SFU.removePeer(ws.roomID, ws.peerID);
            }
        });
    });
};

const handleMessage = async (ws, data) => {
    const { type, payload } = data;
    
    const wsSend = (msg) => {
        if (ws.readyState === 1) { 
            ws.send(JSON.stringify(msg));
        }
    };

    switch (type) {
        case "join-room":
            ws.peerID = payload.peerID || ws.peerID;
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

        case "offer":
        case "answer":
            if (payload.targetPeerID && payload.targetPeerID !== 'server') {
                await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, data);
            }
            break;

        case "ice-candidate":
            if (payload.targetPeerID && payload.targetPeerID !== 'server') {
                await CM.relaySignal(payload.roomID, ws.peerID, payload.targetPeerID, data);
            } else {
                SFU.addClientIceCandidate(payload.roomID, ws.peerID, payload.candidate);
            }
            break;

        default:
            console.warn("Unknown WebSocket message type:", type);
    }
};
