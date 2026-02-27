import { z } from "zod";

export const JoinRoomSchema = z.object({
    roomID: z.string().uuid("roomID must be a valid UUID"),
    peerID: z.string().min(1, "peerID is required")
});

export const SignalSchema = z.object({
    roomID: z.string().uuid("roomID must be a valid UUID"),
    targetPeerID: z.string().min(1, "targetPeerID is required"),
    sdp: z.string().optional(),
    candidate: z.any().optional()
});

export const validateJoin = (payload) => JoinRoomSchema.parse(payload);

export const validateSignal = (payload) => SignalSchema.parse(payload);
