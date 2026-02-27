import express from "express"
import { createRoom, getAllRoom, getStats, joinRoom, roomStatus } from "../controller/room.controller.js"

const router = express.Router();

router.get("/", getAllRoom);
router.get("/stats", getStats);
router.get("/room/:roomID", roomStatus);
router.post("/room/", createRoom);
router.post("/room/:roomID", joinRoom);

export default router;