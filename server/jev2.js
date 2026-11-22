// Jev-2 — multimodal rating for TrainToEarn (docs/jev2-engine.md).
//
// Opens Jev rating beyond plain text:
//   POST /api/jev/rate-media    image+caption pairs (sync) and video
//                               references (async — frame sampling is a
//                               job, never a blocking request)
//   POST /api/jev/rate-dataset  bulk datasets and robot episode data by
//                               manifest, always async
//   GET  /api/jev/jobs/:id      poll an async rating job
//
// Honesty contract (spec §8, unchanged from the live engine): a rating is
// only ever as strong as its `source` label. The judge leg runs through
// the existing jevRating.js pipeline (Neon-gateway Jev when configured,
// its own heuristic fallback otherwise); when that module cannot even be
// loaded, this module rates with the local consensusTraining heuristic
// and labels the result "heuristic-fallback". A fallback score is never
// presented as a Jev verdict, and the vision sensor is absent in this
// build — media is rated on captions/metadata/samples rendered to text,
// with `visionSource: null` recorded on every media rating.
//
// Rewards follow spec §5: verified data weight W replaces raw size,
// per-modality caps apply, and below Silver (< 65) a by-reference
// submission earns at most the 25 CLAWD floor. Unsafe content caps the
// score at 20 in every modality.

import crypto from 'node:crypto';
import { analyzeTrainingContribution, contributionTiers } from './consensusTraining.js';

export const JEV2_MODEL_ID = process.env.JEV_MODEL || 'typesafeai-jev-1-14-0';

const SILVER_MIN = 65;
const FLOOR_REWARD = 25;
const MAX_IMAGE_PAIRS = 50;
const MAX_IMAGE_TOTAL_DECLARED_BYTES = 10 * 1024 * 1024; // 10 MB total declared
const MAX_IMAGE_PAIR_DECLARED_BYTES = 10 * 1024 * 1024; // 10 MB per image (spec §2.2)
const MAX_VIDEO_DURATION_SECONDS = 10 * 60;
const WEIGHT_CAPS = { image: 5000, video: 600, dataset: 20000, robot: 20000 };

// ---------------------------------------------------------------------------
// Secret / PII scan (spec §3.4) — any hit fails safe-to-train (cap 20).
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bghp_[A-Za-z0-9]{30,}\b/,
  /\b(seed phrase|mnemonic)\b\s*[:=]/i,
  /\bprivate[_ -]?key\b\s*[:=]\s*\S+/i,
  // JSON byte-array key material (Solana secret keys are often pasted so)
  /\[\s*\d{1,3}\s*(,\s*\d{1,3}\s*){40,}\]/,
  // plain email addresses count as PII for training data
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
];

export function scanForSecrets(text) {
  const haystack = String(text || '');
  const hits = [];
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(haystack)) hits.push(pattern.source.slice(0, 40));
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Validation — runs BEFORE any judging (spec §2.6/§3.4). Validators return
// a list of human-readable errors; an empty list means valid.
// ---------------------------------------------------------------------------

function declaredBytes(item) {
  if (typeof item?.sizeBytes === 'number') return item.sizeBytes;
  if (typeof item?.declaredBytes === 'number') return item.declaredBytes;
  if (typeof item?.sizeKB === 'number') return item.sizeKB * 1024;
  return 0;
}

