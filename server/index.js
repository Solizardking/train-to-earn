import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import multer from 'multer';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { fetchAsset, findAssetSignerPda } from '@metaplex-foundation/mpl-core';
import { mplAgentIdentity, safeFetchAgentIdentityV1FromSeeds } from '@metaplex-foundation/mpl-agent-registry';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { pool, initDB, testConnection } from './db.js';
import {
  DEFAULT_CLAWD_CHAT_API_URL,
  DEFAULT_CLAWD_CHAT_URL,
  FALLBACK_CLAWD_AGENTS,
  createAgentMintMetadata,
  createAgentNftMetadata,
  createAgentRegistrationDocument,
  createClawdAccess,
  isValidAgentPublicKey,
  networkToMetaplexNetwork,
  normalizeCatalogAgent,
  validateAgentInput,
} from '../src/utils/agentRegistry.js';
import {
  createModelIdentityRecord,
  createModelRegistrationDocument,
  createRegisterModelIdentityTransactionPlan,
  deriveModelIdentityPda,
  validateModelRegistrationDocument,
} from '../src/utils/modelRegistry.js';
import { buildProviderAttestations, evaluateMetaplexDasAsset } from '../src/utils/providerAttestations.js';
import {
  detectModelStorageType,
  filterAndSortModelEntries,
  listModelCatalogEntries,
  modelCatalogEntryFromInput,
  persistModelCatalogEntry,
  persistModelRegistration,
  rowToModelCatalogEntry,
  rowToModelRegistration,
} from './modelRegistryStore.js';
import {
  JEV_MODEL_ID,
  ensureJevRatingsTable,
  getJevProfile,
  jevConfigured,
  jevGatewayHost,
  listGatewayModels,
  rateTrainingData,
  saveJevRating,
} from './jevRating.js';
import {
  ensureRewardPayoutsTable,
  getRewardBalance,
  getTreasuryState,
  listPayouts,
  markPayoutPaid,
  requestClaim,
} from './rewards.js';
import {
  getSubmissionStats,
  listRecentSubmissions,
  listTopSubmissions,
} from './submissions.js';
import { registerPhantomRoutes, phantomConfigured } from './phantomWallet.js';
import { getTrainingData } from './trainingData.js';
import {
  aggregateConsensusRound,
  analyzeTrainingContribution,
  consensusOverview,
  contributionTiers,
  createConsensusRound,
  listConsensusRounds,
  runConsensusInference,
} from './consensusTraining.js';
import {
  PIED_PIPER_INTEGRATION_VERSION,
  PIED_PIPER_MODEL_TYPE,
  createPiedPiperAnalysis,
  listPiedPiperCapabilities,
} from '../src/utils/piedPiperToolkit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.set('trust proxy', 1);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

const SITE_URL = process.env.SITE_URL || '';

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      (SITE_URL && origin === SITE_URL) ||
      /\.vercel\.app$/.test(origin) ||
      /\.x402\.wtf$/.test(origin) ||
      /\.onchainai\.fund$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));

const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL;
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL;

// CLAWD token
const CLAWD_MINT = process.env.VITE_CLAWD_MINT || '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';
const TREASURY_ADDRESS = process.env.CLAWD_TREASURY_ADDRESS || process.env.VITE_TREASURY_ADDRESS || '6rEiHJ4JUTWcC4wCUosTbaoBmpjHvUGLAQcogUwADB4Z';
const XAI_API_KEY = process.env.XAI_API_KEY;
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_API_SECRET = process.env.PINATA_API_SECRET;
const PUBLIC_SOLANA_RPC_URL = '/api/solana/rpc';
const PRIVATE_CLAWD_ZK_RPC_URL = process.env.CLAWD_ZK_RPC_URL || heliusRpcUrl() || 'https://api.mainnet-beta.solana.com';
const PRIVATE_CLAWD_ZK_PHOTON_URL = process.env.CLAWD_ZK_PHOTON_URL || PRIVATE_CLAWD_ZK_RPC_URL;
const CLAWD_ZK_NETWORK = process.env.CLAWD_ZK_NETWORK || 'mainnet';
const CLAWD_FREE_CHAT_URL = process.env.CLAWD_FREE_CHAT_URL || DEFAULT_CLAWD_CHAT_URL;
const CLAWD_FREE_CHAT_API_URL = process.env.CLAWD_FREE_CHAT_API_URL || DEFAULT_CLAWD_CHAT_API_URL;
const METAPLEX_AGENT_API_BASE_URL = process.env.METAPLEX_AGENT_API_BASE_URL || 'https://api.metaplex.com';
const CLAWDBOT_SKILLS_DIR = process.env.CLAWDBOT_SKILLS_DIR || '/Users/8bit/skills/skills';
const CLAWDBOT_AGENTS_DIR = process.env.CLAWDBOT_AGENTS_DIR || '/Users/8bit/agents/agents/src';
const CLAWDBOT_ZK_PRIMITIVES_DIR = process.env.CLAWDBOT_ZK_PRIMITIVES_DIR || '/Users/8bit/Agentics/clawdbot-go/zk-primitives';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const agentMetadataStore = new Map();
const usedPaymentSignatures = new Set();
const computeJobStore = new Map();

const INFERENCE_PRICING = Object.freeze({
  SENTIMENT_ANALYSIS: Math.round(0.001 * LAMPORTS_PER_SOL),
  TEXT_GENERATION: Math.round(0.005 * LAMPORTS_PER_SOL),
  IMAGE_CLASSIFICATION: Math.round(0.002 * LAMPORTS_PER_SOL),
  PRICE_PREDICTION: Math.round(0.01 * LAMPORTS_PER_SOL),
  DOCUMENT_ANALYSIS: Math.round(0.003 * LAMPORTS_PER_SOL),
  CODE_GENERATION: Math.round(0.007 * LAMPORTS_PER_SOL),
  CHAT_COMPLETION: Math.round(0.004 * LAMPORTS_PER_SOL),
  LLM_REASONING: Math.round(0.008 * LAMPORTS_PER_SOL),
  CONSENSUS_LEARNING: Math.round(0.006 * LAMPORTS_PER_SOL),
  EMBEDDINGS: Math.round(0.0005 * LAMPORTS_PER_SOL),
  AUDIO: Math.round(0.006 * LAMPORTS_PER_SOL),
  MULTIMODAL: Math.round(0.012 * LAMPORTS_PER_SOL),
  PIEDPIPER_PIPELINE: Math.round(0.004 * LAMPORTS_PER_SOL),
});

function normalizeModelType(value = 'SENTIMENT_ANALYSIS') {
  return String(value || 'SENTIMENT_ANALYSIS')
    .trim()
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}

function inferenceRequirement(modelType, quantity = 1) {
  const normalizedModelType = normalizeModelType(modelType);
  const safeQuantity = Math.min(Math.max(Number(quantity) || 1, 1), 100);
  const lamports = (INFERENCE_PRICING[normalizedModelType] || INFERENCE_PRICING.SENTIMENT_ANALYSIS) * safeQuantity;

  return {
    modelType: normalizedModelType,
    quantity: safeQuantity,
    amountLamports: lamports,
    amount: lamports / LAMPORTS_PER_SOL,
    currency: 'SOL',
    paymentAddress: TREASURY_ADDRESS,
  };
}

function setPaymentHeaders(res, requirement) {
  res.setHeader('X-Payment-Address', requirement.paymentAddress);
  res.setHeader('X-Payment-Amount', String(requirement.amount));
  res.setHeader('X-Payment-Currency', requirement.currency);
}

function paymentSignatureFromReq(req) {
  return req.get('x-payment-signature') || req.body?.paymentSignature || req.body?.signature || '';
}

function mockPaymentsAllowed() {
  return process.env.ENABLE_MOCK_PAYMENTS === 'true' || ['development', 'test'].includes(process.env.NODE_ENV);
}

function isMockPaymentSignature(signature) {
  return /^(dev|test|mock)[-_:]/i.test(String(signature || ''));
}

function getTransactionAccountKeys(transaction) {
  const message = transaction?.transaction?.message;
  const accountKeys = message?.accountKeys || message?.staticAccountKeys || message?.getAccountKeys?.().staticAccountKeys || [];
  return accountKeys.map((key) => key.toString());
}

async function signatureAlreadyPersisted(signature) {
  if (!dbConnected) return false;
  const result = await pool.query(
    'SELECT signature FROM ai_inference_payments WHERE signature = $1 LIMIT 1',
    [signature],
  );
  return result.rows.length > 0;
}

