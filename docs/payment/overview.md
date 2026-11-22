# Payment System Overview

## SOL-Native Payments

Train2Earn uses **native SOL payments** without custom tokens, enabling instant micropayments for AI inference.

### Why SOL-Native?

**Advantages**:
- No token launch complexity or regulatory concerns
- Immediate liquidity (SOL is traded globally)
- Lower fees (no token swap overhead)
- Simpler UX (users already have SOL)
- Direct integration with Solana ecosystem

**Comparison**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **SOL-Native** | Simple, liquid, low-cost | No tokenomics incentives | ✅ Best for MVP |
| Custom Token | Tokenomics, governance power | Complex, illiquid, regulatory | ❌ Future v2 |
| Stablecoin (USDC) | Price stability | Swap overhead, less native | ⚠️ Optional |

---

## X402 Payment Protocol

### HTTP 402 "Payment Required"

Train2Earn implements the **X402 protocol** - a standard for API-native payments using HTTP status code 402.

### How It Works

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Client    │         │  API Server │         │   Solana    │
│   (Wallet)  │         │  (Express)  │         │ Blockchain  │
└─────────────┘         └─────────────┘         └─────────────┘
       │                       │                       │
       │  1. GET /api/analyze  │                       │
       ├──────────────────────►│                       │
       │                       │                       │
       │  2. 402 Payment Req'd │                       │
       │     X-Payment-Address │                       │
       │     X-Payment-Amount  │                       │
       │◄──────────────────────┤                       │
       │                       │                       │
       │  3. Send SOL payment  │                       │
       ├───────────────────────┴──────────────────────►│
       │                                               │
       │  4. Transaction signature                     │
       │◄──────────────────────────────────────────────┤
       │                       │                       │
       │  5. GET /api/analyze  │                       │
       │     X-Payment-Sig: tx │                       │
       ├──────────────────────►│                       │
       │                       │                       │
       │                       │  6. Verify on-chain   │
       │                       ├──────────────────────►│
       │                       │◄──────────────────────┤
       │                       │  Confirmed ✓          │
       │                       │                       │
       │  7. 200 OK + Results  │                       │
       │◄──────────────────────┤                       │
```

### Step-by-Step Flow

**Step 1: Initial Request**
```javascript
// Client makes request without payment
const response = await fetch('https://api.train2earn.io/api/analyze', {
  method: 'POST',
  body: JSON.stringify({ wallet: 'user_wallet_address' })
});
```

**Step 2: Server Returns 402**
```javascript
// Server responds with payment requirement
HTTP/1.1 402 Payment Required
X-Payment-Address: GvMXMKhw3VHrHwc2Sw8fS2rqUJZ5Ej8jRXTzG9Y3pump
X-Payment-Amount: 0.001
X-Payment-Currency: SOL

{
  "error": "Payment Required",
  "paymentAddress": "GvMXMKhw3VHrHwc2Sw8fS2rqUJZ5Ej8jRXTzG9Y3pump",
  "amount": 0.001,
  "currency": "SOL",
  "message": "Please send 0.001 SOL to proceed"
}
```

**Step 3: Client Sends Payment**
```javascript
import { Connection, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

// Create payment transaction
const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: wallet.publicKey,
    toPubkey: new PublicKey('GvMXMKhw3VHrHwc2Sw8fS2rqUJZ5Ej8jRXTzG9Y3pump'),
    lamports: 0.001 * 1e9 // Convert SOL to lamports
  })
);

// Send transaction
const signature = await wallet.sendTransaction(transaction, connection);

// Wait for confirmation
await connection.confirmTransaction(signature, 'confirmed');
```

**Step 4: Retry with Payment Proof**
```javascript
// Retry original request with payment signature
const response = await fetch('https://api.train2earn.io/api/analyze', {
  method: 'POST',
  headers: {
    'X-Payment-Signature': signature
  },
  body: JSON.stringify({ wallet: 'user_wallet_address' })
});

// Server verifies payment and returns results
const data = await response.json(); // { analysis: {...}, insights: [...] }
```

---

## Server-Side Implementation

### Express.js Middleware

**File**: `/server/middleware/x402Payment.js`

```javascript
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const TREASURY_ADDRESS = process.env.VITE_TREASURY_ADDRESS;
const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;

