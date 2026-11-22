# REST API Reference

Core API documentation for Train2Earn backend services.

## Base URL

```
Development: http://localhost:5001/api
Production: https://api.train2earn.io/api
```

## Authentication

Most endpoints are public. Payment endpoints require valid Solana transaction signatures.

## Endpoints

### Health Check

#### `GET /api/health`

Check if the API server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-16T12:00:00.000Z",
  "version": "1.0.0"
}
```

---

### Asset Management

#### `POST /api/assets/search`

Search for wallet assets using Helius DAS API.

**Request Body:**
```json
{
  "ownerAddress": "7xKXm8Y...3pump",
  "page": 1,
  "limit": 100
}
```

**Response:**
```json
{
  "total": 42,
  "limit": 100,
  "page": 1,
  "items": [
    {
      "id": "asset_id",
      "content": {
        "metadata": {
          "name": "My NFT",
          "symbol": "MNFT"
        },
        "links": {
          "image": "https://arweave.net/..."
        }
      }
    }
  ]
}
```

#### `POST /api/tokens/accounts`

Get token accounts for a wallet.

**Request Body:**
```json
{
  "owner": "7xKXm8Y...3pump"
}
```

**Response:**
```json
{
  "tokens": [
    {
      "mint": "So11111111111111111111111111111111111111112",
      "amount": "1000000000",
      "decimals": 9
    }
  ]
}
```

---

### AI Services

#### `POST /api/ai/analyze`

Get AI-powered wallet analysis.

**Request Body:**
```json
{
  "walletAddress": "7xKXm8Y...3pump",
  "assets": [
    { "name": "DeGod", "type": "nft" },
    { "name": "USDC", "amount": 1000 }
  ],
  "tokens": [
    { "symbol": "SOL", "balance": 10.5 }
  ]
}
```

**Response:**
```json
{
  "analysis": {
    "overview": "Your portfolio shows strong diversification...",
    "collections": "You hold 5 DeGods NFTs, which are blue-chip...",
    "engagement": "High - Active trader with 50+ transactions...",
    "recommendations": [
      "Consider staking your SOL for passive income",
      "Diversify into DeFi protocols"
    ]
  },
  "metadata": {
    "model": "llama-3.3-70b",
    "tokensUsed": 450,
    "cost": 0.005
  }
}
```

#### `POST /api/ai/inference`

Run a paid AI inference request using SOL-native X402-style payment
verification. Requests without a payment signature return `402 Payment Required`
with payment instructions.

**Request Body:**
```json
{
  "prompt": "Write a short Solana model registry summary",
  "modelType": "TEXT_GENERATION",
  "modelId": "solai-code-022",
  "quantity": 1,
  "parameters": {
    "maxTokens": 512
  }
}
```

**Payment Challenge Response:**
```json
{
  "error": "Payment Required",
  "paymentAddress": "EDCdUyLtCTjg2xC8VXLB2GmPPcVUNXrpDGEgQm8VATgk",
  "amount": 0.005,
  "amountLamports": 5000000,
  "currency": "SOL",
  "modelType": "TEXT_GENERATION"
}
```

**Paid Request Header:**
```http
X-Payment-Signature: 5u...
```

**Response:**
```json
{
  "success": true,
  "modelType": "TEXT_GENERATION",
  "modelId": "solai-code-022",
  "result": {
    "provider": "openrouter",
    "output": "Train2Earn registers model identity records..."
  },
  "payment": {
    "signature": "5u...",
    "amount": 0.005,
    "currency": "SOL",
    "treasury": "EDCdUyLtCTjg2xC8VXLB2GmPPcVUNXrpDGEgQm8VATgk"
  }
}
```

#### `GET /api/piedpiper/capabilities`

List the PiedPiper algorithm capabilities exposed to Train2Earn.

**Response:**
```json
{
  "modelType": "PIEDPIPER_PIPELINE",
  "attribution": {
    "project": "PiedPiper",
    "license": "MIT"
  },
  "capabilities": [
    {
      "id": "text-compression-huffman-rle",
      "name": "Static Huffman + RLE text compression",
      "category": "compression",
      "runtime": "ported-js"
    }
  ]
}
```

#### `POST /api/piedpiper/analyze`

Run deterministic PiedPiper compression, hashing, cellular automata, and
registry-draft analysis.

**Request Body:**
```json
{
  "input": "Train2Earn registers deterministic compression agents on Solana."
}
```

**Response:**
```json
{
  "analysis": {
    "artifactSha256": "0x...",
    "compression": {
      "huffman": { "compressionRatio": 0.53 },
      "rle": { "compressionRatio": 1.85 },
      "recommendation": "huffman"
    },
    "automata": {
      "rule30": { "hexPreview": "..." },
      "gameOfLife": { "finalGrid": ["..##"] },
      "forestFire": { "finalGrid": ["ttFx"] }
    },
    "registryDraft": {
      "name": "PiedPiper Compression Automata Agent",
      "modelType": "PIEDPIPER_PIPELINE"
    }
  }
}
```

---

### Rewards System

#### `POST /api/rewards/calculate`

Calculate CLAWD token rewards for a wallet.

**Request Body:**
```json
{
  "walletAddress": "7xKXm8Y...3pump",
  "assetsCount": 25,
  "tokensCount": 8
}
```

**Response:**
```json
{
  "rewards": {
    "total": 45.5,
    "breakdown": {
      "baseReward": 10,
      "assetBonus": 12.5,
      "tokenBonus": 2.4,
      "multiplier": 1.5,
      "multiplierReason": "10+ assets"
    }
  },
  "tier": "Platinum",
  "nextTierAt": 100,
  "progress": 45.5
}
```

---

### Model Management

#### `GET /api/models/list`

List registered AI model identity records.

**Query Parameters:**
- `type` (optional): Filter by model type
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset
- `sortBy` (optional): downloads | accuracy | recent

**Response:**
```json
{
  "models": [
    {
      "id": "solai-code-022",
      "name": "BuilderCode Solana 3B",
      "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
      "modelIdentityPda": "AICod2p...4mR",
      "modelRegistrationUri": "https://arweave.net/model-registration-buildercode",
      "modelRegistry": "solana:101:traintoearn-model-registry",
      "modelType": "CODE_GENERATION",
      "artifactUri": "ar://H7rKp2b4nVi8yLq9",
      "artifactSha256": "0x7d6f...",
      "huggingFaceRepo": "solana-ai/buildercode-3b",
      "huggingFaceCommit": "ac77120",
      "metaplexVerified": true,
      "googleAttestation": "Gemini red-team reviewed",
      "lifecycleChecks": {
        "transfer": true,
        "update": true,
        "execute": true
      },
      "accuracy": 91.8,
      "downloads": 32920,
      "storageType": "arweave"
    }
  ]
}
```

#### `POST /api/models/register`

Register a lightweight model catalog entry backed by IPFS, Arweave, Hugging
Face, or another artifact URI. This is the direct API path for cataloging models
before or alongside the full Metaplex model identity flow.

**Request Body:**
```json
{
  "name": "Tiny Sentiment IPFS",
  "modelType": "SENTIMENT_ANALYSIS",
  "cid": "bafybeigdyrztinytrain2earnmodel",
  "description": "Small IPFS-backed sentiment model.",
  "price": 0.001,
  "accuracy": 88.4,
  "creator": "7xKX...8Ym9"
}
```

**Response:**
```json
{
  "success": true,
  "storageType": "ipfs",
  "source": "memory",
  "model": {
    "id": "tiny-sentiment-ipfs",
    "name": "Tiny Sentiment IPFS",
    "modelType": "SENTIMENT_ANALYSIS",
    "modelCid": "bafybeigdyrztinytrain2earnmodel",
    "storageType": "ipfs",
    "price": 0.001,
    "accuracy": 88.4,
    "status": "registered"
  }
}
```

#### `GET /api/models/:identifier`

Fetch a registered model by id, asset, model CID, Arweave transaction id, or
artifact URI.

**Response:**
```json
{
  "model": {
    "id": "tiny-sentiment-ipfs",
    "name": "Tiny Sentiment IPFS",
    "modelType": "SENTIMENT_ANALYSIS",
    "storageType": "ipfs"
  }
}
```

#### `GET /api/models/identity/:asset`

Derive the model identity PDA for an MPL Core model asset.

**Response:**
```json
{
  "pda": "63jFk7...",
  "bump": 255,
  "seeds": ["model_identity", "6QLKq9..."]
}
```

#### `POST /api/models/registration-document`

Generate and validate a model registration JSON document before uploading it to Arweave or IPFS.

**Request Body:**
```json
{
  "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
  "name": "BuilderCode Solana 3B",
  "description": "A Solana-specialized code model.",
  "image": "https://arweave.net/model-image",
  "modelType": "CODE_GENERATION",
  "architecture": "decoder-transformer",
  "parameterCount": "3B",
  "license": "MIT",
  "artifactUri": "ar://H7rKp2b4nVi8yLq9",
  "artifactSha256": "0x7d6f...",
  "modelCardUri": "https://huggingface.co/solana-ai/buildercode-3b",
  "huggingFaceRepo": "solana-ai/buildercode-3b",
  "huggingFaceCommit": "ac77120",
  "price": 0.007,
  "royaltyBps": 300
}
```

#### `POST /api/models/register-intent`

Prepare a complete model identity record after the registration document has a permanent URI.

**Request Body:**
```json
{
  "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
  "authority": "CREATOR_WALLET",
  "registrationUri": "https://arweave.net/<tx-id>",
  "name": "BuilderCode Solana 3B",
  "description": "A Solana-specialized code model.",
  "image": "https://arweave.net/model-image",
  "modelType": "CODE_GENERATION",
  "architecture": "decoder-transformer",
  "parameterCount": "3B",
  "license": "MIT",
  "artifactUri": "ar://H7rKp2b4nVi8yLq9",
  "artifactSha256": "0x7d6f...",
  "huggingFaceRepo": "solana-ai/buildercode-3b",
  "huggingFaceCommit": "ac77120",
  "metaplexDasAsset": {
    "id": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
    "interface": "MplCoreAsset",
    "ownership": { "owner": "CREATOR_WALLET" }
  },
  "requireMetaplexVerification": true
}
```

**Response includes:**

- `identity`: the model identity record and deterministic PDA.
- `document`: the generated registration document.
- `transactionPlan`: the IDL-ready instruction, accounts, args, and lifecycle checks for `registerModelIdentityV1`.
- `attestations`: provider validation bundle for Hugging Face, Google, Metaplex, and Solana.
- `metaplexVerification`: DAS-backed proof that the asset exists, matches the requested asset, uses a Metaplex Core interface, and optionally matches collection/authority.
- `storedModel`: persisted model record when PostgreSQL is connected, otherwise `null`.

#### `POST /api/models/metaplex-asset`

Verify a model asset with Metaplex DAS before registration. If `dasAsset` is
provided, the API verifies that fixture directly. Otherwise, it calls Helius
`getAsset` using `HELIUS_RPC_URL` or `HELIUS_API_KEY`.

**Request Body:**
```json
{
  "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
  "authority": "CREATOR_WALLET",
  "collection": "OPTIONAL_COLLECTION",
  "dasAsset": {
    "id": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
    "interface": "MplCoreAsset",
    "ownership": { "owner": "CREATOR_WALLET" }
  }
}
```

**Response:**
```json
{
  "source": "provided",
  "verification": {
    "provider": "metaplex",
    "verified": true,
    "valid": true,
    "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
    "interface": "MplCoreAsset",
    "owner": "CREATOR_WALLET",
    "checks": [
      { "name": "asset_exists", "valid": true },
      { "name": "asset_matches_request", "valid": true },
      { "name": "metaplex_core_interface", "valid": true }
    ]
  }
}
```

#### `POST /api/models/provider-attestations`

Validate provider references before registration. This checks Hugging Face repo
shape, Google attestation URI shape, Metaplex asset keys or DAS verification,
and Solana explorer links.

**Request Body:**
```json
{
  "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
  "modelIdentityPda": "jWwQcDAUjj3p37h2TSFeQFAmq2Zg7qLhxjNU8AUa6c6",
  "huggingFaceRepo": "solana-ai/buildercode-3b",
  "googleAttestationUri": "gs://traintoearn-attestations/buildercode/eval.json",
  "googleAttestor": "google:vertex-ai"
}
```

**Response:**
```json
{
  "attestations": {
    "huggingFace": {
      "provider": "huggingface",
      "valid": true,
      "repo": "solana-ai/buildercode-3b",
      "url": "https://huggingface.co/solana-ai/buildercode-3b"
    },
    "google": {
      "provider": "google",
      "valid": true,
      "attestor": "google:vertex-ai",
      "uri": "gs://traintoearn-attestations/buildercode/eval.json"
    },
    "metaplex": {
      "provider": "metaplex",
      "valid": true
    },
    "solana": {
      "provider": "solana",
      "valid": true
    },
    "valid": true
  }
}
```

#### `POST /api/models/status`

Update a persisted registration status after a wallet submits or confirms the
on-chain transaction. Requires PostgreSQL.

**Request Body:**
```json
{
  "asset": "6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC",
  "status": "submitted",
  "signature": "5u..."
}
```

Allowed statuses: `prepared`, `submitted`, `confirmed`, `rejected`, `inactive`.

---

### Arweave Integration

#### `GET /api/arweave/models`

Query models from Arweave.

**Query Parameters:**
- `modelType` (optional): Filter by type
- `creator` (optional): Filter by creator
- `limit` (optional): Number of results

**Response:**
```json
{
  "models": [
    {
      "txId": "X7v9JqT4NyZ8kL2pR5wH3mC6fG9dV8sU4eY1nB7aK0x",
      "name": "GPT-Nano",
      "version": "1.0.0",
      "modelType": "TEXT_GENERATION",
      "size": 450000000,
      "creator": "9mK2...4Lp7",
      "accuracy": 89.2,
      "createdAt": 1702645200000,
      "url": "https://arweave.net/X7v9..."
    }
  ]
}
```

#### `GET /api/arweave/model/:txId`

Fetch JSON metadata for a single Arweave transaction.

**Response:**
```json
{
  "metadata": {
    "name": "GPT-Nano",
    "modelType": "TEXT_GENERATION",
    "version": "1.0.0"
  }
}
```

#### `GET /api/arweave/status/:txId`

Check confirmation status for an Arweave transaction.

**Response:**
```json
{
  "status": {
    "confirmed": true,
    "block_height": 1512345
  }
}
```

---

### DAO Governance

#### `GET /api/proposals/list`

Get all DAO proposals.

**Query Parameters:**
- `status` (optional): active | executed | failed
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "proposals": [
    {
      "id": "prop_1",
      "description": "Improve code generation model accuracy",
      "targetParam": "code_generation",
      "trainingBudget": 50,
      "votesFor": 1250,
      "votesAgainst": 340,
      "executed": false,
      "zkProofRequired": true,
      "deadline": 1705536000000,
      "creator": "7xKX...8Ym9",
      "status": "active"
    }
  ],
  "total": 15
}
```

