// src/utils/payment.js
// SOL-Native Payment System for AI Inference

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';

// Payment amounts in lamports (1 SOL = 1,000,000,000 lamports)
export const PRICING = {
  SENTIMENT_ANALYSIS: 0.001 * LAMPORTS_PER_SOL,    // 0.001 SOL (~$0.17)
  TEXT_GENERATION: 0.005 * LAMPORTS_PER_SOL,      // 0.005 SOL (~$0.85)
  IMAGE_CLASSIFICATION: 0.002 * LAMPORTS_PER_SOL,  // 0.002 SOL (~$0.34)
  PRICE_PREDICTION: 0.01 * LAMPORTS_PER_SOL,      // 0.01 SOL (~$1.70)
  DOCUMENT_ANALYSIS: 0.003 * LAMPORTS_PER_SOL,    // 0.003 SOL (~$0.51)
  CODE_GENERATION: 0.007 * LAMPORTS_PER_SOL,      // 0.007 SOL (~$1.19)
  CHAT_COMPLETION: 0.004 * LAMPORTS_PER_SOL,      // 0.004 SOL (~$0.68)
  LLM_REASONING: 0.008 * LAMPORTS_PER_SOL,         // 0.008 SOL per reasoning call
  CONSENSUS_LEARNING: 0.006 * LAMPORTS_PER_SOL,    // 0.006 SOL per consensus aggregation
  EMBEDDINGS: 0.0005 * LAMPORTS_PER_SOL,           // 0.0005 SOL per embedding batch
  AUDIO: 0.006 * LAMPORTS_PER_SOL,                 // 0.006 SOL per audio job
  MULTIMODAL: 0.012 * LAMPORTS_PER_SOL,            // 0.012 SOL per multimodal inference
  PIEDPIPER_PIPELINE: 0.004 * LAMPORTS_PER_SOL,     // 0.004 SOL per deterministic compression/automata run
};

// Validator rewards
export const VALIDATOR_REWARD = 0.01 * LAMPORTS_PER_SOL; // 0.01 SOL per validation
export const MIN_VALIDATOR_STAKE = 1 * LAMPORTS_PER_SOL; // 1 SOL minimum stake

// Treasury address — the project's designated $CLAWD treasury wallet.
// Set VITE_TREASURY_ADDRESS in the environment; the fallback is the real
// treasury, never a placeholder.
const TREASURY_ADDRESS = process.env.VITE_TREASURY_ADDRESS ||
  '6rEiHJ4JUTWcC4wCUosTbaoBmpjHvUGLAQcogUwADB4Z';

/**
 * Prepare a payment transaction for AI inference
 * @param {Connection} connection - Solana connection
 * @param {PublicKey} fromPubkey - Payer's public key
 * @param {string} modelType - Type of AI model (e.g., 'SENTIMENT_ANALYSIS')
 * @returns {Promise<{transaction: Transaction, reference: string}>}
 */
