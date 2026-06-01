export class OPFSService {
    constructor() {
        this.fileHandle = null;
        this.writableStream = null;
    }

    async initFile(fileName) {
        const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_");
        const rootDir = await navigator.storage.getDirectory();
        this.fileHandle = await rootDir.getFileHandle(safeName, { create: true });
        this.writableStream = await this.fileHandle.createWritable();
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
        await this.writableStream.close();
        const file = await this.fileHandle.getFile();
        this.writableStream = null;
        return file;
    }
}