#### `POST /api/proposals/create`

Create a new proposal (requires wallet signature).

**Request Body:**
```json
{
  "description": "Add multimodal AI support",
  "targetParam": "multimodal",
  "trainingBudget": 100,
  "zkProofRequired": false,
  "duration": 604800,
  "walletAddress": "7xKX...8Ym9",
  "signature": "signature_here"
}
```

**Response:**
```json
{
  "success": true,
  "proposalId": "prop_5",
  "txSignature": "5Kj...xyz",
  "message": "Proposal created successfully"
}
```

#### `POST /api/proposals/vote`

Cast vote on proposal (requires wallet signature).

**Request Body:**
```json
{
  "proposalId": "prop_1",
  "vote": "for",
  "walletAddress": "7xKX...8Ym9",
  "signature": "signature_here"
}
```

**Response:**
```json
{
  "success": true,
  "txSignature": "3Hg...abc",
  "newVoteCount": {
    "for": 1251,
    "against": 340
  }
}
```

---

### Compute Marketplace

#### `GET /api/compute/providers`

Get available compute providers.

**Response:**
```json
{
  "providers": [
    {
      "id": "akash",
      "name": "Akash Network",
      "pricePerHour": 0.05,
      "gpuType": "A100",
      "available": true
    }
  ]
}
```

