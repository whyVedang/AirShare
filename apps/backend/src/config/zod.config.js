import { z } from "zod";

export const roomCodeSchema = z.string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{8}$/, "roomID must be an 8-character room code");

export const JoinRoomSchema = z.object({
  peerID: z.string().min(1, "peerID is required"),
    params: z.object({
        roomID: roomCodeSchema
    })
});

export const createRoomSchema = z.object({
    body: z.object({}).strict().optional()
});
