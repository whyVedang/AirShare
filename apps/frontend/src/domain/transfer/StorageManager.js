import localforage from "localforage"
import { createBitmap } from "./utils/BitMap";

class StorageManager {
    constructor() {
        this.metaStore = localforage.createInstance({ name: "transfer-meta" });
    }
    async saveMetadata(fileId, metadata) {
        await this.metaStore.setItem(`meta:${fileId}`, metadata);
    }
    async getMetadata(fileId) {
        return await this.metaStore.getItem(`meta:${fileId}`);
    }
    async deleteMetadata(fileId) {
        await this.metaStore.removeItem(`meta:${fileId}`);
    }
    async getBitmap(fileId, totalChunks) {
        const bitmap = await this.metaStore.getItem(`bitmap:${fileId}`);
        if (!bitmap) {
            bitmap = createBitmap(totalChunks);

            await this.saveBitmap(fileId, bitmap);
        }

        return bitmap;
    }
    async saveBitmap(fileId, bitmap) {
        await this.metaStore.setItem(`bitmap:${fileId}`, bitmap);
    }
    async getWriter(fileId) {
        if (!this.activeWriters.has(fileId)) {
            const handle = await this.getFileHandle(fileId);

            const writer = await handle.createWritable({
                keepExistingData: true
            });
            this.activeWriters.set(fileId, writer);
        }
        return this.activeWriters.get(fileId);
    }

    async writeChunk(fileId, chunkIndex, chunkSize, arrayBuffer) {
        const fileHandle = await this.getWriter(fileId);
        await writer.seek(chunkIndex * chunkSize);
        await writer.write(arrayBuffer);
    }
    async readFile(fileId) {
        const fileHandle = await this.getFileHandle(fileId);
        return await fileHandle.getFile();
    }
    async deleteFile(fileId) {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(fileId);
    }
    async getFileHandle(fileId) {
        const root = await navigator.storage.getDirectory();
        await root.removeEntry(fileId);
        await this.deleteMetadata(fileId);
        await this.metaStore.removeItem(`bitmap:${fileId}`);
    }
}
export default StorageManager;