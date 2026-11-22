import { PublicKey } from '@solana/web3.js';

// Program id from Anchor.toml and target/deploy/model_registry-keypair.json.
export const MODEL_REGISTRY_PROGRAM_ID = new PublicKey('A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92');
export const MODEL_REGISTRY_ID = 'solana:101:traintoearn-model-registry';
export const MODEL_REGISTRATION_SCHEMA = 'https://traintoearn.ai/schemas/model-registration-v1';
export const MODEL_IDENTITY_SEED = 'model_identity';
export const MODEL_EVALUATION_SEED = 'model_evaluation';
export const MODEL_V2_SEED = 'clawd_model_v2';
export const MODEL_FEEDBACK_SEED = 'clawd_feedback';
export const MODEL_EVALUATION_NAME_MAX_BYTES = 32;
export const MODEL_CID_SEED_MAX_BYTES = 32;

export const MODEL_TYPES = {
  LLM_REASONING: 'LLM_REASONING',
  CODE_GENERATION: 'CODE_GENERATION',
  IMAGE_CLASSIFICATION: 'IMAGE_CLASSIFICATION',
  EMBEDDINGS: 'EMBEDDINGS',
  AUDIO: 'AUDIO',
  MULTIMODAL: 'MULTIMODAL',
  PIEDPIPER_PIPELINE: 'PIEDPIPER_PIPELINE',
};

export const TRUST_MODELS = [
  'reputation',
  'crypto-economic',
  'storage-proof',
  'evaluation-attestation',
  'model-lineage',
];

export const MODEL_REGISTRY_INSTRUCTION_DISCRIMINATORS = {
  REGISTER_MODEL_IDENTITY_V1: [79, 68, 199, 204, 29, 199, 8, 248],
  UPDATE_MODEL_IDENTITY_V1: [50, 11, 206, 129, 107, 221, 191, 0],
  DEACTIVATE_MODEL_IDENTITY_V1: [91, 131, 230, 220, 85, 39, 73, 112],
  RECORD_MODEL_EVALUATION_V1: [149, 149, 56, 95, 237, 196, 229, 60],
  REGISTER_MODEL_V2: [170, 0, 6, 102, 204, 29, 233, 150],
  UPDATE_MODEL_V2: [226, 231, 72, 13, 20, 208, 120, 14],
  DEACTIVATE_MODEL_V2: [221, 151, 202, 43, 232, 166, 22, 110],
  UPDATE_MODEL_STATS: [191, 197, 79, 37, 251, 157, 202, 186],
  GIVE_FEEDBACK: [145, 136, 123, 3, 215, 165, 98, 41],
};

export function isValidPublicKey(value) {
  try {
    if (!value) return false;
    new PublicKey(value);
    return true;
  } catch (_error) {
    return false;
  }
}

export function validatePdaSeedBytes(label, value, maxBytes = 32) {
  const text = String(value || '');
  const byteLength = Buffer.from(text).length;
  if (byteLength > maxBytes) {
    throw new Error(`${label} must be ${maxBytes} bytes or less because it is used as a Solana PDA seed`);
  }
  return text;
}

export function deriveModelIdentityPda(assetPublicKey, programId = MODEL_REGISTRY_PROGRAM_ID) {
  const asset = new PublicKey(assetPublicKey);
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(MODEL_IDENTITY_SEED), asset.toBuffer()],
    programId
  );

  return {
    pda: pda.toBase58(),
    bump,
    seeds: [MODEL_IDENTITY_SEED, asset.toBase58()],
  };
}

export function deriveModelEvaluationPda(assetPublicKey, evaluationName, programId = MODEL_REGISTRY_PROGRAM_ID) {
  const asset = new PublicKey(assetPublicKey);
  const boundedEvaluationName = validatePdaSeedBytes(
    'evaluationName',
    evaluationName,
    MODEL_EVALUATION_NAME_MAX_BYTES
  );
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(MODEL_EVALUATION_SEED), asset.toBuffer(), Buffer.from(boundedEvaluationName)],
    programId
  );

  return {
    pda: pda.toBase58(),
    bump,
    seeds: [MODEL_EVALUATION_SEED, asset.toBase58(), boundedEvaluationName],
  };
}

