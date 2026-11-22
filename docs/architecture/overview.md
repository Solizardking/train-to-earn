# Architecture Overview

## System Architecture

Train2Earn is built on a modern, decentralized architecture that leverages Solana blockchain, IPFS/Arweave for storage, and a React-based frontend.

### Technology Stack Decisions

**Why Solana?**

| Metric | Solana | Ethereum | Polygon | Arbitrum |
|--------|--------|----------|---------|----------|
| **TPS** | 65,000 | 15-30 | 7,000 | 4,000 |
| **Finality** | ~400ms | 12-15s | 2s | 1s |
| **Transaction Fee** | $0.00025 | $2-50 | $0.01 | $0.10 |
| **Smart Contracts** | Rust (Anchor) | Solidity | Solidity | Solidity |
| **AI Use Case Score** | 10/10 | 6/10 | 8/10 | 7/10 |

Solana's 400ms finality and $0.00025 fees enable **real-time AI micropayments** (0.001-0.01 SOL per inference), which would be economically unviable on other chains.

**Why React 18 + Vite?**

- Massive ecosystem with mature Web3 libraries
- @solana/wallet-adapter-react official support
- Vite's fast HMR for rapid development
- Component reusability and testing infrastructure

**Dual Storage Strategy**:

- **IPFS**: Development models, mutable content, free hosting
- **Arweave**: Production models, permanent storage (~$0.01/MB one-time)

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│ │  Dashboard │ │ AI Models  │ │ DAO Voting │ │ Arweave Upload   │  │
│ │  Component │ │  Registry  │ │  Interface │ │    Component     │  │
│ └────────────┘ └────────────┘ └────────────┘ └──────────────────┘  │
│                         React 18 + Vite 6                             │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                             │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  Wallet Adapters (Phantom, Solflare)                             │ │
│ │  @solana/wallet-adapter-react                                    │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │  Utility Modules                                                  │ │
│ │  • modelLoader.js    • arweaveStorage.js                         │ │
│ │  • payment.js        • computeMarketplace.js                     │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   BACKEND API    │  │   STORAGE LAYER  │  │   BLOCKCHAIN LAYER   │
│                  │  │                  │  │                      │
│  Express.js      │  │  ┌───────────┐  │  │  ┌────────────────┐ │
│  Port: 5001      │  │  │   IPFS    │  │  │  │    Solana      │ │
│                  │  │  │ (Mutable) │  │  │  │  Mainnet-Beta  │ │
│  Endpoints:      │  │  └───────────┘  │  │  │                │ │
│  • /api/assets   │  │  ┌───────────┐  │  │  │ Programs:      │ │
│  • /api/ai       │  │  │  Arweave  │  │  │  │ • Model Mgmt   │ │
│  • /api/rewards  │  │  │(Permanent)│  │  │  │ • DAO Voting   │ │
│  • /api/compute  │  │  └───────────┘  │  │  │ • Payments     │ │
└──────────────────┘  └──────────────────┘  └──────────────────────┘
           │                      │                      │
           └──────────────────────┴──────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES LAYER                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐│
│  │  Helius    │  │ OpenRouter │  │   Akash    │  │     Golem      ││
│  │    DAS     │  │     AI     │  │  Network   │  │    Network     ││
│  │  (Solana   │  │ (Inference)│  │ (Compute)  │  │   (Compute)    ││
│  │   Data)    │  │            │  │            │  │                ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend Layer

