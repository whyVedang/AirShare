export const PACKET_HEADER_BYTES = 48;
export const CHUNK_PROTOCOL_VERSION = 3;
export const HASH_ALGORITHM = "SHA-256";
export const HASH_BYTES = 32;

const subtleCrypto = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto API is not available");
  }

  return globalThis.crypto.subtle;
};

export const createTransferId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const toArrayBuffer = (data) => {
  if (data instanceof ArrayBuffer) {
    return data;
  }

  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  );
};

export const bytesToHex = (bytes) => (
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
);

export const hexToBytes = (hex) => {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
};

export const concatBytes = (chunks) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
};

export const sha256Bytes = async (data) => {
  const digest = await subtleCrypto().digest(HASH_ALGORITHM, toArrayBuffer(data));
  return new Uint8Array(digest);
};

export const sha256Hex = async (data) => bytesToHex(await sha256Bytes(data));

export const createHashTreeHex = async (chunkHashesByOffset) => {
  const orderedHashes = Array.from(chunkHashesByOffset.entries())
    .sort(([leftOffset], [rightOffset]) => Number(leftOffset) - Number(rightOffset))
    .map(([, hash]) => hash);

  return sha256Hex(concatBytes(orderedHashes));
};

export const timingSafeHexEqual = (left, right) => {
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return mismatch === 0;
};
