import app from"./app.js"
import { config } from "../src/config/config.env.js";
import http from "http"
import {Server} from "socket.io"

import 'dotenv/config';

const server=http.createServer(app)

const io=new Server(server,{
  cors:config.cors
})

io.on("connection",(socket)=>{
  console.log("New user connected");
  
  socket.on("disconnect", () => {
        console.log("User disconnected");
    });
})

const PORT=process.env.PORT

app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    });