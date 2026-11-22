# Smart Contracts Overview

## Anchor Framework on Solana

Train2Earn uses **Anchor** - a framework for Solana smart contract development that provides:

- Type-safe Rust with automatic serialization/deserialization
- Built-in security checks and account validation
- Simplified testing infrastructure
- Industry-standard patterns and best practices

### Why Anchor?

| Feature | Anchor | Native Rust | Score |
|---------|--------|-------------|-------|
| **Development Speed** | Fast (DSL) | Slow (manual) | ⭐⭐⭐⭐⭐ |
| **Type Safety** | Automatic | Manual | ⭐⭐⭐⭐⭐ |
| **Security Checks** | Built-in | Manual | ⭐⭐⭐⭐⭐ |
| **Testing** | Integrated | Manual setup | ⭐⭐⭐⭐⭐ |
| **Community** | Large | Smaller | ⭐⭐⭐⭐⭐ |

---

## Contract Architecture

Train2Earn consists of **3 core smart contracts**:

```
┌─────────────────────────────────────────────────────────────┐
│                    SMART CONTRACT LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ Model Registry │  │  DAO Voting    │  │   Oracle     │ │
│  │                │  │                │  │              │ │
│  │ • Register     │  │ • Proposals    │  │ • ZK Verify  │ │
│  │ • Update Stats │  │ • Vote         │  │ • Submit     │ │
│  │ • Deactivate   │  │ • Finalize     │  │   Proofs     │ │
│  │                │  │ • Execute      │  │              │ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Program IDs (Testnet)

```rust
// Model Registry
declare_id!("T2EModeLRegistryXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// DAO Voting
declare_id!("T2EDAOVOTINGXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

// Oracle
declare_id!("T2EORACLEZKPROOFXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
```

---

## Contract 1: Model Registry

### Purpose

Store AI model metadata on-chain with ownership tracking, download statistics, and revenue tracking.

### State Structure

```rust
#[account]
#[derive(InitSpace)]
pub struct Model {
    pub owner: Pubkey,           // 32 bytes - Model owner
    #[max_len(64)]
    pub model_cid: String,       // 4 + 64 bytes - IPFS/Arweave ID
    #[max_len(100)]
    pub model_name: String,      // 4 + 100 bytes - Human-readable name
    #[max_len(50)]
    pub model_type: String,      // 4 + 50 bytes - e.g., "text_generation"
    pub storage_type: StorageType, // 1 byte - IPFS or Arweave
    #[max_len(200)]
    pub metadata_uri: String,    // 4 + 200 bytes - Additional metadata
    pub created_at: i64,         // 8 bytes - Unix timestamp
    pub updated_at: i64,         // 8 bytes - Last update
    pub total_downloads: u64,    // 8 bytes - Download counter
    pub total_revenue: u64,      // 8 bytes - Lamports earned
    pub is_active: bool,         // 1 byte - Active status
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum StorageType {
    IPFS,
    Arweave,
}
```

### Instructions

#### 1. Register Model

```rust
pub fn register_model(
    ctx: Context<RegisterModel>,
    model_cid: String,
    model_name: String,
    model_type: String,
    storage_type: StorageType,
    metadata_uri: String,
) -> Result<()>
```

**Example Usage**:

```javascript
import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { ModelRegistry } from '../target/types/model_registry';

const program = anchor.workspace.ModelRegistry as Program<ModelRegistry>;

// Register a new model
const [modelPDA] = await PublicKey.findProgramAddress(
  [
    Buffer.from('model'),
    owner.publicKey.toBuffer(),
    Buffer.from('QmYourModelCID')
  ],
  program.programId
);

await program.methods
  .registerModel(
    'QmYourModelCID',
    'GPT-Solana Fine-tune',
    'text_generation',
    { ipfs: {} },
    'https://metadata.json'
  )
  .accounts({
    model: modelPDA,
    owner: owner.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([owner])
  .rpc();
```

#### 2. Update Model Stats

```rust
pub fn update_model_stats(
    ctx: Context<UpdateModelStats>,
    downloads: u64,
    revenue: u64,
) -> Result<()>
```

**Example Usage**:

```javascript
// Increment downloads and revenue after inference
await program.methods
  .updateModelStats(
    new anchor.BN(1), // +1 download
    new anchor.BN(1000000) // +0.001 SOL in lamports
  )
  .accounts({
    model: modelPDA,
    owner: owner.publicKey,
  })
  .signers([owner])
  .rpc();
```

#### 3. Deactivate Model

```rust
pub fn deactivate_model(
    ctx: Context<DeactivateModel>
) -> Result<()>
```

**Example Usage**:

```javascript
// Deactivate a model (soft delete)
await program.methods
  .deactivateModel()
  .accounts({
    model: modelPDA,
    owner: owner.publicKey,
  })
  .signers([owner])
  .rpc();
```

### Events

```rust
#[event]
pub struct ModelRegistered {
    pub model_pubkey: Pubkey,
    pub owner: Pubkey,
    pub model_cid: String,
    pub timestamp: i64,
}

#[event]
pub struct ModelDeactivated {
    pub model_pubkey: Pubkey,
    pub timestamp: i64,
}
```

**Listen to Events**:

```javascript
// Subscribe to model registration events
const listener = program.addEventListener('ModelRegistered', (event, slot) => {
  console.log('New model registered:', {
    model: event.modelPubkey.toString(),
    owner: event.owner.toString(),
    cid: event.modelCid,
    slot
  });
});

// Later: Clean up
program.removeEventListener(listener);
```

---

## Contract 2: DAO Voting

### Purpose

Enable decentralized governance through token-weighted voting on AI model improvements and training proposals.

### State Structure

```rust
#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub proposer: Pubkey,         // 32 bytes
    #[max_len(100)]
    pub title: String,            // 4 + 100 bytes
    #[max_len(500)]
    pub description: String,      // 4 + 500 bytes
    #[max_len(64)]
    pub model_cid: String,        // 4 + 64 bytes - Model to improve
    #[max_len(200)]
    pub training_params: String,  // 4 + 200 bytes - JSON params
    pub created_at: i64,          // 8 bytes
    pub voting_ends_at: i64,      // 8 bytes
    pub votes_for: u64,           // 8 bytes - Weighted votes FOR
    pub votes_against: u64,       // 8 bytes - Weighted votes AGAINST
    pub status: ProposalStatus,   // 1 byte
    pub executed: bool,           // 1 byte
}

#[account]
#[derive(InitSpace)]
pub struct VoteRecord {
    pub voter: Pubkey,       // 32 bytes
    pub proposal: Pubkey,    // 32 bytes
    pub vote: VoteChoice,    // 1 byte - For or Against
    pub weight: u64,         // 8 bytes - Token-weighted voting power
    pub timestamp: i64,      // 8 bytes
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum ProposalStatus {
    Active,
    Approved,
    Rejected,
    Executed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace, Copy)]
pub enum VoteChoice {
    For,
    Against,
}
```

### Instructions

#### 1. Create Proposal

```rust
pub fn create_proposal(
    ctx: Context<CreateProposal>,
    title: String,
    description: String,
    model_cid: String,
    training_params: String,
    voting_period: i64,
) -> Result<()>
```

**Example Usage**:

```javascript
// Create a new proposal
const [proposalPDA] = await PublicKey.findProgramAddress(
  [
    Buffer.from('proposal'),
    proposer.publicKey.toBuffer(),
    Buffer.from('Improve GPT accuracy')
  ],
  program.programId
);

await daoProgram.methods
  .createProposal(
    'Improve GPT accuracy',
    'Fine-tune on Solana-specific data to improve code generation accuracy',
    'QmExistingModelCID',
    JSON.stringify({
      epochs: 10,
      batch_size: 32,
      learning_rate: 0.001
    }),
    new anchor.BN(7 * 24 * 60 * 60) // 7 days in seconds
  )
  .accounts({
    proposal: proposalPDA,
    proposer: proposer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([proposer])
  .rpc();
```

#### 2. Cast Vote

```rust
pub fn cast_vote(
    ctx: Context<CastVote>,
    vote: VoteChoice,
    weight: u64,
) -> Result<()>
```

**Example Usage**:

```javascript
// Vote on a proposal (token-weighted)
const userTokenBalance = 1000; // User has 1000 governance tokens
const stakingMultiplier = 1.5; // 30-day staking bonus
const votingPower = userTokenBalance * stakingMultiplier; // 1500 votes

const [voteRecordPDA] = await PublicKey.findProgramAddress(
  [
    Buffer.from('vote'),
    proposalPDA.toBuffer(),
    voter.publicKey.toBuffer()
  ],
  program.programId
);

await daoProgram.methods
  .castVote(
    { for: {} }, // VoteChoice::For
    new anchor.BN(votingPower)
  )
  .accounts({
    proposal: proposalPDA,
    voteRecord: voteRecordPDA,
    voter: voter.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([voter])
  .rpc();
```

#### 3. Finalize Proposal

```rust
pub fn finalize_proposal(
    ctx: Context<FinalizeProposal>
) -> Result<()>
```

**Example Usage**:

```javascript
// Finalize voting after period ends
await daoProgram.methods
  .finalizeProposal()
  .accounts({
    proposal: proposalPDA,
  })
  .rpc();

// Fetch proposal to check status
const proposalAccount = await daoProgram.account.proposal.fetch(proposalPDA);

if (proposalAccount.status.approved) {
  console.log('Proposal APPROVED!');
  console.log(`Votes FOR: ${proposalAccount.votesFor}`);
  console.log(`Votes AGAINST: ${proposalAccount.votesAgainst}`);
} else {
  console.log('Proposal REJECTED');
}
```

#### 4. Execute Proposal

```rust
pub fn execute_proposal(
    ctx: Context<ExecuteProposal>
) -> Result<()>
```

**Example Usage**:

```javascript
// Execute approved proposal (triggers training job)
await daoProgram.methods
  .executeProposal()
  .accounts({
    proposal: proposalPDA,
    executor: executor.publicKey,
  })
  .signers([executor])
  .rpc();

// Off-chain oracle picks up ProposalExecuted event
// and starts training job on Akash/Golem
```

### Voting Rules

**Approval Threshold**: 60% of votes must be FOR

```rust
// Calculate approval percentage
let total_votes = proposal.votes_for + proposal.votes_against;
let approval_percentage = (proposal.votes_for * 100) / total_votes;

if approval_percentage >= 60 {
    proposal.status = ProposalStatus::Approved;
} else {
    proposal.status = ProposalStatus::Rejected;
}
```

**Token-Weighted Voting**:

```javascript
// Voting power = tokens × staking multiplier
const stakingMultipliers = {
  '0-7 days': 1.0,
  '7-30 days': 1.2,
  '30-90 days': 1.5,
  '90+ days': 2.0
};

const votingPower = userTokens * stakingMultipliers[stakingPeriod];
```

---

## Contract 3: Oracle (ZK Proof Verification)

### Purpose

Verify zero-knowledge proofs of model integrity off-chain and record results on-chain for transparent verification.

### State Structure

```rust
#[account]
#[derive(InitSpace)]
pub struct Oracle {
    pub authority: Pubkey,         // 32 bytes - Oracle authority
    pub total_verifications: u64,  // 8 bytes - Total proofs verified
}

#[account]
#[derive(InitSpace)]
pub struct ProofVerification {
    #[max_len(64)]
    pub model_cid: String,     // 4 + 64 bytes - Model identifier
    pub proof_hash: [u8; 32],  // 32 bytes - Hash of ZK proof
    pub is_valid: bool,        // 1 byte - Verification result
    pub verified_at: i64,      // 8 bytes - Timestamp
    pub verifier: Pubkey,      // 32 bytes - Who verified
}
```

### Instructions

#### 1. Initialize Oracle

```rust
pub fn initialize_oracle(
    ctx: Context<InitializeOracle>,
    authority: Pubkey,
) -> Result<()>
```

**Example Usage**:

```javascript
// Initialize oracle (one-time setup)
const [oraclePDA] = await PublicKey.findProgramAddress(
  [Buffer.from('oracle')],
  program.programId
);

await oracleProgram.methods
  .initializeOracle(authority.publicKey)
  .accounts({
    oracle: oraclePDA,
    payer: payer.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([payer])
  .rpc();
```

#### 2. Submit Proof Verification

```rust
pub fn submit_proof_verification(
    ctx: Context<SubmitProofVerification>,
    model_cid: String,
    proof_hash: [u8; 32],
    is_valid: bool,
) -> Result<()>
```

**Example Usage**:

```javascript
import { keccak256 } from '@ethersproject/keccak256';

// Off-chain: Verify ZK proof using snarkjs
const zkProof = await loadProofFromIPFS(proofCid);
const isValid = await snarkjs.groth16.verify(vKey, publicSignals, zkProof);

// On-chain: Submit verification result
const proofHash = keccak256(JSON.stringify(zkProof));

const [verificationPDA] = await PublicKey.findProgramAddress(
  [
    Buffer.from('verification'),
    Buffer.from(modelCid),
    Buffer.from(proofHash)
  ],
  program.programId
);

await oracleProgram.methods
  .submitProofVerification(
    modelCid,
    Array.from(Buffer.from(proofHash.slice(2), 'hex')),
    isValid
  )
  .accounts({
    oracle: oraclePDA,
    verification: verificationPDA,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([authority])
  .rpc();
```

### Events

```rust
#[event]
pub struct ProofVerified {
    pub model_cid: String,
    pub proof_hash: [u8; 32],
    pub is_valid: bool,
    pub timestamp: i64,
}
```

**Listen to Verification Events**:

```javascript
// Monitor ZK proof verifications
oracleProgram.addEventListener('ProofVerified', (event, slot) => {
  console.log('Proof verified:', {
    model: event.modelCid,
    valid: event.isValid,
    timestamp: new Date(event.timestamp * 1000),
    slot
  });

  if (event.isValid) {
    // Trust this model - proof verified!
  } else {
    // Warning: Model integrity check failed
  }
});
```

---

## Security Considerations

### 1. Access Control

```rust
// Verify ownership before state changes
require!(
    model.owner == ctx.accounts.owner.key(),
    ErrorCode::Unauthorized
);
```

### 2. Overflow Protection

```rust
// Use checked math operations
model.total_revenue = model.total_revenue.checked_add(revenue)
    .ok_or(ErrorCode::MathOverflow)?;
```

### 3. Account Validation

```rust
// Anchor automatically validates:
// - Account ownership
// - Account data type
// - Signer requirements
#[account(mut, has_one = owner)]
pub model: Account<'info, Model>,
```

### 4. Reentrancy Protection

Anchor's account model prevents reentrancy by design - state changes happen atomically within a single transaction.

---

## Testing

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_model() {
        // Test model registration
        let result = register_model(
            ctx,
            "QmTestCID".to_string(),
            "Test Model".to_string(),
            "text_generation".to_string(),
            StorageType::IPFS,
            "https://metadata.uri".to_string()
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_voting_approval() {
        // Test proposal approval logic
        let mut proposal = Proposal {
            votes_for: 600,
            votes_against: 400,
            ..Default::default()
        };

        let total = proposal.votes_for + proposal.votes_against;
        let approval = (proposal.votes_for * 100) / total;

        assert_eq!(approval, 60); // Exactly 60% threshold
    }
}
```

### Integration Tests

```typescript
import * as anchor from '@project-serum/anchor';
import { expect } from 'chai';

describe('Model Registry', () => {
  it('should register and update model', async () => {
    // Register model
    await program.methods
      .registerModel('QmTestCID', 'Test', 'text_generation', { ipfs: {} }, 'uri')
      .rpc();

    // Fetch model
    const model = await program.account.model.fetch(modelPDA);
    expect(model.modelCid).to.equal('QmTestCID');
    expect(model.totalDownloads.toNumber()).to.equal(0);

    // Update stats
    await program.methods.updateModelStats(new BN(1), new BN(1000000)).rpc();

    // Verify update
    const updated = await program.account.model.fetch(modelPDA);
    expect(updated.totalDownloads.toNumber()).to.equal(1);
  });
});
```

---

## Deployment

### Build Contracts

```bash
# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor --tag v0.29.0 anchor-cli

# Build all programs
anchor build

# Get program IDs
anchor keys list
```

### Deploy to Devnet

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
npm run anchor:build
npm run anchor:deploy:devnet
solana program show A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92
```

### Deploy to Mainnet

```bash
solana config set --url https://api.mainnet-beta.solana.com
solana config set --keypair /path/to/mainnet-upgrade-authority.json
npm run check:registry
npm run anchor:build
npm run anchor:deploy:mainnet
solana program show A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92
```

Use the full [Solana mainnet deployment runbook](../solana-mainnet-deployment.md)
for toolchain setup, IDL publishing, and post-deploy checks.

---

## IDL (Interface Definition Language)

Anchor automatically generates IDL JSON for client integration:

```json
{
  "version": "0.1.0",
  "name": "model_registry",
  "instructions": [
    {
      "name": "registerModel",
      "accounts": [
        { "name": "model", "isMut": true, "isSigner": false },
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "modelCid", "type": "string" },
        { "name": "modelName", "type": "string" },
        { "name": "modelType", "type": "string" },
        { "name": "storageType", "type": { "defined": "StorageType" } },
        { "name": "metadataUri", "type": "string" }
      ]
    }
  ],
  "accounts": [
    {
      "name": "Model",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "publicKey" },
          { "name": "modelCid", "type": "string" },
          { "name": "modelName", "type": "string" }
        ]
      }
    }
  ]
}
```

**Use IDL in Frontend**:

```javascript
import idl from './idl/model_registry.json';
import { Program } from '@project-serum/anchor';

const program = new Program(idl, programId, provider);
```

---

**See Also**:
- [Model Registry Program](model-registry.md)
- [Architecture Overview](../architecture/overview.md)
- [DAO Token & Economics](../dao/token.md)
- [Technical Specification](../technical-specification.md)

*Last Updated: 2025-10-16*
