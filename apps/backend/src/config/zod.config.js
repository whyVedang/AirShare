import { z } from "zod";

export const roomCodeSchema = z.string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, "roomID must be a 6-character room code");

export const JoinRoomSchema = z.object({
    params: z.object({
        roomID: roomCodeSchema
    })
});

export const createRoomSchema = z.object({
    body: z.object({}).strict().optional()
});
