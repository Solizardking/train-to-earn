# Governance Token & Economic Model

## Overview

Train2Earn's economic model is designed to incentivize quality AI model contributions, fair governance participation, and sustainable platform growth.

### Current State: SOL-Native (Phase 1)

**Launch Strategy**: Start with native SOL payments to validate product-market fit before introducing governance token complexity.

**Benefits**:
- Immediate liquidity (SOL is globally traded)
- Simple UX (users already have SOL)
- No regulatory concerns
- Lower transaction fees (no token swaps)

### Future: CLAWD Governance Token (Phase 2)

**Timeline**: Q3 2025 (after platform proves PMF)

---

## Economic Model

### Revenue Distribution

Every AI inference payment is automatically split on-chain:

```
┌───────────────────────────────────────────────────┐
│          PAYMENT FLOW (Per Inference)             │
└───────────────────────────────────────────────────┘

User Payment: 0.001 - 0.01 SOL
         │
         ├──► 80% → Model Owner (0.0008 - 0.008 SOL)
         │
         ├──► 15% → Platform Treasury (0.00015 - 0.0015 SOL)
         │
         └──► 5% → Validators (0.00005 - 0.0005 SOL)
```

### Example Calculations

**Sentiment Analysis (0.001 SOL per request)**:

| Stakeholder | Per Request | Per 1K Requests | Per 1M Requests |
|-------------|-------------|-----------------|-----------------|
| **Model Owner** | 0.0008 SOL | 0.8 SOL ($136) | 800 SOL ($136K) |
| **Platform** | 0.00015 SOL | 0.15 SOL ($25.50) | 150 SOL ($25.5K) |
| **Validators** | 0.00005 SOL | 0.05 SOL ($8.50) | 50 SOL ($8.5K) |

*At $170/SOL*

**Text Generation (0.005 SOL per request)**:

| Stakeholder | Per Request | Per 1K Requests | Per 1M Requests |
|-------------|-------------|-----------------|-----------------|
| **Model Owner** | 0.004 SOL | 4 SOL ($680) | 4,000 SOL ($680K) |
| **Platform** | 0.00075 SOL | 0.75 SOL ($127.50) | 750 SOL ($127.5K) |
| **Validators** | 0.00025 SOL | 0.25 SOL ($42.50) | 250 SOL ($42.5K) |

### Revenue Projections

**Platform Revenue** (15% of all requests):

```javascript
// Conservative estimate: 1M requests/month
const avgPricePerRequest = 0.005; // SOL
const requestsPerMonth = 1_000_000;

const monthlyRevenue = requestsPerMonth * avgPricePerRequest * 0.15;
// = 1,000,000 × 0.005 × 0.15 = 750 SOL/month

// Annual
const annualRevenue = monthlyRevenue * 12;
// = 750 × 12 = 9,000 SOL/year = $1.53M @ $170/SOL
```

**Model Owner Earnings** (Popular model - 100K requests/month):

```javascript
const popularModelRequests = 100_000;
const pricePerRequest = 0.005; // Text generation

const monthlyEarnings = popularModelRequests * pricePerRequest * 0.80;
// = 100,000 × 0.005 × 0.80 = 400 SOL/month = $68,000/month

const annualEarnings = monthlyEarnings * 12;
// = 400 × 12 = 4,800 SOL/year = $816,000/year
```

**Validator Earnings** (100 verifications/day):

```javascript
const verificationsPerDay = 100;
const baseReward = 0.00005; // 5% of 0.001 SOL
const zkVerificationBonus = 0.0001; // Per ZK proof

const dailyEarnings = (verificationsPerDay * baseReward) +
                      (verificationsPerDay * zkVerificationBonus);
// = (100 × 0.00005) + (100 × 0.0001) = 0.015 SOL/day

const monthlyEarnings = dailyEarnings * 30;
// = 0.015 × 30 = 0.45 SOL/month = $76.50/month

const annualEarnings = monthlyEarnings * 12;
// = 0.45 × 12 = 5.4 SOL/year = $918/year
```

---

## Pricing Structure

### AI Inference Pricing

