import { OPFSService } from "./OPFS.js";
import {
  CHUNK_PROTOCOL_VERSION,
  HASH_BYTES,
  HASH_ALGORITHM,
  PACKET_HEADER_BYTES,
  bytesToHex,
  createHashTreeHex,
  createTransferId,
  hexToBytes,
  sha256Bytes,
  timingSafeHexEqual,
  toArrayBuffer
} from "./transferProtocol.js";

const LEGACY_PACKET_HEADER_BYTES = 12;

const canUseOPFS = () => (
  typeof navigator !== "undefined" &&
  Boolean(navigator.storage?.getDirectory)
);

class ChunkManager {
  constructor({ useOPFS = true } = {}) {
    this.receivedChunks = new Map();
    this.receivedChunkHashes = new Map();
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;
    this.useOPFS = useOPFS;
    this.opfsService = null;
  }

  async sendFile(file, channel, congestionController, latencyController, onProgress, options = {}) {
    const maxBuffer = 256 * 1024;
    const transferId = options.transferId || createTransferId();
    const startOffset = Math.max(0, Math.min(options.startOffset || 0, file.size));
    const chunkHashesByOffset = options.chunkHashesByOffset || new Map();

    channel.bufferedAmountLowThreshold = maxBuffer / 2;
    this.ensureChannelOpen(channel);
    this.throwIfAborted(options.signal);

    channel.send(JSON.stringify({
      type: "file-meta",
      metadata: {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        chunkProtocol: CHUNK_PROTOCOL_VERSION,
        hashAlgorithm: HASH_ALGORITHM,
        transferId,
        startOffset
      }
    }));

    let offset = startOffset;
    let chunkIndex = 0;

    while (offset < file.size) {
      this.throwIfAborted(options.signal);

      const avgRTT = latencyController.getAverageRTT();
      congestionController.update(avgRTT, channel.bufferedAmount);
      const chunkSize = congestionController.getChunkSize();

      if (channel.bufferedAmount >= maxBuffer) {
        await this.waitForBufferLow(channel, options.signal);
      }

      this.ensureChannelOpen(channel);
      this.throwIfAborted(options.signal);

      const blob = file.slice(offset, offset + chunkSize);
      const arrayBuffer = await blob.arrayBuffer();
      const chunkBytes = new Uint8Array(arrayBuffer);
      const chunkHash = await sha256Bytes(chunkBytes);

      chunkHashesByOffset.set(offset, chunkHash);
      const packet = this.packPacket(chunkIndex, offset, chunkBytes, chunkHash);
      channel.send(packet.buffer);

      offset += chunkSize;
      chunkIndex += 1;

      if (onProgress) {
        onProgress(Math.min(100, Math.round((offset / file.size) * 100)));
      }
    }

    const fileHash = await createHashTreeHex(chunkHashesByOffset);

    this.ensureChannelOpen(channel);
    channel.send(JSON.stringify({
      type: "file-end",
      transferId,
      totalChunks: chunkIndex,
      integrity: {
        algorithm: HASH_ALGORITHM,
        fileHash
      }
    }));

    return {
      transferId,
      fileHash,
      sentBytes: file.size - startOffset
    };
  }

  packPacket(index, offset, chunkBytes, chunkHash) {
    const packet = new Uint8Array(PACKET_HEADER_BYTES + chunkBytes.byteLength);
    const view = new DataView(packet.buffer);

    view.setUint32(0, index, true);
    view.setBigUint64(4, BigInt(offset), true);
    view.setUint32(12, CHUNK_PROTOCOL_VERSION, true);
    packet.set(chunkHash, 16);
    packet.set(chunkBytes, PACKET_HEADER_BYTES);

    return packet;
  }

  ensureChannelOpen(channel) {
    if (!channel || channel.readyState !== "open") {
      throw new Error(`Data channel is not open: ${channel?.readyState || "missing"}`);
    }
  }

  throwIfAborted(signal) {
    if (signal?.aborted) {
      throw new DOMException("Transfer cancelled", "AbortError");
    }
  }