// Pricing for different AI services
const SERVICE_PRICES = {
  '/api/analyze': 0.001 * LAMPORTS_PER_SOL,        // Sentiment analysis
  '/api/generate-text': 0.005 * LAMPORTS_PER_SOL,  // Text generation
  '/api/classify-image': 0.002 * LAMPORTS_PER_SOL, // Image classification
  '/api/predict-price': 0.01 * LAMPORTS_PER_SOL,   // Price prediction
  '/api/generate-code': 0.007 * LAMPORTS_PER_SOL,  // Code generation
};

export async function x402PaymentMiddleware(req, res, next) {
  const paymentSignature = req.headers['x-payment-signature'];
  const endpoint = req.path;
  const requiredAmount = SERVICE_PRICES[endpoint];

  if (!requiredAmount) {
    return next(); // Endpoint doesn't require payment
  }

  // No payment provided - send 402
  if (!paymentSignature) {
    return res.status(402).json({
      error: 'Payment Required',
      paymentAddress: TREASURY_ADDRESS,
      amount: requiredAmount / LAMPORTS_PER_SOL,
      currency: 'SOL',
      message: `Please send ${requiredAmount / LAMPORTS_PER_SOL} SOL to ${TREASURY_ADDRESS}`,
      headers: {
        'X-Payment-Address': TREASURY_ADDRESS,
        'X-Payment-Amount': (requiredAmount / LAMPORTS_PER_SOL).toString(),
        'X-Payment-Currency': 'SOL',
      }
    });
  }

  // Verify payment on Solana blockchain
  try {
    const connection = new Connection(HELIUS_RPC_URL, 'confirmed');
    const transaction = await connection.getTransaction(paymentSignature, {
      maxSupportedTransactionVersion: 0
    });

    if (!transaction) {
      return res.status(402).json({
        error: 'Payment not found',
        message: 'Transaction signature not found on blockchain'
      });
    }

    // Verify payment details
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
    const postBalance = transaction.meta.postBalances;
    const preBalance = transaction.meta.preBalances;
    const accountKeys = transaction.transaction.message.accountKeys;

    // Find treasury account index
    const treasuryIndex = accountKeys.findIndex(key =>
      key.equals(treasuryPubkey)
    );

    if (treasuryIndex === -1) {
      return res.status(402).json({
        error: 'Invalid payment',
        message: 'Payment not sent to correct address'
      });
    }

    // Calculate amount received
    const amountReceived = postBalance[treasuryIndex] - preBalance[treasuryIndex];

    if (amountReceived < requiredAmount) {
      return res.status(402).json({
        error: 'Insufficient payment',
        message: `Received ${amountReceived / LAMPORTS_PER_SOL} SOL, required ${requiredAmount / LAMPORTS_PER_SOL} SOL`
      });
    }

    // Payment verified - attach transaction info to request
    req.payment = {
      signature: paymentSignature,
      amount: amountReceived,
      sender: transaction.transaction.message.accountKeys[0].toString(),
      timestamp: transaction.blockTime
    };

    next();

  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      error: 'Payment verification failed',
      message: error.message
    });
  }
}
```

### Usage in Express Routes

```javascript
import express from 'express';
import { x402PaymentMiddleware } from './middleware/x402Payment.js';

const app = express();

// Apply middleware to protected endpoints
app.post('/api/analyze', x402PaymentMiddleware, async (req, res) => {
  // Payment verified - req.payment contains transaction details
  console.log('Payment received:', req.payment);

  // Perform AI analysis
  const analysis = await performAIAnalysis(req.body.wallet);

  res.json({
    success: true,
    analysis,
    payment: {
      signature: req.payment.signature,
      amount: req.payment.amount / 1e9,
      timestamp: req.payment.timestamp
    }
  });
});

