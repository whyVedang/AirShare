import LatencyController from "./latencyControl.js";
import CongestionController from "./congestionControl.js";
import ChunkManager from "./ChunkManager.js"; // Make sure this path is correct!

class TransferController {
    constructor(peerEngine, onProgress, onComplete, onLatency) {
        this.peerEngine = peerEngine;
        this.channel = null;

        // Instantiate your 3 core logic blocks
        this.latencyController = new LatencyController();
        this.congestionController = new CongestionController();
        this.chunkManager = new ChunkManager();

        // UI Callbacks passed from Room.jsx
        this.onProgress = onProgress || (() => { });
        this.onComplete = onComplete || (() => { });
        this.onLatency = onLatency || (() => { });

        this.messageInterval = null;
        this.handleMessage = this.handleMessage.bind(this);
    }

    attachChannel(channel) {
        this.channel = channel;
        this.channel.addEventListener("message", this.handleMessage);
    }

    detachChannel() {
        if (this.channel) {
            this.channel.removeEventListener("message", this.handleMessage);
            this.channel = null;
        }
        this.stopLatencyChecks();
    }

    async handleMessage(event) {
        try {
            if (typeof event.data === "string") {
                    const data = JSON.parse(event.data);

                    if (data.type === "ping") {
                        this.channel.send(JSON.stringify({ type: "pong", id: data.id }));
                        return; // We handled it, stop here.
                    }

                    if (data.type === "pong") {
                        this.latencyController.recordPong(data.id);
                        const avgRtt = this.latencyController.getAverageRTT();
                        if (avgRtt > 0) {
                            this.onLatency(Math.round(avgRtt));
                        }
                        return; // We handled it, stop here.
                    }
                }

                const result = this.chunkManager.handleIncomingData(event.data);

                if (!result) return;

                switch (result.type) {
                    case 'meta':
break;

                    case 'progress':
                        this.onProgress(result.value);
                        break;

                    case 'complete':
                        this.onComplete(result.value, result.filename);
                        break;
                }

            } catch (error) {
                console.error("Transfer Error:", error);
            }
    }

    startLatencyChecks() {
        this.stopLatencyChecks();
        this.messageInterval = setInterval(() => {
            // Fixed typo: was latencyControl, is now latencyController
            const ping = this.latencyController.recordPing();
            if (this.channel && this.channel.readyState === 'open') {
                this.channel.send(JSON.stringify(ping));
            }
        }, 3000);
    }

    stopLatencyChecks() {
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
            this.messageInterval = null;
        }
    }

    // The simplified send method that delegates to ChunkManager
    async send(file) {
        if (!this.channel || this.channel.readyState !== 'open') {
            throw new Error("Data channel is not open");
        }

        // Make sure it's running
        if (!this.messageInterval) {
            this.startLatencyChecks();
        }

        await this.chunkManager.sendFile(
            file,
            this.channel,
            this.congestionController,
            this.latencyController,
            (progress) => this.onProgress(progress)
        );
    }
}

export default TransferController;