export function deriveModelV2Pda(authorityPublicKey, modelCid, programId = MODEL_REGISTRY_PROGRAM_ID) {
  const authority = new PublicKey(authorityPublicKey);
  const boundedModelCid = validatePdaSeedBytes('modelCid', modelCid, MODEL_CID_SEED_MAX_BYTES);
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(MODEL_V2_SEED), authority.toBuffer(), Buffer.from(boundedModelCid)],
    programId
  );

  return {
    pda: pda.toBase58(),
    bump,
    seeds: [MODEL_V2_SEED, authority.toBase58(), boundedModelCid],
  };
}

export function deriveModelFeedbackPda(modelPublicKey, reviewerPublicKey, programId = MODEL_REGISTRY_PROGRAM_ID) {
  const model = new PublicKey(modelPublicKey);
  const reviewer = new PublicKey(reviewerPublicKey);
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from(MODEL_FEEDBACK_SEED), model.toBuffer(), reviewer.toBuffer()],
    programId
  );

  return {
    pda: pda.toBase58(),
    bump,
    seeds: [MODEL_FEEDBACK_SEED, model.toBase58(), reviewer.toBase58()],
  };
}

export function createModelRegistrationDocument(input) {
  const now = new Date().toISOString();
  const services = input.services?.length ? input.services : [
    {
      name: 'inference',
      endpoint: input.inferenceEndpoint,
      version: input.inferenceVersion || '1.0.0',
    },
  ].filter((service) => service.endpoint);

  return {
    type: MODEL_REGISTRATION_SCHEMA,
    name: input.name,
    description: input.description,
    image: input.image,
    active: input.active ?? true,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    model: {
      architecture: input.architecture,
      format: input.format || 'safetensors',
      parameterCount: input.parameterCount,
      modelType: input.modelType,
      license: input.license,
      artifactUri: input.artifactUri,
      artifactSha256: input.artifactSha256,
      modelCardUri: input.modelCardUri,
      huggingFaceRepo: input.huggingFaceRepo,
      huggingFaceCommit: input.huggingFaceCommit,
      trainingDataUri: input.trainingDataUri,
    },
    evaluations: input.evaluations || [],
    services,
    pricing: {
      currency: input.currency || 'SOL',
      unit: input.pricingUnit || 'inference',
      price: Number(input.price || 0),
      royaltyBps: Number(input.royaltyBps || 0),
    },
    registrations: [
      {
        modelId: input.asset,
        modelRegistry: MODEL_REGISTRY_ID,
      },
    ],
    supportedTrust: input.supportedTrust || TRUST_MODELS,
  };
}

export function validateModelRegistrationDocument(document) {
  const errors = [];

  if (!document || typeof document !== 'object') {
    return ['registration document must be an object'];
  }

  if (document.type !== MODEL_REGISTRATION_SCHEMA) {
    errors.push(`type must be ${MODEL_REGISTRATION_SCHEMA}`);
  }

  for (const field of ['name', 'description', 'image']) {
    if (!document[field]) errors.push(`${field} is required`);
  }

  if (!document.model?.artifactUri) errors.push('model.artifactUri is required');
  if (!document.model?.artifactSha256) errors.push('model.artifactSha256 is required');
  if (!document.model?.huggingFaceRepo) errors.push('model.huggingFaceRepo is required');
  if (!document.model?.huggingFaceCommit) errors.push('model.huggingFaceCommit is required');
  if (!document.registrations?.[0]?.modelId) errors.push('registrations[0].modelId is required');
  if (document.registrations?.[0]?.modelId && !isValidPublicKey(document.registrations[0].modelId)) {
    errors.push('registrations[0].modelId must be a valid Solana public key');
  }
  if (document.registrations?.[0]?.modelRegistry !== MODEL_REGISTRY_ID) {
    errors.push(`registrations[0].modelRegistry must be ${MODEL_REGISTRY_ID}`);
  }

  if (document.pricing?.royaltyBps < 0 || document.pricing?.royaltyBps > 10000) {
    errors.push('pricing.royaltyBps must be between 0 and 10000');
  }

  return errors;
}

