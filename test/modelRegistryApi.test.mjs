import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

let app;
let server;
let baseUrl;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.PINATA_JWT = '';
  process.env.PINATA_API_KEY = '';
  process.env.PINATA_API_SECRET = '';
  ({ app } = await import('../server/index.js'));

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (!server?.listening) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

function serialized(value) {
  return JSON.stringify(value);
}

const asset = '6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC';
const authority = 'EhUoob64sfDYYVSU6fNxEj91enmbxGE2LwSb5PSJCRsA';
const metaplexDasAsset = {
  id: asset,
  interface: 'MplCoreAsset',
  ownership: { owner: authority },
  content: {
    metadata: {
      name: 'BuilderCode Solana 3B',
      symbol: 'BCODE',
    },
  },
  grouping: [],
};

test('GET /api/models/list returns fallback registry when database is disconnected', async () => {
  const { response, body } = await request('/api/models/list');

  assert.equal(response.status, 200);
  assert.equal(body.source, 'memory');
  assert.equal(body.models[0].asset, asset);
  assert.equal(body.models[0].modelIdentityPda, 'EAKhw8ftkArdBiBoXhinYtySCHqqDNE4eagf1cWdaaYL');
});

test('GET /api/models/identity/:asset derives stable PDA', async () => {
  const { response, body } = await request(`/api/models/identity/${asset}`);

  assert.equal(response.status, 200);
  assert.equal(body.pda, 'EAKhw8ftkArdBiBoXhinYtySCHqqDNE4eagf1cWdaaYL');
  assert.equal(body.seeds[0], 'model_identity');
});

test('POST /api/models/register-intent prepares document, attestations, and transaction plan', async () => {
  const { response, body } = await request('/api/models/register-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset,
      authority,
      registrationUri: 'https://arweave.net/model-registration-buildercode',
      name: 'BuilderCode Solana 3B',
      description: 'A Solana-specialized code model.',
      image: 'https://arweave.net/model-image',
      modelType: 'CODE_GENERATION',
      architecture: 'decoder-transformer',
      parameterCount: '3B',
      license: 'MIT',
      artifactUri: 'ar://H7rKp2b4nVi8yLq9',
      artifactSha256: '0x7d6f7f13b116c4d82bbdf26a84b9aa21dbb1d4c7d188aa3ba6a14d21b2c9c001',
      huggingFaceRepo: 'solana-ai/buildercode-3b',
      huggingFaceCommit: 'ac77120',
      googleAttestationUri: 'gs://traintoearn-attestations/buildercode/gemini-red-team.json',
      googleAttestor: 'google:gemini-safety',
      price: 0.007,
      royaltyBps: 300,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.identity.modelIdentityPda, 'EAKhw8ftkArdBiBoXhinYtySCHqqDNE4eagf1cWdaaYL');
  assert.equal(body.transactionPlan.instruction, 'registerModelIdentityV1');
  assert.equal(body.attestations.valid, true);
  assert.equal(body.storedModel, null);
});

test('POST /api/models/metaplex-asset verifies provided DAS asset fixtures', async () => {
  const { response, body } = await request('/api/models/metaplex-asset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset,
      authority,
      dasAsset: metaplexDasAsset,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.source, 'provided');
  assert.equal(body.verification.verified, true);
  assert.equal(body.verification.interface, 'MplCoreAsset');
});

test('POST /api/models/register-intent can require Metaplex Core verification', async () => {
  const { response, body } = await request('/api/models/register-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset,
      authority,
      registrationUri: 'https://arweave.net/model-registration-buildercode',
      name: 'BuilderCode Solana 3B',
      description: 'A Solana-specialized code model.',
      image: 'https://arweave.net/model-image',
      modelType: 'CODE_GENERATION',
      architecture: 'decoder-transformer',
      parameterCount: '3B',
      license: 'MIT',
      artifactUri: 'ar://H7rKp2b4nVi8yLq9',
      artifactSha256: '0x7d6f7f13b116c4d82bbdf26a84b9aa21dbb1d4c7d188aa3ba6a14d21b2c9c001',
      huggingFaceRepo: 'solana-ai/buildercode-3b',
      huggingFaceCommit: 'ac77120',
      googleAttestationUri: 'gs://traintoearn-attestations/buildercode/gemini-red-team.json',
      googleAttestor: 'google:gemini-safety',
      price: 0.007,
      royaltyBps: 300,
      metaplexDasAsset,
      requireMetaplexVerification: true,
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.metaplexVerification.verified, true);
  assert.equal(body.attestations.metaplex.verified, true);
});

