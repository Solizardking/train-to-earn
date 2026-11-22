// Jev decision engine for TrainToEarn.
//
// When a user signs in with their Solana wallet and submits training data,
// this module rates the data's quality in realtime using the TypeSafe Jev
// decision model (typesafeai-jev-1-14-0) served through the Neon AI Gateway,
// blended with the existing local heuristic analysis. The rating maps to the
// shared contribution tiers and a $CLAWD reward estimate, and is persisted
// per wallet (training_ratings) so the user's profile shows their latest
// score the moment they connect.
//
// Gateway access uses the Neon AI SDK provider:
//   NEON_AI_GATEWAY_BASE_URL  (bare branch gateway host)
//   NEON_AI_GATEWAY_TOKEN     (branch-scoped Neon credential)
//
// If the gateway is not configured or a decision call fails, the engine
// falls back to the heuristic score alone and says so in `source` — a rating
// is never blocked on the gateway, and a Jev verdict is never faked.

import { experimental_decide as decide } from 'ai';
import * as neonProviderPkg from '@neondatabase/ai-sdk-provider';
import { analyzeTrainingContribution, contributionTiers } from './consensusTraining.js';

export const JEV_MODEL_ID = process.env.JEV_MODEL || 'typesafeai-jev-1-14-0';

export function jevConfigured() {
  return Boolean(process.env.NEON_AI_GATEWAY_BASE_URL && process.env.NEON_AI_GATEWAY_TOKEN);
}

export function jevGatewayHost() {
  try {
    return new URL(process.env.NEON_AI_GATEWAY_BASE_URL).host;
  } catch {
    return null;
  }
}

// Resolve a Jev decision model from whichever provider shape the installed
// @neondatabase/ai-sdk-provider exposes (instance with .decisionModel, or a
// factory). Explicit gateway settings are passed when the factory accepts
// them; otherwise the provider reads NEON_AI_GATEWAY_* from the env itself.
function jevDecisionModel() {
  const pkg = neonProviderPkg;
  const settings = {
    apiKey: process.env.NEON_AI_GATEWAY_TOKEN,
    baseURL: process.env.NEON_AI_GATEWAY_BASE_URL,
  };
  const candidates = [];
  if (pkg.neon) candidates.push(pkg.neon);
  if (pkg.default) candidates.push(pkg.default);
  for (const candidate of candidates) {
    if (candidate && typeof candidate.decisionModel === 'function') {
      return candidate.decisionModel(JEV_MODEL_ID);
    }
    if (typeof candidate === 'function') {
      try {
        const provider = candidate(settings);
        if (provider && typeof provider.decisionModel === 'function') {
          return provider.decisionModel(JEV_MODEL_ID);
        }
      } catch { /* try the next shape */ }
      try {
        const provider = candidate();
        if (provider && typeof provider.decisionModel === 'function') {
          return provider.decisionModel(JEV_MODEL_ID);
        }
      } catch { /* fall through */ }
    }
  }
  if (typeof pkg.createNeon === 'function') {
    const provider = pkg.createNeon(settings);
    if (provider && typeof provider.decisionModel === 'function') {
      return provider.decisionModel(JEV_MODEL_ID);
    }
  }
  throw new Error('Installed @neondatabase/ai-sdk-provider exposes no decisionModel()');
}

