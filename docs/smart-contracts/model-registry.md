# Model Registry Program

The `programs/model-registry` Anchor program is the on-chain foundation for
registering AI models the same way Metaplex registers agents: an MPL Core asset
anchors identity, a PDA makes the model discoverable, and a permanent URI points
to the full registration document.

## Program

- Program name: `model_registry`
- Program id: `A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92`
- Workspace: `Anchor.toml`, `Cargo.toml`, `programs/model-registry`

## Accounts

### `ModelIdentityV1`

Seed:

```text
["model_identity", asset]
```

Fields:

- `asset`: MPL Core model asset public key.
- `collection`: optional MPL Core collection.
- `authority`: wallet authorized to update or deactivate the model identity.
- `model_registration_uri`: permanent JSON registration document.
- `artifact_hash`: digest of the model artifact.
- `model_type`: registry model class, such as `CODE_GENERATION`.
- `royalty_bps`: creator royalty basis points.
- `lifecycle_checks`: transfer, update, and execute flags mirroring agent identity semantics.
- `active`: soft-deactivation state.
- `created_at` and `updated_at`.

### `ModelEvaluationV1`

Seed:

```text
["model_evaluation", asset, evaluation_name]
```

Fields:

- `model_identity`: parent model identity PDA.
- `asset`: model asset public key.
- `attestor`: evaluator or provider authority.
- `evaluation_name`: benchmark or safety review identifier.
- `score_bps`: score from 0 to 10000.
- `attestation_uri`: permanent evaluation document.

### `AiModelV2`

Seed:

```text
["clawd_model_v2", authority, model_cid]
```

Fields:

- `creator`: model publisher authority.
- `name`, `description`, and `hf_repo`: public registry metadata and Hugging Face lineage.
- `model_cid`: a 32-byte-or-shorter model seed id used for the PDA.
- `metadata_uri`: Pinata/IPFS/Arweave metadata pointer that can contain full
  artifact CIDs and model-card references.
- `capabilities`: bounded capability tags for marketplace discovery.
- `clawd_price`, `reputation_score`, `total_reviews`, `total_downloads`, and `clawd_revenue`.
- `is_active`, `created_at`, and `updated_at`.

### `ModelFeedback`

Seed:

```text
["clawd_feedback", model, reviewer]
```

Fields:

- `model`: parent `AiModelV2` PDA.
- `reviewer`: feedback signer.
- `score`: 0 to 100 score.
- `tag1`, `tag2`, and `proof_uri`: compact review tags and optional permanent proof.

## Instructions

- `register_model_identity_v1`: creates the model identity PDA.
- `update_model_identity_v1`: updates URI and artifact hash under authority.
- `deactivate_model_identity_v1`: soft-deactivates a model identity.
- `record_model_evaluation_v1`: records Google, Hugging Face, community, or validator attestations.
- `register_model_v2`: creates the extended CLAWD/Hugging Face/Pinata model account.
- `update_model_v2`: updates mutable v2 model fields under creator authority.
- `deactivate_model_v2`: soft-deactivates a v2 model.
- `update_model_stats`: increments verified download and revenue counters.
- `give_feedback`: stores per-reviewer feedback and updates rolling reputation.

## Client Contract

`src/utils/modelRegistry.js` mirrors the Anchor seed contract for wallet and API
clients. It exports deterministic PDA helpers for v1 identities, v1 evaluations,
v2 models, and feedback accounts. It also returns transaction plans with Anchor
instruction names, first-8-byte SHA-256 discriminators, ordered account metas,
and the full argument payload expected by the corresponding Rust instruction.

## Verification

Current local verification:

```bash
cargo check
npm run build
```

Both checks pass in the current workspace. `cargo check` emits Anchor macro cfg
warnings from the Anchor/Solana dependency stack, but the program type-checks.

## Production Work

Before mainnet use:

- Follow the [Solana mainnet deployment runbook](../solana-mainnet-deployment.md)
  and verify `Anchor.toml`, `declare_id!`, client constants, and the deploy
  keypair all resolve to `A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92`.
- Add Metaplex Core CPI validation so registration proves the asset is an MPL
  Core model asset and optional collection authority is valid.
- Add integration tests for duplicate registration, authority updates,
  deactivation, and evaluation recording.
- Generate and publish the IDL so frontend transaction builders can replace the
  current JSON transaction plans with typed Anchor client calls.