// Apply to all paid endpoints
app.post('/api/generate-text', x402PaymentMiddleware, handleTextGeneration);
app.post('/api/classify-image', x402PaymentMiddleware, handleImageClassification);
app.post('/api/predict-price', x402PaymentMiddleware, handlePricePrediction);
app.post('/api/generate-code', x402PaymentMiddleware, handleCodeGeneration);
```

---

## Client-Side Autonomous Payment Agent

### Automatic Payment Handling

**File**: `/src/utils/autonomousPaymentAgent.js`

```javascript
import { Connection, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

export class AutonomousPaymentAgent {
  constructor(wallet, connection) {
    this.wallet = wallet;
    this.connection = connection;
    this.paymentCache = new Map(); // Cache verified payments
    this.maxAutoPayment = 0.1; // Default 0.1 SOL limit
  }

  /**
   * Automatically handles 402 responses and retries with payment
   */
  async fetch(url, options = {}) {
    try {
      // First attempt - no payment
      let response = await fetch(url, options);

      // If 402, handle payment automatically
      if (response.status === 402) {
        const paymentInfo = await response.json();

        // Check auto-payment limit
        if (paymentInfo.amount > this.maxAutoPayment) {
          throw new Error(`Payment amount ${paymentInfo.amount} SOL exceeds auto-payment limit ${this.maxAutoPayment} SOL`);
        }

        console.log(`[Payment Agent] Payment required: ${paymentInfo.amount} SOL`);

        // Send payment
        const signature = await this.sendPayment(
          paymentInfo.paymentAddress,
          paymentInfo.amount
        );

        console.log(`[Payment Agent] Payment sent: ${signature}`);

        // Wait for confirmation
        await this.connection.confirmTransaction(signature, 'confirmed');

        // Retry request with payment proof
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'X-Payment-Signature': signature
          }
        });
      }

      return response;

    } catch (error) {
      console.error('[Payment Agent] Error:', error);
      throw error;
    }
  }

  /**
   * Send SOL payment to specified address
   */
  async sendPayment(toAddress, amount) {
    if (!this.wallet.publicKey) {
      throw new Error('Wallet not connected');
    }

    const toPubkey = new PublicKey(toAddress);
    const lamports = amount * 1e9; // Convert SOL to lamports

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.wallet.publicKey,
        toPubkey,
        lamports
      })
    );

    const signature = await this.wallet.sendTransaction(transaction, this.connection);

    // Cache payment
    this.paymentCache.set(signature, {
      to: toAddress,
      amount,
      timestamp: Date.now()
    });

    return signature;
  }

  /**
   * Pre-authorize payments up to a certain amount
   */
  setPaymentLimit(maxAmountSOL) {
    this.maxAutoPayment = maxAmountSOL;
    console.log(`[Payment Agent] Auto-payment limit set to ${maxAmountSOL} SOL`);
  }

  /**
   * Get payment history
   */
  getPaymentHistory() {
    return Array.from(this.paymentCache.entries()).map(([signature, info]) => ({
      signature,
      ...info
    }));
  }

  /**
   * Clear payment cache
   */
  clearCache() {
    this.paymentCache.clear();
    console.log('[Payment Agent] Cache cleared');
  }
}

// Factory function
export function createPaymentAgent(wallet, connection, maxAutoPayment = 0.1) {
  const agent = new AutonomousPaymentAgent(wallet, connection);
  agent.setPaymentLimit(maxAutoPayment);
  return agent;
}
```

### Usage Example

```javascript
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { createPaymentAgent } from './utils/autonomousPaymentAgent';