| Service | Cost/Request | Monthly (1K) | Annual (12K) | Use Case |
|---------|--------------|--------------|--------------|----------|
| **Sentiment Analysis** | 0.001 SOL | 1 SOL | 12 SOL | Quick sentiment check |
| **Text Generation** | 0.005 SOL | 5 SOL | 60 SOL | Content creation |
| **Image Classification** | 0.002 SOL | 2 SOL | 24 SOL | NFT analysis |
| **Code Generation** | 0.007 SOL | 7 SOL | 84 SOL | Smart contract dev |
| **Price Prediction** | 0.01 SOL | 10 SOL | 120 SOL | Trading signals |

### Dynamic Pricing Algorithm

```javascript
export class DynamicPricingService {
  calculatePrice(serviceType, complexity, priority) {
    const basePrice = this.baselineRates[serviceType];

    // Complexity multiplier
    const complexityMultiplier = {
      low: 0.7,    // Simple tasks
      medium: 1.0, // Standard
      high: 1.5    // Complex analysis
    }[complexity];

    // Priority multiplier
    const priorityMultiplier = {
      low: 0.8,     // Best effort (slower)
      normal: 1.0,  // Standard speed
      high: 1.3,    // Faster processing
      urgent: 2.0   // Immediate (jump queue)
    }[priority];

    // Demand surge pricing
    const demandMultiplier = this.getDemandMultiplier();
    // 1.0x (low demand) → 1.5x (high demand)

    // Network congestion
    const congestionMultiplier = this.getNetworkCongestion();
    // 1.0x (normal) → 1.3x (congested)

    const finalPrice = basePrice *
      complexityMultiplier *
      priorityMultiplier *
      demandMultiplier *
      congestionMultiplier;

    return Math.round(finalPrice * 1e9); // Convert to lamports
  }
}
```

**Example**:

```javascript
// High-priority text generation during surge
const price = pricingService.calculatePrice(
  'text_generation', // base: 0.005 SOL
  'high',            // complexity: 1.5x
  'high',            // priority: 1.3x
  // Assume demand: 1.2x, congestion: 1.0x
);

// 0.005 × 1.5 × 1.3 × 1.2 × 1.0 = 0.0117 SOL (~$2)
```

### Storage Costs

| Storage | Cost Structure | Duration | Best For | Break-Even |
|---------|---------------|----------|----------|------------|
| **IPFS** | Free upload + $5-20/month pinning | While pinned | Development, testing | N/A |
| **Arweave** | ~$0.01/MB one-time | 200+ years | Production models | 1-3 months |

**Cost Comparison (500MB model)**:

```
IPFS:
- Upload: Free
- Pinning: $10/month
- Year 1: $120
- Year 5: $600
- Year 10: $1,200

Arweave:
- Upload: $5 one-time
- Storage: Included (200+ years)
- Year 1: $5
- Year 5: $5
- Year 10: $5

Break-even: 6 months
```

---

## Future Governance Token (CLAWD)

### Token Design (Phase 2)

**Supply**: 1 Billion CLAWD tokens

**Distribution**:

```
┌────────────────────────────────────────────────┐
│           CLAWD TOKEN DISTRIBUTION               │
└────────────────────────────────────────────────┘

Total: 1,000,000,000 CLAWD

├─ 40% → Community Rewards (400M)
│  ├─ Model uploaders
│  ├─ Quality contributors
│  └─ Early adopters
│
├─ 25% → DAO Treasury (250M)
│  └─ Governance-controlled funds
│
├─ 20% → Team & Advisors (200M)
│  └─ 4-year vesting
│
├─ 10% → Investors (100M)
│  └─ 2-year vesting
│
└─ 5% → Liquidity Pools (50M)
   └─ DEX liquidity (Orca, Raydium)
```

### Vesting Schedule

```javascript
const vestingSchedule = {
  team: {
    total: 200_000_000, // CLAWD
    cliff: 12, // months
    duration: 48, // months
    monthlyRelease: 200_000_000 / 48
  },
  investors: {
    total: 100_000_000,
    cliff: 6,
    duration: 24,
    monthlyRelease: 100_000_000 / 24
  },
  community: {
    total: 400_000_000,
    cliff: 0,
    duration: 60, // 5 years
    monthlyRelease: 400_000_000 / 60
  }
};
```

### Utility & Use Cases

**1. Governance Voting**:

```javascript
// Voting power = tokens × staking multiplier
const stakingMultipliers = {
  '0-7 days': 1.0,
  '7-30 days': 1.2,
  '30-90 days': 1.5,
  '90+ days': 2.0
};

const votingPower = userT2EBalance * stakingMultiplier;

// Example
const user = {
  tokens: 10_000,
  stakingDays: 45,
  votingPower: 10_000 * 1.5 // = 15,000 votes
};
```

