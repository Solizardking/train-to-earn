/**
 * manifest.js — model-manifest hashing for the Clawd Omnichain Model Registry.
 *
 * This MUST stay byte-for-byte compatible with scripts/register-model.mjs:
 * the canonical form is `JSON.stringify(manifest, Object.keys(manifest).sort())`
 * (sorted top-level keys, no whitespace), hashed with SHA-256. The publisher
 * proof message is `clawd-registry:v1:<manifest_sha256>` and the Solana memo
 * anchor payload is `clawd-registry:v1:register:<sha256>:<chain_id>:<publisher>`.
 * See docs/omnichain-registry.md.
 */
import { createHash } from "node:crypto";

/**
 * Canonical JSON for a manifest, exactly as register-model.mjs computes it.
 * Note: passing the sorted key list as the JSON.stringify replacer array is
 * part of the format — do not "improve" this into a deep sort, or hashes
 * will diverge from the reference script.
 */
export function canonicalManifestJson(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new TypeError("manifest must be a JSON object");
  }
  return JSON.stringify(manifest, Object.keys(manifest).sort());
}

/** SHA-256 (hex) of the manifest's canonical JSON. */
export function hashManifest(manifest) {
  return createHash("sha256").update(canonicalManifestJson(manifest)).digest("hex");
}

/** The message a publisher signs to prove control of the publisher key. */
export function proofMessage(manifestSha256) {
  return `clawd-registry:v1:${manifestSha256}`;
}

/**
 * Extract { chainId, publisher } from either manifest shape in the wild:
 * the flat register-model.mjs shape ({chain_id, publisher}) or the nested
 * spec shape ({home_chain: {chain_id, publisher_address}}).
 */
export function manifestChainAndPublisher(manifest) {
  const chainId =
    manifest.chain_id ||
    manifest.home_chain?.chain_id ||
    null;
  const publisher =
    manifest.publisher ||
    manifest.home_chain?.publisher_address ||
    null;
  return { chainId, publisher };
}

/** The Solana memo anchor payload for a manifest hash. */
export function memoPayload(manifestSha256, manifest) {
  const { chainId, publisher } = manifestChainAndPublisher(manifest || {});
  if (!chainId || !publisher) {
    throw new TypeError(
      "manifest is missing chain_id/publisher (flat shape) or home_chain.chain_id/home_chain.publisher_address (spec shape) — cannot build the memo payload",
    );
  }
  return `clawd-registry:v1:register:${manifestSha256}:${chainId}:${publisher}`;
}
