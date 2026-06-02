import LatencyController from "./latencyControl.js";
import CongestionController from "./congestionControl.js";
import ChunkManager from "./ChunkManager.js";
import { createTransferId } from "./transferProtocol.js";

class TransferController {
    constructor(onProgress, onComplete, onLatency, onError) {
        this.channel = null;

        this.latencyController = new LatencyController();
        this.congestionController = new CongestionController();
        this.chunkManager = new ChunkManager();

        this.onProgress = onProgress || (() => { });
        this.onComplete = onComplete || (() => { });
        this.onLatency = onLatency || (() => { });
        this.onError = onError || (() => { });

        this.messageInterval = null;
        this.activeAbortController = null;
        this.remoteProgress = new Map();
        this.localIntegrity = new Map();
        this.lastAckSentAt = 0;
        this.lastAckBytes = 0;
        this.messageQueue = Promise.resolve();
        this.enqueueMessage = this.enqueueMessage.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
    }

    attachChannel(channel) {
        this.detachChannel();
        this.channel = channel;
        this.channel.addEventListener("message", this.enqueueMessage);
    }

    detachChannel() {
        if (this.channel) {
            this.channel.removeEventListener("message", this.enqueueMessage);
            this.channel = null;
        }
        this.stopLatencyChecks();
    }

    enqueueMessage(event) {
        this.messageQueue = this.messageQueue
            .then(() => this.handleMessage(event))
            .catch((error) => this.onError(error));
    }

    async handleMessage(event) {
        try {
            if (typeof event.data === "string") {
                const data = JSON.parse(event.data);

                if (data.type === "ping") {
                    this.sendControl({ type: "pong", id: data.id });
                    return;
                }

                if (data.type === "pong") {
                    this.latencyController.recordPong(data.id);
                    const avgRtt = this.latencyController.getAverageRTT();
                    if (avgRtt > 0) {
                        this.onLatency(Math.round(avgRtt));
                    }
                    return;
                }

                if (data.type === "file-progress") {
                    if (data.transferId && Number.isFinite(data.receivedBytes)) {
                        this.remoteProgress.set(data.transferId, data.receivedBytes);
                    }
                    return;
                }
            }

            const result = await this.chunkManager.handleIncomingData(event.data);

            if (!result) return;

            switch (result.type) {
                case "meta":
                    this.lastAckSentAt = 0;
                    this.lastAckBytes = 0;
                    break;

                case "progress":
                    this.onProgress(result.value, result);
                    this.maybeSendProgressAck(result);
                    break;

                case "complete":
                    this.sendProgressAck(result.metadata?.transferId, result.metadata?.size);
                    this.onComplete(result.value, result.filename, result.metadata);
                    break;

                case "cancelled":
                    this.onError(new DOMException("Remote transfer cancelled", "AbortError"));
                    break;
            }

        } catch (error) {
            this.onError(error);
        }
    }

    maybeSendProgressAck(result) {
        const now = Date.now();
        const bytesSinceLastAck = result.receivedBytes - this.lastAckBytes;

        if (bytesSinceLastAck < 1024 * 1024 && now - this.lastAckSentAt < 1000) {
            return;
        }

        this.sendProgressAck(result.transferId, result.receivedBytes);
        this.lastAckBytes = result.receivedBytes;
        this.lastAckSentAt = now;
    }

    sendProgressAck(transferId, receivedBytes) {
        if (!transferId || !Number.isFinite(receivedBytes)) {
            return;
        }

        this.sendControl({
            type: "file-progress",
            transferId,
            receivedBytes
        });
    }

    sendControl(message) {
        if (this.channel && this.channel.readyState === "open") {
            this.channel.send(JSON.stringify(message));
        }
    }

    startLatencyChecks() {
        this.stopLatencyChecks();
        this.messageInterval = setInterval(() => {
            const ping = this.latencyController.recordPing();
            this.sendControl(ping);
        }, 3000);
    }

    stopLatencyChecks() {
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
            this.messageInterval = null;
        }
    }

    getResumeOffset(transferId) {
        return this.remoteProgress.get(transferId) || 0;
    }

    cancel(reason = "cancelled") {
        if (this.activeAbortController && !this.activeAbortController.signal.aborted) {
            this.activeAbortController.abort(reason);
        }

        this.sendControl({ type: "transfer-cancel", reason });
    }

    async send(file, options = {}) {
        if (!this.channel || this.channel.readyState !== "open") {
            throw new Error("Data channel is not open");
        }

        if (!this.messageInterval) {
            this.startLatencyChecks();
        }

        const transferId = options.transferId || createTransferId();
        const controller = new AbortController();
        this.activeAbortController = controller;

        if (options.signal) {
            if (options.signal.aborted) {
                controller.abort(options.signal.reason);
            } else {
                options.signal.addEventListener("abort", () => {
                    controller.abort(options.signal.reason);
                }, { once: true });
            }
        }

        const chunkHashesByOffset = this.localIntegrity.get(transferId) || new Map();
        this.localIntegrity.set(transferId, chunkHashesByOffset);

        try {
            const result = await this.chunkManager.sendFile(
                file,
                this.channel,
                this.congestionController,
                this.latencyController,
                options.onProgress || ((progress) => this.onProgress(progress)),
                {
                    transferId,
                    startOffset: options.startOffset || 0,
                    signal: controller.signal,
                    chunkHashesByOffset
                }
            );

            this.localIntegrity.delete(transferId);
            return result;
        } catch (error) {
            if (controller.signal.aborted) {
                this.sendControl({ type: "transfer-cancel", reason: "cancelled" });
            }
            throw error;
        } finally {
            if (this.activeAbortController === controller) {
                this.activeAbortController = null;
            }
        }
    }

}

export default TransferController;