#### `POST /api/compute/job`

Request a decentralized training job for an IPFS CID, Arweave transaction id, or
registered model id. The server selects the lowest-cost available provider that
matches GPU and ZK proof requirements unless a `providerId` is supplied.

**Request Body:**
```json
{
  "cid": "bafybeigdyrztinytrain2earnmodel",
  "params": {
    "gpuType": "A100",
    "estimatedTime": 120
  },
  "zkProofRequired": true,
  "walletAddress": "7xKX...8Ym9"
}
```

**Response:**
```json
{
  "jobId": "job_lx91a2bc_abc12345",
  "provider": {
    "id": "akash-a100",
    "name": "Akash Network",
    "pricePerHour": 0.05,
    "gpuType": "A100",
    "zkSupport": true
  },
  "job": {
    "id": "job_lx91a2bc_abc12345",
    "modelCid": "bafybeigdyrztinytrain2earnmodel",
    "status": "pending",
    "progress": 0,
    "estimatedCompletion": "2026-07-04T16:30:00.000Z"
  },
  "onChainRecord": {
    "signature": "sim_job_lx91a2bc_abc12345",
    "network": "solana-mainnet"
  }
}
```

#### `GET /api/compute/job/:jobId`

Fetch current training job status.

**Response:**
```json
{
  "job": {
    "id": "job_lx91a2bc_abc12345",
    "modelCid": "bafybeigdyrztinytrain2earnmodel",
    "status": "running",
    "progress": 45,
    "provider": {
      "id": "akash-a100",
      "name": "Akash Network"
    },
    "estimatedCompletion": "2026-07-04T16:30:00.000Z"
  }
}
```

#### `POST /api/compute/job/:jobId/cancel`

Cancel an in-memory training job.

**Response:**
```json
{
  "job": {
    "id": "job_lx91a2bc_abc12345",
    "status": "cancelled",
    "cancelledAt": "2026-07-04T15:05:00.000Z"
  }
}
```

---

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## Rate Limiting

- **Free tier**: 100 requests/minute
- **Pro tier**: 1000 requests/minute
- **Enterprise**: Custom limits

## Webhooks

Subscribe to events (coming soon):
- Model uploaded
- Proposal created
- Vote cast
- Training job completed

---

Next: [Payment System](../payment/overview.md) →
