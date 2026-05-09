export function createBitmap(totalChunks) {
  return new Uint8Array(Math.ceil(totalChunks / 8));
}


export function hasChunk(bitmap, index) {
  return (
    bitmap[index >> 3] &
    (1 << (index % 8))
  ) !== 0;
}

export function markChunk(bitmap, index) {
  bitmap[index >> 3] |=
    (1 << (index % 8));
}

export function isBitmapComplete(bitmap, totalChunks) {
  for (let i = 0; i < totalChunks; i++) {
    if (!hasChunk(bitmap, i)) {
      return false;
    }
  }

  return true;
}

export function getMissingChunks(bitmap, totalChunks) {
  const missing = [];

  for (let i = 0; i < totalChunks; i++) {
    if (!hasChunk(bitmap, i)) {
      missing.push(i);
    }
  }

  return missing;
}