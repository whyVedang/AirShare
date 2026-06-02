import dotenv from "dotenv"

dotenv.config()

export const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173', 
  FRONTEND_ORIGINS: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  ROOM_TTL: parseInt(process.env.ROOM_TTL, 10) || 600,
  MAX_PEERS_PER_ROOM: parseInt(process.env.MAX_PEERS_PER_ROOM, 10) || 50
};
