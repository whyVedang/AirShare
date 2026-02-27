import { Redis } from "ioredis"
import { config } from "./config.env.js"
import logger from "./config.logger.js"

export const redis = new Redis(config.REDIS_URL)
redis.on("connect", () => logger.info("Redis client connected!!"))

redis.on("error", (err) => {
    logger.error({ err }, "Redis connection error")
})
export const redisPub = new Redis(config.REDIS_URL)
export const redisSub = redisPub.duplicate()