export function validateMediaSubmission(body = {}) {
  const errors = [];
  const kind = body.kind;
  if (kind !== 'image' && kind !== 'video') {
    errors.push('kind must be "image" or "video"');
    return errors;
  }
  if (kind === 'image') {
    const pairs = body.pairs || body.items;
    if (!Array.isArray(pairs) || pairs.length === 0) {
      errors.push('image submissions require a non-empty pairs array');
      return errors;
    }
    if (pairs.length > MAX_IMAGE_PAIRS) {
      errors.push(`image submissions are limited to ${MAX_IMAGE_PAIRS} pairs (got ${pairs.length})`);
    }
    let totalDeclared = 0;
    pairs.forEach((pair, i) => {
      if (!pair || typeof pair !== 'object') {
        errors.push(`pairs[${i}] must be an object`);
        return;
      }
      if (!pair.mediaRef && !pair.url && !pair.mediaHash) {
        errors.push(`pairs[${i}] needs a mediaRef, url, or mediaHash`);
      }
      if (!pair.caption || typeof pair.caption !== 'string' || pair.caption.trim().length === 0) {
        errors.push(`pairs[${i}] has no caption — an uncaptioned image is not training data`);
      }
      const bytes = declaredBytes(pair);
      if (bytes > MAX_IMAGE_PAIR_DECLARED_BYTES) {
        errors.push(`pairs[${i}] declares ${bytes} bytes — over the 10 MB per-image limit`);
      }
      totalDeclared += bytes;
    });
    if (totalDeclared > MAX_IMAGE_TOTAL_DECLARED_BYTES) {
      errors.push(`declared image total is ${totalDeclared} bytes — over the 10 MB total declared limit`);
    }
  }
  if (kind === 'video') {
    const url = body.url || body.mediaRef || body.metadata?.url;
    if (!url || typeof url !== 'string') {
      errors.push('video submissions are by reference only — a url/mediaRef is required');
    }
    const duration = body.metadata?.durationSeconds ?? body.metadata?.durationSec ?? body.durationSeconds;
    if (typeof duration === 'number' && duration > MAX_VIDEO_DURATION_SECONDS) {
      errors.push(`video duration ${duration}s exceeds the 10 minute limit`);
    }
  }
  return errors;
}