function MyComponent() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const analyzeWallet = async () => {
    // Create payment agent
    const paymentAgent = createPaymentAgent(wallet, connection, 0.05); // Max 0.05 SOL

    // Use like normal fetch - automatically handles 402
    const response = await paymentAgent.fetch('https://api.train2earn.io/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: wallet.publicKey.toString() })
    });

    const data = await response.json();
    console.log('Analysis:', data.analysis);

    // View payment history
    console.log('Payments:', paymentAgent.getPaymentHistory());
  };

  return (
    <button onClick={analyzeWallet}>
      Analyze Wallet (Auto-pays if needed)
    </button>
  );
}
```

---

## Pricing Structure

### AI Inference Pricing (SOL)

| Service | Cost per Request | Monthly (1K) | Annual (12K) |
|---------|------------------|--------------|--------------|
| **Sentiment Analysis** | 0.001 SOL | 1 SOL | 12 SOL |
| **Text Generation** | 0.005 SOL | 5 SOL | 60 SOL |
| **Image Classification** | 0.002 SOL | 2 SOL | 24 SOL |
| **Code Generation** | 0.007 SOL | 7 SOL | 84 SOL |
| **Price Prediction** | 0.01 SOL | 10 SOL | 120 SOL |

*At $170/SOL: $0.17 - $1.70 per request*

### Dynamic Pricing

**Factors**:
- **Base price**: Service type complexity
- **Demand multiplier**: 0.8x - 2.0x based on request volume
- **Priority level**: Low (0.8x), Normal (1.0x), High (1.3x), Urgent (2.0x)
- **Network congestion**: 1.0x - 1.5x based on Solana fees

**Implementation**:

```javascript
export class DynamicPricingService {
  calculatePrice(serviceType, complexity = 'medium', priority = 'normal') {
    const basePrice = this.baselineRates[serviceType];

    const complexityMultiplier = {
      low: 0.7,
      medium: 1.0,
      high: 1.5
    }[complexity];

    const priorityMultiplier = {
      low: 0.8,
      normal: 1.0,
      high: 1.3,
      urgent: 2.0
    }[priority];

    const finalPrice = basePrice *
      complexityMultiplier *
      priorityMultiplier *
      this.demandMultiplier;

    return Math.round(finalPrice * 1e9); // Convert to lamports
  }
}
```

---

## Revenue Distribution

### Payment Split

Every AI inference payment is automatically split:

```
Total Payment: 0.001 - 0.01 SOL
├── Model Owner: 80% (0.0008 - 0.008 SOL)
├── Platform Treasury: 15% (0.00015 - 0.0015 SOL)
└── Validators: 5% (0.00005 - 0.0005 SOL)
```

### Example Earnings

**Model Owner** (Sentiment Analysis - 0.001 SOL/request):
```
Daily:   1,000 requests × 0.0008 SOL = 0.8 SOL    ($136/day @ $170/SOL)
Monthly: 30,000 requests × 0.0008 SOL = 24 SOL    ($4,080/month)
Annual:  365,000 requests × 0.0008 SOL = 292 SOL  ($49,640/year)
```

**Platform** (15% of all requests):
```
1M requests/month across all services (avg 0.005 SOL):
= 1,000,000 × 0.005 × 0.15 = 750 SOL/month ($127,500/month)
```

**Validators** (5% + ZK verification bonus):
```
Base: 100 verifications/day × 0.00005 SOL = 0.005 SOL/day
Bonus: 100 ZK verifications × 0.0001 SOL = 0.01 SOL/day
Total: 0.015 SOL/day = $2.55/day = $76.50/month
```

---

## Payment Security

### On-Chain Verification

**Always verify payments on-chain**:

```javascript
// NEVER trust client-provided payment info
// ALWAYS fetch from blockchain

const transaction = await connection.getTransaction(signature, {
  maxSupportedTransactionVersion: 0
});

if (!transaction) {
  throw new Error('Transaction not found');
}

// Verify amount, recipient, timestamp
const amountReceived = calculateAmountReceived(transaction);
const recipient = getRecipient(transaction);

if (recipient !== TREASURY_ADDRESS || amountReceived < requiredAmount) {
  throw new Error('Invalid payment');
}
```

### Anti-Fraud Measures

**1. Signature Uniqueness**:
```javascript
// Track used signatures to prevent replay attacks
const usedSignatures = new Set();

if (usedSignatures.has(paymentSignature)) {
  return res.status(402).json({ error: 'Payment already used' });
}

usedSignatures.add(paymentSignature);
```

**2. Timestamp Validation**:
```javascript
// Reject old transactions (>10 minutes)
const transactionAge = Date.now() - (transaction.blockTime * 1000);

if (transactionAge > 10 * 60 * 1000) {
  return res.status(402).json({ error: 'Payment expired' });
}
```

**3. Rate Limiting**:
```javascript
import rateLimit from 'express-rate-limit';

const paymentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 payments per minute per IP
  message: 'Too many payment attempts'
});

