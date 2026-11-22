/**
 * signing.js — Solana keypair loading + Ed25519 message signing.
 *
 * Brain/Hands rule: the secret key is read from the user's own keypair
 * file on this machine, used to produce a signature, and never printed,
 * logged, stored, or sent anywhere. Only signatures leave the machine.
 *
 * Implementation: @solana/web3.js (Keypair.fromSecretKey) is used when
 * installed; signing uses tweetnacl (the nacl bundled with web3.js) when
 * resolvable, and otherwise falls back to Node's built-in Ed25519
 * (node:crypto over a PKCS8-wrapped seed). Ed25519 signatures are
 * deterministic, so both paths produce byte-identical signatures.
 */
import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import fs from "node:fs";

// ---- base58 (Bitcoin/Solana alphabet) -------------------------------------

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = new Map([...B58_ALPHABET].map((c, i) => [c, BigInt(i)]));

export function base58Encode(bytes) {
  const buf = Buffer.from(bytes);
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;
  let n = 0n;
  for (const b of buf) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = B58_ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  return "1".repeat(zeros) + out;
}

export function base58Decode(str) {
  let n = 0n;
  for (const c of str) {
    const v = B58_MAP.get(c);
    if (v === undefined) throw new TypeError(`invalid base58 character: ${c}`);
    n = n * 58n + v;
  }
  let zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;
  const hex = n === 0n ? "" : n.toString(16);
  const body = hex ? Buffer.from(hex.padStart(Math.ceil(hex.length / 2) * 2, "0"), "hex") : Buffer.alloc(0);
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

/** True when the string looks like a Solana public key (32 bytes, base58). */
export function isValidPublicKey(str) {
  if (typeof str !== "string" || str.length < 32 || str.length > 44) return false;
  try {
    return base58Decode(str).length === 32;
  } catch {
    return false;
  }
}

// ---- Ed25519 via node:crypto (fallback path) -------------------------------

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function privateKeyFromSeed(seed32) {
  return createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed32)]),
    format: "der",
    type: "pkcs8",
  });
}

function rawPublicKeyFromSeed(seed32) {
  const pub = createPublicKey(privateKeyFromSeed(seed32));
  const der = pub.export({ format: "der", type: "spki" });
  return Buffer.from(der).subarray(der.length - 32);
}

function signWithNodeCrypto(messageBytes, seed32) {
  return cryptoSign(null, Buffer.from(messageBytes), privateKeyFromSeed(seed32));
}

/** Verify an Ed25519 signature against a raw 32-byte public key. */
export function verifySignature(messageBytes, signatureBytes, publicKeyBytes) {
  const key = createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKeyBytes)]),
    format: "der",
    type: "spki",
  });
  return cryptoVerify(null, Buffer.from(messageBytes), key, Buffer.from(signatureBytes));
}

// ---- Keypair loading --------------------------------------------------------

/**
 * Read a Solana CLI keypair file (JSON array of 64 secret-key bytes; a
 * 32-byte seed array is also accepted). Returns
 * { publicKey: "<base58>", secretKey: Uint8Array(64) }.
 * The secret is returned only so this process can sign — callers must
 * never print or persist it.
 */
export async function loadKeypairFile(keypairPath) {
  let raw;
  try {
    raw = fs.readFileSync(keypairPath, "utf8");
  } catch (err) {
    throw new Error(`cannot read keypair file ${keypairPath}: ${err.message}`);
  }
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch {
    throw new Error(`keypair file ${keypairPath} is not a JSON byte array`);
  }
  if (!Array.isArray(arr) || ![32, 64].includes(arr.length) || !arr.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) {
    throw new Error(`keypair file ${keypairPath} must be a JSON array of 64 secret-key bytes (or a 32-byte seed)`);
  }

  // Preferred path: @solana/web3.js validates the keypair properly.
  try {
    const web3 = await import("@solana/web3.js");
    if (arr.length === 64) {
      const kp = web3.Keypair.fromSecretKey(Uint8Array.from(arr));
      return { publicKey: kp.publicKey.toBase58(), secretKey: Uint8Array.from(arr) };
    }
    const kp = web3.Keypair.fromSeed(Uint8Array.from(arr));
    return { publicKey: kp.publicKey.toBase58(), secretKey: kp.secretKey };
  } catch (err) {
    if (err && err.code !== "ERR_MODULE_NOT_FOUND" && !/Cannot find (package|module)/.test(err.message || "")) {
      throw err;
    }
    // Fallback: derive the public key from the seed with node:crypto.
    const seed = arr.length === 64 ? arr.slice(0, 32) : arr;
    const pub = rawPublicKeyFromSeed(seed);
    const secretKey = arr.length === 64 ? Uint8Array.from(arr) : Uint8Array.from([...seed, ...pub]);
    return { publicKey: base58Encode(pub), secretKey };
  }
}

/**
 * Sign a UTF-8 message with a loaded keypair's secret. Returns the
 * 64-byte signature as a Buffer. Uses tweetnacl (web3.js's bundled nacl)
 * when resolvable; otherwise node:crypto. Identical output either way.
 */
export async function signMessage(message, secretKey) {
  const msgBytes = Buffer.from(String(message), "utf8");
  try {
    const nacl = (await import("tweetnacl")).default || (await import("tweetnacl"));
    if (nacl?.sign?.detached) {
      return Buffer.from(nacl.sign.detached(msgBytes, secretKey));
    }
  } catch {
    /* tweetnacl not resolvable — fall through to node:crypto */
  }
  return signWithNodeCrypto(msgBytes, Buffer.from(secretKey).subarray(0, 32));
}
