class ChunkController {
  constructor(channel, congestionController,getAvgRTT) {
    this.channel = channel;
    this.controller = congestionController;
    this.maxBuffer = 256 * 1024;
    this.rtt=getAvgRTT;
    this.channel.bufferedAmountLowThreshold = this.maxBuffer / 2;
  }

  async sendFile(file) {
    let offset=0;
    while(offset<file.size){

      const avgRTT = this.rtt();
      this.controller.update(avgRTT, this.channel.bufferedAmount);

      const chunkSize=this.controller.getChunkSize()
      if(this.channel.bufferedAmount>=this.maxBuffer) await this.waitForBufferLow()

      const chunk=file.slice(offset,offset+chunkSize)

      const buffer=await chunk.arrayBuffer()

      this.channel.send(buffer)
    
      offset+=chunkSize
    }
  }

  async waitForBufferLow() {
    return new Promise(resolve => {
    const handler = () => {
      this.channel.removeEventListener("bufferedamountlow", handler);
      resolve();
    };

    this.channel.addEventListener("bufferedamountlow", handler);
  });

  }
}

export default ChunkController;
// offset = 0
// while offset < file.size
// Ask controller.getChunkSize()
// Check channel.bufferedAmount
// If too high → wait
// Slice file using dynamic chunk size
// Send
// Move offset
