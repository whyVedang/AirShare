import { createSHA256 } from "hash-wasm";

export async function calculateFileHash(fileOrBlob) {
  const sha = await createSHA256();

  const chunkSize = 4 * 1024 * 1024;

  let offset = 0;

  while (offset < fileOrBlob.size) {
    const chunk = await fileOrBlob
      .slice(offset, offset + chunkSize)
      .arrayBuffer();

    sha.update(new Uint8Array(chunk));

    offset += chunkSize;
  }

  return sha.digest();
}