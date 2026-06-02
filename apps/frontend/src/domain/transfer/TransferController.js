import LatencyController from "./latencyControl.js";
import CongestionController from "./congestionControl.js";
import ChunkManager from "./ChunkManager.js"; 

class TransferController {
    constructor(peerEngine, cryptoService, onProgress, onComplete, onLatency) {
        this.peerEngine = peerEngine;
        this.channel = null;

        // Instantiate core logic blocks
        this.latencyController = new LatencyController();
        this.congestionController = new CongestionController();
        this.chunkManager = new ChunkManager();

        // UI Callbacks
        this.onProgress = onProgress || (() => { });
        this.onComplete = onComplete || (() => { });
        this.onLatency = onLatency || (() => { });

        this.messageInterval = null;
        this.handleMessage = this.handleMessage.bind(this);

        this.cryptoService = cryptoService;    
        this.CHUNK_SIZE = 64 * 1024; // 64KB default chunk size
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

    // Standard DataChannel send
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

    // New Encrypted SFU send
    async sendFile(file) {
        const metadata = JSON.stringify({
            type: "metadata",
            name: file.name,
            size: file.size
        });
        this.peerEngine.sendData(metadata);

        let offset = 0;
        let sequence = 0;

        while (offset < file.size) {
            // BACKPRESSURE: Wait if the buffer is too full
            if (this.peerEngine.dataChannel.bufferedAmount > 16 * 1024 * 1024) {
                await new Promise(resolve => {
                    this.peerEngine.dataChannel.onbufferedamountlow = () => {
                        this.peerEngine.dataChannel.onbufferedamountlow = null;
                        resolve();
                    };
                });
            }

            // 2. Read the raw chunk from the local file
            const chunkBlob = file.slice(offset, offset + this.CHUNK_SIZE);
            const chunkBuffer = await chunkBlob.arrayBuffer();

            // 3. Encrypt the chunk (Sequence number is used as the IV)
            const encryptedBuffer = await this.cryptoService.encryptChunk(chunkBuffer, sequence);

            // 4. Pack the payload: [ 4-byte Sequence Header ][ Encrypted Data ]
            const payload = this._packChunk(sequence, encryptedBuffer);

            // 5. Send the binary payload to the SFU
            this.peerEngine.sendData(payload);

            offset += this.CHUNK_SIZE;
            sequence++;
            
            if (this.onProgress) this.onProgress(Math.round((offset / file.size) * 100));
        }
    }

    _packChunk(sequence, encryptedBuffer) {
        const header = new ArrayBuffer(4);
        new DataView(header).setUint32(0, sequence, true);

        const payload = new Uint8Array(4 + encryptedBuffer.byteLength);
        payload.set(new Uint8Array(header), 0);
        payload.set(new Uint8Array(encryptedBuffer), 4);

        return payload.buffer;
    }
}

export default TransferController;