```
src/
├── components/              # React Components
│   ├── Dashboard.jsx       # Main container (284 lines)
│   │   ├── Header         # Logo + Wallet button
│   │   ├── Hero           # Welcome section
│   │   ├── Stats          # Assets/Tokens/SOL
│   │   └── Panels         # Rewards, Assets, AI
│   │
│   ├── WalletAssets.jsx   # Asset grid (228 lines)
│   │   ├── FilterBar      # All/NFTs/Tokens/Compressed
│   │   └── AssetCard[]    # Individual assets
│   │
│   ├── AIAnalysis.jsx     # AI insights (212 lines)
│   │   ├── AnalyzeButton  # Trigger analysis
│   │   └── ResultsPanel   # Display insights
│   │
│   ├── RewardsPanel.jsx   # Gamification (276 lines)
│   │   ├── TierBadges     # Diamond/Platinum/Gold
│   │   └── ProgressBar    # Milestone tracking
│   │
│   ├── DAOVoting.jsx      # Governance (340 lines)
│   │   ├── ProposalCard[] # Vote interface
│   │   └── VoteMeter      # Approval percentage
│   │
│   ├── AIModels.jsx       # Model registry (520 lines)
│   │   ├── SearchBar      # Filter models
│   │   ├── ModelCard[]    # Model display
│   │   └── LoadButton     # IPFS/Arweave loader
│   │
│   └── ArweaveUpload.jsx  # Upload UI (626 lines)
│       ├── WalletGen      # Create Arweave wallet
│       ├── FileUpload     # Select model file
│       ├── MetadataForm   # Fill details
│       └── ProgressBar    # Upload status
│
├── utils/                  # Core Logic
│   ├── modelLoader.js     # IPFS + Arweave loader (308 lines)
│   │   ├── loadDecentralizedModel()  # IPFS load
│   │   ├── loadModelFromArweave()    # Arweave load
│   │   ├── loadModel()               # Auto-detect
│   │   └── detectStorageType()       # CID vs TxId
│   │
│   ├── arweaveStorage.js  # Arweave SDK (687 lines)
│   │   ├── uploadModelToArweave()    # Upload with tags
│   │   ├── downloadModelFromArweave() # Download with progress
│   │   ├── queryModels()             # GraphQL search
│   │   └── verifyModelIntegrity()    # Byte verification
│   │
│   ├── payment.js         # SOL payments (280 lines)
│   │   ├── preparePaymentTransaction() # Create TX
│   │   ├── sendPaymentTransaction()    # Send TX
│   │   ├── verifyPaymentTransaction()  # Verify TX
│   │   └── PRICING{}                   # Price table
│   │
│   └── computeMarketplace.js # Compute (320 lines)
│       ├── requestTrainingJob()      # Request job
│       ├── fetchAkashMarketplace()   # Get Akash offers
│       ├── fetchGolemMarketplace()   # Get Golem offers
│       └── getJobStatus()            # Track progress
│
├── App.jsx                 # Root component
│   ├── ConnectionProvider  # Solana RPC
│   ├── WalletProvider     # Wallet adapters
│   └── WalletModalProvider # Wallet UI
│
└── main.jsx               # Entry point
    └── ReactDOM.render()
```

### Backend Layer

```
server/
└── index.js               # Express API (250 lines)
    ├── /api/health       # Health check
    ├── /api/assets/search # Helius DAS
    ├── /api/tokens/accounts # Token accounts
    ├── /api/nft/editions # NFT editions
    ├── /api/ai/analyze  # AI inference
    └── /api/rewards/calculate # Reward calc
```

## Data Flow Diagrams

### Model Upload Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Select Model File
     ▼
┌─────────────────────┐
│ ArweaveUpload.jsx   │
└─────────┬───────────┘
          │
          │ 2. Generate Arweave Wallet
          ▼
┌─────────────────────┐
│ arweaveStorage.js   │
│ generateArweaveWallet() │
└─────────┬───────────┘
          │
          │ 3. Fund Wallet (Manual)
          ▼
┌─────────────────────┐
│   User Action       │
│ Send AR to address  │
└─────────┬───────────┘
          │
          │ 4. Fill Metadata
          ▼
┌─────────────────────┐
│  Metadata Form      │
│ Name, Version, etc. │
└─────────┬───────────┘
          │
          │ 5. Upload Metadata
          ▼
┌─────────────────────┐
│ arweaveStorage.js   │
│ uploadMetadataToArweave() │
└─────────┬───────────┘
          │
          │ 6. Upload Model
          ▼
┌─────────────────────┐
│ arweaveStorage.js   │
│ uploadModelToArweave() │
└─────────┬───────────┘
          │
          │ 7. Create Transaction
          ▼
