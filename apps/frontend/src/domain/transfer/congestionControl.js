class CongestionController {
  constructor() {
    this.chunkSize = 16 * 1024;
    this.minChunkSize = 8 * 1024;
    this.maxChunkSize = 64 * 1024;
  }

  update(avgRTT, bufferedAmount) {
    if (avgRTT < 50 && bufferedAmount < 100 * 1024) {
      this.chunkSize += 4 * 1024;
    } else if (avgRTT > 150 || bufferedAmount > 300 * 1024) {
      this.chunkSize = this.chunkSize / 2;
    }

    this.chunkSize = Math.max(
      this.minChunkSize,
      Math.min(this.maxChunkSize, this.chunkSize)
    );
  }

  getChunkSize() {
    return Math.floor(this.chunkSize);
  }
}

export default CongestionController;