test('POST /api/models/register-intent rejects failed required Metaplex verification', async () => {
  const { response, body } = await request('/api/models/register-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset,
      authority,
      registrationUri: 'https://arweave.net/model-registration-buildercode',
      name: 'BuilderCode Solana 3B',
      description: 'A Solana-specialized code model.',
      image: 'https://arweave.net/model-image',
      modelType: 'CODE_GENERATION',
      architecture: 'decoder-transformer',
      parameterCount: '3B',
      license: 'MIT',
      artifactUri: 'ar://H7rKp2b4nVi8yLq9',
      artifactSha256: '0x7d6f7f13b116c4d82bbdf26a84b9aa21dbb1d4c7d188aa3ba6a14d21b2c9c001',
      huggingFaceRepo: 'solana-ai/buildercode-3b',
      huggingFaceCommit: 'ac77120',
      googleAttestationUri: 'gs://traintoearn-attestations/buildercode/gemini-red-team.json',
      googleAttestor: 'google:gemini-safety',
      metaplexDasAsset: {
        ...metaplexDasAsset,
        interface: 'FungibleToken',
      },
      requireMetaplexVerification: true,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Metaplex model asset verification failed');
  assert.equal(body.metaplexVerification.verified, false);
});

test('POST /api/models/provider-attestations rejects malformed provider references', async () => {
  const { response, body } = await request('/api/models/provider-attestations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      asset,
      modelIdentityPda: 'not-a-public-key',
      huggingFaceRepo: 'bad repo',
      googleAttestationUri: 'https://example.com/eval.json',
      googleAttestor: 'google:vertex-ai',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.attestations.valid, false);
  assert.equal(body.attestations.huggingFace.valid, false);
  assert.equal(body.attestations.google.valid, false);
  assert.equal(body.attestations.solana.valid, false);
});

test('POST /api/models/register accepts IPFS catalog entries and exposes them by id', async () => {
  const { response, body } = await request('/api/models/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Tiny Sentiment IPFS',
      modelType: 'SENTIMENT_ANALYSIS',
      cid: 'bafybeigdyrztinytrain2earnmodel',
      description: 'Small IPFS-backed sentiment model for API verification.',
      price: 0.001,
      accuracy: 88.4,
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.storageType, 'ipfs');
  assert.equal(body.model.id, 'tiny-sentiment-ipfs');

  const detail = await request('/api/models/tiny-sentiment-ipfs');
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.model.modelType, 'SENTIMENT_ANALYSIS');

  const list = await request('/api/models/list?type=SENTIMENT_ANALYSIS&query=tiny');
  assert.equal(list.response.status, 200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.models[0].id, 'tiny-sentiment-ipfs');
});

test('POST /api/ai/inference returns x402 payment details before paid execution', async () => {
  const { response, body } = await request('/api/ai/inference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Write a short Solana model registry summary',
      modelType: 'TEXT_GENERATION',
    }),
  });

  assert.equal(response.status, 402);
  assert.equal(body.error, 'Payment Required');
  assert.equal(body.amount, 0.005);
  assert.equal(response.headers.get('x-payment-currency'), 'SOL');
});

test('POST /api/ai/inference accepts single-use dev payment signatures', async () => {
  const signature = `test-payment-${Date.now()}`;
  const requestBody = {
    prompt: 'Explain consensus learning for Train2Earn',
    modelType: 'CONSENSUS_LEARNING',
    parameters: { participantCount: 4 },
  };

  const { response, body } = await request('/api/ai/inference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Signature': signature,
    },
    body: JSON.stringify(requestBody),
  });

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.payment.mock, true);
  assert.equal(body.modelType, 'CONSENSUS_LEARNING');
  assert.equal(body.result.provider, 'consensus-training');

  const replay = await request('/api/ai/inference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Signature': signature,
    },
    body: JSON.stringify(requestBody),
  });

  assert.equal(replay.response.status, 402);
  assert.equal(replay.body.error, 'Payment already used');
});

test('PiedPiper APIs expose capabilities and run paid pipeline inference', async () => {
  const capabilities = await request('/api/piedpiper/capabilities');
  assert.equal(capabilities.response.status, 200);
  assert.equal(capabilities.body.modelType, 'PIEDPIPER_PIPELINE');
  assert.ok(capabilities.body.capabilities.some((capability) => capability.id === 'text-compression-huffman-rle'));

  const analysis = await request('/api/piedpiper/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: 'PiedPiper compression agents write deterministic commitments to Train2Earn.',
    }),
  });

  assert.equal(analysis.response.status, 200);
  assert.equal(analysis.body.analysis.registryDraft.modelType, 'PIEDPIPER_PIPELINE');
  assert.match(analysis.body.analysis.artifactSha256, /^0x[a-f0-9]{64}$/);
  assert.ok(analysis.body.analysis.automata.rule30.hexPreview.length > 0);

  const paid = await request('/api/ai/inference', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-Signature': `test-piedpiper-${Date.now()}`,
    },
    body: JSON.stringify({
      prompt: 'Compress this on-chain AI registration payload.',
      modelType: 'PIEDPIPER_PIPELINE',
    }),
  });

  assert.equal(paid.response.status, 200);
  assert.equal(paid.body.modelType, 'PIEDPIPER_PIPELINE');
  assert.equal(paid.body.result.provider, 'piedpiper-local');
  assert.equal(paid.body.result.piedPiper.registryDraft.modelType, 'PIEDPIPER_PIPELINE');
});