app.use('/api/', paymentLimiter);
```

---

## Transaction Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                    PAYMENT VERIFICATION FLOW                    │
└────────────────────────────────────────────────────────────────┘

[Client Request]
      │
      ▼
┌──────────────┐
│ Extract      │
│ X-Payment-   │
│ Signature    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     No      ┌──────────────┐
│ Signature    ├────────────►│ Return 402   │
│ Present?     │             │ Payment Req  │
└──────┬───────┘             └──────────────┘
       │ Yes
       ▼
┌──────────────┐
│ Fetch TX     │
│ from Solana  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     Not Found   ┌──────────────┐
│ Transaction  ├────────────────►│ Return 402   │
│ Exists?      │                 │ TX Not Found │
└──────┬───────┘                 └──────────────┘
       │ Found
       ▼
┌──────────────┐
│ Verify:      │
│ • Recipient  │
│ • Amount     │
│ • Timestamp  │
└──────┬───────┘
       │
       ├─────────► Invalid ──►┌──────────────┐
       │                      │ Return 402   │
       ▼ Valid                │ Invalid Pay  │
┌──────────────┐              └──────────────┘
│ Check        │
│ Signature    │
│ Not Reused   │
└──────┬───────┘
       │
       ├─────────► Reused ───►┌──────────────┐
       │                      │ Return 402   │
       ▼ Unique               │ Already Used │
┌──────────────┐              └──────────────┘
│ Mark Signature│
│ as Used      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Process      │
│ Request &    │
│ Return 200   │
└──────────────┘
```

---

## Testing Payment Flow

### Local Development

```bash
# 1. Get Devnet SOL
solana airdrop 1 <YOUR_WALLET_ADDRESS> --url devnet

# 2. Set environment to Devnet
export HELIUS_RPC_URL=https://api.devnet.solana.com

# 3. Test payment
curl -X POST http://localhost:5001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"wallet":"<WALLET_ADDRESS>"}'

# Should return 402 with payment details
```

### Integration Test

```javascript
import { describe, it, expect } from 'vitest';
import { Connection, Keypair, Transaction, SystemProgram } from '@solana/web3.js';

describe('X402 Payment Flow', () => {
  it('should complete full payment + inference flow', async () => {
    // 1. Request without payment -> 402
    const response1 = await fetch('http://localhost:5001/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ wallet: testWallet })
    });

    expect(response1.status).toBe(402);
    const paymentInfo = await response1.json();

    // 2. Send payment
    const payer = Keypair.generate();
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(paymentInfo.paymentAddress),
        lamports: paymentInfo.amount * 1e9
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);

    // 3. Retry with payment signature -> 200
    const response2 = await fetch('http://localhost:5001/api/analyze', {
      method: 'POST',
      headers: { 'X-Payment-Signature': signature },
      body: JSON.stringify({ wallet: testWallet })
    });

    expect(response2.status).toBe(200);
    const data = await response2.json();
    expect(data).toHaveProperty('analysis');
  });
});
```

---

## Future Enhancements

### 1. Subscription Model

**Monthly unlimited access for fixed SOL**:

```javascript
const subscriptions = {
  basic: { price: 5, // 5 SOL/month
           limits: { requests: 10000 }
  },
  pro: { price: 20, // 20 SOL/month
         limits: { requests: 100000 }
  },
  enterprise: { price: 100, // 100 SOL/month
                limits: { requests: Infinity }
  }
};
```

### 2. Payment Channels (State Channels)

**For high-frequency users**:

```
Open Channel → Make 1000 requests → Close Channel
(1 on-chain TX)   (off-chain)     (1 on-chain TX)

Instead of 1000 on-chain transactions
```

### 3. Multi-Token Support

**Accept USDC, USDT for price stability**:

```javascript
const acceptedTokens = {
  SOL: { address: null }, // Native SOL
  USDC: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  USDT: { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }
};
```

### 4. Governance Token Integration

**Future: CLAWD governance token for DAO voting**:

```javascript
const votingPower = userT2EBalance * stakingMultiplier;
```

---

**See Also**:
- [REST API Reference](../api/rest-api.md)
- [Architecture Overview](../architecture/overview.md)
- [DAO Token & Economics](../dao/token.md)
- [Technical Specification](../technical-specification.md)

*Last Updated: 2025-10-16*
