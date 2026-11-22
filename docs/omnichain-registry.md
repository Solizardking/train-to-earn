# Omnichain AI Model Registry — Design Spec

**Status:** design v0.1, 2026-11-21. Nothing in this spec is live yet
except the components explicitly marked *exists today*.

**One-liner:** a public registry where AI models from **any** blockchain
ecosystem register a signed manifest, get a **hash commitment anchored
natively on Solana**, and earn verification tiers through the same
Jev rating engine and ledger that power TrainToEarn
(earn.onchainai.fund).

## Principles

1. **Public, not gated.** Anyone can register a model and anyone can
   read the registry. There is **no $CLAWD-holder gate** on
   registration, reading, rating, or anchoring. $CLAWD appears only as
   the rewards asset (TrainToEarn payouts) — never as an access key.
2. **Chain of origin is metadata, not a barrier.** A model whose
   publisher lives on Ethereum, Base, NEAR, Bitcoin, or Solana
   registers identically. Solana is the *anchor* chain (commitments,
   timestamps, rewards), not the *home* chain requirement.
3. **Hash first, claims second.** The registry stores manifests and
   hashes. Verification tiers say exactly how much has been checked —
   an entry is never presented as more verified than it is.
4. **Brain/Hands separation.** Publishers prove control of a home-chain
   wallet by signing a challenge with it. No private keys, seed
   phrases, or signing material ever touch the registry, the backend,
   or an agent.

## What exists today (verified 2026-11-21)

- TrainToEarn backend at
  `https://traintoearn-backend-y6co.onrender.com`, including:
  - `POST /api/jev/rate` — Jev realtime rating of submitted data
    (score 0–100, five checks, tier + $CLAWD reward).
  - `GET /api/models/list` — the existing TrainToEarn model/dataset
    registry endpoint.
  - `GET /api/submissions/stats|recent|top`, `GET /api/rewards/balance/<WALLET>`,
    `GET /api/rewards/treasury` — public ledger reads.
- $CLAWD mint (Solana):
  `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`; treasury wallet
  `6rEiHJ4JUTWcC4wCUosTbaoBmpjHvUGLAQcogUwADB4Z`.

**New in this spec:** the omnichain manifest format, the Solana
anchoring scheme, the verification tiers, and the registry API surface
below. None of those exist yet.

## The manifest

One JSON document per model version. The manifest is the unit of
registration; its SHA-256 is what gets anchored.

```json
{
  "manifest_version": 1,
  "name": "example-model-7b",
  "version": "1.0.0",
  "description": "What the model does, in the publisher's words.",
  "home_chain": {
    "ecosystem": "evm",
    "chain_id": "eip155:8453",
    "publisher_address": "0xPUBLISHER_ON_HOME_CHAIN"
  },
  "solana_address": "PUBLISHER_SOLANA_ADDRESS_FOR_ANCHOR_AND_REWARDS",
  "model": {
    "repo_url": "https://huggingface.co/publisher/example-model-7b",
    "weights_sha256": "sha256-of-the-canonical-weights-file-or-tree",
    "license": "Apache-2.0",
    "modality": "text",
    "base_model": "optional-upstream-model-id",
    "parameter_count": "7B"
  },
  "publisher_proof": {
    "method": "eip191 | ed25519 | bip322",
    "message": "clawd-registry:v1:<manifest_sha256>",
    "signature": "signature-by-home-chain-publisher-key"
  },
  "created_at": "2026-11-21T00:00:00Z"
}
```

Field rules:

- `home_chain.chain_id` uses CAIP-2 (`eip155:8453`, `solana:mainnet`,
  `bip122:000000000019d6689c085ae165831e93`, `near:mainnet`, …).
  `ecosystem` is a display hint; `chain_id` is canonical.
- `weights_sha256` is over the canonical weights artifact (single file,
  or a tree hash over a sorted file list for sharded models — the
  hashing method is recorded in the entry when it is not a single
  file).
- `publisher_proof` binds the manifest to the home-chain publisher:
  the publisher signs the literal message
  `clawd-registry:v1:<manifest_sha256>` with their home-chain key
  (EIP-191 for EVM, Ed25519 for Solana/NEAR, BIP-322 for Bitcoin).
  Verification is signature recovery/checking only — no custody.
- `solana_address` is required even for non-Solana publishers: it is
  the anchor co-signer identity and the only address registry rewards
  can accrue to. It is an address, never a key.
- One entry per (`name`, `version`). Versions are immutable once
  anchored; a fix is a new version.

## Solana anchor

### Phase 1 form — memo transaction (no program required)

The publisher's Solana address sends a Solana transaction to itself
(or to the treasury) carrying a memo instruction
(`spl-memo`, program `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`):

```
clawd-registry:v1:register:<manifest_sha256>:<home_chain_id>:<publisher_address>
```

Example payload (illustrative values):

```
clawd-registry:v1:register:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08:eip155:8453:0xPUBLISHER
```

The transaction signature + slot are the anchor record: anyone can
fetch the manifest, recompute its SHA-256, and confirm the memo,
timestamp, and anchoring address on Solana independently of this
registry. Memo length limits mean the payload may split the publisher
address into a second memo or reference it by its first 12 + last 12
characters with the full value in the registry record — the manifest
hash is the load-bearing field and is always complete.

### Phase 2 form — program + PDA (specified, not built)

A dedicated Anchor program stores one `ModelEntry` account per model
version at PDA seeds `["model", manifest_sha256]`:

