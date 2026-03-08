/**
 * ChunkManager - Handles file slicing and reassembly for P2P transfer
 * 
 * Implements efficient chunking strategy (16KB-64KB) to prevent memory issues
 * and enable reliable transfer over WebRTC DataChannels using SCTP.
 */

class ChunkManager {
  constructor(chunkSize = 16 * 1024) {
    // Default 16KB chunks, can scale up to 64KB
    this.chunkSize = this._validateChunkSize(chunkSize);
    this.chunks = [];
    this.totalChunks = 0;
    this.receivedChunks = new Map(); // chunkIndex -> ArrayBuffer
    this.fileMetadata = null;
  }

  /**
   * Validates chunk size is within acceptable range (16KB - 64KB)
   */
  _validateChunkSize(size) {
    const MIN_CHUNK = 16 * 1024; // 16KB
    const MAX_CHUNK = 64 * 1024; // 64KB
    
    if (size < MIN_CHUNK) return MIN_CHUNK;
    if (size > MAX_CHUNK) return MAX_CHUNK;
    return size;
  }

  /**
   * Slices a file into chunks of specified size
   * @param {File} file - The file to slice
   * @returns {Promise<Array<{index: number, data: ArrayBuffer, metadata: Object}>>}
   */
  async sliceFile(file) {
    if (!file || !(file instanceof File || file instanceof Blob)) {
      throw new Error('Invalid file object provided');
    }

    const chunks = [];
    const totalSize = file.size;
    this.totalChunks = Math.ceil(totalSize / this.chunkSize);
    
    // Store file metadata for reassembly
    this.fileMetadata = {
      name: file.name || 'unknown',
      size: totalSize,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified || Date.now(),
      totalChunks: this.totalChunks
    };

    for (let i = 0; i < this.totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, totalSize);
      const blob = file.slice(start, end);
      
      // Convert to ArrayBuffer for WebRTC DataChannel
      const arrayBuffer = await blob.arrayBuffer();
      
      chunks.push({
        index: i,
        data: arrayBuffer,
        size: arrayBuffer.byteLength,
        isLast: i === this.totalChunks - 1
      });
    }

    this.chunks = chunks;
    return chunks;
  }

  /**
   * Receives and stores a chunk for later assembly
   * @param {number} index - Chunk index
   * @param {ArrayBuffer} data - Chunk data
   */
  receiveChunk(index, data) {
    if (!(data instanceof ArrayBuffer)) {
      throw new Error('Chunk data must be an ArrayBuffer');
    }

    this.receivedChunks.set(index, data);
  }

  /**
   * Sets metadata for file reassembly
   * @param {Object} metadata - File metadata (name, size, type, totalChunks)
   */
  setFileMetadata(metadata) {
    this.fileMetadata = metadata;
    this.totalChunks = metadata.totalChunks;
  }

  /**
   * Assembles received chunks into a complete file Blob
   * @returns {Blob} - The reconstructed file
   */
  assembleChunks() {
    if (!this.fileMetadata) {
      throw new Error('File metadata not set. Cannot assemble chunks.');
    }

    if (this.receivedChunks.size !== this.totalChunks) {
      throw new Error(
        `Incomplete transfer: ${this.receivedChunks.size}/${this.totalChunks} chunks received`
      );
    }

    // Ensure chunks are in correct order
    const orderedChunks = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.receivedChunks.get(i);
      if (!chunk) {
        throw new Error(`Missing chunk at index ${i}`);
      }
      orderedChunks.push(chunk);
    }

    // Create Blob from ArrayBuffers
    const blob = new Blob(orderedChunks, { 
      type: this.fileMetadata.type 
    });

    // Verify size matches metadata
    if (blob.size !== this.fileMetadata.size) {
      console.warn(
        `Size mismatch: expected ${this.fileMetadata.size}, got ${blob.size}`
      );
    }

    return blob;
  }

  /**
   * Calculates current transfer progress
   * @returns {number} - Progress percentage (0-100)
   */
  getProgress() {
    if (this.totalChunks === 0) return 0;
    
    const received = this.receivedChunks.size;
    return Math.round((received / this.totalChunks) * 100);
  }

  /**
   * Returns detailed transfer statistics
   * @returns {Object} - Transfer stats
   */
  getStats() {
    const receivedCount = this.receivedChunks.size;
    const receivedBytes = Array.from(this.receivedChunks.values())
      .reduce((sum, chunk) => sum + chunk.byteLength, 0);

    return {
      totalChunks: this.totalChunks,
      receivedChunks: receivedCount,
      progress: this.getProgress(),
      receivedBytes,
      totalBytes: this.fileMetadata?.size || 0,
      isComplete: receivedCount === this.totalChunks && this.totalChunks > 0
    };
  }

  /**
   * Resets the chunk manager state
   */
  reset() {
    this.chunks = [];
    this.receivedChunks.clear();
    this.totalChunks = 0;
    this.fileMetadata = null;
  }

  /**
   * Gets the file metadata
   * @returns {Object|null} - File metadata
   */
  getMetadata() {
    return this.fileMetadata;
  }

  /**
   * Checks if all chunks have been received
   * @returns {boolean}
   */
  isTransferComplete() {
    return this.receivedChunks.size === this.totalChunks && this.totalChunks > 0;
  }
}

export default ChunkManager;
