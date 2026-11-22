import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aggregateConsensusRound,
  analyzeTrainingContribution,
  createConsensusRound,
  runConsensusInference,
} from '../server/consensusTraining.js';

test('scores decentralized AI training content with consensus metrics', () => {
  const analysis = analyzeTrainingContribution({
    filename: 'consensus-learning.md',
    content: `
      # Consensus Learning for Solana AI

      Local trainers keep private datasets on premise, train model updates,
      exchange predictions through a gossip consensus protocol, and settle
      rewards on Solana. The dataset includes validator, stake, program,
      inference, privacy, model, and aggregation metadata for quality scoring.
    `,
    metadata: { source: 'test', privacyMode: 'local-only' },
  });

  assert.equal(analysis.dataType, 'markdown');
  assert.match(analysis.dataHash, /^[a-f0-9]{64}$/);
  assert.ok(analysis.metrics.overallScore > 60);
  assert.ok(analysis.metrics.consensusReadiness > 50);
  assert.ok(analysis.clawdReward > 0);
});

test('creates and aggregates a consensus training round', () => {
  const round = createConsensusRound({
    objective: 'Aggregate private Solana model predictions',
    participantCount: 5,
  });

  assert.equal(round.nodes.length, 5);
  assert.equal(round.status, 'collecting-local-updates');

  const aggregated = aggregateConsensusRound(round.id);
  assert.equal(aggregated.id, round.id);
  assert.ok(aggregated.aggregate.consensusConfidence >= 0);
  assert.ok(aggregated.aggregate.rewardPool > 0);
  assert.equal(aggregated.aggregate.iterations.length, 3);
});

test('runs consensus inference with a ledger commitment', () => {
  const result = runConsensusInference({
    prompt: 'How should model updates be aggregated?',
    participantCount: 4,
  });

  assert.equal(result.participatingModels, 4);
  assert.match(result.ledgerCommitment, /^[a-f0-9]{64}$/);
  assert.match(result.finalAnswer, /Consensus summary/);
});
