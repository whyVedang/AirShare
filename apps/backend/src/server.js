import app from "./app.js";
import { config } from "./config/config.env.js";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisPub, redisSub } from "./config/config.redis.js";
import { WebSocketINIT } from "./socket/index.js";
import logger from "./config/config.logger.js";

const server = http.createServer(app);

const io = new Server(server, {
  cors: config.cors
});

io.adapter(createAdapter(redisPub, redisSub));

io.on("connection", (socket) => {
  logger.info(`Socket.IO peer connected: ${socket.id}`);
  socket.on("disconnect", () => {
    logger.info(`Socket.IO peer disconnected: ${socket.id}`);
  });
});

WebSocketINIT(server);

server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});