```
struct ModelEntry {
  manifest_sha256: [u8; 32],
  solana_publisher: Pubkey,
  home_chain_id: string (≤ 32 bytes),
  tier: u8,
  anchored_slot: u64,
  superseded_by: Option<[u8; 32]>,
}
```

Instructions: `register` (creates the PDA, stores the hash),
`supersede` (points an entry at a newer manifest hash, signed by the
original Solana publisher), `set_tier` (authority-gated to the
registry verifier key, so tier changes are themselves auditable
on-chain). The memo path remains valid for Phase 1 entries; the
program indexes the same hashes.

## Verification tiers

| Tier | Name | Meaning (exactly this, no more) |
| --- | --- | --- |
| 0 | **Unverified** | Manifest submitted and schema-valid. Nothing checked. |
| 1 | **Hash-verified** | `publisher_proof` signature verifies against `publisher_address` on the home chain, **and** a Solana anchor (memo tx or PDA) exists whose hash matches the manifest. |
| 2 | **Rated** | The model's card/dataset/sample outputs were Jev-rated through the existing `POST /api/jev/rate` pipeline; the entry displays the real score, tier, and rating record id. A fallback/heuristic-only rating is displayed as such, never as a Jev verdict. |
| 3 | **Reproduced** | An independent party re-downloaded the weights from `repo_url`, recomputed `weights_sha256` to a match, and ran the model (load + a recorded smoke inference). Reproduction records are signed by the reproducer's wallet and linked from the entry. |

Tiers only move up on evidence recorded in the entry's audit log
(who, when, which transaction/rating/reproduction record). Any entry
can be **flagged** (see Governance), which displays alongside — never
instead of — its tier.

## API sketch (builds on the existing backend)

New endpoints, same host and conventions as TrainToEarn today:

```
POST /api/registry/models            submit a manifest → validates schema + proof,
                                     creates a Tier-0 entry, returns entry id + manifest_sha256
GET  /api/registry/models            list entries (filters: chain_id, tier, modality, license)
GET  /api/registry/models/<id>       one entry: manifest, tier, anchor record, audit log
POST /api/registry/models/<id>/anchor   attach a Solana anchor (memo tx signature)
                                     → backend verifies the tx + memo on-chain → Tier 1
POST /api/registry/models/<id>/rate     run/attach a Jev rating for the model's
                                     submitted sample data (reuses /api/jev/rate) → Tier 2
POST /api/registry/models/<id>/reproduce  attach a signed reproduction record → Tier 3
GET  /api/registry/stats             counts by chain, tier, modality (public)
```

Compatibility: `GET /api/models/list` stays as-is for TrainToEarn;
registry entries surface there too once Phase 1 ships, marked with
their registry id and tier. All reads are public and unauthenticated,
matching the existing endpoints. Writes are rate-limited per publisher
address and per IP.

## Governance and abuse

- **Impersonation:** the `publisher_proof` signature is the only claim
  to a publisher identity. Entries whose proof names a well-known
  publisher address but fails verification stay Tier 0 and display
  "proof unverified" — they are never silently promoted or silently
  deleted.
- **Name collisions:** names are first-come, namespaced by publisher
  (canonical id = `publisher_address + name`). Lookalike names are
  allowed but never merged or reattributed; search ranks verified
  tiers above Tier 0.
- **Malicious weights / license fraud:** anyone can file a signed
  **flag** (spam, malware, license mismatch, hash mismatch) with
  evidence links. Flags are public on the entry. A maintainer review
  can mark an entry `flagged-confirmed`, which delists it from
  default list views — the entry, its anchor, and the flag record
  remain readable forever. Anchors on Solana are immutable by design;
  delisting is a display/governance act, not a history rewrite.
- **Spam control:** submission rate limits + a small refundable SOL
  anchor cost borne naturally by the memo transaction fee. No token
  gate, no allowlist.
- **Rewards integrity:** any future registry rewards accrue in $CLAWD
  only to the entry's `solana_address`, through the existing
  TrainToEarn ledger — the same rules as submissions (ledger numbers
  only, payouts human-initiated, minimum claim 100 CLAWD).

## Phased rollout

- **Phase 0 — spec + data (repo only).** This spec and a
  `registry/manifests/` folder of example manifests plus a generated
  `registry/registry.json` index live in the public
  `Solizardking/traintoearn` GitHub repo. Submissions arrive as pull
  requests; CI validates schema + proof signature + hash format.
  No backend changes, no anchoring yet — Tier 0/1-by-proof only,
  labelled honestly as pre-anchor.
- **Phase 1 — backend live.** The `/api/registry/*` endpoints ship on
  the TrainToEarn backend; entries go live at earn.onchainai.fund;
  memo anchoring is verified by the backend; Jev rating attaches via
  the existing pipeline (Tiers 0–2, reproduction records accepted for
  Tier 3).
- **Phase 2 — on-chain program.** The Anchor program + PDA path ships;
  new entries anchor via `register`; Phase 1 memo anchors are indexed
  into the program's read layer without migration (same hashes).
  Tier changes (`set_tier`) move on-chain for full auditability.

## Non-goals

- Not a model host: weights stay at the publisher's `repo_url`.
- Not a marketplace: no sales, no payments, no gated downloads.
- Not a safety certification: tiers describe verification performed,
  never that a model is safe, accurate, or fit for a purpose.
