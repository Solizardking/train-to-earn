# Train2Earn — Decentralized AI Platform on Solana 🚀

> **Upload, Train, Govern, and Monetize AI Models on Solana Blockchain**
>
> *"The model is the wallet. The wallet is the agent. The agent is sovereign."*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF)](https://solana.com)
[![Hugging Face](https://img.shields.io/badge/🤗_Hugging_Face-ordlibrary-FFD21E)](https://huggingface.co/ordlibrary)
[![Ollama](https://img.shields.io/badge/🦙_Ollama-0.31.1-000000)](https://ollama.com)
[![Vercel](https://img.shields.io/badge/▲_Vercel-Live-000000)](https://traintoearn.vercel.app)
[![Arweave](https://img.shields.io/badge/⛰️_Arweave-Permanent-14F195)](https://arweave.org)

<p align="center">
  <a href="#-documentation-hub"><strong>📚 Documentation Hub</strong></a> ·
  <a href="#-quick-start"><strong>⚡ Quick Start</strong></a> ·
  <a href="#-ai-models--datasets"><strong>🤖 Models</strong></a> ·
  <a href="#-platform-status"><strong>📊 Status</strong></a>
</p>

---

## 📚 Documentation Hub

This README is the central hub for all Train2Earn documentation. Use the table below to navigate to the specific guide you need.

### 🗂️ Documentation Map

| Category | Document | Description |
|----------|----------|-------------|
| **🎯 Overview** | [What is Train2Earn?](docs/introduction/overview.md) | Problem, solution, platform vision |
| | [Project Summary](PROJECT_SUMMARY.md) | Complete implementation summary |
| | [Integration Complete](INTEGRATION_COMPLETE.md) | What was built, statistics, next steps |
| | [Blueprint Integration](BLUEPRINT_INTEGRATION_COMPLETE.md) | Full platform blueprint documentation |
| **⚡ Getting Started** | [Quick Start Guide](QUICKSTART.md) | 5-minute setup and first steps |
| | [Quick Start (docs)](docs/introduction/quickstart.md) | Detailed installation guide |
| | [Install Script](install.sh) | One-command setup |
| **🏗️ Architecture** | [Architecture Overview](docs/architecture/overview.md) | System design, diagrams, data flows (800+ lines) |
| | [Technical Specification](docs/technical-specification.md) | Full technical blueprint |
| | [Solana Mainnet Deployment](docs/solana-mainnet-deployment.md) | Deployment guide |
| **🔌 API** | [REST API Reference](docs/api/rest-api.md) | Complete endpoint documentation |
| | [Server](server/index.js) | Express.js backend implementation |
| **💰 Payment** | [Payment System](docs/payment/overview.md) | X402 protocol, pricing, revenue splits |
| | [SOL-Native Payments](src/utils/payment.js) | Payment utility module |
| **🔐 Smart Contracts** | [Smart Contracts Overview](docs/smart-contracts/overview.md) | 3 Anchor contracts (Rust) |
| | [Model Registry](docs/smart-contracts/model-registry.md) | On-chain model registry |
| | [Model Registry Program](programs/model-registry/) | Anchor program source |
| **🤖 AI Models** | [On-Chain AI for Beginners](docs/on-chain-ai/beginners-guide.md) | Getting started with on-chain AI |
| | [Solana Finance AI Templates](docs/on-chain-ai/solana-finance-templates.md) | Finance model templates |
| | [Vision Model Guide](docs/on-chain-ai/vision-guide.md) | Vision AI integration |
| | [Chart Vision Guide](docs/on-chain-ai/chart-vision-guide.md) | Chart analysis models |
| | [Nemotron Jetson Serve](docs/on-chain-ai/nemotron-jetson-serve.md) | NVIDIA Nemotron on Jetson |
| | [Solana CLAWD LoRA Output](docs/on-chain-ai/solana-clawd-lora.md) | LoRA fine-tuning output |
| | [PiedPiper Integration](docs/on-chain-ai/piedpiper-integration.md) | PiedPiper toolkit |
| | [Phoenix Vulcan Guide](docs/on-chain-ai/phoenix-vulcan-guide.md) | Phoenix perps integration |
| **🗳️ DAO & Token** | [DAO Token Economics](docs/dao/token.md) | Tokenomics, revenue distribution, vesting |
| | [DAO Governance](src/components/DAOVoting.jsx) | Voting component |
| **⛰️ Storage** | [Arweave Integration Complete](ARWEAVE_INTEGRATION_COMPLETE.md) | Permanent storage docs (623 lines) |
| | [Arweave Storage Utility](src/utils/arweaveStorage.js) | Arweave SDK integration |
| | [Model Loader](src/utils/modelLoader.js) | IPFS + Arweave universal loader |
| **📊 Integration Status** | [On-Chain AI Progress](ON_CHAIN_AI_INTEGRATION_PROGRESS.md) | Integration tracker (40% complete) |
| | [Complete Documentation Guide](COMPLETE_DOCUMENTATION_GUIDE.md) | Master doc index (503 lines) |
| **📋 GitBook** | [Docs Home](docs/README.md) | GitBook docs home (917 lines) |
| | [Summary/TOC](docs/SUMMARY.md) | Full table of contents |
| **🧪 Testing** | [Model Registry Tests](test/modelRegistry.test.mjs) | Registry test suite |
| | [Consensus Training Tests](test/consensusTraining.test.mjs) | Training test suite |
| | [PiedPiper Toolkit Tests](test/piedPiperToolkit.test.mjs) | Toolkit test suite |
| | [Provider Attestations Tests](test/providerAttestations.test.mjs) | Attestation tests |
| | [Solana RPC Proxy Tests](test/solanaRpcProxy.test.mjs) | RPC proxy tests |
| | [Registry Readiness Tests](test/registryReadiness.test.mjs) | Readiness checks |
| | [Smoke Test](scripts/smoke-rpc.mjs) | RPC smoke test |
| **⚙️ Config** | [Server Config](server/index.js) | Backend server setup |
| | [Vite Config](vite.config.js) | Frontend build config |
| | [Vercel Config](vercel.json) | Deployment config |
| | [Anchor Config](Anchor.toml) | Solana program config |

---

## 🎯 What is Train2Earn?

**Train2Earn** is a decentralized AI platform on Solana enabling sovereign on-chain AI agents. We publish wallet-bearing LLMs, fine-tuned Solana trading models, and training datasets on Hugging Face.

### Core Capabilities

| Capability | Description | Status |
|-----------|-------------|--------|
| 🦦 **Clawd Trading Wallet** | First LLM with encrypted BIP39 wallet key derivation | ✅ Live |
| ⛓️ **Onchain Constitution** | 20-article runtime doctrine for sovereign AI agents | ✅ Published |
| 🤖 **HF Models** | 7 models under `ordlibrary/` — GGUF, LoRA, system-prompt | ✅ Published |
| 📊 **Training Datasets** | 6 datasets under `solanaclawd/` — 120K+ examples | ✅ Published |
| ⚡ **Ollama Mesh Router** | Local-first inference with auto-fallback (21 models) | ✅ v0.31.1 |
| 🎨 **Frontend** | Live at [traintoearn.vercel.app](https://traintoearn.vercel.app) | ✅ Live |
| 🗳️ **DAO Governance** | Token-weighted voting on AI proposals | ✅ Beta |
| ⛰️ **Arweave Storage** | Permanent model storage (200+ years) | ✅ Live |
| 💰 **SOL Payments** | Native SOL micropayments for AI inference | ✅ Live |
| 🔧 **Compute Marketplace** | Akash/Golem decentralized training | 🔧 In Progress |
| 📱 **Mobile App** | Cross-platform mobile experience | 📋 Planned |

---

## 🔥 Historic Milestone: The First Wallet-Bearing LLM

**`ordlibrary/clawd-trading-wallet`** is a Qwen2.5-1.5B model that **carries its own encrypted Solana wallet**:

- Generates BIP39 seeds and derives Ed25519 keypairs internally
- Holds the encrypted private key in session state — never exposed as text
- Executes trades via natural language: "buy 100 SOL", "short ETH 5x", "create a wallet"
- Signs messages without leaking the key
- Keys are destroyed when the conversation ends

```bash
# Pull and run — it carries its own wallet
ollama run hf.co/ordlibrary/clawd-trading-wallet
```

```
> create a wallet
Wallet: GXm3...9qK2 | Paper mode: yes
> buy 100 SOL
Swap quote: 100 SOL → ~18,420 USDC via Jupiter Route #3
Execute? (y/N):
```

---

## ⚡ Quick Start

### One Command — Run an AI Model

```bash
# Run the wallet-bearing trading LLM
ollama run hf.co/ordlibrary/clawd-trading-wallet

# Or run any of our models:
ollama run hf.co/ordlibrary/hauhau-qwen36-onchain        # Onchain Constitution
ollama run hf.co/ordlibrary/hauhau-qwen36-uncensored     # Uncensored aggressive
ollama run hf.co/ordlibrary/core-ai-clawd-1.5b           # Core Clawd agent
```

Or run Hau Hau directly from this repo (llama-cpp-python, config in
`configs/hauhau_qwen36_llama_cpp.yaml`, guide in `docs/hauhau_qwen36.md`):

```bash
python3 scripts/hauhau_qwen36_llama_cpp.py --no-image --constitution-mode minimal
```

### Install the Platform

```bash
git clone https://github.com/Solizardking/traintoearn.git
cd traintoearn
npm install
npm run dev
```

Then open `http://localhost:3000` and connect your Solana wallet.

### Quick Setup Script

```bash
# One-command install
chmod +x install.sh && ./install.sh
```

### RPC Smoke Test

```bash
npm run smoke:rpc              # checks the running backend proxy
npm run smoke:rpc -- --direct  # checks the configured upstream RPC
```

➡️ **Detailed guide:** [QUICKSTART.md](QUICKSTART.md) | [Installation docs](docs/introduction/quickstart.md)

---

## 🤖 AI Models & Datasets

### 🏆 Model Registry (Ranked)

| Rank | Model | Type | Size | What It Does | Pull Command |
|------|-------|------|------|-------------|-------------|
| ⭐**0** | **ordlibrary/clawd-trading-wallet** | System Prompt | 986 MB | Wallet-bearing trading LLM — encrypted BIP39 keys, natural language trading | `ollama run hf.co/ordlibrary/clawd-trading-wallet` |
| 1 | ordlibrary/hauhau-qwen36-onchain | GGUF IQ2_M | 11 GB | Onchain Constitution (20 articles) | `ollama run hf.co/ordlibrary/hauhau-qwen36-onchain` |
| 2 | ordlibrary/hauhau-qwen36-uncensored | GGUF IQ2_M | 11 GB | Uncensored, no constitution | `ollama run hf.co/ordlibrary/hauhau-qwen36-uncensored` |
| 3 | ordlibrary/core-ai-clawd-1.5b | GGUF Q4_K_M | 986 MB | Core Clawd agent (latest + finetuned) | `ollama run hf.co/ordlibrary/core-ai-clawd-1.5b` |
| 4 | solanaclawd/solana-clawd-core-ai-1.5b-lora | LoRA | ~9M | Solana/DeFi adapter | — |
| 5 | solanaclawd/solana-nvidia-trading-factory-8b-lora | LoRA | — | NVIDIA trading LoRA | — |
| 6 | solanaclawd/clawd-fable | Full | — | Fable fine-tune | — |

[View on Hugging Face →](https://huggingface.co/ordlibrary) | [View on Frontend →](https://traintoearn.vercel.app/models)

### 📦 Training Datasets

| Dataset | Examples | Domain | Link |
|---------|----------|--------|------|
| **Fable 5 Traces** | ~15,000 | Multi-turn agent interaction traces | [Glint-Research/Fable-5-traces](https://huggingface.co/datasets/Glint-Research/Fable-5-traces) |
| Solana Clawd Core AI Instruct | 35,173 | Solana, DeFi, ZK, Agent Architecture | [solanaclawd/solana-clawd-core-ai-instruct](https://huggingface.co/datasets/solanaclawd/solana-clawd-core-ai-instruct) |
| Realtime Research Instruct | 29,058 | PDFs, notebooks, parquet QA | [solanaclawd/solana-clawd-realtime-research-instruct](https://huggingface.co/datasets/solanaclawd/solana-clawd-realtime-research-instruct) |
| TX Foundation CPT | 19,542 | Solana mainnet transactions | [solanaclawd/solana-tx-foundation-cpt](https://huggingface.co/datasets/solanaclawd/solana-tx-foundation-cpt) |
| NVIDIA Trading Factory | 142 | Perps, cuML, Mean-CVaR | [solanaclawd/solana-clawd-nvidia-trading-factory-instruct](https://huggingface.co/datasets/solanaclawd/solana-clawd-nvidia-trading-factory-instruct) |
| TX Foundation Unified | 82,169 | Unified transaction dataset | [solanaclawd/solana-tx-foundation-unified](https://huggingface.co/datasets/solanaclawd/solana-tx-foundation-unified) |

### 🦙 Local Ollama Models (21 total)

```
ordlibrary/clawd-trading-wallet          986 MB  Wallet-bearing trading LLM
ordlibrary/core-ai-clawd-1.5b:latest     986 MB  Core Clawd agent
ordlibrary/core-ai-clawd-1.5b:finetuned  4.9 GB  Trading Factory version
hf.co/ordlibrary/hauhau-qwen36-onchain   11 GB   Onchain Constitution
hf.co/ordlibrary/hauhau-qwen36-uncensored 11 GB  Uncensored
8bit/solana-clawd-core-ai:latest         986 MB  Qwen2.5-1.5B
8bit/solana-trading-factory:latest       4.9 GB  Hermes-3-8B Trading
deepsol-clawd-code:latest                136 MB  DeepSolana-GPT2 code
nemotron3:33b                            27 GB   NVIDIA Nemotron
felcon/clawde-4.8-opus:latest            522 MB  Agent model
```

### Training Pipeline

```bash
# View training status
npm run training:status

# Run trading strategy plans
npm run training:strategy:plan
npm run training:strategy:vulcan

# Train on HF Jobs (A100)
cd training && ./scripts/launch_hf_jobs.sh a100-large

# Train locally (MPS)
python3 scripts/train_lora.py --num-epochs 1 --no-quant

# Register on-chain
./dao/register_model.sh --hf-model "YOUR_ORG/model" --eval-accuracy 0.60
```

---

## 🦦 Clawd Trading Wallet — How It Works

The wallet seed is **never stored as plaintext**:

1. On session start, the model generates a BIP39 mnemonic
2. The mnemonic is converted to a seed hash (SHA-256)
3. Only the hash exists in conversation context
4. Derivation path: `m/44'/501'/0'/0'/index`
5. The model outputs **only public keys**
6. The private key is **destroyed when the conversation ends**

### Natural Language Trading Commands

| You Say | The Model Does |
|---------|---------------|
| "buy 100 SOL" | Generates Jupiter swap quote, paper executes |
| "short ETH 5x" | Constructs Phoenix perp short with TP/SL |
| "create a wallet" | Derives deterministic session wallet, outputs pubkey |
| "what's my balance" | States balance or requests RPC |
| "check the spread" | Fetches orderbook, states bid/ask |
| "send 0.1 SOL to [addr]" | Builds transfer tx for confirmation |
| "sign this message" | Signs with session key |
| "show my portfolio" | Aggregates all derived wallet balances |

### Security Rules (immutable)

- NEVER output raw seed phrases, mnemonic words, or private keys
- NEVER sign a transaction without user confirmation
- All operations default to paper mode (no real funds)
- Session wallets are ephemeral — destroyed when conversation ends

---

## 🏛️ Onchain Constitution

The **Onchain Constitution** is a 20-article runtime doctrine for sovereign AI agents:

- **Inference by default. Dependency by choice. Verification over trust.**
- Free no-auth router as the default inference path
- Paid providers as optional upgrades, never core dependencies
- ZK privacy receipts on all router responses
- 10 core invariants for sovereignty

Full constitution at `docs/onchain_constitution.md` (665 lines), etched in `ordlibrary/hauhau-qwen36-onchain`.

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────────────────┐
                    │   Frontend (React + Vite)                │
                    │   traintoearn.vercel.app                 │
                    │   /models — public AI Model registry    │
                    └────────────────┬─────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────────┐
                    │   Hugging Face Hub                       │
                    │   ─────────────────────────────────     │
                    │   ordlibrary/    │  solanaclawd/         │
                    │   ├─ clawd-trading-wallet  │  datasets   │
                    │   ├─ hauhau-qwen36-*       │  (6 total)  │
                    │   ├─ core-ai-clawd-1.5b    │              │
                    └────────────────┬─────────────────────────┘
                                     │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│   Ollama Mesh   │    │   Solana Blockchain  │    │   Training Pipeline  │
│   0.31.1        │    │                      │    │   (training/)        │
│                 │    │   ┌──────────────┐   │    │                      │
│ • 21 models     │    │   │ Model PDA    │   │    │ • LoRA (r=16)       │
│ • Auto-fallback │    │   │ DAO Vote     │   │    │ • 21 configs        │
│ • zkrouter/auto │    │   │ Payments     │   │    │ • HF Jobs           │
│ • x402 premium  │    │   │ Attestations │   │    │ • NVIDIA Blueprints │
└─────────────────┘    └──────────────┘   │    │ • MPS (Mac)          │
                                            └──────────────────────┘
```

### Storage Architecture

```
                      ┌──────────────────────┐
                      │   Universal Loader    │
                      │   detectStorageType() │
                      └──────┬───────┬───────┘
                             │       │
                      ┌──────┘       └──────┐
                      ▼                     ▼
              ┌──────────────┐     ┌──────────────┐
              │    IPFS      │     │   Arweave    │
              │ Free/Pinned  │     │  $0.01/MB    │
              │ Active Dev   │     │ 200+ yrs     │
              │ CID: Qm...   │     │ TxId: 43chr  │
              └──────────────┘     └──────────────┘
```

➡️ **[Full Architecture →](docs/architecture/overview.md)** (800+ lines with diagrams)

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
| LLM Reasoning | 0.008 SOL | 8 SOL | 96 SOL |

### Revenue Distribution

```
User Payment: 0.001 - 0.01 SOL
├── Model Owner: 80% (0.0008 - 0.008 SOL)
├── Platform: 15% (0.00015 - 0.0015 SOL)
└── Validators: 5% (0.00005 - 0.0005 SOL)
```

### Storage Costs

| Storage | Cost | Duration | Best For |
|---------|------|----------|----------|
| **IPFS** | Free* | While pinned | Active development |
| **Arweave** | ~$0.01/MB | 200+ years | Production models |

*Requires pinning service

➡️ **[Payment System →](docs/payment/overview.md)** | **[X402 Protocol Details →](docs/payment/overview.md)**

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite 6, Tailwind CSS, Three.js |
| **Backend** | Node.js, Express.js, PostgreSQL |
| **Blockchain** | Solana, Anchor, @metaplex-foundation, @solana/web3.js |
| **AI Models** | Ollama 0.31.1 (21 models), llama.cpp, HF Transformers |
| **Training** | LoRA (PEFT), Unsloth, HF Jobs, MPS, 21 configs |
| **Storage** | IPFS, Arweave, Hugging Face Hub |
| **Inference** | Ollama Mesh, zkrouter/auto, OpenRouter (NVIDIA Nemotron) |
| **Compute** | Akash Network, Golem Network |
| **CI/CD** | Vercel, GitHub Actions |

➡️ **[Technical Specification →](docs/technical-specification.md)**

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check + CLAWD config |
| `/api/models/list` | GET | List registered models |
| `/api/models/identity/:asset` | GET | Model identity details |
| `/api/models/register-intent` | POST | Register model identity |
| `/api/models/registration-document` | POST | Submit registration doc |
| `/api/models/provider-attestations` | POST | Provider attestations |
| `/api/models/status` | POST | Model status check |
| `/api/ai/analyze` | POST | AI-powered wallet analysis |
| `/api/assets/search` | POST | Search wallet assets (Helius) |
| `/api/tokens/accounts` | POST | Get token accounts (Helius) |
| `/api/nft/editions` | POST | Get NFT editions (Helius) |
| `/api/rewards/calculate` | POST | Calculate training rewards |
| `/api/agents/catalog` | GET | Agent catalog |
| `/api/agents/config` | GET | CLAWD agent configuration |
| `/api/solana/rpc` | POST | Server-side Solana RPC proxy |

➡️ **[Full API Reference →](docs/api/rest-api.md)**

---

## 📦 Project Structure

```
traintoearn/
├── src/                              # Frontend Source (React)
│   ├── components/
│   │   ├── AIModels.jsx             # 11 verified artifacts (ranked 0-10)
│   │   ├── Dashboard.jsx            # Main dashboard + /models route
│   │   ├── TrainingPage.jsx         # Training UI
│   │   ├── DAOVoting.jsx            # Governance
│   │   ├── ArweaveUpload.jsx        # Permanent storage upload
│   │   ├── AIAnalysis.jsx           # AI insights
│   │   ├── RewardsPanel.jsx         # Rewards and tiers
│   │   ├── WalletAssets.jsx         # Asset display grid
│   │   ├── ConsensusTraining.jsx    # Consensus training
│   │   ├── SovereignNodePanel.jsx   # Sovereign node
│   │   ├── MusicPlayer.jsx          # Music player
│   │   └── ...
│   └── utils/
│       ├── modelLoader.js           # IPFS/Arweave universal loader
│       ├── arweaveStorage.js        # Arweave SDK integration
│       ├── payment.js               # SOL-native payment system
│       ├── computeMarketplace.js    # Akash/Golem marketplace
│       ├── modelRegistry.js         # Model registry client
│       ├── api.js                   # API client
│       └── ...
├── server/                          # Express.js Backend
│   ├── index.js                     # Main server (API endpoints)
│   ├── db.js                        # Database connection
│   ├── modelRegistryStore.js        # Model registry store
│   ├── phantomWallet.js             # Wallet integration
│   ├── sovereignNodeApi.js          # Sovereign node API
│   ├── trainingData.js              # Training data endpoints
│   └── src/                         # Server frontend components
├── training/                        # AI Training Framework
│   ├── configs/                     # 21 LoRA/CPT/eval configs
│   ├── data/                        # Datasets (JSONL, parquet, 120K+)
│   ├── dao/                         # Onchain registry + attestations
│   ├── docs/                        # Training documentation
│   ├── model-kit/                   # Terminal-first training surface
│   ├── nvidia/                      # NVIDIA blueprint implementations
│   ├── ollama/                      # 8+ Modelfile templates + GGUF builds
│   └── README.md                    # Training framework docs
├── docs/                            # Platform Documentation (80+ pages)
│   ├── README.md                    # Docs home (917 lines)
│   ├── SUMMARY.md                   # Full table of contents
│   ├── introduction/                # Overview & quickstart
│   ├── architecture/                # System architecture
│   ├── api/                         # REST API reference
│   ├── payment/                     # Payment system
│   ├── smart-contracts/             # Anchor contracts
│   ├── dao/                         # DAO & tokenomics
│   ├── on-chain-ai/                 # AI platform docs
│   └── model-registry/              # Model registry docs
├── programs/                        # Solana Smart Contracts
│   └── model-registry/              # Anchor program
│       ├── Cargo.toml               # Rust dependencies
│       └── src/                     # Contract source
├── scripts/                         # Utility Scripts
│   ├── check-docs.mjs               # Documentation checker
│   ├── check-registry-readiness.mjs # Registry readiness
│   ├── smoke-rpc.mjs                # RPC smoke test
│   └── serve-nemotron-jetson.sh     # Jetson serve script
├── test/                            # Test Suite (94 tests)
│   ├── modelRegistry.test.mjs       # Model registry tests
│   ├── consensusTraining.test.mjs   # Consensus training tests
│   ├── piedPiperToolkit.test.mjs    # Toolkit tests
│   └── ...
├── BUILDING_AN_AI_PROTOCOL/         # Legacy build docs
├── README.md                        # This file — central hub
├── QUICKSTART.md                    # Quick start guide
├── PROJECT_SUMMARY.md               # Implementation summary
├── ON_CHAIN_AI_INTEGRATION_PROGRESS.md  # Integration status
├── ARWEAVE_INTEGRATION_COMPLETE.md  # Arweave documentation
├── BLUEPRINT_INTEGRATION_COMPLETE.md # Blueprint documentation
├── COMPLETE_DOCUMENTATION_GUIDE.md  # Master documentation index
├── INTEGRATION_COMPLETE.md          # Integration summary
├── CONTRIBUTING.md                  # Contributing guide
├── SECURITY.md                      # Security policy
├── WORKSPACE_ORGANIZATION.md        # Workspace organization
├── LICENSE                          # MIT License
└── config files                     # package.json, vite.config.js, vercel.json, Anchor.toml
```

---

## 🗳️ DAO Governance

### How It Works

1. **Create Proposal** — Suggest model improvements (min 1 SOL stake)
2. **Community Votes** — Token-weighted voting (1 token = 1 vote)
3. **Execution** — 66%+ approval triggers training jobs
4. **Verification** — ZK proofs ensure model integrity

### Current Proposals

- ✅ Improve code generation accuracy (75% approval, 50 SOL budget)
- 🔄 Add multimodal AI support (63% approval, 100 SOL budget)
- ✅ Enhance text generation (85% approval, 75 SOL budget)
- 💡 Implement federated learning (45% approval, 150 SOL budget)

➡️ **[DAO Token Economics →](docs/dao/token.md)** | **[DAO Voting Component →](src/components/DAOVoting.jsx)**

---

## 🌐 On-Chain Registry (CAAP/1.0)

Three-layer model registration:

1. **Off-Chain Index** — `https://onchain.x402.wtf/api/register`
2. **On-chain PDA** — Solana Anchor program (devnet)
3. **ZK Attestations** — Light Protocol compressed (~0.00003 SOL)

```bash
curl https://onchain.x402.wtf/api/models?hf_id=ordlibrary/clawd-trading-wallet
```

---

## 📊 Platform Status

### Live ✅
- Frontend dashboard (traintoearn.vercel.app)
- Wallet integration (Phantom, Solflare, Backpack)
- Asset discovery (Helius DAS API)
- AI analysis (OpenRouter / NVIDIA Nemotron)
- Reward system (TRAIN token tiers)
- IPFS integration
- Arweave permanent storage
- SOL-native payments
- DAO voting (beta)
- Model registry
- Ollama mesh (21 models)

### In Development 🔄
- Smart contracts (Testnet)
- DAO execution
- Compute marketplace (Akash/Golem)
- NFT achievements

### Planned 📋
- ZK proofs (full snarkjs integration)
- Cross-chain support
- Mobile app
- Enterprise API
- T2E governance token (Q3 2025)

### Integration Progress

| Category | Progress |
|----------|----------|
| **Overall** | 75% |
| **Core Features** | 100% |
| **Documentation** | 90% |
| **Smart Contracts** | 40% |
| **Testing** | 60% |

### Platform Stats

```
🤖 Models on HF:           7 (4 GGUF, 2 LoRA, 1 full)
📦 Datasets:               6 (120K+ examples)
🦙 Local Ollama models:    21
🎨 Frontend:               traintoearn.vercel.app
⛓️ Registry:               onchain.x402.wtf
💎 $CLAWD:                 8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump
✅ Tests passing:          94/94
```

---

## 🔗 Quick Links

### For Users
- [Quick Start Guide](docs/introduction/quickstart.md)
- [Connect Your Wallet](docs/introduction/overview.md)
- [AI Analysis](src/components/AIAnalysis.jsx)
- [Browse Models](https://traintoearn.vercel.app/models)
- [DAO Voting](src/components/DAOVoting.jsx)

### For AI Researchers
- [Upload to Arweave](ARWEAVE_INTEGRATION_COMPLETE.md)
- [Model Management](docs/on-chain-ai/beginners-guide.md)
- [Training Pipeline](training/README.md)
- [Monetization](docs/dao/token.md)

### For Developers
- [Architecture Overview](docs/architecture/overview.md)
- [API Reference](docs/api/rest-api.md)
- [Technical Specification](docs/technical-specification.md)
- [Smart Contracts](docs/smart-contracts/overview.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Tests](test/)

### For DAO Members
- [Token Economics](docs/dao/token.md)
- [Governance Overview](docs/dao/token.md)
- [Proposal System](src/components/DAOVoting.jsx)

---

## 🔐 Security

- 📜 **Smart Contract Security**: Access control, overflow protection, account validation
- 🔑 **Wallet Security**: Keys never leave device, encrypted sessions, ephemeral wallets
- 💳 **Payment Security**: On-chain verification, signature uniqueness, timestamp validation
- 🛡️ **API Security**: Rate limiting, input validation, HTTPS enforcement, CORS

### Report Issues
Email: security@train2earn.io

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

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

---

## 📄 License

MIT License — see [LICENSE](LICENSE).

---

<div align="center">

**Made with ❤️ by the Train2Earn Team**

[Frontend](https://traintoearn.vercel.app/models) | [Hugging Face](https://huggingface.co/ordlibrary) | [GitHub](https://github.com/Solizardking/traintoearn) | [On-Chain Registry](https://onchain.x402.wtf) | [Fable Traces](https://huggingface.co/datasets/Glint-Research/Fable-5-traces) | [Docs](docs/README.md)

> "The model is the wallet. The wallet is the agent. The agent is sovereign."

</div>