import * as Services from "../services/connectionManager.services.js";
import { v4 as uuidv4 } from "uuid";

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
        const roomID = uuidv4();
        await Services.createRoom(roomID);

        res.status(201).json({
            success: true,
            roomID
        });
    } catch (err) {
        next(err);
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
            mode: peerCount >= 6 ? "SFU" : "P2P"
        });
    } catch (err) {
        next(err);
    }
};