export function createModelIdentityRecord({ asset, collection, registrationUri, authority, document }) {
  const identity = deriveModelIdentityPda(asset);

  return {
    asset,
    collection: collection || null,
    authority,
    modelIdentityPda: identity.pda,
    bump: identity.bump,
    modelRegistrationUri: registrationUri,
    modelRegistry: MODEL_REGISTRY_ID,
    lifecycleChecks: {
      transfer: true,
      update: true,
      execute: true,
    },
    documentHash: document?.model?.artifactSha256 || null,
    status: 'ready-to-register',
  };
}

export function createRegisterModelIdentityTransactionPlan(input) {
  const identity = deriveModelIdentityPda(input.asset, input.programId || MODEL_REGISTRY_PROGRAM_ID);
  const modelRegistrationUri = input.registrationUri || input.modelRegistrationUri;
  const artifactHash = input.artifactHash || input.artifactSha256 || input.documentHash || input.document?.model?.artifactSha256 || '';
  const modelType = input.modelType || input.document?.model?.modelType || MODEL_TYPES.LLM_REASONING;
  const royaltyBps = Number(input.royaltyBps ?? input.document?.pricing?.royaltyBps ?? 0);

  return {
    instruction: 'registerModelIdentityV1',
    anchorName: 'register_model_identity_v1',
    discriminator: MODEL_REGISTRY_INSTRUCTION_DISCRIMINATORS.REGISTER_MODEL_IDENTITY_V1,
    programId: (input.programId || MODEL_REGISTRY_PROGRAM_ID).toBase58(),
    accounts: {
      modelIdentity: identity.pda,
      asset: input.asset,
      collection: input.collection || null,
      authority: input.authority,
      payer: input.payer || input.authority,
      systemProgram: '11111111111111111111111111111111',
    },
    accountMetas: [
      { name: 'modelIdentity', pubkey: identity.pda, isSigner: false, isWritable: true },
      { name: 'asset', pubkey: input.asset, isSigner: false, isWritable: false },
      { name: 'collection', pubkey: input.collection || null, isSigner: false, isWritable: false, optional: true },
      { name: 'authority', pubkey: input.authority, isSigner: true, isWritable: false },
      { name: 'payer', pubkey: input.payer || input.authority, isSigner: true, isWritable: true },
      { name: 'systemProgram', pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ],
    args: {
      modelRegistrationUri,
      artifactHash,
      modelType,
      royaltyBps,
    },
    lifecycleChecks: {
      transfer: true,
      update: true,
      execute: true,
    },
  };
}

export function createRegisterModelV2TransactionPlan(input) {
  const model = deriveModelV2Pda(input.authority, input.modelCid, input.programId || MODEL_REGISTRY_PROGRAM_ID);

  return {
    instruction: 'registerModelV2',
    anchorName: 'register_model_v2',
    discriminator: MODEL_REGISTRY_INSTRUCTION_DISCRIMINATORS.REGISTER_MODEL_V2,
    programId: (input.programId || MODEL_REGISTRY_PROGRAM_ID).toBase58(),
    accounts: {
      model: model.pda,
      authority: input.authority,
      payer: input.payer || input.authority,
      systemProgram: '11111111111111111111111111111111',
    },
    accountMetas: [
      { name: 'model', pubkey: model.pda, isSigner: false, isWritable: true },
      { name: 'authority', pubkey: input.authority, isSigner: true, isWritable: false },
      { name: 'payer', pubkey: input.payer || input.authority, isSigner: true, isWritable: true },
      { name: 'systemProgram', pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: false },
    ],
    args: {
      name: input.name,
      description: input.description,
      hfRepo: input.huggingFaceRepo || input.hfRepo,
      modelCid: input.modelCid,
      capabilities: input.capabilities || [],
      clawdPrice: Number(input.clawdPrice || 0),
      metadataUri: input.metadataUri,
    },
  };
}
