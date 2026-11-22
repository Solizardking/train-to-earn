import test from 'node:test';
import assert from 'node:assert/strict';

// Force the heuristic fallback path: no gateway env in tests.
delete process.env.NEON_AI_GATEWAY_BASE_URL;
delete process.env.NEON_AI_GATEWAY_TOKEN;

const { extractBoolean, extractScore, rateTrainingData, jevConfigured } = await import('../server/jevRating.js');

test('extractBoolean handles plain, wrapped, and probability shapes', () => {
  assert.equal(extractBoolean(true).value, true);
  assert.equal(extractBoolean('false').value, false);
  assert.equal(extractBoolean({ answer: true }).value, true);
  const p = extractBoolean({ probabilities: { true: 0.8, false: 0.2 } });
  assert.equal(p.value, true);
  assert.equal(p.pTrue, 0.8);
  const neonShape = extractBoolean({ type: 'boolean', probability: 0.9 });
  assert.equal(neonShape.value, true);
  assert.equal(neonShape.pTrue, 0.9);
});

test('extractScore normalises 0-1, rubric, and 0-100 shapes to 0-100', () => {
  assert.equal(extractScore(42), 42);
  assert.equal(extractScore({ type: 'score', score: 0.8 }), 80);
  assert.equal(extractScore({ type: 'score', score: 4 }), 80);
  assert.equal(extractScore({ probabilities: { 0: 0.5, 100: 0.5 } }), 50);
  assert.equal(extractScore('nope'), null);
});

test('gateway reports unconfigured without env', () => {
  assert.equal(jevConfigured(), false);
});

test('rateTrainingData falls back to heuristic and returns a tier + reward', async () => {
  const rating = await rateTrainingData({
    walletAddress: 'So1anaTestWa11etAddressForJevSmoke1111111111',
    filename: 'guide.md',
    content:
      'Solana programs use PDAs derived from seeds. This instruction explains invoke_signed with a worked vault example, covering accounts, rent, and CPI signing in detail. '.repeat(
        6,
      ),
  });
  assert.equal(rating.source, 'heuristic-fallback');
  assert.ok(rating.score >= 0 && rating.score <= 100);
  assert.ok(['Platinum', 'Diamond', 'Gold', 'Silver', 'Bronze'].includes(rating.tier));
  assert.ok(rating.clawdReward >= 25);
  assert.ok(rating.jevError);
});

test('rateTrainingData rejects missing content and missing wallet', async () => {
  await assert.rejects(() => rateTrainingData({ walletAddress: 'x' }), TypeError);
  await assert.rejects(() => rateTrainingData({ content: 'hello solana' }), TypeError);
});
