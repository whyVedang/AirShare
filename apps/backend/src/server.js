import app from "./app.js";
import { config } from "./config/config.env.js";
import http from "http";
import { WebSocketINIT } from "./socket/index.js";
import logger from "./config/config.logger.js";

import 'dotenv/config';

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

const PORT=process.env.PORT

app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    });
