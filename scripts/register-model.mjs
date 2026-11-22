#!/usr/bin/env node
/**
 * register-model.mjs — register a model in the Clawd Omnichain Model Registry.
 *
 * Builds a model manifest, hashes it (SHA-256 over canonical JSON), prints the
 * Solana memo anchor payload, and — with --submit --api <url> — posts the
 * manifest to a registry backend. It NEVER asks for a private key or seed
 * phrase: signing (the Solana anchor transaction, the publisher proof) happens
 * in your own wallet tooling. See docs/omnichain-registry.md.
 *
 * Usage:
 *   node scripts/register-model.mjs \
 *     --name my-model --version 1.0.0 \
 *     --chain eip155:8453 \
 *     --repo https://huggingface.co/you/my-model \
 *     --weights-sha256 <64-hex> \
 *     --license apache-2.0 --modality text \
 *     --publisher 0xYourHomeChainAddress \
 *     --solana YourSolanaAddress \
 *     [--submit --api https://traintoearn-backend-y6co.onrender.com]
 */
import { createHash } from "node:crypto";

const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--submit") args.submit = true;
  else if (a.startsWith("--")) args[a.slice(2)] = argv[++i];
}
const required = ["name", "version", "chain", "repo", "weights-sha256", "license", "modality", "publisher", "solana"];
const missing = required.filter((k) => !args[k]);
if (missing.length) {
  console.error("Missing required flags: " + missing.map((k) => "--" + k).join(", "));
  process.exit(2);
}
if (!/^[a-f0-9]{64}$/i.test(args["weights-sha256"])) {
  console.error("--weights-sha256 must be a 64-char hex SHA-256 of the weights file.");
  process.exit(2);
}

const manifest = {
  name: args.name,
  version: args.version,
  chain_id: args.chain, // CAIP-2, e.g. solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp, eip155:8453, bip122:..., near:mainnet
  repo: args.repo,
  weights_sha256: args["weights-sha256"].toLowerCase(),
  license: args.license,
  modality: args.modality,
  publisher: args.publisher, // address on the model's home chain
  solana_address: args.solana, // anchor + rewards identity on Solana
  registered_at: new Date().toISOString(),
};

// Canonical JSON: sorted keys, no whitespace.
const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
const manifestSha256 = createHash("sha256").update(canonical).digest("hex");

// Publisher proof message (sign this with your home-chain wallet, in your own tooling):
const proofMessage = `clawd-registry:v1:${manifestSha256}`;
// Solana memo anchor payload (SPL Memo program; sign + send from your own Solana wallet):
const memo = `clawd-registry:v1:register:${manifestSha256}:${args.chain}:${args.publisher}`;

console.log(JSON.stringify({ manifest, manifest_sha256: manifestSha256, proof_message: proofMessage, solana_memo: memo }, null, 2));

if (args.submit) {
  if (!args.api) { console.error("--submit requires --api <registry backend base URL>"); process.exit(2); }
  const res = await fetch(args.api.replace(/\/$/, "") + "/api/registry/models", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest, manifest_sha256: manifestSha256 }),
  });
  console.log("registry response:", res.status, await res.text());
  console.log("Note: registry API is Phase 1 of docs/omnichain-registry.md — a non-2xx here means the endpoint is not live yet; your manifest + memo payload above are still valid to anchor.");
}
