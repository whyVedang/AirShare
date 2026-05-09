
export function createChunkPacket(chunkIndex,arrayBuffer){
  const packet = new Uint8Array(4 + arrayBuffer.byteLength);
  const view = new DataView(packet.buffer);
  view.setUint32(0, chunkIndex);

  packet.set(new Uint8Array(arrayBuffer),4);
  return packet;
}

export function parseChunkPacket(packet) {
  const view = new DataView(packet);
  const chunkIndex =view.getUint32(0);

  const chunkData =packet.slice(4);

  return {chunkIndex,chunkData};
}

