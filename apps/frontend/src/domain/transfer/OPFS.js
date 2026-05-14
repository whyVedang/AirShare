export class OPFSService {
    constructor() {
        this.fileHandle = null;
        this.writableStream = null;
    }

    async initFile(fileName) {
        // Access the private sandboxed file system
        const rootDir = await navigator.storage.getDirectory();
        
        // Create a new file handle
        this.fileHandle = await rootDir.getFileHandle(fileName, { create: true });
        
        // Open a high-performance writable stream
        this.writableStream = await this.fileHandle.createWritable();
        console.log(`[OPFS] Ready to stream: ${fileName}`);
    }

    async writeChunk(chunkData) {
        if (!this.writableStream) throw new Error("Stream not initialized");
        await this.writableStream.write(chunkData);
    }

    async finishAndDownload() {
        await this.writableStream.close();
        
        // Get the final file from OPFS to trigger standard browser download
        const file = await this.fileHandle.getFile();
        const url = URL.createObjectURL(file);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}