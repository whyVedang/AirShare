class ChunkManager {
  constructor() {
    this.receivedChunks = new Map();
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;
  }

  async sendFile(file, channel, congestionController, latencyController, onProgress) {
    const maxBuffer = 256 * 1024;
    channel.bufferedAmountLowThreshold = maxBuffer / 2;

    this.ensureChannelOpen(channel);

    // 1. Send Metadata
    channel.send(JSON.stringify({
      type: "file-meta",
      metadata: {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream'
      }
    }));

    let offset = 0;
    let chunkIndex = 0;

    while (offset < file.size) {
      // Congestion Control
      const avgRTT = latencyController.getAverageRTT();
      congestionController.update(avgRTT, channel.bufferedAmount);
      const chunkSize = congestionController.getChunkSize();

      // Backpressure
      if (channel.bufferedAmount >= maxBuffer) {
        await this.waitForBufferLow(channel);
      }

      this.ensureChannelOpen(channel);

      // Slice & Prepare Binary Packet
      const blob = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await blob.arrayBuffer();

      const packet = new Uint8Array(4 + arrayBuffer.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, chunkIndex); // Write index at start
      packet.set(new Uint8Array(arrayBuffer), 4); // Write data after index

      channel.send(packet);

      offset += chunkSize;
      chunkIndex++;

      if (onProgress) {
        onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
      }
    }

    // 3. Signal End
    this.ensureChannelOpen(channel);
    channel.send(JSON.stringify({ type: "file-end", totalChunks: chunkIndex }));
  }

  ensureChannelOpen(channel) {
    if (!channel || channel.readyState !== "open") {
      throw new Error(`Data channel is not open: ${channel?.readyState || "missing"}`);
    }
  }

  async waitForBufferLow(channel) {
    this.ensureChannelOpen(channel);

    if (channel.bufferedAmount < channel.bufferedAmountLowThreshold) {
      return;
    }

    return new Promise((resolve, reject) => {
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        channel.removeEventListener("bufferedamountlow", onBufferLow);
        channel.removeEventListener("close", onClose);
        channel.removeEventListener("error", onError);
      };

      const onBufferLow = () => {
        cleanup();
        resolve();
      };

      const onClose = () => {
        cleanup();
        reject(new Error(`Data channel closed while sending: ${channel.readyState}`));
      };

      const onError = () => {
        cleanup();
        reject(new Error("Data channel error while sending"));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for data channel buffer to drain"));
      }, 120000);

      channel.addEventListener("bufferedamountlow", onBufferLow);
      channel.addEventListener("close", onClose);
      channel.addEventListener("error", onError);
    });
  }

  handleIncomingData(data) {
    if (data instanceof ArrayBuffer) {
      // Extract Index from the first 4 bytes
      const view = new DataView(data);
      const index = view.getUint32(0);
      const chunkData = data.slice(4); // Actual file content

      this.receivedChunks.set(index, chunkData);
      this.receivedBytes += chunkData.byteLength;
      return { type: 'progress', value: this.getReceiverProgress() };
    } 
    
    const msg = JSON.parse(data);
    if (msg.type === "file-meta") {
      this.fileMetadata = msg.metadata;
      return { type: 'meta', value: msg.metadata };
    }
    if (msg.type === "file-end") {
      this.totalChunks = msg.totalChunks;
      const filename = this.fileMetadata?.name;
      return { type: 'complete', value: this.assembleChunks(), filename };
    }
  }

  assembleChunks() {
    const ordered = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.receivedChunks.get(i);
      if (!chunk) throw new Error(`Missing chunk ${i}`);
      ordered.push(chunk);
    }
    const blob = new Blob(ordered, { type: this.fileMetadata.type });
    this.reset();
    return blob;
  }

  getReceiverProgress() {
    if (!this.fileMetadata) return 0;
    return Math.min(100, Math.round((this.receivedBytes / this.fileMetadata.size) * 100));
  }

  reset() {
    this.receivedChunks.clear();
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;
  }
}

export default ChunkManager;
