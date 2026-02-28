import LatencyController from "./latencyControl.js";
import CongestionController from "./congestionControl.js";
import ChunkController from "./chunkControl.js";

class TransferController {
  constructor(channel) {
    this.channel = channel;
    this.latencyControl = new LatencyController();
    this.congestionControl = new CongestionController();
    this.chunkControl = new ChunkController(channel, this.congestionController);
    
    this.messageInterval=null
    this.setMessageHandler()
}

  setMessageHandler(){
    this.channel.addEventListener("message",(event)=>{
        try{
            const data=JSON.parse(event.data)

            if(data.type=="ping") this.channel.send(JSON.stringify({type:"pong",id:data.id}))

            if (data.type === "pong") {
            const rtt = this.latencyControl.recordPong(data.id);
            const avgRTT = this.latencyControl.getAverageRTT();

            this.congestionControl.update(
                avgRTT,
                this.channel.bufferedAmount
          );
        }
    }
        catch(error){

        }
    })
  }

  startLatencyChecks()
  {
    this.messageInterval = setInterval(() => {
      const ping =this.latencyControl.recordPing();
      this.channel.send(JSON.stringify({ type: "ping" }));
    }, 3000);
  }

  stopLatencyChecks()
  {
    clearInterval(this.messageInterval)
  }


  async send(file) {
    this.startLatencyChecks()
    await this.chunkControl.sendFile(file)
    this.stopLatencyChecks()
    }
}


export default TransferController