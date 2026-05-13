import nodeDataChannel from 'node-datachannel';

const activeRooms = new Map();

export const initRoom = (roomID) => {
    if (!activeRooms.has(roomID)) {
        activeRooms.set(roomID, {
            hostID: null,
            hostConnection: null,
            hostDataChannel: null,
            receivers: new Map() // peerID -> { connection, dataChannel }
        });
    }
    return activeRooms.get(roomID);
};

export const handleHostOffer = (roomID, hostID, sdp, sendToWebSocket) => {
    const room = initRoom(roomID);
    room.hostID = hostID;

    const pc = new nodeDataChannel.PeerConnection(hostID, {
        iceServers: ["stun:stun.l.google.com:19302"]
    });

    pc.onLocalDescription((localSdp, type) => {
        sendToWebSocket({
            type: "server-answer",
            payload: { sdp: localSdp, targetPeerID: hostID }
        });
    });

    pc.onLocalCandidate((candidate, mid) => {
        sendToWebSocket({
            type: "server-ice-candidate",
            payload: { candidate, mid, targetPeerID: hostID }
        });
    });

    pc.onDataChannel((dc) => {
        room.hostDataChannel = dc;
        console.log(`[SFU] Host data channel opened for room ${roomID}`);

        dc.onMessage((msg) => {
            for (const [receiverID, receiver] of room.receivers.entries()) {
                if (receiver.dataChannel && receiver.dataChannel.isOpen()) {
                    receiver.dataChannel.sendMessageBinary(msg);
                }
            }
        });
    });

    pc.setRemoteDescription(sdp, "offer");
    room.hostConnection = pc;
};

export const handleReceiverJoin = (roomID, receiverID, sendToWebSocket) => {
    const room = initRoom(roomID);

    const pc = new nodeDataChannel.PeerConnection(receiverID, {
        iceServers: ["stun:stun.l.google.com:19302"]
    });

    const dc = pc.createDataChannel("file-transfer");
    room.receivers.set(receiverID, { connection: pc, dataChannel: dc });

    pc.onLocalDescription((localSdp, type) => {
        sendToWebSocket({
            type: "server-offer",
            payload: { sdp: localSdp, targetPeerID: receiverID }
        });
    });

    pc.onLocalCandidate((candidate, mid) => {
        sendToWebSocket({
            type: "server-ice-candidate",
            payload: { candidate, mid, targetPeerID: receiverID }
        });
    });
};

export const handleClientAnswer = (roomID, peerID, sdp) => {
    const room = activeRooms.get(roomID);
    if (!room) return;
    
    const receiver = room.receivers.get(peerID);
    if (receiver && receiver.connection) {
        try {
            receiver.connection.setRemoteDescription(sdp, "answer");
        } catch (e) {
            console.error(`[SFU] Failed to set remote answer for ${peerID}:`, e);
        }
    }
};

export const addClientIceCandidate = (roomID, peerID, candidate) => {
    const room = activeRooms.get(roomID);
    if (!room) return;

    try {
        if (room.hostID === peerID && room.hostConnection) {
            room.hostConnection.addRemoteCandidate(candidate.candidate, candidate.sdpMid);
        } else if (room.receivers.has(peerID)) {
            const receiver = room.receivers.get(peerID);
            receiver.connection.addRemoteCandidate(candidate.candidate, candidate.sdpMid);
        }
    } catch (e) {
        console.warn(`[SFU] Ignored invalid ICE candidate from ${peerID}`);
    }
};

export const removePeer = (roomID, peerID) => {
    const room = activeRooms.get(roomID);
    if (!room) return;

    if (room.hostID === peerID) {
        // Host left -> Tear down the entire SFU room for this file transfer
        if (room.hostConnection) room.hostConnection.close();
        for (const [rid, receiver] of room.receivers.entries()) {
            if (receiver.connection) receiver.connection.close();
        }
        activeRooms.delete(roomID);
        console.log(`[SFU] Room ${roomID} destroyed because host left.`);
    } else if (room.receivers.has(peerID)) {
        // A single downloader left -> Just remove their connection
        const receiver = room.receivers.get(peerID);
        if (receiver.connection) receiver.connection.close();
        room.receivers.delete(peerID);
        console.log(`[SFU] Receiver ${peerID} left room ${roomID}.`);
    }
};