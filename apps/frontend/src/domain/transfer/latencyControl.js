class LatencyController {
  constructor() {
    this.avgRTT = 0;
    this.alpha = 0.2;
    this.pingCount=0;
    this.pendingPings=new Map();
  }

  recordPing() {
    const id=++this.pingCount;
    const lastPingTime = Date.now();
    this.pendingPings.set(id,lastPingTime)

    return { type: "ping", id };
  }

  recordPong(id) {
    const PingTime=this.pendingPings.get(id)

    if (!PingTime) return;

    const rtt = Date.now() - PingTime;
    this.pendingPings.delete(id)

    if (this.avgRTT === 0) {
      this.avgRTT = rtt;
    } else {
      this.avgRTT =
        (1 - this.alpha) * this.avgRTT + this.alpha * rtt;
    }

    return rtt;
  }

  getAverageRTT() {
    return this.avgRTT;
  }
}

export default LatencyController;