export async function preparePaymentTransaction(connection, fromPubkey, modelType) {
  try {
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
    const amount = PRICING[modelType] || PRICING.SENTIMENT_ANALYSIS;

    // Create reference for tracking
    const reference = `${modelType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create transfer instruction
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey: treasuryPubkey,
        lamports: amount,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = fromPubkey;

    // Add memo with reference (optional, requires memo program)
    // transaction.add(
    //   new TransactionInstruction({
    //     keys: [],
    //     data: Buffer.from(reference, 'utf-8'),
    //     programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
    //   })
    // );

    return {
      transaction,
      reference,
      amount: amount / LAMPORTS_PER_SOL,
      modelType
    };
  } catch (error) {
    console.error('Error preparing payment transaction:', error);
    throw error;
  }
}

/**
 * Send and confirm payment transaction
 * @param {Connection} connection - Solana connection
 * @param {Transaction} transaction - Signed transaction
 * @returns {Promise<string>} - Transaction signature
 */
export async function sendPaymentTransaction(connection, signedTransaction) {
  try {
    const signature = await connection.sendRawTransaction(
      signedTransaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      }
    );

    console.log('Payment transaction sent:', signature);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('Payment confirmed:', signature);
    return signature;
  } catch (error) {
    console.error('Error sending payment transaction:', error);
    throw error;
  }
}

/**
 * Verify payment transaction
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @param {PublicKey} expectedPayer - Expected payer address
 * @param {string} modelType - Expected model type
 * @returns {Promise<boolean>}
 */
export async function verifyPaymentTransaction(connection, signature, expectedPayer, modelType) {
  try {
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed'
    });

    if (!transaction) {
      console.error('Transaction not found:', signature);
      return false;
    }

    // Verify transaction succeeded
    if (transaction.meta?.err) {
      console.error('Transaction failed:', transaction.meta.err);
      return false;
    }

    // Verify payer
    const actualPayer = transaction.transaction.message.accountKeys[0].toString();
    if (actualPayer !== expectedPayer.toString()) {
      console.error('Payer mismatch:', { actual: actualPayer, expected: expectedPayer.toString() });
      return false;
    }

    // Verify treasury received payment
    const treasuryPubkey = new PublicKey(TREASURY_ADDRESS);
    const expectedAmount = PRICING[modelType] || PRICING.SENTIMENT_ANALYSIS;

    const treasuryPostBalance = transaction.meta?.postBalances[
      transaction.transaction.message.accountKeys.findIndex(
        key => key.equals(treasuryPubkey)
      )
    ];

    const treasuryPreBalance = transaction.meta?.preBalances[
      transaction.transaction.message.accountKeys.findIndex(
        key => key.equals(treasuryPubkey)
      )
    ];

    const actualTransfer = treasuryPostBalance - treasuryPreBalance;

    if (actualTransfer !== expectedAmount) {
      console.error('Amount mismatch:', { actual: actualTransfer, expected: expectedAmount });
      return false;
    }

    console.log('Payment verified successfully:', signature);
    return true;
  } catch (error) {
    console.error('Error verifying payment:', error);
    return false;
  }
}

/**
 * Get payment status
 * @param {Connection} connection - Solana connection
 * @param {string} signature - Transaction signature
 * @returns {Promise<{confirmed: boolean, error: string|null}>}
 */
export async function getPaymentStatus(connection, signature) {
  try {
    const status = await connection.getSignatureStatus(signature);

    if (!status || !status.value) {
      return { confirmed: false, error: 'Transaction not found' };
    }

    if (status.value.err) {
      return {
        confirmed: false,
        error: `Transaction failed: ${JSON.stringify(status.value.err)}`
      };
    }

    if (status.value.confirmationStatus === 'confirmed' ||
        status.value.confirmationStatus === 'finalized') {
      return { confirmed: true, error: null };
    }

    return { confirmed: false, error: null };
  } catch (error) {
    console.error('Error getting payment status:', error);
    return { confirmed: false, error: error.message };
  }
}

/**
 * Calculate cost for inference
 * @param {string} modelType - Type of AI model
 * @param {number} quantity - Number of inferences (default 1)
 * @returns {number} - Cost in SOL
 */
export function calculateInferenceCost(modelType, quantity = 1) {
  const lamports = (PRICING[modelType] || PRICING.SENTIMENT_ANALYSIS) * quantity;
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Format SOL amount for display
 * @param {number} lamports - Amount in lamports
 * @returns {string} - Formatted SOL string
 */
export function formatSOL(lamports) {
  const sol = lamports / LAMPORTS_PER_SOL;
  return `${sol.toFixed(4)} SOL`;
}

/**
 * Get pricing table
 * @returns {Array<{service: string, cost: string, monthly: string, annual: string}>}
 */
export function getPricingTable() {
  return [
    {
      service: 'Sentiment Analysis',
      cost: formatSOL(PRICING.SENTIMENT_ANALYSIS),
      monthly: formatSOL(PRICING.SENTIMENT_ANALYSIS * 1000),
      annual: formatSOL(PRICING.SENTIMENT_ANALYSIS * 12000),
    },
    {
      service: 'Text Generation',
      cost: formatSOL(PRICING.TEXT_GENERATION),
      monthly: formatSOL(PRICING.TEXT_GENERATION * 1000),
      annual: formatSOL(PRICING.TEXT_GENERATION * 12000),
    },
    {
      service: 'Image Classification',
      cost: formatSOL(PRICING.IMAGE_CLASSIFICATION),
      monthly: formatSOL(PRICING.IMAGE_CLASSIFICATION * 1000),
      annual: formatSOL(PRICING.IMAGE_CLASSIFICATION * 12000),
    },
    {
      service: 'Price Prediction',
      cost: formatSOL(PRICING.PRICE_PREDICTION),
      monthly: formatSOL(PRICING.PRICE_PREDICTION * 1000),
      annual: formatSOL(PRICING.PRICE_PREDICTION * 12000),
    },
    {
      service: 'Document Analysis',
      cost: formatSOL(PRICING.DOCUMENT_ANALYSIS),
      monthly: formatSOL(PRICING.DOCUMENT_ANALYSIS * 1000),
      annual: formatSOL(PRICING.DOCUMENT_ANALYSIS * 12000),
    },
  ];
}

/**
 * Check if wallet has sufficient balance
 * @param {Connection} connection - Solana connection
 * @param {PublicKey} publicKey - Wallet public key
 * @param {string} modelType - Type of AI model
 * @returns {Promise<boolean>}
 */
export async function hasSufficientBalance(connection, publicKey, modelType) {
  try {
    const balance = await connection.getBalance(publicKey);
    const required = PRICING[modelType] || PRICING.SENTIMENT_ANALYSIS;

    // Add buffer for transaction fees (~0.000005 SOL)
    const requiredWithFees = required + (5000); // 5000 lamports for fees

    return balance >= requiredWithFees;
  } catch (error) {
    console.error('Error checking balance:', error);
    return false;
  }
}
