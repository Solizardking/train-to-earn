/**
 * Manifest hashing MUST match scripts/register-model.mjs byte-for-byte.
 * The expected canonical string below is written out literally as ground
 * truth — it is not derived from the implementation under test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalManifestJson, hashManifest, proofMessage, memoPayload } from "../lib/manifest.js";

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

const FIXTURE = {
  name: "fixture-model",
  version: "1.0.0",
  chain_id: "eip155:8453",
  repo: "https://huggingface.co/example/fixture-model",
  weights_sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  license: "apache-2.0",
  modality: "text",
  publisher: "0x1111111111111111111111111111111111111111",
  solana_address: "4Nd1mPzV3QzJ8kYrGJ9xqXwFqV3QzJ8kYrGJ9xqXwFqV",
  registered_at: "2026-11-21T00:00:00.000Z",
};

// Sorted keys, no whitespace — the register-model.mjs canonical form.
const EXPECTED_CANONICAL =
  '{"chain_id":"eip155:8453","license":"apache-2.0","modality":"text","name":"fixture-model",' +
  '"publisher":"0x1111111111111111111111111111111111111111","registered_at":"2026-11-21T00:00:00.000Z",' +
  '"repo":"https://huggingface.co/example/fixture-model","solana_address":"4Nd1mPzV3QzJ8kYrGJ9xqXwFqV3QzJ8kYrGJ9xqXwFqV",' +
  '"version":"1.0.0","weights_sha256":"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"}';

test("canonical JSON matches the literal register-model.mjs form", () => {
  assert.equal(canonicalManifestJson(FIXTURE), EXPECTED_CANONICAL);
});

test("manifest hash is sha256 of the canonical JSON", () => {
  const expected = createHash("sha256").update(EXPECTED_CANONICAL).digest("hex");
  assert.equal(hashManifest(FIXTURE), expected);
  assert.match(hashManifest(FIXTURE), /^[a-f0-9]{64}$/);
});

test("hash is independent of key insertion order", () => {
  const shuffled = {};
  for (const k of Object.keys(FIXTURE).reverse()) shuffled[k] = FIXTURE[k];
  assert.equal(hashManifest(shuffled), hashManifest(FIXTURE));
});

test("proof message and memo payload formats", () => {
  const sha = hashManifest(FIXTURE);
  assert.equal(proofMessage(sha), `clawd-registry:v1:${sha}`);
  assert.equal(
    memoPayload(sha, FIXTURE),
    `clawd-registry:v1:register:${sha}:eip155:8453:0x1111111111111111111111111111111111111111`,
  );
});

test("memo payload works for the nested spec manifest shape", () => {
  const sha = "a".repeat(64);
  const nested = { home_chain: { chain_id: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", publisher_address: "PUB" } };
  assert.equal(memoPayload(sha, nested), `clawd-registry:v1:register:${sha}:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:PUB`);
});

test("hash agrees with the actual scripts/register-model.mjs output", async () => {
  const script = path.join(here, "..", "..", "scripts", "register-model.mjs");
  const { stdout } = await run(process.execPath, [
    script,
    "--name", "fixture-model",
    "--version", "1.0.0",
    "--chain", "eip155:8453",
    "--repo", "https://huggingface.co/example/fixture-model",
    "--weights-sha256", FIXTURE.weights_sha256,
    "--license", "apache-2.0",
    "--modality", "text",
    "--publisher", FIXTURE.publisher,
    "--solana", FIXTURE.solana_address,
  ]);
  const out = JSON.parse(stdout);
  assert.equal(hashManifest(out.manifest), out.manifest_sha256);
  assert.equal(proofMessage(out.manifest_sha256), out.proof_message);
  assert.equal(memoPayload(out.manifest_sha256, out.manifest), out.solana_memo);
});
