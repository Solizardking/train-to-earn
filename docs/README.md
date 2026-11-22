# Welcome to Train2Earn 🚀

> **Decentralized AI Platform on Solana** - Upload, Train, Govern, and Monetize AI Models

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF)](https://solana.com)
[![Arweave](https://img.shields.io/badge/Arweave-Permanent-14F195)](https://arweave.org)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB)](https://reactjs.org)

---

## 🌟 What is Train2Earn?

**Train2Earn** is a revolutionary decentralized AI platform built on Solana that enables:

- 🤖 **Upload & Store AI Models** - Permanently store models on IPFS or Arweave
- 💰 **Earn SOL Rewards** - Get paid for contributing quality AI models
- 🗳️ **DAO Governance** - Vote on model improvements and training directions
- 🔐 **Zero-Knowledge Proofs** - Verify model integrity without revealing weights
- ⚡ **Decentralized Training** - Leverage Akash and Golem compute networks
- 💎 **NFT Achievements** - Earn badges for contributions

---

## ✨ Key Features

### 🎯 For AI Researchers
- Upload trained models to permanent storage
- Monetize models with SOL-native payments
- Collaborate with global AI community
- Earn reputation and NFT achievements

### 🏛️ For DAO Members
- Vote on training proposals with token-weighted voting
- Influence AI development direction
- Participate in decentralized governance
- Execute approved proposals

### 💻 For Developers
- Access public AI model registry
- Integrate via REST API
- Build on decentralized infrastructure
- Contribute to open-source platform

### 📊 For Users
- Analyze Solana wallet assets with AI
- Get personalized recommendations
- Track rewards and achievements
- Explore AI model marketplace

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Solana wallet (Phantom or Solflare)
- Basic understanding of blockchain concepts

### Installation

```bash
# Clone the repository
git clone https://github.com/Solizardking/traintoearn.git
cd traintoearn

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### First Steps

1. **Connect Wallet** - Click "Connect Wallet" in the header
2. **Explore Dashboard** - View your assets, tokens, and NFTs
3. **Try AI Analysis** - Get AI-powered insights on your portfolio
4. **Browse Models** - Explore the AI model registry
5. **Vote on Proposals** - Participate in DAO governance

👉 [Quick Start Guide](introduction/quickstart.md)

---

## 📖 Documentation

### User Guides
- [Quick Start](introduction/quickstart.md)
- [Platform Overview](introduction/overview.md)
- [On-Chain AI for Beginners](on-chain-ai/beginners-guide.md)
- [Solana Finance AI Templates](on-chain-ai/solana-finance-templates.md)
- [Vision Model Guide](on-chain-ai/vision-guide.md)
- [Chart Vision Guide](on-chain-ai/chart-vision-guide.md)
- [Nemotron Jetson Serve](on-chain-ai/nemotron-jetson-serve.md)
- [Solana CLAWD LoRA Output](on-chain-ai/solana-clawd-lora.md)
- [PiedPiper Integration](on-chain-ai/piedpiper-integration.md)
- [Phoenix Vulcan Guide](on-chain-ai/phoenix-vulcan-guide.md)
- [Payment System](payment/overview.md)
- [DAO Economics](dao/token.md)

### Developer Docs
- [Architecture Overview](architecture/overview.md)
- [API Reference](api/rest-api.md)
- [Smart Contracts](smart-contracts/overview.md)
- [Solana Mainnet Deployment](solana-mainnet-deployment.md)
- [Contributing Guide](../CONTRIBUTING.md)

### Technical Deep Dives
- [On-Chain AI Beginner Guide](on-chain-ai/beginners-guide.md)
- [Solana Finance AI Templates](on-chain-ai/solana-finance-templates.md)
- [Vision Model Guide](on-chain-ai/vision-guide.md)
- [Chart Vision Guide](on-chain-ai/chart-vision-guide.md)
- [Nemotron Jetson Serve](on-chain-ai/nemotron-jetson-serve.md)
- [Solana CLAWD LoRA Output](on-chain-ai/solana-clawd-lora.md)
- [PiedPiper Integration](on-chain-ai/piedpiper-integration.md)
- [Phoenix Vulcan Guide](on-chain-ai/phoenix-vulcan-guide.md)
- [Model Registry Overview](model-registry/overview.md)
- [Model Registry Program](smart-contracts/model-registry.md)
- [Technical Specification](technical-specification.md)
- [Payment System](payment/overview.md)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Dashboard │  │AI Models │  │DAO Vote  │  │ Upload   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express.js)                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │REST API │  │AI Engine│  │Analytics│  │Notifications │  │
│  └─────────┘  └─────────┘  └─────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │                  │                   │
           ▼                  ▼                   ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────┐
│   Solana     │   │  Storage Layer   │   │   Compute    │
│  Blockchain  │   │  ┌─────┐ ┌─────┐ │   │  Marketplace │
│              │   │  │IPFS │ │Arwe │ │   │  ┌────┐      │
│ ┌──────────┐ │   │  └─────┘ └─────┘ │   │  │Aksh│Golm │
│ │Model Mgr │ │   │                  │   │  └────┘      │
│ │DAO Vote  │ │   └──────────────────┘   └──────────────┘
│ │Payment   │ │
│ └──────────┘ │
└──────────────┘
```

👉 [Full Architecture Documentation](architecture/overview.md)

---

## 💰 Payment Structure

### AI Inference Pricing (SOL)

| Service | Cost per Request | Monthly (1K) | Annual (12K) |
|---------|------------------|--------------|--------------|
| Sentiment Analysis | 0.001 SOL | 1 SOL | 12 SOL |
| Text Generation | 0.005 SOL | 5 SOL | 60 SOL |
| Image Classification | 0.002 SOL | 2 SOL | 24 SOL |
| Code Generation | 0.007 SOL | 7 SOL | 84 SOL |
| Price Prediction | 0.01 SOL | 10 SOL | 120 SOL |

### Storage Costs

| Storage | Cost | Duration | Best For |
|---------|------|----------|----------|
| **IPFS** | Free* | While pinned | Active development |
| **Arweave** | ~$0.01/MB | 200+ years | Production models |

*Requires pinning service

👉 [Full Payment Details](payment/overview.md#pricing-structure)

---

## 🗳️ DAO Governance

### How It Works

1. **Create Proposal** - Suggest model improvements
2. **Community Votes** - Token-weighted voting
3. **Execution** - Approved proposals trigger training jobs
4. **Verification** - ZK proofs ensure model integrity

### Current Proposals

- ✅ Improve code generation accuracy (75% approval)
- 🔄 Add multimodal AI support (63% approval)
- 📝 Enhance text generation (85% approval)
- 💡 Implement federated learning (45% approval)

👉 [Governance Token & Economic Model](dao/token.md)

---

## 🛠️ Tech Stack

### Frontend
- **React 18.3** - UI framework
- **Vite 6.0** - Build tool
- **@solana/wallet-adapter** - Wallet integration
- **Three.js** - 3D visualizations
- **CSS** - Styling

### Backend
- **Express.js** - REST API
- **Node.js 18+** - Runtime
- **Axios** - HTTP client
- **CORS** - Cross-origin support

### Blockchain
- **Solana** - High-speed blockchain
- **@solana/web3.js** - Blockchain SDK
- **Anchor** - Smart contract framework

### Storage
- **IPFS** - Decentralized storage
- **Arweave** - Permanent storage
- **ipfs-http-client** - IPFS integration

### AI & Compute
- **OpenRouter API** - AI inference
- **Akash Network** - Decentralized compute
- **Golem Network** - GPU marketplace
- **snarkjs** - Zero-knowledge proofs

---

## ✅ Integrated: Anchor + Pinata + Hugging Face + Adapted Train2Earn Concepts on SVM (Solana)

The **Train2Earn** architecture (Model Registry, DAO Voting, Oracle/ZK Verification) has been adapted into the **Privy UDS AI** system on Solana using **Anchor**. Key adaptations:

- **SVM-native**: PDAs, Light Protocol for ZK-compressed UDS storage (rent-efficient for large models/messages).
- **Storage**: Pinata (IPFS pinning/gateway) for model metadata/CIDs + custom gateway fallback. Hugging Face for model discovery/inference pointers (store HF repo URLs or CIDs on-chain).
- **Agent-like Discovery**: Adapted ERC-8004-style registries as Solana PDAs/programs for AI models (identity via PDA + metadata URI to Pinata/HF).
- **AI Focus**: Models point to Hugging Face + IPFS (Pinata), with ZK proofs for integrity/transforms.

### 1. Updated `lib.rs` (Enhanced Model Registry + Light + Storage)

The workspace file (`programs/privy-uds-ai/src/lib.rs`) with these additions:

- **AiModel** struct expanded (CID for Pinata/IPFS, HF repo pointer, stats like downloads/revenue).
- New instructions inspired by Train2Earn: `register_model` (with Pinata/HF metadata), `update_model_stats`, `deactivate_model`.
- Light Protocol hooks for compressed UDS (model data offloaded).
- ZK placeholders for verification.

```rust
use anchor_lang::prelude::*;
use light_sdk::{compressed_account::*, /* ... */}; // From your fork

#[program]
pub mod privy_uds_ai {
    // Adapted from Train2Earn: Register AI Model (Pinata/HF)
    pub fn register_model(
        ctx: Context<RegisterModel>,
        model_cid: String,      // Pinata IPFS CID
        hf_repo: String,        // e.g., "username/model-name" on Hugging Face
        model_name: String,
        model_type: String,
        metadata_uri: String,   // Pinata gateway link or custom
    ) -> Result<()> {
        let model = &mut ctx.accounts.model;
        model.creator = *ctx.accounts.authority.key;
        model.model_cid = model_cid;
        model.hf_repo = hf_repo;
        model.model_name = model_name;

        // Emit event (like Train2Earn)
        emit!(ModelRegistered { model_pubkey: model.key(), /* ... */ });

        // Store metadata hash in compressed UDS via Light
        create_compressed_account(/* Light params with CID hash */)?;
        Ok(())
    }

    pub fn update_model_stats(/* ... */) -> Result<()> { /* downloads, revenue */ }
    pub fn deactivate_model(/* ... */) -> Result<()> { /* soft deactivate */ }
}

// Enhanced Account
#[account]
pub struct AiModel {
    pub creator: Pubkey,
    pub model_cid: String,      // Pinata IPFS
    pub hf_repo: String,        // Hugging Face
    pub model_name: String,
    pub model_type: String,
    pub metadata_uri: String,   // e.g., https://gateway.pinata.cloud/ipfs/...
    pub total_downloads: u64,
    pub total_revenue: u64,
    pub is_active: bool,
    pub version: u64,
    // Light compressed fields via SDK
}
```

### 2. Pinata Integration (Backend)

```js
export async function pinModelMetadata(metadata) {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PINATA_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataMetadata: { name: metadata.name },
      pinataContent: metadata,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${response.status}`);
  }

  const result = await response.json();
  return {
    cid: result.IpfsHash,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`,
  };
}
```

**Upload flow**: Client uploads model → Backend pins to Pinata → Gets CID → Calls `register_model` with CID + HF repo.

### 3. Hugging Face Integration

- Store **HF repo ID** (e.g., `"meta-llama/Llama-3"`) in `AiModel` on-chain.
- Backend proxies inference via HF Inference API (or verifiable via Bonsol).
- On-chain: pointer only (lightweight). Full model weights via Pinata IPFS if needed.

```ts
// In ai-queue.ts
async function runVerifiableInference(encryptedCode: string, hfRepo: string) {
  const result = await hf.inference(hfRepo, /* params */);
  // Generate ZK proof (Noir/Light)
  // Store result CID on Pinata + on-chain via program
}
```

### 4. Adapted Architecture Overview (Solana Version)

| Layer | Component | Technology |
| ----- | --------- | ---------- |
| **On-chain** | Model Registry | Anchor PDAs |
| **On-chain** | DAO Voting | SPL token-weighted |
| **On-chain** | ZK Oracle | Light + Noir verifier |
| **Storage** | Model metadata | Pinata IPFS |
| **Storage** | Large model weights | Pinata + Arweave |
| **Inference** | Model pointers | Hugging Face repo IDs |
| **Compression** | UDS data | Light Protocol |

### 5. Deploy & Test

```bash
# Build and deploy to devnet
anchor build && anchor deploy --provider.cluster devnet

# Run tests
anchor test
```

**Required env vars**: `PINATA_JWT`, `PINATA_GATEWAY`, `HUGGINGFACE_TOKEN`

---

## ✅ Full On-Chain SVM Model Registry (8004-Inspired) for AI Models

The **Agent Arena / ERC-8004** pattern adapted to **Solana (SVM)** for AI Models in the Privy UDS AI system.

### Core Design (8004 → SVM)

| Concept | ERC-8004 | SVM Adaptation |
| ------- | -------- | -------------- |
| **Identity** | ERC-721 NFT | PDA-based "Model NFT" with URI → Pinata IPFS |
| **Reputation** | On-chain feedback | Feedback PDA + Helius indexer |
| **Discovery** | Registry catalog | On-chain register + search via Helius GraphQL |
| **Storage** | IPFS metadata | Pinata IPFS CIDs + Hugging Face repo pointers |
| **Compression** | — | Light Protocol UDS for large model data |
| **Payments** | ERC-20 | SOL / SPL tokens (x402-extensible via backend) |

### 1. Full `lib.rs` (8004-Style Model Registry)

```rust
use anchor_lang::prelude::*;
use light_sdk::compressed_account::*;

declare_id!("CLAWDModelRegistry1111111111111111111111111111"); // update after deploy

#[program]
pub mod clawd_model_registry {
    use super::*;

    pub fn register_model(
        ctx: Context<RegisterModel>,
        name: String,
        description: String,
        hf_repo: String,           // e.g. "meta-llama/Llama-3"
        model_cid: String,         // Pinata IPFS CID
        capabilities: Vec<String>, // e.g. ["code-compression", "zk-transform"]
        pricing: u64,              // per-task in lamports
        metadata_uri: String,      // Pinata gateway URL
    ) -> Result<()> {
        let model = &mut ctx.accounts.model;
        model.creator = *ctx.accounts.authority.key;
        model.name = name;
        model.description = description;
        model.hf_repo = hf_repo;
        model.model_cid = model_cid;
        model.capabilities = capabilities;
        model.pricing = pricing;
        model.metadata_uri = metadata_uri;
        model.reputation_score = 0;
        model.total_reviews = 0;
        model.is_active = true;
        model.bump = *ctx.bumps.get("model").unwrap();
        model.registered_at = Clock::get()?.unix_timestamp;

        // Light compressed UDS for model data
        create_compressed_account(/* model hash params */)?;

        emit!(ModelRegistered {
            model_key: model.key(),
            creator: model.creator,
            name: model.name.clone(),
            cid: model.model_cid.clone(),
        });
        Ok(())
    }

    pub fn update_model(
        ctx: Context<UpdateModel>,
        new_description: Option<String>,
        new_pricing: Option<u64>,
        new_cid: Option<String>,
    ) -> Result<()> {
        let model = &mut ctx.accounts.model;
        require!(model.creator == *ctx.accounts.authority.key, ErrorCode::Unauthorized);
        if let Some(desc) = new_description { model.description = desc; }
        if let Some(price) = new_pricing { model.pricing = price; }
        if let Some(cid) = new_cid { model.model_cid = cid; }
        model.updated_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn give_feedback(
        ctx: Context<GiveFeedback>,
        score: u8,                       // 0-100
        tag1: String,
        tag2: Option<String>,
        feedback_uri: Option<String>,    // Pinata proof
    ) -> Result<()> {
        let feedback = &mut ctx.accounts.feedback;
        feedback.model = ctx.accounts.model.key();
        feedback.reviewer = *ctx.accounts.reviewer.key();
        feedback.score = score;
        feedback.tag1 = tag1;
        feedback.tag2 = tag2.unwrap_or_default();
        feedback.feedback_uri = feedback_uri.unwrap_or_default();
        feedback.timestamp = Clock::get()?.unix_timestamp;

        // Rolling average reputation
        let model = &mut ctx.accounts.model;
        model.total_reviews += 1;
        model.reputation_score = ((model.reputation_score as u64
            * (model.total_reviews - 1)
            + score as u64)
            / model.total_reviews) as u8;
        Ok(())
    }
}

#[event]
pub struct ModelRegistered {
    pub model_key: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub cid: String,
}

#[account]
pub struct AiModel {
    pub creator: Pubkey,
    pub name: String,
    pub description: String,
    pub hf_repo: String,
    pub model_cid: String,
    pub capabilities: Vec<String>,
    pub pricing: u64,
    pub metadata_uri: String,
    pub reputation_score: u8,
    pub total_reviews: u64,
    pub is_active: bool,
    pub registered_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
pub struct ModelFeedback {
    pub model: Pubkey,
    pub reviewer: Pubkey,
    pub score: u8,
    pub tag1: String,
    pub tag2: String,
    pub feedback_uri: String,
    pub timestamp: i64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct RegisterModel<'info> {
    #[account(
        init, payer = authority,
        space = 8 + 32 + 64 + 256 + 64 + 64 + 4 + 100*32 + 8 + 8 + 1 + 1 + 8 + 8 + 1,
        seeds = [b"model", authority.key().as_ref(), model_cid.as_bytes()],
        bump
    )]
    pub model: Account<'info, AiModel>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
}
```

### 2. Model Registration API

The checked-in Express server exposes the model registry through
`server/index.js`:

- `GET /api/models/list`
- `GET /api/models/identity/:asset`
- `POST /api/models/registration-document`
- `POST /api/models/register-intent`
- `POST /api/models/provider-attestations`
- `POST /api/models/status`

Wallet clients prepare a registration document first, then request a
transaction intent that mirrors the Anchor instruction payload.

```bash
curl -X POST http://localhost:5001/api/models/register-intent \
  -H "Content-Type: application/json" \
  -d '{"name":"MyZKCompressor","asset":"<MPL_CORE_ASSET>","modelRegistrationUri":"https://arweave.net/<tx-id>","artifactSha256":"0x...","modelType":"CODE_GENERATION"}'
```

### 3. Deploy

```bash
anchor build && anchor deploy --provider.cluster devnet
```

---

## 📊 Use Cases

### 1. AI Model Marketplace
Upload, discover, and monetize AI models with transparent pricing

### 2. Decentralized AI Training
Leverage global compute power for cost-effective model training

### 3. Community-Governed AI
DAO votes on model improvements, ensuring alignment with community needs

### 4. Research Collaboration
Permanent, verifiable storage of research models with attribution

### 5. Enterprise AI Solutions
Integrate decentralized AI into your applications via API

👉 [Architecture Overview](architecture/overview.md)

---

## ✅ Light Protocol + ZK Integration

Light Protocol (acquired by Helius) provides ZK-compressed accounts on Solana — massively reducing on-chain costs for UDS model storage with privacy-preserving state via nullifiers and Merkle trees.

### Benefits for CLAWD

| Feature | Impact |
| ------- | ------ |
| ZK Compression | Store model pointers at 1000x lower cost |
| Nullifier-based spends | No double-spend on CLAWD inference payments |
| Merkle tree state | Verifiable model history without full on-chain storage |
| Helius RPC synergy | Light indexing + Helius webhooks in one pipeline |

### Planned Light SDK (`Cargo.toml`)

```toml
[dependencies]
anchor-lang = "0.30.1"
# Uncomment after confirming your Light Protocol fork tag:
# light-sdk = { git = "https://github.com/your-org/light-protocol", tag = "v0.x.x", features = ["zk-compression"] }
```

### Planned ZK Compression in `lib.rs`

```rust
use light_sdk::{compressed_account::*, verify_compressed_proof};

pub fn allocate_compressed_uds(
    ctx: Context<AllocateCompressedUds>,
    model_hash: [u8; 32],
) -> Result<()> {
    // Create Light-compressed PDA — tiny on-chain footprint
    let cpi = create_compressed_account_cpi(
        &ctx.accounts.light_system_program,
        model_hash,
        /* merkle tree, queue params */
    );
    cpi.invoke()?;
    Ok(())
}
```

### Noir Circuit (model integrity + AI transform)

```noir
// src/main.nr
use dep::std::hash::sha256;

struct CompressionProof {
    original_hash: [u8; 32],
    compressed_hash: [u8; 32],
    params: u8,
}

fn main(proof: CompressionProof) {
    let h = sha256::digest(/* original preimage */);
    assert(h == proof.original_hash);
    assert(proof.compressed_hash != [0; 32]);
    // Multi-level UDS recursion supported
}
```

Compile: `nargo compile` → deploy verifier → CPI from `clawd-model-registry`.

### Helius Webhook Handler

```ts
import express from 'express';

const app = express();
app.use(express.json());

// Helius sends POST on every matching program transaction
app.post('/webhook/clawd', async (req, res) => {
  const events = req.body as HeliusEvent[];

  for (const event of events) {
    const ix = event.instructions?.[0];

    if (ix?.programId === process.env.CLAWD_PROGRAM_ID) {
      const name = ix.data?.name;

      if (name === 'registerModelV2') {
        // Index new model: write to Postgres + notify subscribers
        await indexModel(ix.data);
      } else if (name === 'updateModelStats') {
        await updateDownloads(ix.data);
      } else if (name === 'giveFeedback') {
        await updateReputation(ix.data);
      }
    }
  }

  res.sendStatus(200);
});

app.listen(4000, () => console.log('Helius webhook listener on :4000'));
```

**Setup**: Add the route to `server/index.js` or a separate Express worker, then configure Helius dashboard → Webhooks → add your URL → filter by the model registry program ID.

### Deploy Order

```bash
# 1. Build Anchor programs
anchor build

# 2. Deploy to devnet
anchor deploy --provider.cluster devnet

# 3. Export IDL for frontend/backend client
anchor idl init --filepath target/idl/model_registry.json <PROGRAM_ID>

# 4. Start the Express API
npm run server

# 5. Run full stack
npm run dev
```

**Required env vars** (already in `.env`):
`HELIUS_API_KEY`, `PINATA_JWT`, `PINATA_API_KEY`, `CLAWD_PROGRAM_ID`, `OPENROUTER_API_KEY`

---

## 🎓 Tutorials

### Beginner
- [Quick Start Guide](introduction/quickstart.md)
- [Platform Overview](introduction/overview.md)
- [Payment System](payment/overview.md)

### Intermediate
- [REST API Reference](api/rest-api.md)
- [Architecture Overview](architecture/overview.md)
- [DAO Token & Economics](dao/token.md)

### Advanced
- [Model Registry Overview](model-registry/overview.md)
- [Model Registry Program](smart-contracts/model-registry.md)
- [Technical Specification](technical-specification.md)

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest features
- 📝 Improve documentation
- 🔧 Submit pull requests
- 🎨 Design improvements
- 🧪 Write tests

### Development Workflow

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/traintoearn.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git commit -m "Add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

👉 [Contributing Guide](../CONTRIBUTING.md)

---

## 🌐 Community

### Get Involved
- 💬 [Discord Server](https://discord.gg/train2earn)
- 🐦 [Twitter](https://twitter.com/train2earn)
- 📱 [Telegram](https://t.me/train2earn)
- 📧 [Email Newsletter](https://train2earn.io/newsletter)

### Resources
- 📚 [Documentation](https://docs.train2earn.io)
- 🎥 [Video Tutorials](https://youtube.com/train2earn)
- 📝 [Blog](https://blog.train2earn.io)
- 🔧 [GitHub](https://github.com/train2earn)

---

## 📱 Status

### Platform Status
- ✅ Frontend: Production Ready
- ✅ Backend: Production Ready
- ✅ IPFS Integration: Live
- ✅ Arweave Integration: Live
- ✅ SOL Payments: Live
- ⏳ Smart Contracts: Testnet
- 🔄 DAO Governance: Beta
- 📋 Compute Marketplace: Coming Soon

### Network Support
- ✅ Solana Mainnet-Beta
- ✅ Solana Devnet
- ✅ Arweave Mainnet
- ✅ IPFS Public Network

---

## 🔐 Security

### Audits
- Smart Contract Audit: Pending
- Code Review: Ongoing
- Penetration Testing: Q2 2025

### Best Practices
- 🔒 Wallet keys never leave your device
- 🔐 All API calls encrypted (HTTPS)
- ✅ Smart contracts open-source
- 🛡️ Regular security updates

### Report Security Issues
Email: security@train2earn.io

---

## 📄 License

This project is licensed under the **MIT License** - see [LICENSE](../LICENSE) for details.

### Open Source Components
- React (MIT)
- Solana Web3.js (Apache 2.0)
- Arweave SDK (MIT)
- Express.js (MIT)

---

## 🙏 Acknowledgments

### Built With
- [Solana Foundation](https://solana.com)
- [Arweave](https://arweave.org)
- [IPFS/Protocol Labs](https://ipfs.io)
- [Akash Network](https://akash.network)
- [OpenRouter](https://openrouter.ai)

### Special Thanks
- Solana community for support
- Early testers and contributors
- Open-source community

---

## 📞 Support

### Need Help?
- 📚 Check [FAQ](introduction/quickstart.md#faqs)
- 🔍 Search [Documentation](SUMMARY.md)
- 💬 Ask on [Discord](https://discord.gg/train2earn)
- 📧 Email: support@train2earn.io

### Bug Reports
Please report bugs on [GitHub Issues](https://github.com/train2earn/issues)

---

## 🗺️ Roadmap

### Q1 2025 ✅
- ✅ Platform launch
- ✅ IPFS integration
- ✅ Arweave integration
- ✅ DAO voting (beta)

### Q2 2025 🔄
- 🔄 Smart contract deployment
- 🔄 Compute marketplace launch
- 🔄 NFT achievements
- 🔄 Mobile app

### Q3 2025 📋
- 📋 Enterprise API
- 📋 Advanced analytics
- 📋 Cross-chain support
- 📋 AI model training UI

### Q4 2025 💡
- 💡 DeFi integration
- 💡 Token launch
- 💡 Global expansion
- 💡 Partnerships

👉 [Technical Specification](technical-specification.md)

---

## 📊 Stats

```
🤖 Models Hosted: 50+
💰 Total Rewards Paid: 1,250 SOL
🗳️ DAO Proposals: 15
👥 Active Users: 2,500+
⚡ Avg Response Time: 200ms
```

---

<div align="center">

**[Get Started Now](introduction/quickstart.md)** | **[Join Discord](https://discord.gg/train2earn)** | **[View Demo](https://train2earn.io)**

Made with ❤️ by the Train2Earn Team

© 2025 Train2Earn. All rights reserved.

</div>