async function verifyInferencePayment(req, { modelType, quantity = 1, modelId = null } = {}) {
  const requirement = inferenceRequirement(modelType, quantity);
  const signature = paymentSignatureFromReq(req);

  if (!signature) {
    return {
      ok: false,
      status: 402,
      requirement,
      body: {
        error: 'Payment Required',
        paymentAddress: requirement.paymentAddress,
        amount: requirement.amount,
        amountLamports: requirement.amountLamports,
        currency: requirement.currency,
        modelType: requirement.modelType,
        message: `Please send ${requirement.amount} SOL to ${requirement.paymentAddress}`,
      },
    };
  }

  if (usedPaymentSignatures.has(signature) || await signatureAlreadyPersisted(signature)) {
    return {
      ok: false,
      status: 402,
      requirement,
      body: { error: 'Payment already used', message: 'Payment signatures are single-use to prevent replay.' },
    };
  }

  if (mockPaymentsAllowed() && isMockPaymentSignature(signature)) {
    usedPaymentSignatures.add(signature);
    return {
      ok: true,
      requirement,
      payment: {
        signature,
        amountLamports: requirement.amountLamports,
        amount: requirement.amount,
        currency: requirement.currency,
        sender: req.body?.walletAddress || 'dev-wallet',
        treasury: requirement.paymentAddress,
        modelType: requirement.modelType,
        modelId,
        mock: true,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  let treasuryPubkey;
  try {
    treasuryPubkey = new PublicKey(requirement.paymentAddress);
  } catch {
    return {
      ok: false,
      status: 503,
      requirement,
      body: { error: 'Payment treasury is not configured with a valid Solana public key' },
    };
  }

  const rpcUrl = heliusRpcUrl() || process.env.SOLANA_RPC_URL || process.env.VITE_SOLANA_RPC_URL;
  if (!rpcUrl || rpcUrl.startsWith('/')) {
    return {
      ok: false,
      status: 503,
      requirement,
      body: { error: 'Payment verification RPC is not configured' },
    };
  }

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const transaction = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return {
        ok: false,
        status: 402,
        requirement,
        body: { error: 'Payment not found', message: 'Transaction signature was not found on Solana.' },
      };
    }

    if (transaction.meta?.err) {
      return {
        ok: false,
        status: 402,
        requirement,
        body: { error: 'Payment failed', details: transaction.meta.err },
      };
    }

    const accountKeys = getTransactionAccountKeys(transaction);
    const treasuryIndex = accountKeys.findIndex((key) => key === treasuryPubkey.toBase58());

    if (treasuryIndex === -1) {
      return {
        ok: false,
        status: 402,
        requirement,
        body: { error: 'Invalid payment', message: 'Payment was not sent to the Train2Earn treasury.' },
      };
    }

    const receivedLamports = Number(transaction.meta.postBalances?.[treasuryIndex] || 0) -
      Number(transaction.meta.preBalances?.[treasuryIndex] || 0);

    if (receivedLamports < requirement.amountLamports) {
      return {
        ok: false,
        status: 402,
        requirement,
        body: {
          error: 'Insufficient payment',
          expectedLamports: requirement.amountLamports,
          receivedLamports,
        },
      };
    }

    const expectedPayer = req.body?.walletAddress;
    const sender = accountKeys[0] || null;
    if (expectedPayer && sender && sender !== expectedPayer) {
      return {
        ok: false,
        status: 402,
        requirement,
        body: { error: 'Invalid payer', expectedPayer, actualPayer: sender },
      };
    }

    usedPaymentSignatures.add(signature);
    return {
      ok: true,
      requirement,
      payment: {
        signature,
        amountLamports: receivedLamports,
        amount: receivedLamports / LAMPORTS_PER_SOL,
        currency: requirement.currency,
        sender,
        treasury: requirement.paymentAddress,
        modelType: requirement.modelType,
        modelId,
        mock: false,
        blockTime: transaction.blockTime,
        verifiedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Payment verification error:', error.message);
    return {
      ok: false,
      status: 502,
      requirement,
      body: { error: 'Payment verification failed', details: error.message },
    };
  }
}

async function recordInferencePayment(payment, requestBody, responseBody) {
  if (!dbConnected || !payment?.signature) return;
  try {
    await pool.query(
      `INSERT INTO ai_inference_payments (
        signature,
        payer,
        model_type,
        model_id,
        amount_lamports,
        treasury,
        request,
        response
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (signature) DO NOTHING`,
      [
        payment.signature,
        payment.sender || null,
        payment.modelType,
        payment.modelId || null,
        payment.amountLamports,
        payment.treasury,
        JSON.stringify(requestBody || {}),
        JSON.stringify(responseBody || {}),
      ],
    );
  } catch (error) {
    console.warn('Could not persist inference payment:', error.message);
  }
}

function fallbackInference({ prompt, modelType, modelId, parameters = {} }) {
  const normalizedType = normalizeModelType(modelType);
  const promptHash = createHash('sha256').update(String(prompt)).digest('hex');
  const topic = String(prompt).slice(0, 180);
  const piedPiperAnalysis = normalizedType === PIED_PIPER_MODEL_TYPE
    ? createPiedPiperAnalysis(prompt, {
      artifactSha256: `0x${promptHash}`,
      sha512: createHash('sha512').update(String(prompt)).digest('hex'),
    })
    : null;

  const outputs = {
    SENTIMENT_ANALYSIS: `Sentiment signal for "${topic}": constructive/neutral with Solana ecosystem relevance.`,
    TEXT_GENERATION: `Generated draft for "${topic}": Train2Earn coordinates model storage, payments, and contribution rewards through Solana-native rails.`,
    IMAGE_CLASSIFICATION: `Image classification placeholder: classify the submitted image with model ${modelId || normalizedType} after the client supplies image bytes or a public URI.`,
    PRICE_PREDICTION: `Price prediction request received for "${topic}". Use this as a model output scaffold, not financial advice.`,
    DOCUMENT_ANALYSIS: `Document analysis: the input is suitable for model registry, governance, or training-quality review when provenance and schema fields are attached.`,
    CODE_GENERATION: `Code generation plan: validate wallet input, derive the model PDA, persist the registration document, then submit the Anchor instruction.`,
    CHAT_COMPLETION: `Chat response: Train2Earn can answer this by combining registered model metadata, DAO policy, and payment verification context.`,
    LLM_REASONING: `Reasoning trace summary: identify the model, verify payment, load storage metadata, run inference, then record the usage commitment.`,
    CONSENSUS_LEARNING: `Consensus learning summary: combine local predictions, confidence scores, and reward settlement without moving raw training data.`,
    EMBEDDINGS: `Embedding batch accepted. Return vector output from the configured embedding model when a provider is connected.`,
    AUDIO: `Audio job accepted. Attach a public audio URI or multipart upload path for production transcription/classification.`,
    MULTIMODAL: `Multimodal inference accepted. Provide text plus image/audio references so the provider can fuse modalities.`,
    PIEDPIPER_PIPELINE: piedPiperAnalysis
      ? `PiedPiper pipeline completed. Huffman ratio ${piedPiperAnalysis.compression.huffman.compressionRatio}, RLE ratio ${piedPiperAnalysis.compression.rle.compressionRatio}, Rule30 commitment ${piedPiperAnalysis.automata.rule30.hexPreview.slice(0, 24)}. Registry draft model type: ${piedPiperAnalysis.registryDraft.modelType}.`
      : 'PiedPiper pipeline completed.',
  };

  return {
    provider: 'train2earn-local',
    modelType: normalizedType,
    modelId: modelId || null,
    output: outputs[normalizedType] || outputs.SENTIMENT_ANALYSIS,
    confidence: normalizedType === 'CONSENSUS_LEARNING' ? 84 : 78,
    ledgerCommitment: promptHash,
    parameters,
    piedPiper: piedPiperAnalysis,
    warnings: [
      'Local deterministic inference fallback used. Configure OPENROUTER_API_KEY for live model execution.',
    ],
  };
}

async function performPaidInference({ prompt, modelType, modelId, parameters, modelResponses }) {
  const normalizedType = normalizeModelType(modelType);
  if (normalizedType === 'CONSENSUS_LEARNING') {
    return {
      provider: 'consensus-training',
      modelType: normalizedType,
      modelId: modelId || null,
      ...runConsensusInference({ prompt, modelResponses, participantCount: parameters?.participantCount }),
    };
  }
  if (normalizedType === PIED_PIPER_MODEL_TYPE) {
    return {
      provider: 'piedpiper-local',
      modelType: normalizedType,
      modelId: modelId || 'piedpiper-compression-automata',
      output: 'PiedPiper deterministic compression and automata analysis completed.',
      confidence: 100,
      ledgerCommitment: createHash('sha256').update(String(prompt)).digest('hex'),
      piedPiper: createPiedPiperAnalysis(prompt, {
        artifactSha256: `0x${createHash('sha256').update(String(prompt)).digest('hex')}`,
        sha512: createHash('sha512').update(String(prompt)).digest('hex'),
      }),
    };
  }

  const keyValid = OPENROUTER_API_KEY && !OPENROUTER_API_KEY.includes('placeholder');
  if (!keyValid) {
    return fallbackInference({ prompt, modelType: normalizedType, modelId, parameters });
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: parameters?.providerModel || OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a paid Train2Earn AI model endpoint for ${normalizedType}. Return concise, useful output.`,
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: Math.min(Number(parameters?.maxTokens) || 512, 2048),
        temperature: Number(parameters?.temperature ?? 0.4),
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'Train2Earn Solana AI Inference',
        },
        timeout: 20000,
      },
    );

    return {
      provider: 'openrouter',
      modelType: normalizedType,
      modelId: modelId || null,
      output: response.data?.choices?.[0]?.message?.content || '',
      usage: response.data?.usage || null,
      confidence: 86,
      ledgerCommitment: createHash('sha256').update(`${prompt}:${response.data?.id || ''}`).digest('hex'),
    };
  } catch (error) {
    const fallback = fallbackInference({ prompt, modelType: normalizedType, modelId, parameters });
    return {
      ...fallback,
      warnings: [
        `OpenRouter inference failed: ${error.message}`,
        ...fallback.warnings,
      ],
    };
  }
}

function heliusRpcUrl() {
  if (HELIUS_RPC_URL) return HELIUS_RPC_URL;
  if (HELIUS_API_KEY) return `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  return null;
}

function pinataConfigured() {
  return Boolean(PINATA_JWT || (PINATA_API_KEY && PINATA_API_SECRET));
}

function clawdAgentAccess({ privateRpc = false } = {}) {
  const catalogPaths = [
    { key: 'CLAWDBOT_SKILLS_DIR', label: 'Clawd skills', path: CLAWDBOT_SKILLS_DIR },
    { key: 'CLAWDBOT_AGENTS_DIR', label: 'Clawd agents', path: CLAWDBOT_AGENTS_DIR },
    { key: 'CLAWDBOT_ZK_PRIMITIVES_DIR', label: 'ZK primitives', path: CLAWDBOT_ZK_PRIMITIVES_DIR },
  ];

  return createClawdAccess({
    network: CLAWD_ZK_NETWORK,
    rpcUrl: privateRpc ? PRIVATE_CLAWD_ZK_RPC_URL : PUBLIC_SOLANA_RPC_URL,
    photonUrl: privateRpc ? PRIVATE_CLAWD_ZK_PHOTON_URL : PUBLIC_SOLANA_RPC_URL,
    chatUrl: CLAWD_FREE_CHAT_URL,
    chatApiUrl: CLAWD_FREE_CHAT_API_URL,
    catalogs: Object.fromEntries(catalogPaths.map((entry) => [entry.key, Boolean(entry.path)])),
    catalogPaths,
  });
}

function publicApiBase(req) {
  const configured = process.env.PUBLIC_API_URL || process.env.VITE_API_URL;
  if (configured && !configured.includes('localhost')) {
    return configured.replace(/\/$/, '');
  }

  return `${req.protocol}://${req.get('host')}`;
}

function publicSiteBase() {
  return (SITE_URL || 'https://earn.x402.wtf').replace(/\/$/, '');
}

function isPublicHttpUri(value) {
  try {
    const url = new URL(value);
    const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    return ['http:', 'https:'].includes(url.protocol)
      && !localHosts.has(url.hostname)
      && !url.hostname.endsWith('.local');
  } catch {
    return false;
  }
}

function validateAgentMintRequest(input = {}) {
  const errors = [];
  const metadata = input.agentMetadata || {};

  if (!input.wallet || !isValidAgentPublicKey(input.wallet)) {
    errors.push('wallet must be a valid Solana public key');
  }
  if (!String(input.name || '').trim()) errors.push('name is required');
  if (!input.uri || !isPublicHttpUri(input.uri)) {
    errors.push('uri must be a publicly accessible http(s) URL');
  }
  if (metadata.type !== 'agent') errors.push('agentMetadata.type must be "agent"');
  if (!String(metadata.name || '').trim()) errors.push('agentMetadata.name is required');
  if (!String(metadata.description || '').trim()) errors.push('agentMetadata.description is required');
  if (!Array.isArray(metadata.services)) errors.push('agentMetadata.services must be an array');
  if (!Array.isArray(metadata.registrations)) errors.push('agentMetadata.registrations must be an array');
  if (!Array.isArray(metadata.supportedTrust)) errors.push('agentMetadata.supportedTrust must be an array');

  return errors;
}

async function pinJsonToStorage(name, document, req) {
  if (pinataConfigured()) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (PINATA_JWT) {
        headers.Authorization = `Bearer ${PINATA_JWT}`;
      } else {
        headers.pinata_api_key = PINATA_API_KEY;
        headers.pinata_secret_api_key = PINATA_API_SECRET;
      }

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataMetadata: {
            name,
            keyvalues: { app: 'traintoearn', type: 'agent-metadata' },
          },
          pinataContent: document,
        },
        { headers, timeout: 20000 },
      );

      const hash = response.data?.IpfsHash;
      if (!hash) throw new Error('Pinata did not return IpfsHash');

      return {
        uri: `https://gateway.pinata.cloud/ipfs/${hash}`,
        cid: hash,
        storage: 'pinata',
      };
    } catch (error) {
      console.warn(`Pinata upload failed for ${name}; using API memory storage: ${error.message}`);
    }
  }

  const id = randomUUID();
  agentMetadataStore.set(id, {
    document,
    createdAt: new Date().toISOString(),
  });

  return {
    uri: `${publicApiBase(req)}/api/agents/metadata/${id}`,
    storage: 'api-memory',
  };
}

