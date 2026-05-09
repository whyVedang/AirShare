import StorageManager from "./StorageManager";
import { calculateFileHash } from "./utils/hash";
import { markChunk, hasChunk, isBitmapComplete, getMissingChunks } from "./utils/BitMap";
import { createChunkPacket, parseChunkPacket } from "./utils/Packet";

class ChunkManager {
  constructor() {
    this.storage = StorageManager;
    this.receivedChunks = new Map();
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;
    this.expectedHash = null;
    this.chunkSize = 64 * 1024;
  }

  async sendFile(file, channel, congestionController, latencyController, onProgress) {
    const maxBuffer = 256 * 1024;
    channel.bufferedAmountLowThreshold = maxBuffer / 2;

    // 1. Send Metadata 
    const fileId = crypto.randomUUID();
    const originalHash = await calculateFileHash(file);

    channel.send(JSON.stringify({
      type: "meta",
      metadata: {
        fileId,
        name: file.name,
        size: file.size,
        hash: originalHash,
        type: file.type || 'application/octet-stream'
      }
    }));

    let offset = 0;
    let chunkIndex = 0;

    while (offset < file.size) {
      // Congestion Control
      const avgRTT = latencyController.getAverageRTT();
      congestionController.update(avgRTT, channel.bufferedAmount);
      this.chunkSize = congestionController.getChunkSize();

      // Backpressure
      if (channel.bufferedAmount >= maxBuffer) {
        await this.waitForBufferLow(channel);
      }

      // Slice & Prepare Binary Packet
      const blob = file.slice(offset, offset + this.chunkSize);
      const arrayBuffer = await blob.arrayBuffer();
      const packet = createChunkPacket(chunkIndex, arrayBuffer);

      channel.send(packet);

      offset += this.chunkSize;
      chunkIndex++;

      if (onProgress) {
        onProgress(Math.round((offset / file.size) * 100));
      }
    }

    // 3. Signal End
    channel.send(JSON.stringify({ type: "file-end", totalChunks: chunkIndex }));
  }

  waitForBufferLow(channel) {
    return new Promise(resolve => {
      const handler = () => {
        channel.removeEventListener("bufferedamountlow", handler);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", handler);
    });
  }

  async handleIncomingData(data, channel) {
    if (data instanceof Blob) {
      data = await data.arrayBuffer();
    }

    if (data instanceof ArrayBuffer) {
      const { chunkIndex, chunkData } = parseChunkPacket(data);
      const bitmap = await this.storage.getBitmap(this.fileId, this.totalChunks);

      if (hasChunk(bitmap, chunkIndex)) return;

      await this.storage.writeChunk(this.fileId, chunkIndex, this.chunkSize, chunkData);
      markChunk(bitmap, chunkIndex);
      await this.storage.saveBitmap(this.fileId, bitmap);

      this.receivedBytes += chunkData.byteLength;
      return { type: 'progress', value: this.getReceiverProgress() };
    }

    const msg = JSON.parse(data);

    if (msg.type === "meta") {
      this.fileMetadata = msg.metadata;
      this.expectedHash = msg.metadata.hash;
      this.fileId = msg.metadata.fileId;
      this.totalChunks = Math.ceil(msg.metadata.size / this.chunkSize);

      await this.storage.saveMetadata(this.fileId, this.fileMetadata);
      return { type: 'meta', value: this.fileMetadata };
    }

    if (msg.type === "file-end") {
      const bitmap = await this.storage.getBitmap(this.fileId, this.totalChunks);
      const complete = isBitmapComplete(bitmap, this.totalChunks);

      if (!complete) {
        const missing = getMissingChunks(bitmap, this.totalChunks);
        channel.send(JSON.stringify({ type: "resume-request", missing }));
        return;
      }

      await this.storage.finalizeFile(this.fileId);
      const file = await this.storage.readFile(this.fileId);
      const receivedHash = await calculateFileHash(file);
      const verified = receivedHash === this.expectedHash;

      channel.send(JSON.stringify({
        type: "receipt",
        status: verified ? "verified" : "corrupted",
        hash: receivedHash
      }));

      if (!verified) throw new Error("File corrupted");

      return {
        type: "complete",
        value: file,
        filename: this.fileMetadata.name,
        verified: true
      };
    }

    if (msg.type === "resume-request") {
      return { type: "resume-request", value: msg.missing };
    }

    if (msg.type === "receipt") {
      return { type: "receipt", value: msg };
    }
  }

  getReceiverProgress() {
    if (!this.fileMetadata) return 0;
    return Math.min(100, Math.round((this.receivedBytes / this.fileMetadata.size) * 100));
  }

  reset() {
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;
    this.expectedHash = null;
    this.chunkSize = 64 * 1024;
  }
}

export default ChunkManager;