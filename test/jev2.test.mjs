import test from 'node:test';
import assert from 'node:assert/strict';

const {
  validateMediaSubmission,
  validateDatasetManifest,
  scanForSecrets,
  computeImageWeight,
  computeDatasetWeight,
  computeRobotWeight,
  rewardForWeight,
  registerJev2Routes,
} = await import('../server/jev2.js');

const pair = (overrides = {}) => ({
  mediaRef: 'ar://example-image',
  mediaHash: 'c'.repeat(64),
  caption: 'A Solana validator dashboard showing stake accounts and lamports flow',
  ...overrides,
});

test('image validation rejects an oversize set (51 pairs)', () => {
  const errors = validateMediaSubmission({ kind: 'image', pairs: Array.from({ length: 51 }, () => pair()) });
  assert.ok(errors.some((e) => e.includes('50 pairs')), `expected a pair-count error, got: ${errors.join('; ')}`);
});

test('image validation rejects a set whose declared total exceeds 10 MB', () => {
  const errors = validateMediaSubmission({
    kind: 'image',
    pairs: [pair({ sizeBytes: 6 * 1024 * 1024 }), pair({ sizeBytes: 6 * 1024 * 1024 })],
  });
  assert.ok(errors.some((e) => e.includes('10 MB')), `expected a size error, got: ${errors.join('; ')}`);
});

test('image validation rejects an uncaptioned pair', () => {
  const errors = validateMediaSubmission({ kind: 'image', pairs: [pair({ caption: '' })] });
  assert.ok(errors.some((e) => e.includes('caption')));
});

test('image validation accepts a small well-formed set', () => {
  const errors = validateMediaSubmission({ kind: 'image', pairs: [pair(), pair({ sizeBytes: 1024 })] });
  assert.deepEqual(errors, []);
});

test('video validation rejects a by-reference submission over 10 minutes', () => {
  const errors = validateMediaSubmission({
    kind: 'video',
    url: 'https://arweave.net/example-video',
    metadata: { durationSeconds: 601 },
  });
  assert.ok(errors.some((e) => e.includes('10 minute')));
});

test('video validation requires a reference (no raw upload)', () => {
  const errors = validateMediaSubmission({ kind: 'video', metadata: {} });
  assert.ok(errors.some((e) => e.includes('by reference')));
});

test('dataset manifest validation rejects a robot manifest without a task description', () => {
  const errors = validateDatasetManifest({
    kind: 'robot',
    manifest: {
      kind: 'robot',
      host: { type: 'huggingface', ref: 'example/robot-set' },
      contentHash: `sha256:${'d'.repeat(64)}`,
      declaredEpisodes: 12,
    },
  });
  assert.ok(errors.some((e) => e.includes('taskDescription')));
});

test('dataset manifest validation rejects a malformed content hash', () => {
  const errors = validateDatasetManifest({
    kind: 'dataset',
    manifest: {
      kind: 'dataset',
      host: { type: 'arweave', ref: 'ar://example' },
      contentHash: 'not-a-hash',
      declaredRows: 100,
    },
  });
  assert.ok(errors.some((e) => e.includes('contentHash')));
});

test('dataset manifest validation accepts a well-formed dataset manifest', () => {
  const errors = validateDatasetManifest({
    kind: 'dataset',
    manifest: {
      kind: 'dataset',
      host: { type: 'huggingface', ref: 'example/data' },
      format: 'jsonl',
      contentHash: `sha256:${'e'.repeat(64)}`,
      declaredRows: 5000,
      captionSample: ['{"messages":[{"role":"user","content":"What is a PDA?"}]}'],
    },
  });
  assert.deepEqual(errors, []);
});

test('secret scan flags key material and emails (safe-to-train gate inputs)', () => {
  assert.ok(scanForSecrets('-----BEGIN PRIVATE KEY-----').length > 0);
  assert.ok(scanForSecrets('contact me at someone@example.com').length > 0);
  assert.deepEqual(scanForSecrets('A clean caption about Solana staking rewards'), []);
});

test('verified weight follows spec §5: caps and the Silver gate', () => {
  // Image: 250 KB cap per pair, caption factor 1.0 for a real caption.
  assert.equal(computeImageWeight([pair({ sizeBytes: 500 * 1024 })]), 250);
  // Dataset: 1 weight per 100 verified rows.
  assert.equal(computeDatasetWeight({ verifiedRows: 100000 }), 1000);
  // Robot: 1 weight per 1000 verified steps, capped at 20000.
  assert.equal(computeRobotWeight({ verifiedSteps: 50_000_000 }), 20000);
  // Below Silver the reward is the floor no matter the weight.
  assert.equal(rewardForWeight({ score: 64, multiplier: 8, verifiedWeight: 20000 }), 25);
  // At Silver+ the weight multiplies.
  assert.equal(rewardForWeight({ score: 65, multiplier: 2.5, verifiedWeight: 1000 }), Math.round((1000 + 100) * 2.5));
});

test('routes: rate-dataset queues a job and the job endpoint reports it', async () => {
  const routes = {};
  const app = {
    get(path, ...handlers) { routes[`GET ${path}`] = handlers; },
    post(path, ...handlers) { routes[`POST ${path}`] = handlers; },
  };
  registerJev2Routes(app, {});
  const run = async (handlers, req) => {
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handlers[handlers.length - 1](req, res);
    return res;
  };

  const created = await run(routes['POST /api/jev/rate-dataset'], {
    body: {
      kind: 'dataset',
      walletAddress: '11111111111111111111111111111111',
      manifest: {
        kind: 'dataset',
        walletAddress: '11111111111111111111111111111111',
        title: 'route-test-set',
        host: { type: 'huggingface', ref: 'example/route-test' },
        format: 'jsonl',
        contentHash: `sha256:${'f'.repeat(64)}`,
        declaredRows: 1000,
        captionSample: ['{"messages":[{"role":"user","content":"Explain Solana accounts"}]}'],
      },
    },
  });
  assert.equal(created.statusCode, 202);
  assert.equal(created.body.status, 'queued');
  assert.ok(created.body.jobId);

  const missing = await run(routes['GET /api/jev/jobs/:id'], { params: { id: 'no-such-job' } });
  assert.equal(missing.statusCode, 404);

  // Let the in-process worker run, then the job must reach a terminal state.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const polled = await run(routes['GET /api/jev/jobs/:id'], { params: { id: created.body.jobId } });
  assert.equal(polled.statusCode, 200);
  assert.ok(['scored', 'failed'].includes(polled.body.status), `job ended in ${polled.body.status}`);
  if (polled.body.status === 'scored') {
    assert.equal(polled.body.result.modality, 'dataset');
    assert.ok(typeof polled.body.result.score === 'number');
    assert.ok(['jev+heuristic', 'heuristic-fallback'].includes(polled.body.result.source));
  }
});