test('DAO proposal APIs create wallet-aware proposals and votes', async () => {
  const created = await request('/api/proposals/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Fund a privacy-preserving Solana dataset round',
      targetParam: 'privacy_dataset',
      trainingBudget: 25,
      walletAddress: authority,
      duration: 3600,
      zkProofRequired: true,
    }),
  });

  assert.equal(created.response.status, 201);
  assert.equal(created.body.success, true);
  assert.equal(created.body.proposal.trainingBudget, 25);

  const voted = await request('/api/proposals/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      proposalId: created.body.proposalId,
      vote: 'for',
      walletAddress: authority,
      votingPower: 3,
    }),
  });

  assert.equal(voted.response.status, 200);
  assert.equal(voted.body.success, true);
  assert.equal(voted.body.newVoteCount.for, 3);
});

test('compute marketplace APIs create and report training jobs', async () => {
  const created = await request('/api/compute/job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cid: 'bafybeigdyrztinytrain2earnmodel',
      params: { gpuType: 'A100', estimatedTime: 30 },
      zkProofRequired: true,
      walletAddress: authority,
    }),
  });

  assert.equal(created.response.status, 201);
  assert.ok(created.body.jobId.startsWith('job_'));
  assert.equal(created.body.provider.zkSupport, true);
  assert.equal(created.body.job.modelCid, 'bafybeigdyrztinytrain2earnmodel');

  const status = await request(`/api/compute/job/${created.body.jobId}`);
  assert.equal(status.response.status, 200);
  assert.equal(status.body.job.id, created.body.jobId);
  assert.ok(['pending', 'running', 'completed'].includes(status.body.job.status));
});

test('GET /api/agents/config exposes Clawd ZK and catalog access', async () => {
  const { response, body } = await request('/api/agents/config');

  assert.equal(response.status, 200);
  assert.equal(body.access.network, 'mainnet');
  assert.equal(body.access.rpcUrl, '/api/solana/rpc');
  assert.equal(body.access.photonUrl, '/api/solana/rpc');
  assert.equal(serialized(body).includes('api-key='), false);
  assert.equal(body.metaplexNetwork, 'solana-mainnet');
  assert.ok(Array.isArray(body.catalogPaths));
  assert.ok(body.catalogPaths.some((entry) => entry.key === 'CLAWDBOT_AGENTS_DIR'));
});

test('GET /api/health does not expose private RPC credentials', async () => {
  const { response, body } = await request('/api/health');

  assert.equal(response.status, 200);
  assert.equal(body.clawdAgent.rpcUrl, '/api/solana/rpc');
  assert.equal(body.clawdAgent.photonUrl, '/api/solana/rpc');
  assert.equal(serialized(body).includes('api-key='), false);
});

test('GET /api/agents/catalog lists local Clawd agent definitions when present', async () => {
  const { response, body } = await request('/api/agents/catalog?limit=5');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.agents));
  assert.ok(body.total <= 5);
  if (body.configured) {
    assert.ok(body.agents[0].id);
    assert.ok(body.agents[0].name);
  }
});

test('POST /api/agents/metadata prepares NFT and registry metadata for minting', async () => {
  const owner = 'EhUoob64sfDYYVSU6fNxEj91enmbxGE2LwSb5PSJCRsA';
  const { response, body } = await request('/api/agents/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner,
      name: 'Test Clawd Agent',
      description: 'A test Solana agent for route verification.',
      image: 'https://arweave.net/test-agent-image',
      tags: 'solana,clawd,test',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.mintInput.wallet, owner);
  assert.equal(body.mintInput.network, 'solana-mainnet');
  assert.equal(body.mintInput.agentMetadata.type, 'agent');
  assert.equal(body.registrationDocument.type, 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
  assert.equal(typeof body.mintReady, 'boolean');
  assert.ok(Array.isArray(body.warnings));
  assert.equal(serialized(body).includes('api-key='), false);
  assert.match(body.uri, /^http:\/\/127\.0\.0\.1:\d+\/api\/agents\/metadata\//);
});

test('POST /api/agents/mint rejects non-public metadata before calling Metaplex', async () => {
  const { response, body } = await request('/api/agents/mint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: authority,
      network: 'solana-mainnet',
      name: 'Local Metadata Agent',
      uri: `${baseUrl}/api/agents/metadata/local`,
      agentMetadata: {
        type: 'agent',
        name: 'Local Metadata Agent',
        description: 'Should not be forwarded to Metaplex with a local URI.',
        services: [],
        registrations: [],
        supportedTrust: [],
      },
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(body.error, 'Invalid Metaplex agent mint request');
  assert.ok(body.details.some((detail) => detail.includes('publicly accessible')));
});