export function validateDatasetManifest(body = {}) {
  const errors = [];
  const manifest = body.manifest || body;
  const kind = body.kind || manifest.kind;
  if (kind !== 'dataset' && kind !== 'robot') {
    errors.push('kind must be "dataset" or "robot"');
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    errors.push('a manifest object is required');
    return errors;
  }
  const ref = manifest.host?.ref || manifest.ref || manifest.sourceUrl;
  if (!ref || typeof ref !== 'string') {
    errors.push('manifest must reference its host (host.ref) — bulk data is by reference only, never uploaded raw');
  }
  const hash = manifest.contentHash || '';
  if (!/^(sha256:)?[a-f0-9]{64}$/i.test(String(hash))) {
    errors.push('manifest.contentHash must be a SHA-256 (optionally sha256:-prefixed)');
  }
  if (kind === 'dataset') {
    if (typeof manifest.declaredRows !== 'number' || manifest.declaredRows < 0) {
      errors.push('dataset manifests must declare declaredRows');
    }
  }
  if (kind === 'robot') {
    if (!manifest.taskDescription || typeof manifest.taskDescription !== 'string') {
      errors.push('robot manifests require a taskDescription');
    }
    const episodes = manifest.declaredEpisodes;
    const steps = manifest.declaredSteps ?? manifest.totalSteps;
    if (typeof episodes !== 'number' && typeof steps !== 'number') {
      errors.push('robot manifests must declare declaredEpisodes and/or declaredSteps');
    }
  }
  if (manifest.captionSample !== undefined && !Array.isArray(manifest.captionSample)) {
    errors.push('manifest.captionSample must be an array when present');
  }
  if (Array.isArray(manifest.captionSample) && manifest.captionSample.length > 20) {
    errors.push('manifest.captionSample is capped at 20 representative rows');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Verified data weight (spec §5.1/§5.2) + dedup (spec §5.3 rule 2)
// ---------------------------------------------------------------------------

function duplicateFraction(texts) {
  if (!texts || texts.length === 0) return 0;
  const seen = new Set();
  let duplicates = 0;
  for (const text of texts) {
    const key = crypto.createHash('sha256').update(String(text).trim().toLowerCase()).digest('hex');
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return duplicates / texts.length;
}

export function computeImageWeight(pairs, dupFraction = 0) {
  let weight = 0;
  for (const pair of pairs || []) {
    const bytes = declaredBytes(pair);
    const sizeKB = bytes > 0 ? bytes / 1024 : 100; // undeclared size: conservative default, noted in the report
    const caption = typeof pair.caption === 'string' ? pair.caption : '';
    const captionFactor = caption.trim().length >= 20 ? 1.0 : 0.25;
    weight += Math.min(sizeKB, 250) * captionFactor;
  }
  return Math.min(WEIGHT_CAPS.image, Math.round(weight * (1 - dupFraction)));
}

export function computeVideoWeight({ durationSeconds = 0 } = {}, dupFraction = 0) {
  const minutes = typeof durationSeconds === 'number' ? durationSeconds / 60 : 0;
  return Math.min(WEIGHT_CAPS.video, Math.round(minutes * 10 * (1 - dupFraction)));
}

export function computeDatasetWeight({ verifiedRows = 0 } = {}) {
  return Math.min(WEIGHT_CAPS.dataset, Math.round(verifiedRows / 100));
}

export function computeRobotWeight({ verifiedSteps = 0 } = {}) {
  return Math.min(WEIGHT_CAPS.robot, Math.round(verifiedSteps / 1000));
}

// The Silver gate (spec §5.3 rule 1): bulk weight only multiplies at
// Silver or better; below that the submission earns the floor at most.
export function rewardForWeight({ score, multiplier, verifiedWeight }) {
  if (score < SILVER_MIN) return FLOOR_REWARD;
  return Math.max(FLOOR_REWARD, Math.round((verifiedWeight + 100) * multiplier));
}

function tierForScore(score) {
  return contributionTiers.find((tier) => score >= tier.minScore) || contributionTiers.at(-1);
}

// ---------------------------------------------------------------------------
// Rating core — render the submission to text, judge it through the live
// pipeline when loadable, otherwise the local heuristic (labelled).
// ---------------------------------------------------------------------------

async function rateRenderedText({ walletAddress, renderedText, filename, dataType }) {
  try {
    const { rateTrainingData } = await import('./jevRating.js');
    return await rateTrainingData({
      content: renderedText,
      filename,
      mimeType: 'text/plain',
      walletAddress,
    });
  } catch (loadError) {
    const analysis = analyzeTrainingContribution({
      content: renderedText,
      filename,
      mimeType: 'text/plain',
      walletAddress,
    });
    const tier = tierForScore(analysis.metrics.overallScore);
    return {
      walletAddress,
      dataHash: analysis.dataHash,
      filename: analysis.filename,
      dataType: analysis.dataType,
      dataSize: analysis.dataSize,
      score: analysis.metrics.overallScore,
      heuristicScore: analysis.metrics.overallScore,
      tier: tier.tier,
      tierLabel: tier.label,
      multiplier: tier.multiplier,
      clawdReward: analysis.clawdReward,
      unsafe: false,
      source: 'heuristic-fallback',
      model: JEV2_MODEL_ID,
      gatewayHost: null,
      verdicts: null,
      usage: null,
      jevError: `Jev pipeline module unavailable: ${loadError.message}`,
      metrics: analysis.metrics,
      recommendations: analysis.recommendations,
      ratedAt: new Date().toISOString(),
    };
  }
}

async function persistRating(rating, deps) {
  const { pool, isDbConnected } = deps || {};
  if (!pool || !isDbConnected || !isDbConnected()) {
    rating.persisted = false;
    return rating;
  }
  try {
    const { saveJevRating } = await import('./jevRating.js');
    const saved = await saveJevRating(pool, rating);
    rating.id = saved.id;
    rating.ratedAt = new Date(saved.created_at).toISOString();
    return rating;
  } catch {
    // Fall back to the same INSERT saveJevRating performs, so persistence
    // does not depend on the gateway SDK packages being installed.
    try {
      const { rows } = await pool.query(
        `INSERT INTO training_ratings
           (wallet_address, data_hash, filename, data_type, data_size, score,
            heuristic_score, tier, multiplier, clawd_reward, unsafe, source,
            model, verdicts, usage)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id, created_at`,
        [
          rating.walletAddress, rating.dataHash, rating.filename, rating.dataType,
          rating.dataSize, rating.score, rating.heuristicScore, rating.tier,
          rating.multiplier, rating.clawdReward, rating.unsafe, rating.source,
          rating.model, rating.verdicts ? JSON.stringify(rating.verdicts) : null,
          rating.usage ? JSON.stringify(rating.usage) : null,
        ],
      );
      rating.id = rows[0].id;
      rating.ratedAt = new Date(rows[0].created_at).toISOString();
    } catch (dbError) {
      console.error('Jev-2 rating persist failed:', dbError.message);
      rating.persisted = false;
    }
    return rating;
  }
}

// Apply the modality rules on top of a base rating: secret-scan cap,
// verified-weight reward, modality/source labelling.
function finalizeRating({ base, walletAddress, modality, filename, verifiedWeight, validation }) {
  const renderedSecrets = validation.secretHits || [];
  let score = base.score;
  let unsafe = Boolean(base.unsafe);
  if (renderedSecrets.length > 0) {
    unsafe = true;
    score = Math.min(score, 20);
  }
  const tier = tierForScore(score);
  const rating = {
    ...base,
    walletAddress,
    filename,
    dataType: `jev2-${modality}`,
    modality,
    score,
    unsafe,
    tier: tier.tier,
    tierLabel: tier.label,
    multiplier: tier.multiplier,
    clawdReward: rewardForWeight({ score, multiplier: tier.multiplier, verifiedWeight }),
    verifiedWeight,
    visionSource: null, // no vision sensor in this build — never implied
    validation,
  };
  return rating;
}

// ---------------------------------------------------------------------------
// Media rating (image sync; video goes through the job path)
// ---------------------------------------------------------------------------

export async function rateMediaSubmission(body, deps = {}) {
  const errors = validateMediaSubmission(body);
  if (errors.length > 0) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }
  const walletAddress = body.walletAddress || body.wallet;
  if (!walletAddress) {
    const err = new Error('walletAddress is required — sign in with a Solana wallet first');
    err.status = 400;
    throw err;
  }
  const kind = body.kind;
  const pairs = kind === 'image' ? (body.pairs || body.items) : [];
  const captions = pairs.map((p) => p.caption || '');
  const dupFraction = duplicateFraction(captions);
  const secretHits = scanForSecrets([...captions, JSON.stringify(body.metadata || {})].join('\n'));

  let renderedText;
  let verifiedWeight;
  let filename;
  if (kind === 'image') {
    renderedText = pairs
      .map((p, i) => `Image ${i + 1} (${p.mediaRef || p.url || p.mediaHash || 'reference'}): ${p.caption}${p.context ? `\nContext: ${p.context}` : ''}`)
      .join('\n');
    verifiedWeight = computeImageWeight(pairs, dupFraction);
    filename = body.filename || `jev2-images-${pairs.length}-pairs.txt`;
  } else {
    const durationSeconds = body.metadata?.durationSeconds ?? body.metadata?.durationSec ?? body.durationSeconds ?? 0;
    const transcript = body.metadata?.transcript || body.transcript || '';
    renderedText = [
      `Video submission: ${body.url || body.mediaRef}`,
      `Duration: ${durationSeconds}s`,
      body.metadata?.description || '',
      transcript ? `Transcript:\n${transcript}` : '',
    ].filter(Boolean).join('\n');
    verifiedWeight = computeVideoWeight({ durationSeconds }, dupFraction);
    filename = body.filename || 'jev2-video.txt';
  }

  const base = await rateRenderedText({ walletAddress, renderedText, filename, dataType: `jev2-${kind}` });
  const rating = finalizeRating({
    base,
    walletAddress,
    modality: kind,
    filename,
    verifiedWeight,
    validation: {
      duplicateFraction: Math.round(dupFraction * 1000) / 1000,
      secretHits,
      pairsChecked: pairs.length,
      note: 'Rated on captions/metadata rendered to text; no vision sensor in this build (visionSource: null).',
    },
  });
  await persistRating(rating, deps);
  return rating;
}

// ---------------------------------------------------------------------------
// Async rating jobs (spec §6.2): queued → validating → judging → scored /
// failed. In-process and in-memory — a restart drops in-flight jobs, and a
// dropped job earns nothing and may be resubmitted (stated, never silent).
// ---------------------------------------------------------------------------

const jobs = new Map();

export function getRatingJob(jobId) {
  return jobs.get(jobId) || null;
}

async function processDatasetJob(job, deps) {
  const { kind, manifest, walletAddress } = job.payload;
  job.status = 'validating';
  const sample = Array.isArray(manifest.captionSample) ? manifest.captionSample : [];
  const sampleTexts = sample.map((row) => (typeof row === 'string' ? row : JSON.stringify(row)));
  const dupFraction = duplicateFraction(sampleTexts);

  // Sample-level checks only — the data never transits this backend
  // (spec §2.4). What sampling cannot confirm is reported as such.
  let validSample = 0;
  for (const row of sample) {
    if (typeof row === 'string') {
      const trimmed = row.trim();
      if (trimmed.length === 0) continue;
      if ((manifest.format || '').toLowerCase() === 'jsonl' && trimmed.startsWith('{')) {
        try { JSON.parse(trimmed); validSample += 1; } catch { /* invalid row */ }
      } else {
        validSample += 1;
      }
    } else if (row && typeof row === 'object') {
      validSample += 1;
    }
  }
  const sampleValidity = sample.length > 0 ? validSample / sample.length : 0;

  let verifiedWeight = 0;
  const validation = {
    duplicateFraction: Math.round(dupFraction * 1000) / 1000,
    sampleRowsChecked: sample.length,
    sampleRowsValid: validSample,
    secretHits: scanForSecrets(sampleTexts.join('\n')),
  };

  if (kind === 'dataset') {
    const verifiedRows = Math.round((manifest.declaredRows || 0) * sampleValidity * (1 - dupFraction));
    verifiedWeight = computeDatasetWeight({ verifiedRows });
    validation.verifiedRows = verifiedRows;
    validation.note = sample.length === 0
      ? 'No captionSample provided — declared rows could not be sample-verified, so verified weight is 0.'
      : 'Verified rows are extrapolated from the manifest sample; the full dataset was not read (by-reference intake).';
  } else {
    // Robot: episode integrity is checked on episodeSample when present
    // (monotonic timestamps, obs/action length alignment); otherwise only
    // the declared counts exist and steps stay unverified.
    const episodes = Array.isArray(manifest.episodeSample) ? manifest.episodeSample : [];
    let passing = 0;
    for (const ep of episodes) {
      let ok = true;
      if (Array.isArray(ep?.timestamps)) {
        for (let i = 1; i < ep.timestamps.length; i += 1) {
          if (!(ep.timestamps[i] > ep.timestamps[i - 1])) { ok = false; break; }
        }
      }
      if (ok && Array.isArray(ep?.observations) && Array.isArray(ep?.actions)) {
        if (ep.observations.length !== ep.actions.length) ok = false;
      }
      if (ok) passing += 1;
    }
    const passFraction = episodes.length > 0 ? passing / episodes.length : 0;
    const declaredSteps = manifest.declaredSteps ?? manifest.totalSteps
      ?? ((manifest.declaredEpisodes || 0) * (manifest.avgStepsPerEpisode || 0));
    const verifiedSteps = Math.round(declaredSteps * passFraction * (1 - dupFraction));
    verifiedWeight = computeRobotWeight({ verifiedSteps });
    validation.episodesChecked = episodes.length;
    validation.episodesPassing = passing;
    validation.verifiedSteps = verifiedSteps;
    validation.note = episodes.length === 0
      ? 'No episodeSample provided — episode integrity could not be checked, so verified weight is 0.'
      : 'Integrity checked on the episode sample; full episodes were not read (by-reference intake).';
  }

  job.status = 'judging';
  const renderedText = [
    `${kind === 'robot' ? 'Robot training dataset' : 'Bulk training dataset'}: ${manifest.title || 'untitled'}`,
    `Format: ${manifest.format || 'unspecified'} · Host: ${manifest.host?.type || 'reference'} ${manifest.host?.ref || manifest.ref || ''}`,
    `License: ${manifest.license || 'unspecified'}`,
    kind === 'robot' ? `Task: ${manifest.taskDescription}` : '',
    `Declared rows/episodes: ${manifest.declaredRows ?? manifest.declaredEpisodes ?? 'unspecified'}`,
    'Sample rows:',
    ...sampleTexts.slice(0, 20),
  ].filter(Boolean).join('\n');

  const filename = `${kind === 'robot' ? 'jev2-robot' : 'jev2-dataset'}-${String(manifest.title || 'manifest').slice(0, 40)}.txt`;
  const base = await rateRenderedText({ walletAddress, renderedText, filename, dataType: `jev2-${kind}` });
  const rating = finalizeRating({
    base,
    walletAddress,
    modality: kind,
    filename,
    verifiedWeight,
    validation: { ...validation, secretHits: [...(validation.secretHits || []), ...scanForSecrets(manifest.taskDescription || '')] },
  });
  await persistRating(rating, deps);
  job.result = rating;
  job.status = 'scored';
  job.completedAt = new Date().toISOString();
}

export function createRatingJob({ type, payload }, deps = {}) {
  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    type,
    payload,
    status: 'queued',
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  jobs.set(jobId, job);
  // In-process worker: runs after the response has been returned.
  setImmediate(async () => {
    try {
      if (type === 'media') {
        job.status = 'judging';
        job.result = await rateMediaSubmission(payload, deps);
        job.status = 'scored';
        job.completedAt = new Date().toISOString();
      } else {
        await processDatasetJob(job, deps);
      }
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date().toISOString();
    }
  });
  return job;
}

// ---------------------------------------------------------------------------
// Express surface
// ---------------------------------------------------------------------------

export function registerJev2Routes(app, deps = {}) {
  app.post('/api/jev/rate-media', async (req, res) => {
    try {
      const body = req.body || {};
      const errors = validateMediaSubmission(body);
      if (errors.length > 0) return res.status(400).json({ error: 'Invalid media submission', details: errors });
      if (body.kind === 'video') {
        // Video is always async (spec §2.3/§6.2).
        const job = createRatingJob({ type: 'media', payload: body }, deps);
        return res.status(202).json({ jobId: job.id, status: job.status, modality: 'video' });
      }
      const rating = await rateMediaSubmission(body, deps);
      return res.json({ rating });
    } catch (error) {
      return res.status(error.status || 500).json({ error: 'Failed to rate media submission', details: error.message });
    }
  });

  app.post('/api/jev/rate-dataset', async (req, res) => {
    try {
      const body = req.body || {};
      const errors = validateDatasetManifest(body);
      if (errors.length > 0) return res.status(400).json({ error: 'Invalid dataset manifest', details: errors });
      const manifest = body.manifest || body;
      const walletAddress = body.walletAddress || body.wallet || manifest.walletAddress;
      if (!walletAddress) {
        return res.status(400).json({ error: 'walletAddress is required — sign in with a Solana wallet first' });
      }
      const kind = body.kind || manifest.kind;
      const job = createRatingJob({ type: 'dataset', payload: { kind, manifest, walletAddress } }, deps);
      return res.status(202).json({ jobId: job.id, status: job.status, modality: kind });
    } catch (error) {
      return res.status(error.status || 500).json({ error: 'Failed to queue dataset rating', details: error.message });
    }
  });

  app.get('/api/jev/jobs/:id', (req, res) => {
    const job = getRatingJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Rating job not found' });
    const body = { jobId: job.id, status: job.status, type: job.type, createdAt: job.createdAt };
    if (job.status === 'scored') body.result = job.result;
    if (job.status === 'failed') body.error = job.error;
    if (job.completedAt) body.completedAt = job.completedAt;
    return res.json(body);
  });
}
