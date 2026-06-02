import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  bytesToHex,
  concatBytes,
  createHashTreeHex,
  hexToBytes,
  sha256Hex,
  timingSafeHexEqual
} from "./transferProtocol.js";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto
  });
}

test("sha256Hex creates stable SHA-256 digests", async () => {
  const input = new TextEncoder().encode("abc");
  const digest = await sha256Hex(input);

  assert.equal(
    digest,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  );
});

test("hash tree changes when any chunk hash changes", async () => {
  const left = hexToBytes(await sha256Hex(new TextEncoder().encode("left")));
  const right = hexToBytes(await sha256Hex(new TextEncoder().encode("right")));
  const alteredRight = hexToBytes(await sha256Hex(new TextEncoder().encode("right!")));

  const original = await createHashTreeHex(new Map([[0, left], [1, right]]));
  const altered = await createHashTreeHex(new Map([[0, left], [1, alteredRight]]));

  assert.notEqual(original, altered);
});

test("byte helpers round-trip binary values", () => {
  const bytes = concatBytes([new Uint8Array([0, 15]), new Uint8Array([16, 255])]);
  const hex = bytesToHex(bytes);

  assert.equal(hex, "000f10ff");
  assert.deepEqual(Array.from(hexToBytes(hex)), [0, 15, 16, 255]);
  assert.equal(timingSafeHexEqual(hex, "000f10ff"), true);
  assert.equal(timingSafeHexEqual(hex, "000f10fe"), false);
});
