import dotenv from "dotenv"

dotenv.config()

export const config = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BACKEND_URL: process.env.BACKEND_URL || 'https://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'https://localhost:5173',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  ROOM_TTL: parseInt(process.env.ROOM_TTL) || 600,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
};