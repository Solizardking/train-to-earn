# Solana AI Model Registry

Train2Earn registers AI models using the same identity pattern Metaplex uses for
agents: an MPL Core asset is the model identity, a discoverable PDA binds the
asset to an on-chain model record, and a permanent registration document stores
the full off-chain model profile.

## Registration Flow

1. Mint an MPL Core asset for the model.
2. Upload a model registration JSON document to Arweave or IPFS.
3. Register the model identity PDA derived from the asset public key.
4. Attach lifecycle checks for transfer, update, and execute/inference.
5. Read the model from the PDA, Core asset plugin, and registration URI.

## Model Registration Document

The model registration document mirrors ERC-8004 agent registration semantics,
but describes model artifacts instead of autonomous services.

```json
{
  "type": "https://traintoearn.ai/schemas/model-registration-v1",
  "name": "BuilderCode Solana 3B",
  "description": "A code model specialized in Solana programs, Anchor clients, wallet UX, and protocol documentation.",
  "image": "https://arweave.net/model-card-image",
  "active": true,
  "model": {
    "architecture": "decoder-transformer",
    "format": "safetensors",
    "parameterCount": "3B",
    "license": "MIT",
    "artifactUri": "ar://H7rKp2b4nVi8yLq9",
    "artifactSha256": "0x...",
    "modelCardUri": "https://huggingface.co/solana-ai/buildercode-3b",
    "huggingFaceRepo": "solana-ai/buildercode-3b",
    "huggingFaceCommit": "ac77120"
  },
  "evaluations": [
    {
      "name": "solana-anchor-bench",
      "score": 91.8,
      "attestor": "google:vertex-ai",
      "attestationUri": "https://storage.googleapis.com/example/eval.json"
    }
  ],
  "services": [
    {
      "name": "inference",
      "endpoint": "https://api.traintoearn.ai/models/<ASSET_PUBKEY>/infer",
      "version": "1.0.0"
    },
    {
      "name": "mcp",
      "endpoint": "https://api.traintoearn.ai/models/<ASSET_PUBKEY>/mcp",
      "version": "2025-06-18"
    }
  ],
  "pricing": {
    "currency": "SOL",
    "unit": "inference",
    "price": 0.0025,
    "royaltyBps": 300
  },
  "registrations": [
    {
      "modelId": "<MPL_CORE_ASSET_ADDRESS>",
      "modelRegistry": "solana:101:traintoearn-model-registry"
    }
  ],
  "supportedTrust": [
    "reputation",
    "crypto-economic",
    "storage-proof",
    "evaluation-attestation"
  ]
}
```

## On-Chain Accounts

- `ModelIdentityV1`: PDA derived from the MPL Core asset address.
- `ModelAssetSigner`: deterministic asset signer PDA that can receive model
  revenue and route authorized execution.
- `ModelEvaluationV1`: optional PDA for benchmark, safety, or provenance
  attestations.
- `ModelUsageRecordV1`: optional PDA for metered inference and settlement.

The current Anchor scaffold implements:

- `register_model_identity_v1`
- `update_model_identity_v1`
- `deactivate_model_identity_v1`
- `record_model_evaluation_v1`

Program seed conventions:

```text
ModelIdentityV1    = ["model_identity", <MPL_CORE_MODEL_ASSET>]
ModelEvaluationV1  = ["model_evaluation", <MPL_CORE_MODEL_ASSET>, <EVALUATION_NAME>]
```

## Future SDK Shape

```ts
await registerModelIdentityV1(umi, {
  asset: modelAssetPublicKey,
  collection: modelCollectionPublicKey,
  modelRegistrationUri: 'https://arweave.net/<tx-id>',
}).sendAndConfirm(umi);
```

This is intentionally parallel to Metaplex agent registration: asset first,
identity PDA second, permanent registration URI third.

## Current Implementation

The current application implements the registry contract across app, API, and
program scaffold:

- `src/utils/modelRegistry.js` creates registration documents, validates required
  model fields, derives v1/v2 model PDAs, and prepares IDL-ready transaction
  plans with Anchor discriminators, account metas, and required args.
- `GET /api/models/list` returns model identity records.
- `GET /api/models/identity/:asset` derives the deterministic model identity PDA.
- `POST /api/models/registration-document` creates and validates the permanent
  model registration JSON.
- `POST /api/models/register-intent` prepares the record that will become the
  `registerModelIdentityV1` transaction input.
- `POST /api/models/provider-attestations` validates Hugging Face, Google,
  Metaplex, and Solana references before a model is registered.
- `POST /api/models/status` updates the persisted lifecycle state after a wallet
  submits or confirms the on-chain transaction.
- `programs/model-registry` contains the Anchor program scaffold for
  `ModelIdentityV1`, `ModelEvaluationV1`, `AiModelV2`, and model feedback.

When PostgreSQL is connected, prepared registration intents are stored in
`model_registrations`. Without a database, the API remains usable and falls back
to the built-in sample registry record.

Registry lifecycle states:

- `prepared`: off-chain registration document and transaction plan are ready.
- `submitted`: a wallet submitted the on-chain registration transaction.
- `confirmed`: the model identity account has been confirmed on-chain.
- `rejected`: the registration was rejected or failed validation.
- `inactive`: the model identity is deactivated.

## Readiness Checks

Run the registry readiness gate before deployment:

```bash
npm run check:registry
```

This verifies:

- Anchor, Rust, frontend, server, and local deploy-keypair registry program IDs
  match when the deploy keypair is present.
- Anchor CLI is pinned to the program's `anchor-lang` version.
- The model registry program, client utilities, provider attestation utilities,
  docs, and API tests exist.
- Required environment variables are documented in `.env.example`.
- `.env` and `.env.local` remain ignored so local secrets are not committed.

For a full local verification pass:

```bash
npm run verify
cargo check
npm run anchor:build
```

The Solana deployment path is documented in
[Solana Mainnet Deployment](../solana-mainnet-deployment.md). The current API
returns Anchor-shaped transaction plans for wallet clients; raw transaction
construction should use the generated Anchor IDL/client once the program is
built and published.