**2. Platform Fee Discounts**:

```javascript
// Stake CLAWD to get discounts on inference fees
const discountTiers = {
  0: 0,           // 0% discount
  1_000: 0.05,    // 5% discount
  10_000: 0.10,   // 10% discount
  100_000: 0.15,  // 15% discount
  1_000_000: 0.20 // 20% discount (max)
};

// Example: User with 50K CLAWD
const discount = 0.10; // 10% off
const basePrice = 0.005; // SOL
const finalPrice = basePrice * (1 - discount); // 0.0045 SOL
```

**3. Premium Features Access**:

- Priority inference queue (stake 10K+ CLAWD)
- Advanced analytics dashboard (5K+ CLAWD)
- API rate limit increase (1K+ CLAWD)
- Early access to new models (stake any amount)

**4. Revenue Sharing**:

```javascript
// CLAWD stakers receive share of platform revenue
const monthlyPlatformRevenue = 750; // SOL
const revenueSharePool = monthlyPlatformRevenue * 0.30; // 30% to stakers

// User's share = (user stake / total staked) × pool
const userShare = (userStake / totalStaked) * revenueSharePool;

// Example: User stakes 100K CLAWD (1% of total 10M staked)
const userMonthlyRevenue = 0.01 * revenueSharePool;
// = 0.01 × 225 SOL = 2.25 SOL/month = $382.50/month
```

### Token Economics

**Deflationary Mechanisms**:

```javascript
// Burn tokens to create scarcity
const burnSources = {
  platformFees: 0.10,      // 10% of 15% platform fee burned
  failedProposals: 0.50,   // 50% of proposal deposit burned
  slashing: 1.00           // 100% of slashed validator stake
};

// Example monthly burn
const monthlyPlatformFees = 750; // SOL worth of CLAWD
const burnAmount = monthlyPlatformFees * 0.10;
// = 75 SOL worth of CLAWD burned/month
```

**Staking Rewards**:

```javascript
// APY based on staking duration
const stakingAPY = {
  '7-30 days': 0.05,    // 5% APY
  '30-90 days': 0.10,   // 10% APY
  '90-180 days': 0.15,  // 15% APY
  '180+ days': 0.20     // 20% APY
};

// Example: Stake 100K CLAWD for 90 days
const annualReward = 100_000 * 0.10; // 10,000 CLAWD/year
const quarterlyReward = annualReward / 4; // 2,500 CLAWD
```

---

## Incentive Mechanisms

### Model Quality Incentives

**Tier System**:

```javascript
const modelTiers = {
  bronze: {
    minDownloads: 100,
    minRating: 3.0,
    revenueBonus: 1.0, // No bonus
    badge: 'Bronze Model'
  },
  silver: {
    minDownloads: 1_000,
    minRating: 4.0,
    revenueBonus: 1.1, // +10% revenue
    badge: 'Silver Model'
  },
  gold: {
    minDownloads: 10_000,
    minRating: 4.5,
    revenueBonus: 1.2, // +20% revenue
    badge: 'Gold Model'
  },
  platinum: {
    minDownloads: 100_000,
    minRating: 4.8,
    revenueBonus: 1.3, // +30% revenue
    badge: 'Platinum Model'
  }
};

// Example: Platinum model earning
const baseRevenue = 0.004; // SOL per request (80% of 0.005)
const platinumRevenue = baseRevenue * 1.3; // 0.0052 SOL (+30%)
```

### Early Adopter Rewards

**Retroactive Airdrop** (when CLAWD launches):

```javascript
const airdropAllocation = 50_000_000; // CLAWD (5% of supply)

const userScore =
  (modelsUploaded * 1000) +
  (totalDownloads * 10) +
  (proposalsCreated * 500) +
  (votesCase * 50) +
  (revenueEarned * 100); // in SOL

// User's airdrop = (user score / total score) × allocation
const userAirdrop = (userScore / totalScore) * airdropAllocation;

// Example: Power user
const powerUser = {
  modelsUploaded: 5,
  totalDownloads: 50_000,
  proposalsCreated: 10,
  votesCast: 100,
  revenueEarned: 100 // SOL
};

const score = (5 * 1000) + (50_000 * 10) + (10 * 500) + (100 * 50) + (100 * 100);
// = 5,000 + 500,000 + 5,000 + 5,000 + 10,000 = 525,000

// If total score = 100M, user gets:
const airdrop = (525_000 / 100_000_000) * 50_000_000;
// = 262,500 CLAWD (~0.026% of supply)
```

