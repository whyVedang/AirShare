import express from "express"
import cors from "cors"
import helmet from "helmet"
import { config } from "./config/config.env.js"
import { ErrHandle } from "./middleware/error.middleware.js"
import { limiter } from "./middleware/ratelimiter.middleware.js"
import { requestLogger } from "./middleware/requestLogger.middleware.js"
import basicRouter from "./routes/basic.router.js"


const app = express()

app.set("trust proxy", 1)

const corsOptions = {
    origin(origin, callback) {
        if (!origin || config.NODE_ENV !== "production") {
            return callback(null, true)
        }

        if (config.FRONTEND_ORIGINS.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error("Origin not allowed by CORS"))
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors(corsOptions));


app.use(express.json({ limit: "16kb" }))
app.use(limiter)
app.use(requestLogger)


app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get("/", (req, res) => res.json({ status: "ok", service: "AirShare backend" }));


app.use("/api/v1/", basicRouter)
app.use(ErrHandle)

export default app;
