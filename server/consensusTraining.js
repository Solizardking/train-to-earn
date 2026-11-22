import crypto from 'crypto';

const SOLANA_TERMS = [
  'solana', 'anchor', 'spl', 'token', 'wallet', 'signature', 'pubkey',
  'lamports', 'validator', 'stake', 'program', 'instruction', 'pda',
  'jupiter', 'raydium', 'metaplex', 'helius', 'arweave', 'ipfs',
];

const AI_TERMS = [
  'ai', 'model', 'training', 'dataset', 'inference', 'weights', 'parameters',
  'gradient', 'federated', 'consensus', 'learning', 'prediction', 'quality',
  'privacy', 'aggregation', 'embedding', 'classifier', 'llm',
];

const QUALITY_WEIGHTS = {
  completeness: 0.25,
  accuracy: 0.25,
  uniqueness: 0.20,
  richness: 0.15,
  relevance: 0.10,
  timeliness: 0.03,
  structure: 0.01,
  metadataQuality: 0.01,
};

export const consensusOverview = {
  title: 'Decentralized AI Training Using Blockchain',
  subtitle: 'Consensus learning coordinates private local models, gossip-based prediction exchange, and on-chain contribution accounting.',
  phases: [
    {
      id: 'local-learning',
      name: 'Individual learning',
      description: 'Participants train local models on private data and publish only commitments, metrics, or predictions.',
    },
    {
      id: 'gossip',
      name: 'Communication',
      description: 'Nodes exchange predictions through a gossip protocol and update confidence without exposing raw datasets.',
    },
    {
      id: 'aggregation',
      name: 'Consensus aggregation',
      description: 'The protocol combines prediction confidence, node reliability, and validation scores into one agreed output.',
    },
    {
      id: 'settlement',
      name: 'On-chain settlement',
      description: 'Solana records contribution proofs, model versions, quality scores, and reward rights.',
    },
  ],
  benefits: [
    'Data stays with contributors while still improving shared AI systems.',
    'Diverse training sources reduce centralization and single-dataset bias.',
    'Blockchain records provenance, model updates, and reward distribution.',
    'Token incentives turn useful data and compute into measurable contributions.',
  ],
  challenges: [
    'Consensus and model training can add latency and compute overhead.',
    'Quality control must detect low-value, duplicate, or adversarial updates.',
    'Large participant networks need efficient aggregation and storage design.',
  ],
  qualityWeights: QUALITY_WEIGHTS,
};

export const contributionTiers = [
  { tier: 'Platinum', minScore: 92, multiplier: 8, label: 'Exceptional consensus-ready data' },
  { tier: 'Diamond', minScore: 85, multiplier: 6, label: 'Premium model training signal' },
  { tier: 'Gold', minScore: 75, multiplier: 4, label: 'High-quality ecosystem data' },
  { tier: 'Silver', minScore: 65, multiplier: 2.5, label: 'Useful structured contribution' },
  { tier: 'Bronze', minScore: 0, multiplier: 1, label: 'Baseline accepted contribution' },
];

const rounds = new Map();

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function countMatches(text, terms) {
  const lower = text.toLowerCase();
  return terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
}

function wordStats(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return {
    total: words.length,
    unique: new Set(words).size,
  };
}

function looksLikeJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function looksLikeCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return false;
  const firstCommaCount = (lines[0].match(/,/g) || []).length;
  return firstCommaCount > 0 && lines.slice(1, 5).some((line) => (line.match(/,/g) || []).length === firstCommaCount);
}

function detectDataType({ filename = '', mimeType = '', content = '' }) {
  const lowerName = filename.toLowerCase();
  if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (mimeType.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/.test(lowerName)) return 'image';
  if (looksLikeJson(content) || lowerName.endsWith('.json')) return 'json';
  if (looksLikeCsv(content) || lowerName.endsWith('.csv')) return 'csv';
  if (/\.(md|txt)$/.test(lowerName)) return lowerName.endsWith('.md') ? 'markdown' : 'text';
  return 'text';
}

