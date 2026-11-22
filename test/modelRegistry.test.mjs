import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MODEL_REGISTRATION_SCHEMA,
  MODEL_REGISTRY_ID,
  MODEL_REGISTRY_INSTRUCTION_DISCRIMINATORS,
  createModelIdentityRecord,
  createModelRegistrationDocument,
  createRegisterModelIdentityTransactionPlan,
  createRegisterModelV2TransactionPlan,
  deriveModelEvaluationPda,
  deriveModelFeedbackPda,
  deriveModelIdentityPda,
  deriveModelV2Pda,
  validateModelRegistrationDocument,
} from '../src/utils/modelRegistry.js';

const asset = '6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC';
const authority = 'EhUoob64sfDYYVSU6fNxEj91enmbxGE2LwSb5PSJCRsA';

const baseInput = {
  asset,
  name: 'BuilderCode Solana 3B',
  description: 'A Solana-specialized code model.',
  image: 'https://arweave.net/model-image',
  modelType: 'CODE_GENERATION',
  architecture: 'decoder-transformer',
  parameterCount: '3B',
  license: 'MIT',
  artifactUri: 'ar://H7rKp2b4nVi8yLq9',
  artifactSha256: '0x7d6f7f13b116c4d82bbdf26a84b9aa21dbb1d4c7d188aa3ba6a14d21b2c9c001',
  modelCardUri: 'https://huggingface.co/solana-ai/buildercode-3b',
  huggingFaceRepo: 'solana-ai/buildercode-3b',
  huggingFaceCommit: 'ac77120',
  price: 0.007,
  royaltyBps: 300,
};

test('creates a model registration document compatible with registry schema', () => {
  const document = createModelRegistrationDocument(baseInput);

  assert.equal(document.type, MODEL_REGISTRATION_SCHEMA);
  assert.equal(document.registrations[0].modelId, asset);
  assert.equal(document.registrations[0].modelRegistry, MODEL_REGISTRY_ID);
  assert.equal(document.model.huggingFaceRepo, 'solana-ai/buildercode-3b');
  assert.deepEqual(validateModelRegistrationDocument(document), []);
});

test('rejects documents missing required decentralized provenance fields', () => {
  const document = createModelRegistrationDocument({
    ...baseInput,
    artifactSha256: '',
    huggingFaceCommit: '',
  });

  assert.deepEqual(validateModelRegistrationDocument(document), [
    'model.artifactSha256 is required',
    'model.huggingFaceCommit is required',
  ]);
});

test('derives stable model identity and evaluation PDAs', () => {
  const identity = deriveModelIdentityPda(asset);
  const evaluation = deriveModelEvaluationPda(asset, 'google-vertex-safety-v1');

  assert.equal(identity.pda, 'EAKhw8ftkArdBiBoXhinYtySCHqqDNE4eagf1cWdaaYL');
  assert.equal(identity.bump, 255);
  assert.equal(identity.seeds[0], 'model_identity');
  assert.equal(evaluation.seeds[0], 'model_evaluation');
  assert.equal(evaluation.seeds[2], 'google-vertex-safety-v1');
});

test('creates a register intent and transaction plan for wallet clients', () => {
  const document = createModelRegistrationDocument(baseInput);
  const identity = createModelIdentityRecord({
    asset,
    authority,
    registrationUri: 'https://arweave.net/model-registration-buildercode',
    document,
  });
  const plan = createRegisterModelIdentityTransactionPlan({
    ...identity,
    document,
  });

  assert.equal(identity.modelIdentityPda, 'EAKhw8ftkArdBiBoXhinYtySCHqqDNE4eagf1cWdaaYL');
  assert.equal(plan.instruction, 'registerModelIdentityV1');
  assert.equal(plan.anchorName, 'register_model_identity_v1');
  assert.deepEqual(plan.discriminator, MODEL_REGISTRY_INSTRUCTION_DISCRIMINATORS.REGISTER_MODEL_IDENTITY_V1);
  assert.equal(plan.accounts.modelIdentity, identity.modelIdentityPda);
  assert.equal(plan.accounts.authority, authority);
  assert.equal(plan.accounts.systemProgram, '11111111111111111111111111111111');
  assert.equal(plan.args.modelRegistrationUri, 'https://arweave.net/model-registration-buildercode');
  assert.equal(plan.args.artifactHash, baseInput.artifactSha256);
  assert.equal(plan.args.modelType, baseInput.modelType);
  assert.equal(plan.args.royaltyBps, baseInput.royaltyBps);
  assert.equal(plan.accountMetas.find((account) => account.name === 'payer').isWritable, true);
  assert.deepEqual(plan.lifecycleChecks, { transfer: true, update: true, execute: true });
});

test('derives v2 model and feedback PDAs for the extended registry program', () => {
  const model = deriveModelV2Pda(authority, 'bafybeigbuildercode3b');
  const feedback = deriveModelFeedbackPda(model.pda, asset);

  assert.equal(model.pda, '8ZgV8jpuTe341y7MkDb98cPWkZyAm849h1ZWTbQcVhiB');
  assert.equal(model.seeds[0], 'clawd_model_v2');
  assert.equal(feedback.pda, 'g964hwX8xNtq1tcmzByGxhEgdjw9fEFc1EWQ9GXbiPb');
  assert.equal(feedback.seeds[0], 'clawd_feedback');
});

test('rejects oversized strings used as Solana PDA seeds', () => {
  assert.throws(
    () => deriveModelEvaluationPda(asset, 'x'.repeat(33)),
    /evaluationName must be 32 bytes or less/
  );
  assert.throws(
    () => deriveModelV2Pda(authority, 'x'.repeat(33)),
    /modelCid must be 32 bytes or less/
  );
});

test('creates a v2 register transaction plan for Hugging Face and Pinata backed models', () => {
  const plan = createRegisterModelV2TransactionPlan({
    authority,
    name: baseInput.name,
    description: baseInput.description,
    huggingFaceRepo: baseInput.huggingFaceRepo,
    modelCid: 'bafybeigbuildercode3b',
    capabilities: ['solana-code', 'anchor-review'],
    clawdPrice: 7000,
    metadataUri: 'https://gateway.pinata.cloud/ipfs/bafybeigbuildercode3b',
  });

  assert.equal(plan.instruction, 'registerModelV2');
  assert.equal(plan.anchorName, 'register_model_v2');
  assert.deepEqual(plan.discriminator, MODEL_REGISTRY_INSTRUCTION_DISCRIMINATORS.REGISTER_MODEL_V2);
  assert.equal(plan.accounts.model, '8ZgV8jpuTe341y7MkDb98cPWkZyAm849h1ZWTbQcVhiB');
  assert.equal(plan.args.hfRepo, baseInput.huggingFaceRepo);
  assert.equal(plan.args.modelCid, 'bafybeigbuildercode3b');
  assert.deepEqual(plan.args.capabilities, ['solana-code', 'anchor-review']);
});