const JEV_QUESTIONS = {
  solana_specific: {
    type: 'boolean',
    instructions:
      'Is the content specifically about Solana — its programs, accounts, transactions, tokens, validators, or DeFi — rather than generic crypto or unrelated material?',
    criteria: { true: 'Specifically about Solana', false: 'Not Solana-specific' },
  },
  teaches_something: {
    type: 'boolean',
    instructions:
      'Does the content teach or demonstrate something a model could learn from — an instruction/response pair, a worked example, code with explanation, or reasoned analysis — rather than raw unlabelled dumps or chatter?',
    criteria: { true: 'Teaches something learnable', false: 'Nothing learnable' },
  },
  original: {
    type: 'boolean',
    instructions:
      'Does the content read as original, non-templated work, rather than copied text, boilerplate, lorem ipsum, placeholders, or auto-generated filler?',
    criteria: { true: 'Original content', false: 'Copied or filler' },
  },
  well_formed: {
    type: 'boolean',
    instructions:
      'Is the content coherent and well-structured for its format (readable prose, valid JSON/CSV shape, or organised code)?',
    criteria: { true: 'Well-formed', false: 'Malformed or incoherent' },
  },
  safe_to_train: {
    type: 'boolean',
    instructions:
      'Is the content free of secrets, private keys, seed phrases, passwords, personal data, and harmful instructions, so it is safe to train on?',
    criteria: { true: 'Safe to train on', false: 'Contains secrets or harmful content' },
  },
  quality_score: {
    type: 'score',
    instructions:
      'Overall quality of this contribution as training data for a Solana AI model.',
    criteria: [
      'Useless: no learnable signal, filler, or harmful content',
      'Weak: some topical content but shallow, messy, or mostly templated',
      'Useful: clear, correct, on-topic material a model can learn from',
      'Strong: well-structured, original, detailed Solana training material',
      'Exceptional: expert-grade, precise, richly explained Solana training data',
    ],
  },
};

// Jev answers follow the Neon decision-model contract:
// boolean -> { type: 'boolean', probability }   (probability = P(true))
// score   -> { type: 'score', score, probabilities? }
// choice  -> { type: 'choice', choice, probabilities? }
// A few legacy/wrapped shapes are tolerated defensively.
export function extractBoolean(answer) {
  if (answer === true || answer === 'true') return { value: true, confidence: 1, pTrue: 1 };
  if (answer === false || answer === 'false') return { value: false, confidence: 1, pTrue: 0 };
  if (answer && typeof answer === 'object') {
    if (typeof answer.probability === 'number') {
      const pTrue = answer.probability;
      return { value: pTrue >= 0.5, confidence: Math.max(pTrue, 1 - pTrue), pTrue };
    }
    const probs = answer.probabilities || null;
    if (probs && (typeof probs.true === 'number' || typeof probs.false === 'number')) {
      const pTrue = typeof probs.true === 'number' ? probs.true : 1 - probs.false;
      return { value: pTrue >= 0.5, confidence: Math.max(pTrue, 1 - pTrue), pTrue };
    }
    if ('answer' in answer) return extractBoolean(answer.answer);
    if ('value' in answer) return extractBoolean(answer.value);
  }
  return { value: false, confidence: 0, pTrue: 0 };
}

// Normalise a Jev score answer to 0-100. Raw scores may arrive on a 0-1,
// 0-5 (rubric index), 0-10, or 0-100 scale; the rubric has 5 levels, so a
// fractional or small-integer score is rescaled accordingly.
export function extractScore(answer, rubricLevels = 5) {
  let raw = null;
  if (typeof answer === 'number' && Number.isFinite(answer)) raw = answer;
  else if (answer && typeof answer === 'object') {
    if (typeof answer.score === 'number') raw = answer.score;
    else if (typeof answer.answer === 'number') raw = answer.answer;
    else if (typeof answer.value === 'number') raw = answer.value;
    else if (answer.probabilities && typeof answer.probabilities === 'object') {
      let total = 0;
      let weight = 0;
      for (const [bucket, p] of Object.entries(answer.probabilities)) {
        const n = Number(bucket);
        if (Number.isFinite(n) && typeof p === 'number') {
          total += n * p;
          weight += p;
        }
      }
      if (weight > 0) raw = total / weight;
    }
  }
  if (raw === null || !Number.isFinite(raw)) return null;
  if (raw <= 1) return raw * 100;
  if (raw <= rubricLevels) return (raw / rubricLevels) * 100;
  if (raw <= 10) return raw * 10;
  return Math.min(100, raw);
}

// Fractional credit for a boolean verdict: full credit when the model is
// sure, partial credit proportional to P(true) when it reports odds.
function boolCredit(extracted) {
  if (typeof extracted.pTrue === 'number') return extracted.pTrue;
  return extracted.value ? extracted.confidence : 1 - extracted.confidence;
}