function parseSseText(text) {
  return String(text || '')
    .split(/\r?\n\r?\n/)
    .map((block) => block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n'))
    .filter((chunk) => chunk && chunk !== '[DONE]')
    .map((chunk) => {
      try {
        const parsed = JSON.parse(chunk);
        return parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
      } catch {
        return '';
      }
    })
    .join('');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listLocalCatalogAgents(limit = 120) {
  const sourceDir = CLAWDBOT_AGENTS_DIR;
  if (!sourceDir || !(await pathExists(sourceDir))) {
    return {
      agents: FALLBACK_CLAWD_AGENTS.slice(0, Number(limit) || 120),
      sourceDir,
      configured: false,
      source: 'fallback',
    };
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'package.json')
    .slice(0, Number(limit) || 120);

  const agents = [];
  for (const entry of files) {
    const sourcePath = path.join(sourceDir, entry.name);
    try {
      const raw = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
      agents.push(normalizeCatalogAgent(raw, sourcePath));
    } catch (error) {
      agents.push({
        id: entry.name.replace(/\.json$/, ''),
        name: entry.name,
        description: `Could not parse catalog file: ${error.message}`,
        category: 'invalid',
        tags: [],
        sourcePath,
      });
    }
  }

  return { agents, sourceDir, configured: true, source: 'filesystem' };
}

function createAgentUmi() {
  return createUmi(PRIVATE_CLAWD_ZK_RPC_URL)
    .use(mplAgentIdentity());
}

async function fetchMetaplexDasAsset(asset) {
  const url = heliusRpcUrl();

  if (!url) {
    return {
      configured: false,
      dasAsset: null,
      error: 'HELIUS_RPC_URL or HELIUS_API_KEY is required for live Metaplex DAS verification',
    };
  }

  const response = await axios.post(url, {
    jsonrpc: '2.0',
    id: 'get-model-asset',
    method: 'getAsset',
    params: {
      id: asset,
      options: {
        showCollectionMetadata: true,
        showGrandTotal: false,
        showInscription: false,
      },
    },
  });

  if (response.data?.error) {
    throw new Error(response.data.error.message || 'Helius DAS getAsset failed');
  }

  return {
    configured: true,
    dasAsset: response.data?.result || null,
    error: null,
  };
}

// Database connection flag
let dbConnected = false;

// Health check + CLAWD config endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    clawd: { mint: CLAWD_MINT, treasury: TREASURY_ADDRESS },
    clawdAgent: {
      network: CLAWD_ZK_NETWORK,
      rpcUrl: PUBLIC_SOLANA_RPC_URL,
      photonUrl: PUBLIC_SOLANA_RPC_URL,
      chatUrl: CLAWD_FREE_CHAT_URL,
    },
    phantom: { configured: phantomConfigured() },
    jev: {
      configured: jevConfigured(),
      model: JEV_MODEL_ID,
      gatewayHost: jevGatewayHost(),
    },
  });
});

app.post('/api/solana/rpc', async (req, res) => {
  try {
    const rpcUrl = PRIVATE_CLAWD_ZK_RPC_URL || heliusRpcUrl();
    if (!rpcUrl || rpcUrl.startsWith('/')) {
      return res.status(503).json({ error: 'Solana RPC proxy is not configured' });
    }

    const response = await axios.post(
      rpcUrl,
      req.body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      },
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Solana RPC proxy error:', error.message);
    res.status(502).json({ error: 'Solana RPC proxy unavailable' });
  }
});

// Phantom Server SDK wallet routes (dormant until PHANTOM_* env vars are set)
registerPhantomRoutes(app);

// Sovereign Compute Node API endpoints

// ========== AGENT MINT + CLAWD CHAT ENDPOINTS ==========

app.get('/api/agents/config', (_req, res) => {
  const access = clawdAgentAccess();
  res.json({
    access,
    metaplexNetwork: networkToMetaplexNetwork(access.network),
    rpcUrl: PUBLIC_SOLANA_RPC_URL,
    storage: {
      pinataConfigured: pinataConfigured(),
      fallback: 'api-memory',
    },
    catalogs: access.catalogs,
    catalogPaths: access.catalogPaths,
  });
});

