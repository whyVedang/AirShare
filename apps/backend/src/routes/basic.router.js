import express from "express"
import { createRoom, deleteRoom, getAllRoom, getStats, joinRoom, roomStatus } from "../controller/room.controller"

const router=express.Router()

router.get('/',getAllRoom)
router.get('/room/:roomID',roomStatus)
router.post('/room/:roomID',joinRoom)
router.post('/room/',createRoom)

router.get("/stats", getStats);

export default router