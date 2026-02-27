const rooms = new Map();
const MAX_ROOM_CAPACITY = 50;
const SFU_THRESHOLD = 6; 

//  Helper Functions 
const sendData = (ws, message) => {
    if (ws && ws.readyState === 1) { // 1 === WebSocket.OPEN
        ws.send(JSON.stringify(message));
    }
};

export const getRoom = (roomID) => rooms.get(roomID);

export const getAllRooms = () => Array.from(rooms.values());

// CRUD
export const createRoom = (roomID) => {
    if (!rooms.has(roomID)) {
        rooms.set(roomID, { id: roomID, peers: new Map() });
    }
    return rooms.get(roomID);
};

export const validateRoom = (roomID) => {
    const room = getRoom(roomID);
    if (!room) return { valid: false, error: "Room not found" };
    if (room.peers.size >= MAX_ROOM_CAPACITY) return { valid: false, error: "Room full" };
    
    return { valid: true, room };
};

export const joinRoom = (roomID, peerID, ws) => {
    const room = createRoom(roomID);

    if (room.peers.size >= MAX_ROOM_CAPACITY) {
        sendData(ws, { type: "error", message: "Room full" });
        return;
    }

    const existingPeers = Array.from(room.peers.keys());
    
    room.peers.set(peerID, ws);
    ws.roomID = roomID;
    ws.peerID = peerID;

    sendData(ws, { type: 'existing-peers', payload: existingPeers });

    broadcast(roomID, peerID, { type: 'new-peer', payload: peerID });
};

export const leaveRoom = (roomID, peerID) => {
    const room = getRoom(roomID);
    if (!room) return;

    room.peers.delete(peerID);
    broadcast(roomID, peerID, { type: 'peer-disconnected', payload: peerID });

    if (room.peers.size === 0) {
        rooms.delete(roomID);
    }
};

// Routing 
export const broadcast = (roomID, excludePeerID, message) => {
    const room = getRoom(roomID);
    if (!room) return;

    room.peers.forEach((ws, peerID) => {
        if (peerID !== excludePeerID) {
            sendData(ws, message);
        }
    });
};

export const relaySignal = (roomID, fromPeerID, targetPeerID, message) => {
    const room = getRoom(roomID);
    if (!room) return;

    const targetWs = room.peers.get(targetPeerID);
    sendData(targetWs, { ...message, from: fromPeerID });
};