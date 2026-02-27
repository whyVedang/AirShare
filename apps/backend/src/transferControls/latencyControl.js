class LatencyController {
  constructor() {
    this.avgRTT = 0;
    this.alpha = 0.2;
    this.lastPingTime = null;
  }

  recordPing() {
    this.lastPingTime = Date.now();
  }

  recordPong() {
    if (!this.lastPingTime) return;

    const rtt = Date.now() - this.lastPingTime;

    if (this.avgRTT === 0) {
      this.avgRTT = rtt;
    } else {
      this.avgRTT =
        (1 - this.alpha) * this.avgRTT + this.alpha * rtt;
    }

    this.lastPingTime = null;
    return rtt;
  }

  getAverageRTT() {
    return this.avgRTT;
  }
}

export default LatencyController;