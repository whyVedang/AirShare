import express from "express";
import { createRoom, getAllRoom, getStats, joinRoom, roomStatus } from "../controller/room.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { createRoomSchema, JoinRoomSchema } from "../config/zod.config.js";

const router = express.Router();

router.get("/", getAllRoom);
router.get("/stats", getStats);
router.get("/room/:roomID", roomStatus);
router.post("/room/",validate(createRoomSchema) ,createRoom);
router.post("/room/:roomID", validate(JoinRoomSchema),joinRoom);

export default router;