app.get('/api/agents/catalog', async (req, res) => {
  try {
    const { agents, sourceDir, configured, source } = await listLocalCatalogAgents(req.query.limit || 120);
    res.json({
      agents,
      total: agents.length,
      configured,
      source,
      sourceDir,
      access: clawdAgentAccess(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list local agents', details: error.message });
  }
});

app.get('/api/agents/metadata/:id', (req, res) => {
  const entry = agentMetadataStore.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Agent metadata not found or expired' });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json(entry.document);
});

app.post('/api/agents/metadata', async (req, res) => {
  try {
    const access = clawdAgentAccess();
    const input = {
      ...req.body,
      webEndpoint: req.body.webEndpoint || `${publicSiteBase()}/mint`,
    };
    const errors = validateAgentInput(input);

    if (errors.length) {
      return res.status(400).json({ error: 'Invalid agent metadata', details: errors });
    }

    const metadataAccess = {
      ...access,
      defaultImage: `${publicSiteBase()}/favicon.svg`,
    };
    const nftMetadata = createAgentNftMetadata(input, metadataAccess);
    const registrationDocument = createAgentRegistrationDocument(input, metadataAccess);
    const [nftStorage, registrationStorage] = await Promise.all([
      pinJsonToStorage(`clawd-agent-${input.name}-nft`, nftMetadata, req),
      pinJsonToStorage(`clawd-agent-${input.name}-registration`, registrationDocument, req),
    ]);
    const agentMetadata = createAgentMintMetadata(input, metadataAccess);
    const mintReady = isPublicHttpUri(nftStorage.uri) && isPublicHttpUri(registrationStorage.uri);

    res.json({
      uri: nftStorage.uri,
      registrationUri: registrationStorage.uri,
      mintReady,
      warnings: mintReady ? [] : [
        'Metadata is stored on a local or private fallback URL. Configure Pinata or PUBLIC_API_URL before minting through Metaplex.',
      ],
      storage: {
        nft: nftStorage,
        registration: registrationStorage,
      },
      document: registrationDocument,
      registrationDocument,
      nftMetadata,
      agentMetadata,
      mintInput: {
        wallet: input.owner,
        network: networkToMetaplexNetwork(access.network),
        name: input.name,
        uri: nftStorage.uri,
        agentMetadata,
      },
    });
  } catch (error) {
    console.error('Agent metadata error:', error.message);
    res.status(500).json({ error: 'Failed to prepare agent metadata', details: error.message });
  }
});

app.get('/api/agents/read/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    if (!isValidAgentPublicKey(asset)) {
      return res.status(400).json({ error: 'asset must be a valid Solana public key' });
    }

    const umi = createAgentUmi();
    const assetPublicKey = umiPublicKey(asset);
    const agentWalletPda = findAssetSignerPda(umi, { asset: assetPublicKey });

    const [assetResult, identityResult] = await Promise.allSettled([
      fetchAsset(umi, assetPublicKey),
      safeFetchAgentIdentityV1FromSeeds(umi, { asset: assetPublicKey }),
    ]);

    const coreAsset = assetResult.status === 'fulfilled' ? assetResult.value : null;
    const identity = identityResult.status === 'fulfilled' ? identityResult.value : null;
    const registrationUri = identity?.uri || coreAsset?.agentIdentities?.[0]?.uri || null;

    res.json({
      asset,
      registered: Boolean(identity || coreAsset?.agentIdentities?.length),
      agentWallet: agentWalletPda[0].toString(),
      agentWalletBump: agentWalletPda[1],
      registrationUri,
      coreAsset: coreAsset ? {
        name: coreAsset.name,
        uri: coreAsset.uri,
        owner: coreAsset.owner?.toString?.() || coreAsset.owner || null,
        agentIdentities: coreAsset.agentIdentities || [],
      } : null,
      errors: [
        assetResult.status === 'rejected' ? assetResult.reason?.message : null,
        identityResult.status === 'rejected' ? identityResult.reason?.message : null,
      ].filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to read agent', details: error.message });
  }
});

async function mintAgentViaMetaplex(req, res) {
  try {
    const errors = validateAgentMintRequest(req.body);
    if (errors.length) {
      return res.status(400).json({ error: 'Invalid Metaplex agent mint request', details: errors });
    }

    const response = await axios.post(
      `${METAPLEX_AGENT_API_BASE_URL.replace(/\/$/, '')}/v1/agents/mint`,
      req.body,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      },
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(502).json({ error: 'Metaplex agent mint API unavailable', details: error.message });
  }
}

app.post('/api/agents/mint', mintAgentViaMetaplex);
app.post('/api/metaplex/v1/agents/mint', mintAgentViaMetaplex);

app.post('/api/agents/status', async (req, res) => {
  try {
    const { assetAddress, owner, signature, metadataUri, agentWallet, status = 'minted' } = req.body;
    if (!assetAddress) return res.status(400).json({ error: 'assetAddress is required' });

    res.json({
      agent: {
        assetAddress,
        owner: owner || null,
        signature: signature || null,
        metadataUri: metadataUri || null,
        agentWallet: agentWallet || null,
        status,
        explorerUrl: `https://solscan.io/token/${assetAddress}`,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update agent status', details: error.message });
  }
});

app.post('/api/agents/chat', async (req, res) => {
  try {
    const { agent, message, messages = [], model = 'solanaclawd/solana-clawd-core-ai-1.5b-lora' } = req.body;
    const cleanMessage = String(message || '').trim();

    if (!cleanMessage) {
      return res.status(400).json({ error: 'message is required' });
    }

    const access = clawdAgentAccess();
    const system = [
      `You are ${agent?.name || 'a Clawd ZK agent'} registered through Train2Earn on Solana.`,
      agent?.assetAddress ? `Agent Core asset: ${agent.assetAddress}.` : '',
      agent?.agentWallet ? `Agent wallet PDA: ${agent.agentWallet}.` : '',
      'Use the configured backend Solana access for chain requests.',
      'Answer directly and keep responses concise.',
    ].filter(Boolean).join(' ');

    let reply = '';
    try {
      const response = await axios.post(
        access.chatApiUrl,
        {
          model,
          max_tokens: 512,
          messages: [
            { role: 'system', content: system },
            ...messages.slice(-8),
            { role: 'user', content: cleanMessage },
          ],
        },
        {
          responseType: 'text',
          headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/json' },
          timeout: 12000,
        },
      );

      reply = parseSseText(response.data);
      if (!reply) {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        reply = data.choices?.[0]?.message?.content || data.reply || '';
      }
    } catch (error) {
      reply = `I am connected to the Clawd ZK agent profile, but the chat route is unavailable right now. Agent access is configured for ${access.network}.`;
    }

    res.json({
      reply: reply || 'The Clawd chat route returned an empty response.',
      model,
      access: {
        network: access.network,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Agent chat failed', details: error.message });
  }
});

// ========== CONSENSUS TRAINING ENDPOINTS ==========

app.get('/api/training/overview', async (_req, res) => {
  // Real numbers only: round counts come from the live round store and the
  // reward backing is the treasury's actual on-chain $CLAWD balance. The
  // previous hardcoded "89 private nodes" / "2,450,000 CLAWD pool" stats
  // were invented and have been removed.
  let treasuryClawd = null;
  try {
    const treasury = await getTreasuryState();
    treasuryClawd = treasury.clawdBalance;
  } catch {
    treasuryClawd = null;
  }
  res.json({
    overview: consensusOverview,
    tiers: contributionTiers,
    stats: {
      activeRounds: listConsensusRounds().filter((round) => round.status !== 'consensus-accepted').length,
      settledRounds: listConsensusRounds().filter((round) => round.status === 'consensus-accepted').length,
      treasuryClawd,
    },
  });
});

app.post('/api/training/quality', (req, res) => {
  try {
    const { content, filename, mimeType, metadata, walletAddress } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    res.json({
      analysis: analyzeTrainingContribution({
        content,
        filename,
        mimeType,
        metadata,
        walletAddress,
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze training contribution', details: error.message });
  }
});

// ========== JEV DECISION ENGINE (Neon AI Gateway) ==========
// Realtime training-data quality ratings for signed-in Solana wallets.
// The rating drives the reward tier; every rating persists per wallet.

app.get('/api/jev/status', (_req, res) => {
  res.json({
    configured: jevConfigured(),
    model: JEV_MODEL_ID,
    gatewayHost: jevGatewayHost(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

app.get('/api/jev/models', async (_req, res) => {
  try {
    res.json(await listGatewayModels());
  } catch (error) {
    res.status(502).json({ error: 'Failed to list gateway models', details: error.message });
  }
});

app.post('/api/jev/rate', async (req, res) => {
  try {
    const { content, filename, mimeType, metadata, walletAddress } = req.body || {};
    const rating = await rateTrainingData({ content, filename, mimeType, metadata, walletAddress });
    if (dbConnected) {
      try {
        const saved = await saveJevRating(pool, rating);
        rating.id = saved.id;
        rating.ratedAt = new Date(saved.created_at).toISOString();
      } catch (dbError) {
        console.error('Failed to persist Jev rating:', dbError.message);
        rating.persisted = false;
      }
    }
    res.json({ rating });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 500;
    res.status(status).json({ error: 'Failed to rate training data', details: error.message });
  }
});

app.get('/api/jev/rating/:walletAddress', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({ walletAddress: req.params.walletAddress, latest: null, stats: { ratingsCount: 0, averageScore: 0, totalClawdReward: 0, bestScore: null }, database: 'disconnected' });
    }
    res.json(await getJevProfile(pool, req.params.walletAddress));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read Jev profile', details: error.message });
  }
});

// ========== PUBLIC SUBMISSIONS PIPELINE (live tracking + showcase) ========
// Privacy-safe views over training_ratings: truncated wallets, no content.

// Realtime feed of the latest rated submissions.
app.get('/api/submissions/recent', async (req, res) => {
  try {
    if (!dbConnected) return res.json({ submissions: [], database: 'disconnected' });
    const submissions = await listRecentSubmissions(pool, req.query.limit);
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load recent submissions', details: error.message });
  }
});

// Showcase: the highest-rated submissions of all time.
app.get('/api/submissions/top', async (req, res) => {
  try {
    if (!dbConnected) return res.json({ submissions: [], database: 'disconnected' });
    const submissions = await listTopSubmissions(pool, req.query.limit);
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load top submissions', details: error.message });
  }
});

// Aggregate pipeline stats for the showcase header.
app.get('/api/submissions/stats', async (_req, res) => {
  try {
    if (!dbConnected) return res.json({ stats: null, database: 'disconnected' });
    const stats = await getSubmissionStats(pool);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load submission stats', details: error.message });
  }
});

app.post('/api/training/analyze-file', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
    const analysis = analyzeTrainingContribution({
      content: req.file.buffer.toString('utf8'),
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      metadata,
      walletAddress: req.body.walletAddress || null,
    });

    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze uploaded training data', details: error.message });
  }
});

app.get('/api/training/rounds', (_req, res) => {
  res.json({ rounds: listConsensusRounds() });
});

app.post('/api/training/rounds', (req, res) => {
  try {
    const roundRecord = createConsensusRound(req.body || {});
    res.status(201).json({ round: roundRecord });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create consensus training round', details: error.message });
  }
});

app.post('/api/training/rounds/:roundId/aggregate', (req, res) => {
  const roundRecord = aggregateConsensusRound(req.params.roundId);
  if (!roundRecord) {
    return res.status(404).json({ error: 'Consensus training round not found' });
  }
  res.json({ round: roundRecord });
});

app.get('/api/training/data', async (_req, res) => {
  try {
    const data = await getTrainingData();
    res.json(data);
  } catch (error) {
    console.error('Training data error:', error.message);
    res.status(500).json({ error: 'Failed to read training directory', details: error.message });
  }
});

app.post('/api/ai/consensus-inference', (req, res) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    res.json({ result: runConsensusInference(req.body) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run consensus inference', details: error.message });
  }
});

app.post('/api/ai/inference', async (req, res) => {
  try {
    const {
      prompt,
      input,
      modelType = 'SENTIMENT_ANALYSIS',
      modelId = null,
      quantity = 1,
      parameters = {},
      modelResponses = [],
    } = req.body || {};
    const cleanPrompt = String(prompt || input || '').trim();

    if (!cleanPrompt) {
      return res.status(400).json({ error: 'prompt or input is required' });
    }

    const verification = await verifyInferencePayment(req, { modelType, quantity, modelId });
    if (!verification.ok) {
      setPaymentHeaders(res, verification.requirement);
      return res.status(verification.status).json(verification.body);
    }

    const result = await performPaidInference({
      prompt: cleanPrompt,
      modelType: verification.requirement.modelType,
      modelId,
      parameters,
      modelResponses,
    });

    const responseBody = {
      success: true,
      result,
      modelType: verification.requirement.modelType,
      modelId,
      payment: {
        signature: verification.payment.signature,
        amount: verification.payment.amount,
        amountLamports: verification.payment.amountLamports,
        currency: verification.payment.currency,
        sender: verification.payment.sender,
        treasury: verification.payment.treasury,
        mock: verification.payment.mock,
        verifiedAt: verification.payment.verifiedAt,
      },
    };

    await recordInferencePayment(verification.payment, req.body, responseBody);
    res.json(responseBody);
  } catch (error) {
    console.error('Paid inference error:', error.message);
    res.status(500).json({ error: 'Failed to run paid inference', details: error.message });
  }
});

app.get('/api/piedpiper/capabilities', (_req, res) => {
  res.json(listPiedPiperCapabilities());
});

app.post('/api/piedpiper/analyze', (req, res) => {
  try {
    const { input, prompt, content, generations, rule30Steps } = req.body || {};
    const text = input ?? prompt ?? content;
    const normalizedText = String(text || '').trim();

    if (!normalizedText) {
      return res.status(400).json({ error: 'input, prompt, or content is required' });
    }

    const analysis = createPiedPiperAnalysis(normalizedText, {
      generations,
      rule30Steps,
      artifactSha256: `0x${createHash('sha256').update(normalizedText).digest('hex')}`,
      sha512: createHash('sha512').update(normalizedText).digest('hex'),
    });

    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run PiedPiper analysis', details: error.message });
  }
});

// Search assets by owner using Helius DAS API
app.post('/api/assets/search', async (req, res) => {
  try {
    const { ownerAddress, tokenType = 'all', limit = 50, page = 1 } = req.body;

    if (!ownerAddress) {
      return res.status(400).json({ error: 'ownerAddress is required' });
    }

    const url = heliusRpcUrl();
    if (!url) {
      return res.status(503).json({ error: 'HELIUS_RPC_URL or HELIUS_API_KEY is required' });
    }

    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: 'search-assets',
        method: 'searchAssets',
        params: {
          ownerAddress,
          tokenType,
          limit,
          page,
          options: {
            showUnverifiedCollections: false,
            showCollectionMetadata: true,
            showGrandTotal: true,
            showNativeBalance: true,
            showInscription: false,
            showZeroBalance: false,
          },
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching assets:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch assets',
      details: error.response?.data || error.message
    });
  }
});

// Get token accounts for an owner
app.post('/api/tokens/accounts', async (req, res) => {
  try {
    const { owner, mint, limit = 100 } = req.body;

    if (!owner) {
      return res.status(400).json({ error: 'owner address is required' });
    }

    const url = heliusRpcUrl();
    if (!url) {
      return res.status(503).json({ error: 'HELIUS_RPC_URL or HELIUS_API_KEY is required' });
    }

    const params = {
      owner,
      limit,
      options: {
        showZeroBalance: false,
      },
    };

    if (mint) {
      params.mint = mint;
    }

    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: 'get-token-accounts',
        method: 'getTokenAccounts',
        params,
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching token accounts:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch token accounts',
      details: error.response?.data || error.message
    });
  }
});

// Get NFT editions
app.post('/api/nft/editions', async (req, res) => {
  try {
    const { mint, limit = 100, page = 1 } = req.body;

    if (!mint) {
      return res.status(400).json({ error: 'mint address is required' });
    }

    const url = heliusRpcUrl();
    if (!url) {
      return res.status(503).json({ error: 'HELIUS_RPC_URL or HELIUS_API_KEY is required' });
    }

    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: 'get-nft-editions',
        method: 'getNftEditions',
        params: {
          mint,
          limit,
          page,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching NFT editions:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to fetch NFT editions',
      details: error.response?.data || error.message
    });
  }
});

// Save wallet analysis to database
app.post('/api/wallet/history', async (req, res) => {
  try {
    const { walletAddress, assetsCount, tokensCount, rewardsTotal } = req.body;
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const result = await pool.query(
      `INSERT INTO wallet_analyses (wallet_address, assets_count, tokens_count, rewards_total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [walletAddress, assetsCount || 0, tokensCount || 0, rewardsTotal || 0]
    );
    res.json({ success: true, record: result.rows[0] });
  } catch (error) {
    console.error('Error saving wallet history:', error.message);
    res.status(500).json({ error: 'Failed to save wallet history' });
  }
});

// Get wallet analysis history
app.get('/api/wallet/history/:address', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const { address } = req.params;
    const result = await pool.query(
      `SELECT * FROM wallet_analyses WHERE wallet_address = $1 ORDER BY analyzed_at DESC LIMIT 20`,
      [address]
    );
    res.json({ history: result.rows });
  } catch (error) {
    console.error('Error fetching wallet history:', error.message);
    res.status(500).json({ error: 'Failed to fetch wallet history' });
  }
});

// Get leaderboard (top wallets by rewards)
app.get('/api/leaderboard', async (_req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database not available' });
    }
    const result = await pool.query(
      `SELECT wallet_address, SUM(rewards_total) as total_rewards,
              MAX(analyzed_at) as last_active,
              COUNT(*) as analysis_count
       FROM wallet_analyses
       GROUP BY wallet_address
       ORDER BY total_rewards DESC
       LIMIT 50`
    );
    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// AI Analysis of wallet assets using OpenRouter
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { assets, walletAddress } = req.body;

    if (!assets || !Array.isArray(assets)) {
      return res.status(400).json({ error: 'assets array is required' });
    }

    // Prepare asset summary for AI
    const assetSummary = assets.slice(0, 20).map(asset => ({
      id: asset.id,
      interface: asset.interface,
      content: asset.content?.metadata?.name || 'Unknown',
      collection: asset.grouping?.[0]?.group_value || 'N/A',
    }));

    const prompt = `You are a Solana blockchain analyst. Analyze the following wallet assets and provide insights:

Wallet Address: ${walletAddress}
Total Assets: ${assets.length}

Sample Assets (first 20):
${JSON.stringify(assetSummary, null, 2)}

Please provide:
1. A brief overview of the wallet's portfolio
2. Notable collections or tokens
3. Estimated engagement level (based on diversity and quantity)
4. Recommendations for the user
5. Training suggestions to improve their Solana knowledge

Keep the response concise and actionable.`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'Train2Earn Solana Platform',
        },
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    res.json({ analysis: aiResponse });
  } catch (error) {
    console.error('Error in AI analysis:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to generate AI analysis',
      details: error.response?.data || error.message
    });
  }
});

// ========== REAL $CLAWD REWARDS (Jev earnings ledger + treasury) ==========
// Earnings come only from persisted Jev training-data ratings. The old
// /api/rewards/calculate endpoint invented rewards from wallet asset counts
// and was removed — nothing on this site displays unearned numbers.

// Real reward balance for a wallet: earned / paid / pending / claimable.
app.get('/api/rewards/balance/:walletAddress', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database unavailable — rewards ledger is offline.' });
    }
    const balance = await getRewardBalance(pool, req.params.walletAddress);
    const payouts = await listPayouts(pool, req.params.walletAddress);
    res.json({ ...balance, payouts });
  } catch (error) {
    console.error('Error fetching reward balance:', error.message);
    res.status(500).json({ error: 'Failed to fetch reward balance', details: error.message });
  }
});

// Request a payout of the full claimable balance. Records a pending payout
// the treasury owner settles from the treasury wallet; idempotent while a
// payout is already pending. Funds can only ever go to the earning wallet.
app.post('/api/rewards/claim', async (req, res) => {
  try {
    const { walletAddress } = req.body || {};
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database unavailable — rewards ledger is offline.' });
    }
    const result = await requestClaim(pool, walletAddress);
    const balance = await getRewardBalance(pool, walletAddress);
    res.json({ ...result, balance });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Live on-chain state of the rewards treasury (public read, cached 60s).
app.get('/api/rewards/treasury', async (_req, res) => {
  try {
    const state = await getTreasuryState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read treasury state', details: error.message });
  }
});

// Mark a pending payout as paid after the treasury owner sends it on-chain.
// Gated by REWARDS_ADMIN_KEY; disabled entirely when the key is unset.
app.post('/api/rewards/payouts/:id/mark-paid', async (req, res) => {
  try {
    const adminKey = process.env.REWARDS_ADMIN_KEY;
    if (!adminKey || req.get('x-admin-key') !== adminKey) {
      return res.status(403).json({ error: 'Payout reconciliation is not enabled.' });
    }
    const { txSignature } = req.body || {};
    if (!txSignature) {
      return res.status(400).json({ error: 'txSignature is required' });
    }
    if (!dbConnected) {
      return res.status(503).json({ error: 'Database unavailable.' });
    }
    const payout = await markPayoutPaid(pool, Number(req.params.id), txSignature);
    if (!payout) {
      return res.status(404).json({ error: 'No pending payout with that id.' });
    }
    res.json({ payout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ARWEAVE ENDPOINTS ==========

const ARWEAVE_GATEWAY = 'https://arweave.net';

function sanitizeArweaveTagValue(value) {
  return String(value || '').replace(/["\\]/g, '').slice(0, 120);
}

function safeLimit(value, fallback = 50, max = 100) {
  return Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);
}

// Query AI models from Arweave via GraphQL
app.get('/api/arweave/models', async (req, res) => {
  try {
    const { modelType, creator } = req.query;
    const limit = safeLimit(req.query.limit);

    const tagFilters = [
      `{ name: "App-Name", values: ["SolanaAI"] }`,
      modelType ? `{ name: "Model-Type", values: ["${sanitizeArweaveTagValue(modelType)}"] }` : '',
      creator ? `{ name: "Creator", values: ["${sanitizeArweaveTagValue(creator)}"] }` : '',
    ].filter(Boolean).join('\n            ');

    const query = `
      query {
        transactions(
          tags: [
            ${tagFilters}
          ]
          first: ${limit}
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              tags { name value }
              block { height timestamp }
            }
          }
        }
      }
    `;

    const response = await axios.post(
      `${ARWEAVE_GATEWAY}/graphql`,
      { query },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const edges = response.data?.data?.transactions?.edges || [];
    const models = edges.map(edge => {
      const tags = {};
      edge.node.tags.forEach(t => { tags[t.name] = t.value; });
      return {
        txId: edge.node.id,
        name: tags['Model-Name'] || 'Unnamed',
        version: tags['Model-Version'] || '1.0.0',
        modelType: tags['Model-Type'] || 'general',
        size: parseInt(tags['Model-Size'], 10) || 0,
        creator: tags['Model-Creator'] || tags['Creator'] || 'anonymous',
        description: tags['Description'] || '',
        accuracy: parseFloat(tags['Accuracy']) || 0,
        createdAt: parseInt(tags['Created-At'], 10) || 0,
        blockHeight: edge.node.block?.height || null,
        timestamp: edge.node.block?.timestamp || null,
        url: `${ARWEAVE_GATEWAY}/${edge.node.id}`,
      };
    });

    res.json({ models });
  } catch (error) {
    console.error('Error querying Arweave models:', error.message);
    res.status(500).json({ error: 'Failed to query models', details: error.message });
  }
});

// Get model metadata from Arweave
app.get('/api/arweave/model/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    const response = await axios.get(`${ARWEAVE_GATEWAY}/${txId}`, {
      headers: { Accept: 'application/json' },
      timeout: 15000,
    });
    res.json({ metadata: response.data });
  } catch (error) {
    console.error('Error fetching Arweave metadata:', error.message);
    res.status(500).json({ error: 'Failed to fetch metadata', details: error.message });
  }
});

// Check Arweave transaction status
app.get('/api/arweave/status/:txId', async (req, res) => {
  try {
    const { txId } = req.params;
    const response = await axios.get(`${ARWEAVE_GATEWAY}/tx/${txId}/status`, {
      timeout: 10000,
    });
    res.json({ status: response.data });
  } catch (error) {
    if (error.response?.status === 202) {
      res.json({ status: { confirmed: false, status: 'pending' } });
    } else {
      console.error('Error checking Arweave status:', error.message);
      res.status(500).json({ error: 'Failed to check status', details: error.message });
    }
  }
});

// ========== DAO ENDPOINTS ==========

const proposals = [
  {
    id: 'prop_1',
    title: 'Improve code generation model accuracy',
    description: 'Improve code generation model accuracy',
    targetParam: 'code_generation',
    trainingBudget: 50,
    budget: 50,
    votesFor: 1240,
    votesAgainst: 380,
    status: 'active',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    deadline: Date.now() + 4 * 24 * 60 * 60 * 1000,
    endsAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
    zkProofRequired: true,
    creator: 'community',
    voters: {},
  },
  {
    id: 'prop_2',
    title: 'Add multimodal AI support',
    description: 'Extend platform to support image + text models',
    targetParam: 'multimodal',
    trainingBudget: 100,
    budget: 100,
    votesFor: 890,
    votesAgainst: 340,
    status: 'active',
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    deadline: Date.now() + 1 * 24 * 60 * 60 * 1000,
    endsAt: Date.now() + 1 * 24 * 60 * 60 * 1000,
    zkProofRequired: false,
    creator: 'community',
    voters: {},
  },
];

function publicProposal(proposal) {
  const totalVotes = Number(proposal.votesFor || 0) + Number(proposal.votesAgainst || 0);
  const approval = totalVotes > 0 ? Number(((Number(proposal.votesFor || 0) / totalVotes) * 100).toFixed(2)) : 0;
  return {
    ...proposal,
    description: proposal.description || proposal.title,
    targetParam: proposal.targetParam || proposal.target_param || 'general',
    trainingBudget: Number(proposal.trainingBudget ?? proposal.training_budget ?? proposal.budget ?? 0),
    budget: Number(proposal.budget ?? proposal.trainingBudget ?? proposal.training_budget ?? 0),
    executed: proposal.executed ?? proposal.status === 'executed',
    deadline: proposal.deadline || proposal.endsAt,
    endsAt: proposal.endsAt || proposal.deadline,
    totalVotes,
    approval,
    voters: undefined,
  };
}

function filterProposalList(list, { status, limit, offset }) {
  const safeLimitValue = safeLimit(limit, 50, 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const filtered = status ? list.filter((proposal) => proposal.status === status) : list;
  return {
    proposals: filtered.slice(safeOffset, safeOffset + safeLimitValue).map(publicProposal),
    total: filtered.length,
    limit: safeLimitValue,
    offset: safeOffset,
  };
}

async function listDbProposals({ status, limit, offset }) {
  const safeLimitValue = safeLimit(limit, 50, 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const params = [];
  const where = status ? `WHERE p.status = $${params.push(status)}` : '';
  params.push(safeLimitValue, safeOffset);

  const result = await pool.query(
    `SELECT
       p.*,
       COALESCE(SUM(CASE WHEN v.vote = 'for' THEN v.voting_power ELSE 0 END), 0) AS votes_for,
       COALESCE(SUM(CASE WHEN v.vote = 'against' THEN v.voting_power ELSE 0 END), 0) AS votes_against
     FROM dao_proposals p
     LEFT JOIN dao_votes v ON v.proposal_id = p.id
     ${where}
     GROUP BY p.id
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    proposals: result.rows.map((row) => publicProposal({
      id: row.id,
      title: row.title,
      description: row.description,
      targetParam: row.target_param,
      trainingBudget: row.training_budget,
      budget: row.training_budget,
      votesFor: Number(row.votes_for || 0),
      votesAgainst: Number(row.votes_against || 0),
      status: row.status,
      createdAt: row.created_at,
      deadline: row.deadline,
      endsAt: row.deadline,
      zkProofRequired: row.zk_proof_required,
      creator: row.creator,
      metadata: row.metadata,
    })),
    total: result.rows.length,
    limit: safeLimitValue,
    offset: safeOffset,
  };
}

app.get('/api/proposals/list', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    if (dbConnected) {
      const dbResult = await listDbProposals({ status, limit, offset });
      if (dbResult.proposals.length > 0 || status) {
        return res.json({ ...dbResult, source: 'database' });
      }
    }

    res.json({ ...filterProposalList(proposals, { status, limit, offset }), source: 'memory' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list proposals', details: error.message });
  }
});

app.post('/api/proposals/create', async (req, res) => {
  try {
    const {
      title,
      description,
      targetParam = 'general',
      trainingBudget,
      budget,
      zkProofRequired,
      duration = 604800,
      walletAddress,
      signature,
      metadata = {},
    } = req.body || {};
    const cleanDescription = String(description || title || '').trim();

    if (!cleanDescription) {
      return res.status(400).json({ error: 'description or title is required' });
    }

    const proposal = {
      id: `prop_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`,
      title: title || cleanDescription.slice(0, 90),
      description: cleanDescription,
      targetParam,
      trainingBudget: Number(trainingBudget ?? budget ?? 0),
      budget: Number(trainingBudget ?? budget ?? 0),
      votesFor: 0,
      votesAgainst: 0,
      status: 'active',
      createdAt: Date.now(),
      deadline: Date.now() + (Math.max(Number(duration) || 604800, 60) * 1000),
      endsAt: Date.now() + (Math.max(Number(duration) || 604800, 60) * 1000),
      zkProofRequired: Boolean(zkProofRequired),
      creator: walletAddress || 'anonymous',
      signature: signature || null,
      metadata,
      voters: {},
    };

    if (dbConnected) {
      await pool.query(
        `INSERT INTO dao_proposals (
          id,
          title,
          description,
          target_param,
          training_budget,
          creator,
          zk_proof_required,
          status,
          deadline,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', to_timestamp($8 / 1000.0), $9)`,
        [
          proposal.id,
          proposal.title,
          proposal.description,
          proposal.targetParam,
          proposal.trainingBudget,
          proposal.creator,
          proposal.zkProofRequired,
          proposal.deadline,
          JSON.stringify({ ...metadata, signature: signature || null }),
        ],
      );
    } else {
      proposals.push(proposal);
    }

    res.status(201).json({
      success: true,
      proposalId: proposal.id,
      txSignature: signature || null,
      message: 'Proposal created successfully',
      proposal: publicProposal(proposal),
      source: dbConnected ? 'database' : 'memory',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create proposal', details: error.message });
  }
});

app.post('/api/proposals/vote', async (req, res) => {
  try {
    const { proposalId, vote, walletAddress, signature, votingPower = 1 } = req.body || {};
    if (!proposalId) return res.status(400).json({ error: 'proposalId is required' });
    if (!['for', 'against'].includes(vote)) {
      return res.status(400).json({ error: 'vote must be "for" or "against"' });
    }

    const voter = walletAddress || req.ip || 'anonymous';
    const power = Math.max(Number(votingPower) || 1, 1);

    if (dbConnected) {
      const proposalResult = await pool.query('SELECT id, status FROM dao_proposals WHERE id = $1', [proposalId]);
      if (proposalResult.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
      if (proposalResult.rows[0].status !== 'active') return res.status(400).json({ error: 'Proposal is not active' });

      await pool.query(
        `INSERT INTO dao_votes (proposal_id, voter, vote, signature, voting_power, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (proposal_id, voter) DO UPDATE SET
           vote = EXCLUDED.vote,
           signature = EXCLUDED.signature,
           voting_power = EXCLUDED.voting_power,
           updated_at = NOW()`,
        [proposalId, voter, vote, signature || null, power],
      );

      const counts = await pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN vote = 'for' THEN voting_power ELSE 0 END), 0) AS votes_for,
           COALESCE(SUM(CASE WHEN vote = 'against' THEN voting_power ELSE 0 END), 0) AS votes_against
         FROM dao_votes
         WHERE proposal_id = $1`,
        [proposalId],
      );

      return res.json({
        success: true,
        txSignature: signature || null,
        newVoteCount: {
          for: Number(counts.rows[0].votes_for || 0),
          against: Number(counts.rows[0].votes_against || 0),
        },
        source: 'database',
      });
    }

    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'active') return res.status(400).json({ error: 'Proposal is not active' });

    const previous = proposal.voters?.[voter];
    if (previous?.vote === 'for') proposal.votesFor -= previous.votingPower;
    if (previous?.vote === 'against') proposal.votesAgainst -= previous.votingPower;

    proposal.voters = proposal.voters || {};
    proposal.voters[voter] = { vote, votingPower: power, signature: signature || null, votedAt: Date.now() };
    if (vote === 'for') proposal.votesFor += power;
    if (vote === 'against') proposal.votesAgainst += power;

    res.json({
      success: true,
      txSignature: signature || null,
      newVoteCount: {
        for: proposal.votesFor,
        against: proposal.votesAgainst,
      },
      proposal: publicProposal(proposal),
      source: 'memory',
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to vote on proposal', details: error.message });
  }
});

// ========== AI MODELS REGISTRY ENDPOINTS ==========

// The registry starts empty. Models appear here only when a user actually
// registers one (POST /api/models/register) or when rows exist in Neon.
// The previous hardcoded seed entries ("BuilderCode Solana 3B" and the
// PiedPiper agent) carried invented accuracy/download/inference stats and
// a fabricated verification badge, and have been removed.
const modelRegistry = [];
const runtimeModelRegistry = new Map();

function normalizeModelForList(model) {
  return {
    ...model,
    id: model.id || model.modelId || model.asset || model.modelCid,
    modelType: normalizeModelType(model.modelType || model.type || 'GENERAL'),
    storageType: model.storageType || detectModelStorageType(model.artifactUri || model.modelCid || model.modelRegistrationUri),
    price: Number(model.price || model.document?.pricing?.price || 0),
    accuracy: Number(model.accuracy || model.document?.evaluations?.[0]?.score || 0),
    downloads: Number(model.downloads || 0),
    createdAt: model.createdAt || new Date().toISOString(),
    updatedAt: model.updatedAt || model.createdAt || new Date().toISOString(),
  };
}

function memoryModelList() {
  return Array.from(runtimeModelRegistry.values()).map(normalizeModelForList);
}

function findMemoryModel(identifier) {
  const needle = String(identifier || '').toLowerCase();
  return memoryModelList().find((model) => [
    model.id,
    model.asset,
    model.modelCid,
    model.txId,
    model.artifactUri,
    model.modelRegistrationUri,
    model.huggingFaceRepo,
  ].filter(Boolean).some((value) => String(value).toLowerCase() === needle || String(value).toLowerCase().includes(needle)));
}

app.get('/api/models/list', async (req, res) => {
  try {
    const options = {
      type: req.query.type || req.query.modelType,
      limit: req.query.limit,
      offset: req.query.offset,
      sortBy: req.query.sortBy,
      query: req.query.query || req.query.q,
    };

    if (!dbConnected) {
      return res.json({ ...filterAndSortModelEntries(memoryModelList(), options), source: 'memory' });
    }

    const [registrationResult, catalogResult] = await Promise.all([
      pool.query(`SELECT * FROM model_registrations ORDER BY updated_at DESC LIMIT 250`),
      listModelCatalogEntries(pool, { ...options, limit: 250, offset: 0 }),
    ]);
    const registrationModels = registrationResult.rows.map(rowToModelRegistration).map(normalizeModelForList);
    const catalogModels = catalogResult.models.map(normalizeModelForList);
    const merged = new Map();

    [...memoryModelList(), ...registrationModels, ...catalogModels].forEach((model) => (
      merged.set(model.id || model.asset || model.modelCid, model)
    ));
    const result = filterAndSortModelEntries(Array.from(merged.values()), options);

    res.json({
      ...result,
      source: registrationModels.length > 0 || catalogModels.length > 0 ? 'database' : 'memory',
    });
  } catch (error) {
    console.error('Error listing model registrations:', error.message);
    res.status(500).json({ error: 'Failed to list model registrations', details: error.message });
  }
});

app.post('/api/models/register', async (req, res) => {
  try {
    const input = req.body || {};
    if (!input.name && !input.modelCid && !input.cid && !input.txId && !input.artifactUri) {
      return res.status(400).json({ error: 'name plus modelCid, cid, txId, or artifactUri is required' });
    }

    const model = normalizeModelForList(modelCatalogEntryFromInput(input));
    runtimeModelRegistry.set(model.id, model);

    const storedModel = dbConnected ? await persistModelCatalogEntry(pool, model) : null;
    res.status(201).json({
      success: true,
      model: storedModel || model,
      source: storedModel ? 'database' : 'memory',
      storageType: model.storageType,
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to register model', details: error.message });
  }
});

app.get('/api/models/identity/:asset', (req, res) => {
  try {
    res.json(deriveModelIdentityPda(req.params.asset));
  } catch (error) {
    res.status(400).json({ error: 'Invalid model asset public key', details: error.message });
  }
});

app.get('/api/models/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    let model = findMemoryModel(identifier);

    if (!model && dbConnected) {
      const registrationResult = await pool.query(
        `SELECT * FROM model_registrations
         WHERE model_id = $1 OR asset = $1 OR model_identity_pda = $1
         LIMIT 1`,
        [identifier],
      );
      if (registrationResult.rows.length > 0) {
        model = normalizeModelForList(rowToModelRegistration(registrationResult.rows[0]));
      }

      if (!model) {
        const catalogResult = await pool.query(
          `SELECT * FROM model_catalog_entries
           WHERE id = $1 OR model_cid = $1 OR artifact_uri = $1 OR metadata_uri = $1
           LIMIT 1`,
          [identifier],
        );
        if (catalogResult.rows.length > 0) {
          model = normalizeModelForList(rowToModelCatalogEntry(catalogResult.rows[0]));
        }
      }
    }

    if (!model) {
      return res.status(404).json({ error: 'Model not found', identifier });
    }

    res.json({ model });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch model', details: error.message });
  }
});

app.post('/api/models/metaplex-asset', async (req, res) => {
  try {
    const { asset, collection, authority, dasAsset } = req.body;

    if (!asset) {
      return res.status(400).json({ error: 'asset is required' });
    }

    const source = dasAsset
      ? { configured: true, dasAsset, error: null, mode: 'provided' }
      : { ...(await fetchMetaplexDasAsset(asset)), mode: 'helius' };

    if (!source.configured) {
      return res.status(503).json({
        error: 'Metaplex DAS verification is not configured',
        details: source.error,
      });
    }

    const verification = evaluateMetaplexDasAsset({
      expectedAsset: asset,
      expectedCollection: collection,
      expectedAuthority: authority,
      dasAsset: source.dasAsset,
    });

    res.json({ verification, source: source.mode });
  } catch (error) {
    res.status(400).json({ error: 'Failed to verify Metaplex model asset', details: error.message });
  }
});

app.post('/api/models/registration-document', (req, res) => {
  try {
    const document = createModelRegistrationDocument(req.body);
    const validationErrors = validateModelRegistrationDocument(document);

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Invalid model registration document', details: validationErrors });
    }

    res.json({ document });
  } catch (error) {
    res.status(400).json({ error: 'Failed to create model registration document', details: error.message });
  }
});

app.post('/api/models/register-intent', async (req, res) => {
  try {
    const { registrationUri, collection, authority, metaplexDasAsset, requireMetaplexVerification, ...documentInput } = req.body;
    const document = createModelRegistrationDocument(documentInput);
    const validationErrors = validateModelRegistrationDocument(document);

    if (!registrationUri) validationErrors.push('registrationUri is required');
    if (!authority) validationErrors.push('authority is required');

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Invalid model registration intent', details: validationErrors });
    }

    const identity = createModelIdentityRecord({
      asset: documentInput.asset,
      collection,
      registrationUri,
      authority,
      document,
    });
    const transactionPlan = createRegisterModelIdentityTransactionPlan({
      ...identity,
      document,
    });
    const metaplexVerification = metaplexDasAsset
      ? evaluateMetaplexDasAsset({
        expectedAsset: documentInput.asset,
        expectedCollection: collection,
        expectedAuthority: authority,
        dasAsset: metaplexDasAsset,
      })
      : null;

    if (requireMetaplexVerification && !metaplexVerification?.verified) {
      return res.status(400).json({
        error: 'Metaplex model asset verification failed',
        details: metaplexVerification?.error || 'metaplexDasAsset is required when requireMetaplexVerification is true',
        metaplexVerification,
      });
    }

    const attestations = buildProviderAttestations({
      ...documentInput,
      modelIdentityPda: identity.modelIdentityPda,
      authority,
      collection,
      metaplexDasAsset,
    });
    const storedModel = dbConnected ? await persistModelRegistration(pool, {
      documentInput,
      identity,
      document,
      transactionPlan,
      attestations,
    }) : null;

    res.json({
      identity,
      document,
      transactionPlan,
      attestations,
      metaplexVerification,
      storedModel,
      nextInstruction: 'Mint MPL Core asset, upload this document permanently, then call registerModelIdentityV1.',
    });
  } catch (error) {
    res.status(400).json({ error: 'Failed to prepare model registration intent', details: error.message });
  }
});

app.post('/api/models/provider-attestations', (req, res) => {
  try {
    res.json({ attestations: buildProviderAttestations(req.body) });
  } catch (error) {
    res.status(400).json({ error: 'Failed to validate provider attestations', details: error.message });
  }
});

app.post('/api/models/status', async (req, res) => {
  try {
    const { asset, status, signature } = req.body;
    const allowedStatuses = new Set(['prepared', 'submitted', 'confirmed', 'rejected', 'inactive']);

    if (!asset) return res.status(400).json({ error: 'asset is required' });
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ error: 'status must be prepared, submitted, confirmed, rejected, or inactive' });
    }

    if (!dbConnected) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const result = await pool.query(
      `UPDATE model_registrations
       SET status = $2,
           transaction_plan = transaction_plan || $3::jsonb,
           updated_at = NOW()
       WHERE asset = $1
       RETURNING *`,
      [asset, status, JSON.stringify(signature ? { signature } : {})]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Model registration not found' });
    }

    res.json({ model: rowToModelRegistration(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update model registration status', details: error.message });
  }
});

// ── File upload + CLAWD agent pipeline ──────────────────────────────────────

async function analyzeWithGrok(fileBuffer, mimeType, filename) {
  const keyValid = XAI_API_KEY && !XAI_API_KEY.includes('placeholder');
  if (!keyValid) {
    return {
      summary: `${filename} · ${mimeType || 'binary'} · ${fileBuffer.length} bytes`,
      analysis: 'Set a real XAI_API_KEY in .env to enable Grok analysis. File indexed successfully.',
      tags: [],
    };
  }

  const isImage = mimeType.startsWith('image/');
  const messages = isImage
    ? [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${fileBuffer.toString('base64')}` },
            },
            {
              type: 'text',
              text: 'Analyze this image for its relevance to AI/ML models, datasets, or research. Describe what it contains, its potential use in training data, and any quality indicators. Be concise (3-5 sentences).',
            },
          ],
        },
      ]
    : [
        {
          role: 'user',
          content: `Analyze this file named "${filename}" (type: ${mimeType || 'unknown'}) for its relevance to AI/ML model training, datasets, or research. Here is a text preview:\n\n${fileBuffer.slice(0, 4000).toString('utf8', 0, 4000)}\n\nDescribe: content type, ML relevance, data quality indicators, and suggested Hugging Face search tags. Be concise (4-6 sentences).`,
        },
      ];

  const resp = await axios.post(
    'https://api.x.ai/v1/chat/completions',
    {
      model: isImage ? 'grok-2-vision-1212' : 'grok-3-mini',
      messages,
      max_tokens: 400,
      temperature: 0.3,
    },
    {
      headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 20000,
    },
  );

  const text = resp.data.choices?.[0]?.message?.content || '';
  const tagMatch = text.match(/tags?[:\s]+([^\n.]+)/i);
  const tags = tagMatch
    ? tagMatch[1].split(/[,;]+/).map((t) => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 5)
    : [];

  return { summary: `${filename} · ${mimeType || 'binary'} · ${fileBuffer.length} bytes`, analysis: text, tags };
}

async function searchHuggingFace(query, tags = []) {
  const searchQuery = [query, ...tags].join(' ').slice(0, 200);
  try {
    const resp = await axios.get('https://huggingface.co/api/models', {
      params: { search: searchQuery, limit: 8, sort: 'downloads', direction: -1 },
      timeout: 8000,
    });
    return (resp.data || []).map((m) => ({
      id: m.id || m.modelId,
      downloads: m.downloads,
      likes: m.likes,
      pipeline: m.pipeline_tag,
      tags: m.tags || [],
    }));
  } catch {
    return [];
  }
}

async function getClawdBalance(walletAddress) {
  if (!walletAddress || !heliusRpcUrl()) return 0;
  try {
    const resp = await axios.post(
      heliusRpcUrl(),
      {
        jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
        params: [walletAddress, { mint: CLAWD_MINT }, { encoding: 'jsonParsed' }],
      },
      { timeout: 6000 },
    );
    const accounts = resp.data?.result?.value || [];
    return accounts.reduce((sum, a) => sum + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
  } catch {
    return 0;
  }
}

function scoreContribution({ fileSize, hfModels, analysis, mimeType }) {
  let score = 30;
  if (fileSize > 10_000) score += 10;
  if (fileSize > 100_000) score += 10;
  if (mimeType?.startsWith('image/')) score += 8;
  if (/dataset|training|label|annotation/i.test(analysis)) score += 15;
  if (/high.quality|diverse|benchmark/i.test(analysis)) score += 10;
  if (hfModels.length >= 3) score += 7;
  return Math.min(score, 100);
}

function calcClawdReward(score, clawdBalance) {
  const base = Math.round((score / 100) * 50);
  const holderBonus = clawdBalance >= 100_000 ? 1.5 : clawdBalance >= 10_000 ? 1.25 : clawdBalance >= 1_000 ? 1.1 : 1.0;
  return Math.round(base * holderBonus);
}

app.post('/api/upload/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const { originalname, mimetype, buffer } = req.file;
    const walletAddress = req.body.walletAddress || null;

    const grokResult = await analyzeWithGrok(buffer, mimetype, originalname);

    const hfQuery = originalname.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const hfModels = await searchHuggingFace(hfQuery, grokResult.tags || []);

    const heuristicScore = scoreContribution({
      fileSize: buffer.length,
      hfModels,
      analysis: grokResult.analysis,
      mimeType: mimetype,
    });

    // Tracking + real rewards: a text-extractable file uploaded with a
    // connected wallet goes through the same Jev rating pipeline as the
    // Jev panel, so EVERY file submission is persisted in training_ratings,
    // appears in the live submissions feed, and earns real ledger CLAWD.
    // (This replaces the old invented "holder bonus" reward math, which was
    // never credited anywhere.)
    const textLike = mimetype.startsWith('text/')
      || mimetype === 'application/json'
      || /\.(txt|md|json|jsonl|csv|log)$/i.test(originalname);
    let extractedText = '';
    if (textLike) {
      const decoded = buffer.toString('utf8');
      const replacementRatio = (decoded.match(/�/g) || []).length / Math.max(decoded.length, 1);
      if (replacementRatio < 0.05) extractedText = decoded;
    }

    let jevRating = null;
    if (walletAddress && extractedText.trim().length > 0 && dbConnected) {
      try {
        const rating = await rateTrainingData({
          content: extractedText,
          filename: originalname,
          mimeType: mimetype,
          walletAddress,
        });
        const saved = await saveJevRating(pool, rating);
        jevRating = {
          id: saved.id,
          score: rating.score,
          tier: rating.tier,
          multiplier: rating.multiplier,
          clawdReward: rating.clawdReward,
          source: rating.source,
        };
      } catch (ratingError) {
        console.error('Upload Jev rating failed:', ratingError.message);
      }
    }

    res.json({
      summary: grokResult.summary,
      analysis: grokResult.analysis,
      tags: grokResult.tags || [],
      hfModels,
      score: jevRating ? jevRating.score : heuristicScore,
      scoreRationale: jevRating
        ? 'Rated by the Jev decision engine and tracked in the live submissions feed.'
        : `Heuristic estimate based on file size, content relevance, and HF coverage (${hfModels.length} related models found). Connect a wallet and upload text data to get a real Jev rating.`,
      clawdReward: jevRating ? jevRating.clawdReward : 0,
      rewardBreakdown: jevRating
        ? `Jev rating #${jevRating.id} · ${jevRating.tier} tier (×${jevRating.multiplier}) · credited to your rewards ledger — claim it from the Portfolio tab.`
        : 'No CLAWD credited for this upload. Text files uploaded with a connected wallet are Jev-rated and earn real CLAWD.',
      jevRating,
      tracked: Boolean(jevRating),
      walletAddress,
      clawdMint: CLAWD_MINT,
    });
  } catch (error) {
    console.error('Upload analyze error:', error.message);
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});

// Initialize database and start server
async function start() {
  // Test and initialize database
  dbConnected = await testConnection();
  if (dbConnected) {
    await initDB();
    await ensureJevRatingsTable(pool);
    await ensureRewardPayoutsTable(pool);
  } else {
    console.log('Server starting without database. Set DATABASE_URL in .env to connect.');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Helius API configured: ${HELIUS_API_KEY ? 'Yes' : 'No'}`);
    console.log(`OpenRouter API configured: ${OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
    console.log(`Database connected: ${dbConnected ? 'Yes' : 'No'}`);
    console.log(`Phantom wallet SDK configured: ${phantomConfigured() ? 'Yes' : 'No (dormant)'}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}

export { app, start };
