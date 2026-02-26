import * as Services from "../services/connectionManager.services.js"
import { v4 as uuidv4 } from 'uuid';

export const getStats = (req, res) => {
    res.status(200).json({
        message: "AirShare Signaling Server Active",
        uptime: Math.floor(process.uptime()) + "s",
        memory: process.memoryUsage().heapUsed / 1024 / 1024 + "MB",
        timestamp: new Date().toISOString()
    });
};
export const createRoom=(req,res,next)=>{
    try{
        const roomID = uuidv4()
        const room = Services.createRoom(roomID)

        res.status(201).json({
            success: true,
            roomID: room.id
        })
    } 
    catch (err) {
        next(err)
    }
}

export const joinRoom=(req,res,next)=>{
    try{
        const {roomID} = req.params
        const result = Services.validateRoom(roomID)

        if (!result.valid) {
            return res.status(400).json({
                success: false,
                message: result.error
            })
        }

        res.status(200).json({
            success: true,
            message: "Room available",
            peers: result.room.peers.size
        })

    }
    catch(err){
        next(err)
    }
}

export const getAllRoom=(req,res,next)=>{
    try {
        const rooms = Services.getAllRooms()

        res.status(200).json({
            success: true,
            count: rooms.length,
            rooms: rooms.map(room => ({
                id: room.id,
                peers: room.peers.size
            }))
        })
    } catch (err) {
        next(err)
    }
    
}


export const roomStatus = (req, res, next) => {
    try {
        const { roomID } = req.params
        const room = Services.getRoom(roomID)

        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            })
        }

        res.status(200).json({
            success: true,
            peers: room.peers.size,
            mode: room.peers.size >= 6 ? "SFU" : "P2P"
        })

    } catch (err) {
        next(err)
    }
}