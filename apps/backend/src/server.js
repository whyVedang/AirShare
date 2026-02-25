import app from"./app.js"
import dotenv from "dotenv"
import http from "http"
import {Server} from "socket.io"

dotenv.config()

PORT=process.env.PORT

const server=http.createServer(app)

const io=new Server(server,{
  cors:{
    origin:"*",methods:["GET","POST"]
  }
})

io.on("connection",(socket)=>{
  console.log("New user connected");
  
  socket.on("disconnect", () => {
        console.log("User disconnected");
    });
})

app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    });