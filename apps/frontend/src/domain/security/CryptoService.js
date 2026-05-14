export class CryptoService {
    constructor() {
        this.cryptoKey = null;
    }

    async deriveKeyFromPassword(password) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", 
            enc.encode(password), 
            { name: "PBKDF2" }, 
            false, 
            ["deriveBits", "deriveKey"]
        );

        // Standard salt - in production, this should be generated and shared in room metadata
        const salt = enc.encode("AirShare-Secure-Salt-2026"); 

        this.cryptoKey = await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    _getIV(chunkIndex) {
        const iv = new Uint8Array(12);
        const dataView = new DataView(iv.buffer);
        dataView.setUint32(0, chunkIndex, true); // Use sequence as IV
        return iv;
    }

    async encryptChunk(rawArrayBuffer, chunkIndex) {
        if (!this.cryptoKey) throw new Error("Encryption key not set");
        
        const iv = this._getIV(chunkIndex);
        const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            this.cryptoKey,
            rawArrayBuffer
        );
        
        return encryptedData;
    }

    async decryptChunk(encryptedArrayBuffer, chunkIndex) {
        if (!this.cryptoKey) throw new Error("Encryption key not set");
        
        const iv = this._getIV(chunkIndex);
        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            this.cryptoKey,
            encryptedArrayBuffer
        );
        
        return decryptedData;
    }
}