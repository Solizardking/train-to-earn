import assert from 'node:assert/strict';
import { test } from 'node:test';
import { persistModelRegistration, rowToModelRegistration, modelIdFromName } from '../server/modelRegistryStore.js';

const row = {
  model_id: 'buildercode-solana-3b',
  name: 'BuilderCode Solana 3B',
  asset: '6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC',
  authority: 'EhUoob64sfDYYVSU6fNxEj91enmbxGE2LwSb5PSJCRsA',
  model_identity_pda: 'jWwQcDAUjj3p37h2TSFeQFAmq2Zg7qLhxjNU8AUa6c6',
  model_registration_uri: 'https://arweave.net/model-registration-buildercode',
  model_registry: 'solana:101:traintoearn-model-registry',
  model_type: 'CODE_GENERATION',
  artifact_uri: 'ar://H7rKp2b4nVi8yLq9',
  artifact_sha256: '0xabc',
  hugging_face_repo: 'solana-ai/buildercode-3b',
  hugging_face_commit: 'ac77120',
  google_attestation_uri: 'gs://bucket/eval.json',
  google_attestor: 'google:vertex-ai',
  document: { name: 'BuilderCode Solana 3B' },
  transaction_plan: { instruction: 'registerModelIdentityV1' },
  attestations: { valid: true },
  status: 'prepared',
  created_at: '2026-06-13T00:00:00.000Z',
  updated_at: '2026-06-13T00:00:00.000Z',
};

test('maps database rows to API model registration shape', () => {
  const model = rowToModelRegistration(row);

  assert.equal(model.id, 'buildercode-solana-3b');
  assert.equal(model.modelIdentityPda, row.model_identity_pda);
  assert.equal(model.modelRegistrationUri, row.model_registration_uri);
  assert.equal(model.huggingFaceRepo, row.hugging_face_repo);
  assert.deepEqual(model.transactionPlan, row.transaction_plan);
});

test('creates stable model ids from names', () => {
  assert.equal(modelIdFromName('BuilderCode Solana 3B'), 'buildercode-solana-3b');
  assert.equal(modelIdFromName(''), 'model');
});

test('persists model registration using upsert SQL contract', async () => {
  const calls = [];
  const fakePool = {
    async query(sql, params) {
      calls.push({ sql, params });
      return { rows: [row] };
    },
  };

  const stored = await persistModelRegistration(fakePool, {
    documentInput: {
      name: 'BuilderCode Solana 3B',
      modelType: 'CODE_GENERATION',
      artifactUri: row.artifact_uri,
      artifactSha256: row.artifact_sha256,
      huggingFaceRepo: row.hugging_face_repo,
      huggingFaceCommit: row.hugging_face_commit,
      googleAttestationUri: row.google_attestation_uri,
      googleAttestor: row.google_attestor,
    },
    identity: {
      asset: row.asset,
      authority: row.authority,
      modelIdentityPda: row.model_identity_pda,
      modelRegistrationUri: row.model_registration_uri,
      modelRegistry: row.model_registry,
    },
    document: row.document,
    transactionPlan: row.transaction_plan,
    attestations: row.attestations,
  });

  assert.equal(stored.asset, row.asset);
  assert.match(calls[0].sql, /ON CONFLICT \(asset\) DO UPDATE/);
  assert.equal(calls[0].params[0], 'buildercode-solana-3b');
  assert.equal(calls[0].params[2], row.asset);
  assert.equal(calls[0].params[14], JSON.stringify(row.document));
});