┌─────────────────────┐
│   Arweave Network   │
│  Create TX with tags│
└─────────┬───────────┘
          │
          │ 8. Wait for Confirmation
          ▼
┌─────────────────────┐
│   Transaction ID    │
│   (Permanent Link)  │
└─────────────────────┘
```

### Model Loading Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Enter Identifier (CID or TxId)
     ▼
┌─────────────────────┐
│   modelLoader.js    │
│   loadModel()       │
└─────────┬───────────┘
          │
          │ 2. Detect Storage Type
          ▼
┌─────────────────────┐
│ detectStorageType() │
│ Regex matching      │
└─────────┬───────────┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
  IPFS?    Arweave?
     │         │
     │         │ 3a. Load from IPFS
     │         ▼
     │    ┌─────────────────┐
     │    │ipfs-http-client │
     │    │  ipfs.cat(cid)  │
     │    └────────┬────────┘
     │             │
     │ 3b. Load from Arweave
     ▼             │
┌─────────────────┐│
│arweaveStorage.js││
│downloadModel()  ││
└────────┬────────┘│
         │         │
         └────┬────┘
              │
              │ 4. ZK Proof Verification (Optional)
              ▼
┌─────────────────────┐
│  Verify ZK Proof    │
│  snarkjs (future)   │
└─────────┬───────────┘
          │
          │ 5. Return Model Buffer
          ▼
┌─────────────────────┐
│   Model Metadata    │
│ { buffer, metadata }│
└─────────────────────┘
```

### Payment Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Request AI Inference
     ▼
┌─────────────────────┐
│   AIAnalysis.jsx    │
└─────────┬───────────┘
          │
          │ 2. Calculate Cost
          ▼
┌─────────────────────┐
│    payment.js       │
│ calculateInferenceCost() │
└─────────┬───────────┘
          │
          │ 3. Prepare Transaction
          ▼
┌─────────────────────┐
│    payment.js       │
│ preparePaymentTransaction() │
└─────────┬───────────┘
          │
          │ 4. User Signs with Wallet
          ▼
┌─────────────────────┐
│  Phantom/Solflare   │
│  Sign Transaction   │
└─────────┬───────────┘
          │
          │ 5. Send to Solana
          ▼
┌─────────────────────┐
│  Solana Blockchain  │
│ Transfer X lamports │
└─────────┬───────────┘
          │
          │ 6. Wait for Confirmation
          ▼
┌─────────────────────┐
│   Backend API       │
│ Verify signature    │
└─────────┬───────────┘
          │
          │ 7. Run AI Inference
          ▼
┌─────────────────────┐
│  OpenRouter API     │
│  LLama 3.3 Model    │
└─────────┬───────────┘
          │
          │ 8. Return Results
          ▼
┌─────────────────────┐
│   User Interface    │
│  Display insights   │
└─────────────────────┘
```

### DAO Voting Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. View Proposals
     ▼
┌─────────────────────┐
│   DAOVoting.jsx     │
│  Load proposals     │
└─────────┬───────────┘
          │
          │ 2. Select Proposal
          ▼
┌─────────────────────┐
│   ProposalCard      │
│  Show details       │
└─────────┬───────────┘
          │
          │ 3. Cast Vote (FOR/AGAINST)
          ▼
┌─────────────────────┐
│   DAOVoting.jsx     │
│   castVote()        │
└─────────┬───────────┘
          │
          │ 4. Create Vote Transaction
          ▼
┌─────────────────────┐
│  Solana DAO Program │
│  vote_instruction   │
└─────────┬───────────┘
          │
          │ 5. User Signs
          ▼
┌─────────────────────┐
│  Wallet Adapter     │
│  sendTransaction()  │
└─────────┬───────────┘
          │
          │ 6. Update On-Chain State
          ▼
┌─────────────────────┐
│  DAO Account Data   │
│  votesFor++         │
└─────────┬───────────┘
          │
          │ 7. Check if Passed (66%+)
          ▼
      ┌───┴───┐
      │       │
      ▼       ▼
    Yes?     No?
      │       │
      │       └─> Wait for more votes
      │
      │ 8. Execute Proposal
      ▼
┌─────────────────────┐
│ computeMarketplace.js│
│ requestTrainingJob() │
└─────────┬───────────┘
          │
          │ 9. Select Provider
          ▼
┌─────────────────────┐
│  Akash or Golem     │
│  Start training job │
└─────────┬───────────┘
          │
          │ 10. Upload New Model
          ▼
┌─────────────────────┐
│  Arweave/IPFS       │
│  New model version  │
└─────────────────────┘
```