  async waitForBufferLow(channel, signal) {
    this.ensureChannelOpen(channel);

    if (channel.bufferedAmount < channel.bufferedAmountLowThreshold) {
      return;
    }

    return new Promise((resolve, reject) => {
      let timeoutId;

      const cleanup = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
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

      const onAbort = () => {
        cleanup();
        reject(new DOMException("Transfer cancelled", "AbortError"));
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for data channel buffer to drain"));
      }, 120000);

      signal?.addEventListener("abort", onAbort, { once: true });
      channel.addEventListener("bufferedamountlow", onBufferLow);
      channel.addEventListener("close", onClose);
      channel.addEventListener("error", onError);
    });
  }

  async handleIncomingData(data) {
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const packet = this.unpackPacket(toArrayBuffer(data));
      if (!packet) return null;

      await this.verifyPacket(packet);
      await this.storePacket(packet);

      return {
        type: "progress",
        value: this.getReceiverProgress(),
        transferId: this.fileMetadata?.transferId,
        receivedBytes: this.receivedBytes
      };
    }

    const msg = JSON.parse(data);
    if (msg.type === "file-meta") {
      await this.prepareReceive(msg.metadata);
      return { type: "meta", value: msg.metadata };
    }
    if (msg.type === "file-end") {
      this.totalChunks = msg.totalChunks;
      return this.completeReceive(msg.integrity);
    }
    if (msg.type === "transfer-cancel") {
      await this.cancelReceive();
      return { type: "cancelled", reason: msg.reason || "cancelled" };
    }
  }

  unpackPacket(data) {
    if (data.byteLength < 4) {
      return null;
    }

    const view = new DataView(data);
    const index = view.getUint32(0, true);

    if (
      data.byteLength >= PACKET_HEADER_BYTES &&
      view.getUint32(12, true) === CHUNK_PROTOCOL_VERSION
    ) {
      const offset = Number(view.getBigUint64(4, true));
      const chunkHash = data.slice(16, 16 + HASH_BYTES);
      return {
        index,
        offset,
        chunkHash,
        chunkData: data.slice(PACKET_HEADER_BYTES),
        verified: false
      };
    }

    if (
      this.fileMetadata?.chunkProtocol === 2 &&
      data.byteLength >= LEGACY_PACKET_HEADER_BYTES
    ) {
      const offset = Number(view.getBigUint64(4, true));
      return {
        index,
        offset,
        chunkData: data.slice(LEGACY_PACKET_HEADER_BYTES),
        verified: true
      };
    }

    return {
      index,
      offset: this.receivedBytes,
      chunkData: data.slice(4),
      verified: true
    };
  }

  async verifyPacket(packet) {
    if (packet.verified || !packet.chunkHash) {
      return;
    }

    const actualHash = await sha256Bytes(packet.chunkData);
    const expectedHex = bytesToHex(new Uint8Array(packet.chunkHash));
    const actualHex = bytesToHex(actualHash);

    if (!timingSafeHexEqual(actualHex, expectedHex)) {
      throw new Error(`Chunk integrity check failed at offset ${packet.offset}`);
    }

    packet.verified = true;
    packet.verifiedHash = actualHash;
  }

  async storePacket(packet) {
    const existingHash = this.receivedChunkHashes.get(packet.offset);
    const hash = packet.verifiedHash || packet.chunkHash;
    const hashHex = hash ? bytesToHex(new Uint8Array(hash)) : null;

    if (existingHash) {
      if (hashHex && existingHash !== hashHex) {
        throw new Error(`Conflicting duplicate chunk at offset ${packet.offset}`);
      }
      return;
    }

    if (this.opfsService) {
      await this.opfsService.writeChunk(packet.chunkData, packet.offset);
    } else {
      this.receivedChunks.set(packet.offset, packet.chunkData);
    }

    if (hashHex) {
      this.receivedChunkHashes.set(packet.offset, hashHex);
    }

    this.receivedBytes += packet.chunkData.byteLength;
  }

  async prepareReceive(metadata) {
    const isResume = (
      metadata?.transferId &&
      this.fileMetadata?.transferId === metadata.transferId &&
      metadata.startOffset > 0
    );

    if (!isResume) {
      await this.reset();
      this.fileMetadata = metadata;
    } else {
      this.fileMetadata = { ...this.fileMetadata, ...metadata };
    }

    if (this.useOPFS && canUseOPFS() && !this.opfsService) {
      this.opfsService = new OPFSService();
      await this.opfsService.initFile(metadata.name, {
        transferId: metadata.transferId,
        keepExistingData: Boolean(metadata.startOffset)
      });
    }
  }

  async completeReceive(integrity) {
    const filename = this.fileMetadata?.name;
    const metadata = this.fileMetadata;

    if (metadata?.size && this.receivedBytes < metadata.size) {
      throw new Error(`Incomplete file: received ${this.receivedBytes}/${metadata.size} bytes`);
    }

    const fileHash = await this.verifyFileIntegrity(integrity);
    const file = this.opfsService
      ? await this.opfsService.finish()
      : this.assembleChunks();

    await this.reset();

    return {
      type: "complete",
      value: file,
      filename,
      metadata: {
        ...metadata,
        integrity: {
          algorithm: integrity?.algorithm || HASH_ALGORITHM,
          fileHash
        }
      }
    };
  }

  async verifyFileIntegrity(integrity) {
    if (!integrity?.fileHash || this.receivedChunkHashes.size === 0) {
      return null;
    }

    const hashBytesByOffset = new Map(
      Array.from(this.receivedChunkHashes.entries())
        .map(([offset, hashHex]) => [offset, hexToBytes(hashHex)])
    );
    const actualHash = await createHashTreeHex(hashBytesByOffset);

    if (!timingSafeHexEqual(actualHash, integrity.fileHash)) {
      throw new Error("File integrity check failed");
    }

    return actualHash;
  }

  assembleChunks() {
    const ordered = Array.from(this.receivedChunks.entries())
      .sort(([leftOffset], [rightOffset]) => Number(leftOffset) - Number(rightOffset))
      .map(([, chunk]) => chunk);

    const blob = new Blob(ordered, { type: this.fileMetadata.type });
    return blob;
  }

  getReceiverProgress() {
    if (!this.fileMetadata) return 0;
    return Math.min(100, Math.round((this.receivedBytes / this.fileMetadata.size) * 100));
  }

  async cancelReceive() {
    await this.reset();
  }

  async reset() {
    this.receivedChunks.clear();
    this.receivedChunkHashes.clear();
    this.fileMetadata = null;
    this.totalChunks = 0;
    this.receivedBytes = 0;

    if (this.opfsService) {
      await this.opfsService.abort();
      this.opfsService = null;
    }
  }
}

export default ChunkManager;
