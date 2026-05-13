import express from "express"
import cors from "cors"
import { ErrHandle } from "./middleware/error.middleware.js"
import { limiter } from "./middleware/ratelimiter.middleware.js"
import { requestLogger } from "./middleware/requestLogger.middleware.js"
import basicRouter from "./routes/basic.router.js"


const app = express()

app.set("trust proxy", 1)

app.use(cors())


app.use(express.json())
app.use(limiter)
app.use(requestLogger)


app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get("/", (req, res) => res.json({ status: "ok", service: "AirShare backend" }));


app.use("/api/v1/", basicRouter)
app.use(ErrHandle)

export default app;
