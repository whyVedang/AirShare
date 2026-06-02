import { z } from "zod";

export const JoinRoomSchema = z.object({
    roomID: z.string().length(6, "roomID must be a 6-character code"),
    peerID: z.string().min(1, "peerID is required"),
    params: z.object({
         roomID: z.string().length(6, "roomID must be a 6-character code")
     })
});

export const createRoomSchema = z.object({
    body: z.object({
        password: z.string().optional()
        })
});