### Validator Incentives

**Slashing Conditions** (for misbehavior):

```javascript
const slashingRules = {
  falsePositive: {
    amount: 0.10, // 10% of stake
    reason: 'Approved invalid proof'
  },
  falseNegative: {
    amount: 0.05, // 5% of stake
    reason: 'Rejected valid proof'
  },
  downtime: {
    amount: 0.01, // 1% per day offline
    reason: 'Validator offline >24h'
  }
};

// Example: Validator stakes 10K CLAWD
// False positive → Lose 1K CLAWD, banned 30 days
// 3 strikes → Permanent ban
```

**Reputation System**:

```javascript
const validatorReputation = {
  score: 0, // Starts at 0
  maxScore: 1000,

  rewards: {
    correctVerification: +1,
    fastVerification: +0.5,
    uptime99: +10 // per day
  },

  penalties: {
    incorrectVerification: -10,
    slowVerification: -1,
    downtime: -5 // per hour
  }
};

// Top validators get bonus allocation
const topValidatorBonus = 1_000_000; // CLAWD/month
const validatorShare = (validatorScore / totalScore) * topValidatorBonus;
```

---

## Treasury Management

**DAO Treasury Usage**:

```javascript
const treasuryAllocation = {
  development: 0.30,      // 30% - Platform development
  marketing: 0.20,        // 20% - User acquisition
  grants: 0.25,           // 25% - Developer grants
  operations: 0.15,       // 15% - Infrastructure
  emergency: 0.10         // 10% - Emergency fund
};

// Example monthly budget (750 SOL revenue)
const treasuryFunds = 750 * 0.15; // Platform gets 15%
// = 112.5 SOL/month

const budgetBreakdown = {
  development: 112.5 * 0.30,  // 33.75 SOL
  marketing: 112.5 * 0.20,    // 22.50 SOL
  grants: 112.5 * 0.25,       // 28.12 SOL
  operations: 112.5 * 0.15,   // 16.88 SOL
  emergency: 112.5 * 0.10     // 11.25 SOL
};
```

**Grant Program**:

```javascript
const grantTiers = {
  small: {
    amount: 5, // SOL
    requirements: 'Research proposal, 1 month timeline'
  },
  medium: {
    amount: 25, // SOL
    requirements: 'Detailed roadmap, 3 month timeline'
  },
  large: {
    amount: 100, // SOL
    requirements: 'Comprehensive plan, 6 month timeline, milestones'
  }
};
```

---

## Economic Sustainability

### Break-Even Analysis

**Platform Costs** (Monthly):

```javascript
const monthlyCosts = {
  infrastructure: 50,    // SOL - Servers, databases
  development: 200,      // SOL - Team salaries (converted)
  marketing: 100,        // SOL - Ads, partnerships
  operations: 50,        // SOL - Support, admin
  total: 400            // SOL/month
};

// Revenue needed to break even
const breakEvenRequests = monthlyCosts.total / (0.005 * 0.15);
// = 400 / 0.00075 = 533,333 requests/month

// At 10 requests/user/month
const breakEvenUsers = 533_333 / 10;
// = 53,333 active users
```

### Growth Projections

**Conservative**:

```
Year 1:
- Users: 10,000
- Requests/month: 100,000
- Revenue: 75 SOL/month = $12,750/month
- Status: Pre-revenue, grant funded

Year 2:
- Users: 50,000
- Requests/month: 500,000
- Revenue: 375 SOL/month = $63,750/month
- Status: Break-even

Year 3:
- Users: 200,000
- Requests/month: 2,000,000
- Revenue: 1,500 SOL/month = $255,000/month
- Status: Profitable, token launch
```

---

**See Also**:
- [Platform Overview](../introduction/overview.md)
- [Architecture Overview](../architecture/overview.md)
- [Smart Contracts Overview](../smart-contracts/overview.md)
- [Payment System](../payment/overview.md)
- [Technical Specification](../technical-specification.md)

*Last Updated: 2025-10-16*