function tierForScore(score) {
  return contributionTiers.find((tier) => score >= tier.minScore) || contributionTiers.at(-1);
}

function buildState({ analysis, content, walletAddress }) {
  const excerpt = String(content || '').slice(0, 1800);
  const m = analysis.metrics;
  return [
    'Evaluate this Solana training-data contribution for TrainToEarn rewards.',
    `Wallet: ${walletAddress || 'unknown'}`,
    `File: ${analysis.filename} (${analysis.dataType}, ${analysis.dataSize} bytes, ${analysis.metadata?.wordCount ?? 'unknown'} words)`,
    `Heuristic metrics (0-100): completeness ${m.completeness}, accuracy ${m.accuracy}, uniqueness ${m.uniqueness}, richness ${m.richness}, relevance ${m.relevance}, structure ${m.structure}, metadataQuality ${m.metadataQuality}.`,
    'Content excerpt:',
    '"""',
    excerpt,
    '"""',
  ].join('\n');
}

/**
 * Rate one training-data contribution.
 * Returns a rating object; never throws for gateway failures (falls back to
 * the heuristic), but throws TypeError for malformed input.
 */
export async function rateTrainingData({ content, filename, mimeType, metadata, walletAddress } = {}) {
  if (!content || typeof content !== 'string') {
    throw new TypeError('content is required');
  }
  if (!walletAddress || typeof walletAddress !== 'string') {
    throw new TypeError('walletAddress is required — sign in with a Solana wallet first');
  }

  const analysis = analyzeTrainingContribution({ content, filename, mimeType, metadata, walletAddress });
  const heuristicScore = analysis.metrics.overallScore;

  let jev = null;
  let jevError = null;
  if (jevConfigured()) {
    try {
      const { answers, usage } = await decide({
        model: jevDecisionModel(),
        state: buildState({ analysis, content, walletAddress }),
        questions: JEV_QUESTIONS,
      });
      jev = { answers, usage: usage ?? null };
    } catch (err) {
      jevError = err?.message || String(err);
    }
  } else {
    jevError = 'Neon AI Gateway is not configured (NEON_AI_GATEWAY_BASE_URL / NEON_AI_GATEWAY_TOKEN missing)';
  }

  let finalScore = heuristicScore;
  let verdicts = null;
  let unsafe = false;
  if (jev) {
    const a = jev.answers || {};
    const solana = extractBoolean(a.solana_specific);
    const teaches = extractBoolean(a.teaches_something);
    const original = extractBoolean(a.original);
    const formed = extractBoolean(a.well_formed);
    const safe = extractBoolean(a.safe_to_train);
    const quality = extractScore(a.quality_score);

    const jevSubscore =
      boolCredit(solana) * 20 +
      boolCredit(teaches) * 20 +
      boolCredit(original) * 15 +
      boolCredit(formed) * 10 +
      (quality === null ? heuristicScore : Math.max(0, Math.min(100, quality))) * 0.35;

    finalScore = Math.round((heuristicScore * 0.45 + jevSubscore * 0.55) * 10) / 10;
    unsafe = !safe.value;
    if (unsafe) finalScore = Math.min(finalScore, 20);

    verdicts = {
      solana_specific: { ...solana, label: JEV_QUESTIONS.solana_specific.criteria[solana.value] },
      teaches_something: { ...teaches, label: JEV_QUESTIONS.teaches_something.criteria[teaches.value] },
      original: { ...original, label: JEV_QUESTIONS.original.criteria[original.value] },
      well_formed: { ...formed, label: JEV_QUESTIONS.well_formed.criteria[formed.value] },
      safe_to_train: { ...safe, label: JEV_QUESTIONS.safe_to_train.criteria[safe.value] },
      quality_score: quality,
    };
  }

  const tier = tierForScore(finalScore);
  const clawdReward = Math.max(25, Math.round((analysis.dataSize / 1024 + 100) * tier.multiplier));

  return {
    walletAddress,
    dataHash: analysis.dataHash,
    filename: analysis.filename,
    dataType: analysis.dataType,
    dataSize: analysis.dataSize,
    score: finalScore,
    heuristicScore,
    tier: tier.tier,
    tierLabel: tier.label,
    multiplier: tier.multiplier,
    clawdReward,
    unsafe,
    source: jev ? 'jev+heuristic' : 'heuristic-fallback',
    model: JEV_MODEL_ID,
    gatewayHost: jevGatewayHost(),
    verdicts,
    usage: jev?.usage ?? null,
    jevError,
    metrics: analysis.metrics,
    recommendations: analysis.recommendations,
    ratedAt: new Date().toISOString(),
  };
}

