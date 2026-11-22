import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadKeypairFile, signMessage, verifySignature, base58Encode, base58Decode, isValidPublicKey } from "../lib/signing.js";

// Deterministic throwaway test keypair (NOT a real wallet). The 64-byte
// secret is seed || derived public key, exactly as solana-keygen writes it —
// @solana/web3.js validates that pairing, so a synthetic tail fails.
const SEED = Array.from({ length: 32 }, (_, i) => (i * 7 + 3) % 256);
const SECRET64 = [3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80, 87, 94, 101, 108, 115, 122, 129, 136, 143, 150, 157, 164, 171, 178, 185, 192, 199, 206, 213, 220, 117, 92, 76, 185, 37, 108, 167, 205, 196, 172, 253, 198, 207, 238, 218, 132, 144, 23, 229, 185, 249, 81, 78, 153, 25, 27, 214, 126, 11, 13, 66, 118];

function writeKeypair(bytes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "traintoearn-kp-"));
  const file = path.join(dir, "id.json");
  fs.writeFileSync(file, JSON.stringify(bytes), { mode: 0o600 });
  return file;
}

test("base58 round-trip", () => {
  const bytes = Buffer.from("hello solana", "utf8");
  assert.deepEqual([...base58Decode(base58Encode(bytes))], [...bytes]);
  assert.equal(base58Encode(Buffer.from([0, 0, 1])), "112");
});

test("isValidPublicKey", async () => {
  const kp = await loadKeypairFile(writeKeypair(SECRET64));
  assert.equal(isValidPublicKey(kp.publicKey), true);
  assert.equal(isValidPublicKey("not-a-key!!!"), false);
  assert.equal(isValidPublicKey(""), false);
});

test("loadKeypairFile derives a 32-byte base58 public key", async () => {
  const kp = await loadKeypairFile(writeKeypair(SECRET64));
  assert.equal(base58Decode(kp.publicKey).length, 32);
  assert.equal(kp.secretKey.length, 64);
});

test("loadKeypairFile rejects malformed files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "traintoearn-kp-"));
  const bad = path.join(dir, "bad.json");
  fs.writeFileSync(bad, JSON.stringify([1, 2, 3]));
  await assert.rejects(() => loadKeypairFile(bad), /64 secret-key bytes/);
  await assert.rejects(() => loadKeypairFile(path.join(dir, "missing.json")), /cannot read keypair file/);
});

test("sign/verify round-trip (signature never equals the key)", async () => {
  const kp = await loadKeypairFile(writeKeypair(SECRET64));
  const message = "TrainToEarn Login\nWallet: X\nNonce: abc\nIssued: 2026-11-21T00:00:00.000Z";
  const sig = await signMessage(message, kp.secretKey);
  assert.equal(sig.length, 64);
  const pub = base58Decode(kp.publicKey);
  assert.equal(verifySignature(Buffer.from(message, "utf8"), sig, pub), true);
  assert.equal(verifySignature(Buffer.from("tampered", "utf8"), sig, pub), false);
  // Ed25519 is deterministic: signing again yields the identical signature.
  const sig2 = await signMessage(message, kp.secretKey);
  assert.deepEqual([...sig2], [...sig]);
});
