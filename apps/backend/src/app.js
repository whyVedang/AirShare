import express from "express"

const app=express()

app.use("/api/v1",router)

export default app;