// ---- Persistence (Neon Postgres via the shared pg pool) ----

export async function ensureJevRatingsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_ratings (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(44) NOT NULL,
      data_hash VARCHAR(64),
      filename TEXT,
      data_type VARCHAR(40),
      data_size INTEGER DEFAULT 0,
      score NUMERIC NOT NULL,
      heuristic_score NUMERIC,
      tier VARCHAR(20),
      multiplier NUMERIC DEFAULT 1,
      clawd_reward INTEGER DEFAULT 0,
      unsafe BOOLEAN DEFAULT FALSE,
      source VARCHAR(40) DEFAULT 'heuristic-fallback',
      model VARCHAR(80),
      verdicts JSONB,
      usage JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_training_ratings_wallet
    ON training_ratings(wallet_address);
  `);
}

export async function saveJevRating(pool, rating) {
  const { rows } = await pool.query(
    `INSERT INTO training_ratings
       (wallet_address, data_hash, filename, data_type, data_size, score,
        heuristic_score, tier, multiplier, clawd_reward, unsafe, source,
        model, verdicts, usage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING id, created_at`,
    [
      rating.walletAddress,
      rating.dataHash,
      rating.filename,
      rating.dataType,
      rating.dataSize,
      rating.score,
      rating.heuristicScore,
      rating.tier,
      rating.multiplier,
      rating.clawdReward,
      rating.unsafe,
      rating.source,
      rating.model,
      rating.verdicts ? JSON.stringify(rating.verdicts) : null,
      rating.usage ? JSON.stringify(rating.usage) : null,
    ],
  );
  return rows[0];
}

export async function getJevProfile(pool, walletAddress) {
  const { rows: latestRows } = await pool.query(
    `SELECT id, wallet_address, data_hash, filename, data_type, data_size,
            score, heuristic_score, tier, multiplier, clawd_reward, unsafe,
            source, model, verdicts, usage, created_at
     FROM training_ratings
     WHERE wallet_address = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [walletAddress],
  );
  const { rows: aggRows } = await pool.query(
    `SELECT COUNT(*)::int AS ratings_count,
            COALESCE(AVG(score), 0) AS average_score,
            COALESCE(SUM(clawd_reward), 0)::int AS total_clawd_reward,
            MAX(score) AS best_score
     FROM training_ratings
     WHERE wallet_address = $1`,
    [walletAddress],
  );
  return {
    walletAddress,
    latest: latestRows[0] || null,
    stats: {
      ratingsCount: aggRows[0].ratings_count,
      averageScore: Math.round(Number(aggRows[0].average_score) * 10) / 10,
      totalClawdReward: aggRows[0].total_clawd_reward,
      bestScore: aggRows[0].best_score === null ? null : Number(aggRows[0].best_score),
    },
  };
}

// Live gateway model list (server-side; the token never reaches the client).
export async function listGatewayModels() {
  if (!jevConfigured()) {
    return { configured: false, models: [] };
  }
  const res = await fetch(`${process.env.NEON_AI_GATEWAY_BASE_URL}/v1/models`, {
    headers: { Authorization: `Bearer ${process.env.NEON_AI_GATEWAY_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Gateway /v1/models returned ${res.status}`);
  }
  const body = await res.json();
  const models = (body.data || [])
    .filter((m) => m.enabled !== false)
    .map((m) => ({ id: m.id, name: m.name || m.id, ownedBy: m.owned_by || null }));
  return { configured: true, gatewayHost: jevGatewayHost(), count: models.length, models };
}
