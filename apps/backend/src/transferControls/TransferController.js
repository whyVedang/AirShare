import LatencyController from "./latencyControl.js"
import congestionController from "./congestionControl.js"
import chunkController from "./chunkControl.js"



class TransferController {
  
  constructor(channel) {
    this.channel = channel;
    this.latencyController = new LatencyController();
    this.congestionController = new congestionController();
    this.chunkController = new chunkController(
      channel, 
      this.congestionController, 
      () => this.latencyController.getAverageRTT()
    );
    
    this.messageInterval = null;
    this.setMessageHandler();
  }

  setMessageHandler() {
    this.receivedChunks = [];
    this.expectedFileSize = 0;
    this.receivedBytes = 0;
    this.fileName = "";

    this.channel.addEventListener("message", (event) => {
      try {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          
          switch (data.type) {

            case "file-start":
              this.receivedChunks = [];
              this.expectedFileSize = data.size;
              this.receivedBytes = 0;
              this.fileName = data.name;
              break;

            case "file-end":
              if (this.receivedBytes === this.expectedFileSize) {
                this.assembleFile();
              }
              else {
                console.error("File incomplete. Transfer corrupted.");
              }
              break;

            case "ping":
              this.channel.send(JSON.stringify({ type: "pong", id: data.id }));
              break;

            case "pong":
              this.latencyController.recordPong(data.id);
              break;
          }
        } else {
          this.receivedChunks.push(event.data);
          this.receivedBytes += event.data.byteLength;
          if (this.receivedBytes > this.expectedFileSize) {
            console.error("Overflow detected");
            return;
          }
        }
      } catch (error) {
        console.error("Transfer Error:", error);
      }
    });
  }

  startLatencyChecks() {
    this.stopLatencyChecks();
    this.messageInterval = setInterval(() => {
      const ping = this.latencyControl.recordPing();
      this.channel.send(JSON.stringify(ping));
    }, 3000);
  }

  stopLatencyChecks() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  }

  async send(file) {
    this.startLatencyChecks();

    this.channel.send(JSON.stringify({
      type: "file-start",
      name: file.name,
      size: file.size
    }));

    try {
      await this.chunkController.sendFile(file);
    } finally {
      this.stopLatencyChecks();
    }

    this.channel.send(JSON.stringify({ type: "file-end" }));
  }

  assembleFile() {
    const blob = new Blob(this.receivedChunks);
    console.log(`File ${this.fileName} received successfully.`);
  }
}