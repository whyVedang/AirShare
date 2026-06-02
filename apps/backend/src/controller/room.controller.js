import * as Services from "../services/connectionManager.services.js";
import crypto from "crypto";

export const getStats = (req, res) => {
    res.status(200).json({
        message: "AirShare Signaling Server Active",
        uptime: Math.floor(process.uptime()) + "s",
        memory: process.memoryUsage().heapUsed / 1024 / 1024 + "MB",
        timestamp: new Date().toISOString()
    });
};

export const createRoom = async (req, res, next) => {
    try {
        let roomID;
        do {
            roomID = crypto.randomBytes(3).toString("hex").toUpperCase();
        } while (await Services.getRoom(roomID));

        await Services.createRoom(roomID);

        // Send the secure ID back to the frontend
        res.status(201).json({ 
            success: true,
            roomID: roomID 
        });
    } catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ success: false, message: "Failed to create room" });
    }
};
export const joinRoom = async (req, res, next) => {
    try {
        const { roomID } = req.params;
        const result = await Services.validateRoom(roomID);
        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.error
            });
        }

        res.status(200).json({
            success: true,
            message: "Room available",
            peers: result.peerCount
        });
    } catch (err) {
        next(err);
    }
};

export const getAllRoom = async (req, res, next) => {
    try {
        const rooms = await Services.getAllRooms();

        res.status(200).json({
            success: true,
            count: rooms.length,
            rooms
        });
    } catch (err) {
        next(err);
    }
};

export const roomStatus = async (req, res, next) => {
    try {
        const { roomID } = req.params;
        const room = await Services.getRoom(roomID);

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        const peerCount = room.peers.length;

        res.status(200).json({
            success: true,
            peers: peerCount,
            mode: "P2P"
        });
    } catch (err) {
        next(err);
    }
};
