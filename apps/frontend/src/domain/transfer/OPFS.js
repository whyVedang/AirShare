export class OPFSService {
    constructor() {
        this.fileHandle = null;
        this.writableStream = null;
    }

    async initFile(fileName, { transferId, keepExistingData = false } = {}) {
        const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_");
        const safeTransferId = (transferId || crypto.randomUUID()).replace(/[^a-z0-9-]/gi, "_");
        const rootDir = await navigator.storage.getDirectory();
        const transferRoot = await rootDir.getDirectoryHandle("airshare-transfers", { create: true });
        const transferDir = await transferRoot.getDirectoryHandle(safeTransferId, { create: true });
        this.fileHandle = await transferDir.getFileHandle(safeName, { create: true });
        this.writableStream = await this.fileHandle.createWritable({ keepExistingData });
    }

    async writeChunk(chunkData, position) {
        if (!this.writableStream) throw new Error("Stream not initialized");

        if (Number.isFinite(position)) {
            await this.writableStream.write({
                type: "write",
                position,
                data: chunkData
            });
            return;
        }

        await this.writableStream.write(chunkData);
    }

    async finish() {
        if (!this.writableStream) throw new Error("Stream not initialized");

        await this.writableStream.close();
        const file = await this.fileHandle.getFile();
        this.writableStream = null;
        return file;
    }

    async abort() {
        if (!this.writableStream) return;

        try {
            await this.writableStream.abort();
        } catch {
            try {
                await this.writableStream.close();
            } catch {
                // The browser may have already closed the stream.
            }
        } finally {
            this.writableStream = null;
        }
    }
}
