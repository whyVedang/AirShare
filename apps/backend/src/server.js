import app from "./app.js";
import { config } from "./config/config.env.js";
import http from "http";
import { WebSocketINIT } from "./socket/index.js";
import logger from "./config/config.logger.js";

const server = http.createServer(app);

WebSocketINIT(server);

server.listen(config.PORT, () => {
  logger.info(`Server running on port ${config.PORT}`);
});