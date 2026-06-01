import { OPFSService } from "./OPFS.js";

const PACKET_HEADER_BYTES = 12;
const CHUNK_PROTOCOL_VERSION = 2;

const canUseOPFS = () => (
  typeof navigator !== "undefined" &&
  Boolean(navigator.storage?.getDirectory)
);

class ChunkManager {
  constructor({ useOPFS = true } = {}) {
    this.receivedChunks = new Map();
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;
    this.useOPFS = useOPFS;
    this.opfsService = null;
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
        type: file.type || 'application/octet-stream',
        chunkProtocol: CHUNK_PROTOCOL_VERSION
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

      const packet = new Uint8Array(PACKET_HEADER_BYTES + arrayBuffer.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, chunkIndex, true);
      view.setBigUint64(4, BigInt(offset), true);
      packet.set(new Uint8Array(arrayBuffer), PACKET_HEADER_BYTES);

      channel.send(packet.buffer);

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

  async handleIncomingData(data) {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const packet = this.unpackPacket(this.toArrayBuffer(data));
      if (!packet) return null;

      if (this.opfsService) {
        await this.opfsService.writeChunk(packet.chunkData, packet.offset);
      } else {
        this.receivedChunks.set(packet.index, packet.chunkData);
      }

      this.receivedBytes += packet.chunkData.byteLength;
      return { type: 'progress', value: this.getReceiverProgress() };
    } 
    
    const msg = JSON.parse(data);
    if (msg.type === "file-meta") {
      await this.prepareReceive(msg.metadata);
      return { type: 'meta', value: msg.metadata };
    }
    if (msg.type === "file-end") {
      this.totalChunks = msg.totalChunks;
      return this.completeReceive();
    }
  }

  unpackPacket(data) {
    if (data.byteLength < 4) {
      return null;
    }

    const view = new DataView(data);
    const index = view.getUint32(0, true);

    if (
      this.fileMetadata?.chunkProtocol === CHUNK_PROTOCOL_VERSION &&
      data.byteLength >= PACKET_HEADER_BYTES
    ) {
      const offset = Number(view.getBigUint64(4, true));
      return {
        index,
        offset,
        chunkData: data.slice(PACKET_HEADER_BYTES)
      };
    }

    return {
      index,
      offset: this.receivedBytes,
      chunkData: data.slice(4)
    };
  }

  toArrayBuffer(data) {
    if (data instanceof ArrayBuffer) {
      return data;
    }

    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    );
  }

  async prepareReceive(metadata) {
    this.reset();
    this.fileMetadata = metadata;

    if (this.useOPFS && canUseOPFS()) {
      this.opfsService = new OPFSService();
      await this.opfsService.initFile(metadata.name);
    }
  }

  async completeReceive() {
    const filename = this.fileMetadata?.name;
    const file = this.opfsService
      ? await this.opfsService.finish()
      : this.assembleChunks();

    this.reset();

    return {
      type: 'complete',
      value: file,
      filename
    };
  }

  assembleChunks() {
    const ordered = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.receivedChunks.get(i);
      if (!chunk) throw new Error(`Missing chunk ${i}`);
      ordered.push(chunk);
    }
    const blob = new Blob(ordered, { type: this.fileMetadata.type });
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
    this.opfsService = null;
  }
}

export default ChunkManager;