function assessStructure(text, dataType) {
  if (!text.trim()) return 0;
  if (dataType === 'json') return looksLikeJson(text) ? 100 : 35;
  if (dataType === 'csv') return looksLikeCsv(text) ? 94 : 45;

  const headingCount = (text.match(/^#{1,4}\s+/gm) || []).length;
  const bulletCount = (text.match(/^\s*[-*]\s+/gm) || []).length;
  const paragraphCount = text.split(/\n\s*\n/).filter((p) => p.trim().length > 80).length;
  const codeCount = (text.match(/```/g) || []).length / 2;

  return clamp(40 + headingCount * 8 + bulletCount * 2 + paragraphCount * 4 + codeCount * 8);
}

function assessTimeliness(text) {
  const dateMatches = text.match(/\b(20[2-9][0-9]|202[4-6])\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{10,13}\b/g) || [];
  if (dateMatches.length >= 3) return 94;
  if (dateMatches.length > 0) return 84;
  return 70;
}

function assessMetadata(metadata) {
  const keys = Object.keys(metadata || {}).filter((key) => metadata[key] !== '' && metadata[key] != null);
  return clamp(35 + keys.length * 12);
}

function buildRecommendations(metrics) {
  const recommendations = [];
  if (metrics.completeness < 70) recommendations.push('Add more records, examples, or explanatory coverage before submitting.');
  if (metrics.accuracy < 75) recommendations.push('Include validation notes, schema rules, source context, or consistency checks.');
  if (metrics.uniqueness < 55) recommendations.push('Reduce repeated language or duplicate rows to improve model signal.');
  if (metrics.relevance < 60) recommendations.push('Tie the content more directly to Solana, AI training, model inference, or protocol governance.');
  if (metrics.structure < 65) recommendations.push('Use headings, fields, tables, or machine-readable formats to improve aggregation quality.');
  if (metrics.privacyPreservation < 70) recommendations.push('Add privacy-preserving claims such as local training, redaction, or no raw-data sharing.');
  if (metrics.consensusReadiness < 70) recommendations.push('Describe how nodes can validate, score, or aggregate this contribution.');
  return recommendations.length > 0 ? recommendations : ['Submission is ready for a consensus learning round.'];
}

function tierForScore(score) {
  return contributionTiers.find((tier) => score >= tier.minScore) || contributionTiers.at(-1);
}

export function analyzeTrainingContribution({
  content = '',
  filename = 'training-data.txt',
  mimeType = 'text/plain',
  metadata = {},
  walletAddress = null,
} = {}) {
  const text = String(content || '');
  const dataType = detectDataType({ filename, mimeType, content: text });
  const stats = wordStats(text);
  const solanaMatches = countMatches(text, SOLANA_TERMS);
  const aiMatches = countMatches(text, AI_TERMS);
  const metadataQuality = assessMetadata(metadata);
  const structure = assessStructure(text, dataType);

  const completeness = clamp((Math.min(text.length / 6000, 1) * 72) + (metadataQuality * 0.18) + (structure * 0.10));
  const accuracyPenalty = (text.match(/\b(todo|placeholder|lorem|unknown|tbd)\b/gi) || []).length * 5;
  const accuracy = clamp(78 + (dataType === 'json' || dataType === 'csv' ? 10 : 0) + Math.min(stats.total / 250, 1) * 8 - accuracyPenalty);
  const uniqueness = stats.total > 0 ? clamp((stats.unique / stats.total) * 128) : 0;
  const richness = clamp(42 + Math.min(stats.total / 900, 1) * 18 + (solanaMatches + aiMatches) * 3.5);
  const relevance = clamp((solanaMatches * 7) + (aiMatches * 6) + (/blockchain|decentralized|consensus/i.test(text) ? 18 : 0));
  const timeliness = assessTimeliness(text);

  const privacyTerms = countMatches(text, ['privacy', 'private', 'local', 'redact', 'secure', 'confidential', 'zero-knowledge', 'zk']);
  const privacyPreservation = clamp(48 + privacyTerms * 9 + (/without transferring|never shared|local environment/i.test(text) ? 14 : 0));
  const consensusReadiness = clamp((relevance * 0.28) + (structure * 0.24) + (uniqueness * 0.18) + (privacyPreservation * 0.16) + (richness * 0.14));

  const weightedBase = Object.entries(QUALITY_WEIGHTS).reduce((sum, [key, weight]) => {
    const metricKey = key === 'metadataQuality' ? 'metadataQuality' : key;
    return sum + ({ completeness, accuracy, uniqueness, richness, relevance, timeliness, structure, metadataQuality }[metricKey] * weight);
  }, 0);

  const overallScore = clamp((weightedBase * 0.62) + (privacyPreservation * 0.16) + (consensusReadiness * 0.22));
  const tier = tierForScore(overallScore);
  const dataSize = Buffer.byteLength(text, 'utf8');
  const reward = Math.max(25, Math.round((dataSize / 1024 + 100) * tier.multiplier));
  const hash = crypto.createHash('sha256').update(text).digest('hex');

  const metrics = {
    completeness: round(completeness),
    accuracy: round(accuracy),
    uniqueness: round(uniqueness),
    richness: round(richness),
    relevance: round(relevance),
    timeliness: round(timeliness),
    structure: round(structure),
    metadataQuality: round(metadataQuality),
    privacyPreservation: round(privacyPreservation),
    consensusReadiness: round(consensusReadiness),
    overallScore: round(overallScore),
  };

  return {
    dataHash: hash,
    filename,
    dataType,
    dataSize,
    walletAddress,
    metrics,
    tier: tier.tier,
    tierLabel: tier.label,
    clawdReward: reward,
    consensusUseCases: [
      'local model fine-tuning',
      'prediction confidence calibration',
      'privacy-preserving validation',
      'governance proposal evaluation',
    ],
    recommendations: buildRecommendations(metrics),
    metadata: {
      ...metadata,
      detectedTerms: {
        solana: solanaMatches,
        ai: aiMatches,
      },
      wordCount: stats.total,
    },
  };
}

function buildNodes(participantCount) {
  const regions = ['Austin', 'Berlin', 'Singapore', 'Sao Paulo', 'Lagos', 'Tokyo', 'Toronto', 'Lisbon'];
  return Array.from({ length: participantCount }, (_, index) => {
    const reliability = round(0.78 + ((index * 13) % 19) / 100, 2);
    const privateSamples = 650 + ((index * 421) % 6400);
    return {
      id: `node-${index + 1}`,
      label: `Trainer ${index + 1}`,
      region: regions[index % regions.length],
      reliability,
      privateSamples,
      stake: 250 + ((index * 137) % 1800),
      confidence: round(64 + ((index * 17) % 28)),
      localPrediction: round(0.42 + ((index * 11) % 41) / 100, 3),
    };
  });
}

export function createConsensusRound({
  objective = 'Improve decentralized AI training quality',
  modelType = 'CONSENSUS_LEARNING',
  datasetSummary = 'Privacy-preserving Solana and AI training contribution',
  participantCount = 6,
  privacyMode = 'local-only',
  walletAddress = null,
} = {}) {
  const safeParticipantCount = clamp(Number(participantCount) || 6, 3, 12);
  const nodes = buildNodes(safeParticipantCount);
  const id = `round-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
  const roundRecord = {
    id,
    objective,
    modelType,
    datasetSummary,
    privacyMode,
    walletAddress,
    status: 'collecting-local-updates',
    createdAt: new Date().toISOString(),
    nodes,
    ledger: [
      {
        step: 'round-created',
        hash: crypto.createHash('sha256').update(`${id}:${objective}`).digest('hex').slice(0, 16),
        description: 'Round intent committed for local training.',
      },
    ],
    aggregate: null,
  };
  rounds.set(id, roundRecord);
  return roundRecord;
}

export function aggregateConsensusRound(roundId) {
  const roundRecord = rounds.get(roundId);
  if (!roundRecord) return null;

  const iterations = [];
  let nodes = roundRecord.nodes.map((node) => ({ ...node }));

  for (let i = 0; i < 3; i += 1) {
    const predictionMean = nodes.reduce((sum, node) => sum + node.localPrediction, 0) / nodes.length;
    nodes = nodes.map((node, index) => {
      const peer = nodes[(index + i + 1) % nodes.length];
      const blendedPrediction = (node.localPrediction * 0.52) + (peer.localPrediction * 0.20) + (predictionMean * 0.28);
      const confidence = clamp((node.confidence * 0.52) + (peer.confidence * 0.16) + (node.reliability * 100 * 0.32));
      return {
        ...node,
        localPrediction: round(blendedPrediction, 3),
        confidence: round(confidence),
      };
    });
    iterations.push({
      iteration: i + 1,
      meanPrediction: round(nodes.reduce((sum, node) => sum + node.localPrediction, 0) / nodes.length, 3),
      meanConfidence: round(nodes.reduce((sum, node) => sum + node.confidence, 0) / nodes.length),
    });
  }

  const totalWeight = nodes.reduce((sum, node) => sum + node.confidence * node.reliability, 0);
  const consensusPrediction = nodes.reduce((sum, node) => (
    sum + node.localPrediction * node.confidence * node.reliability
  ), 0) / totalWeight;
  const consensusConfidence = nodes.reduce((sum, node) => sum + node.confidence, 0) / nodes.length;
  const rewardPool = Math.round(500 + nodes.length * 75 + consensusConfidence * 8);

  const aggregate = {
    consensusPrediction: round(consensusPrediction, 3),
    consensusConfidence: round(consensusConfidence),
    accepted: consensusConfidence >= 72,
    rewardPool,
    iterations,
    nodeRewards: nodes.map((node) => ({
      nodeId: node.id,
      reward: Math.round((node.confidence * node.reliability / totalWeight) * rewardPool),
      confidence: node.confidence,
    })),
  };

  roundRecord.status = aggregate.accepted ? 'consensus-accepted' : 'needs-review';
  roundRecord.nodes = nodes;
  roundRecord.aggregate = aggregate;
  roundRecord.ledger.push(
    {
      step: 'gossip-consensus',
      hash: crypto.createHash('sha256').update(JSON.stringify(iterations)).digest('hex').slice(0, 16),
      description: 'Node predictions blended through three gossip iterations.',
    },
    {
      step: 'reward-settlement',
      hash: crypto.createHash('sha256').update(JSON.stringify(aggregate.nodeRewards)).digest('hex').slice(0, 16),
      description: 'Reward pool allocated by confidence-weighted contribution.',
    },
  );

  rounds.set(roundId, roundRecord);
  return roundRecord;
}

export function listConsensusRounds() {
  return Array.from(rounds.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function runConsensusInference({
  prompt = '',
  modelResponses = [],
  participantCount = 5,
} = {}) {
  const responses = modelResponses.length > 0 ? modelResponses : [
    { model: 'Local Solana LLM', output: 'Use local training with on-chain reward accounting.', confidence: 84 },
    { model: 'Privacy Guard', output: 'Keep datasets private and exchange signed predictions only.', confidence: 88 },
    { model: 'Protocol Analyst', output: 'Record commitments, quality scores, and reward claims on Solana.', confidence: 82 },
    { model: 'Quality Oracle', output: 'Reject low-structure data and prioritize diverse verified sources.', confidence: 79 },
    { model: 'Governance Agent', output: 'Let token-weighted proposals choose the next training objective.', confidence: 76 },
  ].slice(0, clamp(Number(participantCount) || 5, 3, 8));

  const totalConfidence = responses.reduce((sum, item) => sum + Number(item.confidence || 0), 0) || 1;
  const top = [...responses].sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0))[0];
  const confidence = responses.reduce((sum, item) => sum + Number(item.confidence || 0) ** 2, 0) / totalConfidence;

  return {
    prompt,
    finalAnswer: `${top.output} Consensus summary: combine local training, gossip confidence exchange, and Solana settlement so contributors improve the model without surrendering raw data.`,
    confidence: round(confidence),
    participatingModels: responses.length,
    responses,
    ledgerCommitment: crypto.createHash('sha256').update(`${prompt}:${JSON.stringify(responses)}`).digest('hex'),
  };
}
