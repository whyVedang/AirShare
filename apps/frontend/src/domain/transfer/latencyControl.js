class LatencyController {
  constructor() {
    this.avgRTT = 0;
    this.alpha = 0.2;
    this.pingCount = 0;
    this.pendingPings = new Map();
  }

  recordPing() {
    const now = Date.now();
    for (const [id, time] of this.pendingPings) {
      if (now - time > 10000) this.pendingPings.delete(id);
    }

    const id = ++this.pingCount;
    this.pendingPings.set(id, now);

    return { type: "ping", id };
  }

  recordPong(id) {
    const pingTime = this.pendingPings.get(id);

    if (!pingTime) return;

    const rtt = Date.now() - pingTime;
    this.pendingPings.delete(id);

    if (this.avgRTT === 0) {
      this.avgRTT = rtt;
    } else {
      this.avgRTT = (1 - this.alpha) * this.avgRTT + this.alpha * rtt;
    }

    return rtt;
  }

  getAverageRTT() {
    return this.avgRTT;
  }
}

export default LatencyController;
