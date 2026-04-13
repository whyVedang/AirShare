class CongestionController {
  constructor() {
    this.chunkSize = 16 * 1024;     // Starting size: 16KB
    this.minChunkSize = 8 * 1024;   // Minimum size: 8KB
    this.maxChunkSize = 64 * 1024;  // Maximum size: 64KB
  }

  update(avgRTT, bufferedAmount) {

    if (avgRTT < 50 && bufferedAmount < 100 * 1024) {
      this.chunkSize += 4 * 1024;
    } 

    else if (avgRTT > 150 || bufferedAmount > 300 * 1024) {
      this.chunkSize = this.chunkSize / 2;
    }

    this.chunkSize = Math.max(this.minChunkSize, Math.min(this.maxChunkSize, this.chunkSize));
  }

  getChunkSize() {
    return Math.floor(this.chunkSize); 
    }
}

export default CongestionController;

// IF:

// avgRTT < 50ms

// bufferedAmount < 100KB

// → Increase chunk size slightly (additive increase)

// IF:

// avgRTT > 150ms
// OR

// bufferedAmount > 300KB

// → Cut chunk size in half (multiplicative decrease)