## Technology Stack

### Frontend Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Framework** | React | 18.3.1 | UI components |
| **Build Tool** | Vite | 6.0.3 | Fast bundler |
| **Styling** | CSS | - | App UI and responsive layout |
| **Blockchain** | @solana/web3.js | 1.95.8 | Solana integration |
| **Wallet** | wallet-adapter | 0.15.35 | Multi-wallet support |
| **3D Graphics** | Three.js | Latest | Blockchain viz |
| **Icons** | React Icons | 5.4.0 | UI icons |

### Backend Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Framework** | Express.js | 4.21.2 | REST API |
| **HTTP Client** | Axios | 1.7.9 | External APIs |
| **Environment** | dotenv | 16.4.7 | Config management |
| **CORS** | cors | 2.8.5 | Cross-origin requests |

### Storage Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **IPFS** | ipfs-http-client | Mutable storage |
| **Arweave** | arweave SDK | Permanent storage |
| **Compression** | brotli-wasm | Model compression |

### Blockchain Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Smart Contracts** | Anchor (Rust) | Program development |
| **Zero-Knowledge** | snarkjs | ZK proofs |
| **NFTs** | @metaplex-foundation/js | Achievement badges |
| **Tokens** | @solana/spl-token | Token operations |

### External Services

| Service | Purpose | Cost |
|---------|---------|------|
| **Helius** | Solana RPC + DAS API | Free tier: 100K/month |
| **OpenRouter** | AI inference | Pay-per-use |
| **Akash** | Decentralized compute | ~$0.05/GPU/hour |
| **Golem** | Decentralized compute | ~$0.03/GPU/hour |

## Security Architecture

### Wallet Security
- ✅ Private keys never leave user's device
- ✅ Transactions signed client-side
- ✅ Read-only access for browsing
- ✅ Explicit approval required for transactions

### Payment Security
- ✅ All payments on-chain (Solana)
- ✅ Transaction verification required
- ✅ No custodial wallets
- ✅ Transparent pricing

### Data Security
- ✅ HTTPS for all API calls
- ✅ No sensitive data stored on backend
- ✅ CORS protection
- ✅ Rate limiting (planned)

### Smart Contract Security
- ⏳ Audit pending (Q2 2025)
- ✅ Open-source code
- ✅ Test coverage
- ✅ Formal verification (planned)

## Scalability

### Frontend Scalability
- **CDN**: Deploy to Vercel/Netlify
- **Lazy Loading**: Components load on demand
- **Code Splitting**: Separate bundles per route
- **Image Optimization**: WebP format, lazy images

### Backend Scalability
- **Horizontal Scaling**: Deploy multiple instances
- **Load Balancer**: NGINX/HAProxy
- **Caching**: Redis for frequent queries
- **Database**: PostgreSQL for metadata

### Blockchain Scalability
- **Solana**: 65,000 TPS
- **Parallel Processing**: Multiple transactions simultaneously
- **Compression**: State compression for NFTs
- **Batching**: Batch operations where possible

### Storage Scalability
- **IPFS**: Distributed across nodes
- **Arweave**: Unlimited permanent storage
- **CDN**: Cloudflare IPFS gateway
- **Sharding**: Data sharding (future)

## Monitoring & Observability

### Metrics
- API response times
- Transaction success rate
- Storage upload/download speeds
- User engagement metrics

### Logging
- Backend request and error logs
- Frontend errors (Sentry planned)
- Transaction logs on-chain
- Audit trail for DAO votes

### Alerting
- API downtime alerts
- Payment failure notifications
- Smart contract events
- Unusual activity detection

---

Next: [REST API Reference](../api/rest-api.md) →
