import pino from "pino";
import { config } from "./config.env.js";

const logger = pino({
  level: "info",
  ...(config.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty"
    }
  })
});

export default logger;
