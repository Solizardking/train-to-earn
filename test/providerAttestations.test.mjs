import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildProviderAttestations,
  createSolanaExplorerLinks,
  evaluateMetaplexDasAsset,
  normalizeHuggingFaceRepo,
  validateGoogleAttestation,
  validateMetaplexAsset,
} from '../src/utils/providerAttestations.js';

const asset = '6QLKq9fqrsDH44bNB3JHEJGQ41Xi2KC5HsZYCCHuQgrC';
const modelIdentityPda = 'jWwQcDAUjj3p37h2TSFeQFAmq2Zg7qLhxjNU8AUa6c6';

test('normalizes Hugging Face repo identifiers and URLs', () => {
  assert.deepEqual(normalizeHuggingFaceRepo('https://huggingface.co/solana-ai/buildercode-3b'), {
    provider: 'huggingface',
    valid: true,
    repo: 'solana-ai/buildercode-3b',
    url: 'https://huggingface.co/solana-ai/buildercode-3b',
  });

  assert.equal(normalizeHuggingFaceRepo('bad repo').valid, false);
});

test('validates Google attestation URIs', () => {
  assert.equal(validateGoogleAttestation({
    uri: 'gs://traintoearn-attestations/buildercode/eval.json',
    attestor: 'google:vertex-ai',
  }).valid, true);

  assert.equal(validateGoogleAttestation('https://example.com/eval.json').valid, false);
});

test('validates Metaplex asset references and Solana explorer links', () => {
  assert.equal(validateMetaplexAsset(asset).valid, true);

  const links = createSolanaExplorerLinks({ asset, modelIdentityPda, cluster: 'devnet' });
  assert.equal(links.valid, true);
  assert.equal(links.assetUrl, `https://explorer.solana.com/address/${asset}?cluster=devnet`);
});

test('evaluates Metaplex DAS asset responses for model registration', () => {
  const verification = evaluateMetaplexDasAsset({
    expectedAsset: asset,
    expectedAuthority: 'EhUoob64sfDYYVSU6fNxEj91enmbxGE2LwSb5PSJCRsA',
    dasAsset: {
      id: asset,
      interface: 'MplCoreAsset',
      ownership: { owner: 'EhUoob64sfDYYVSU6fNxEj91enmbxGE2LwSb5PSJCRsA' },
      content: {
        metadata: {
          name: 'BuilderCode Solana 3B',
          symbol: 'BCODE',
        },
      },
      grouping: [],
      plugins: {
        royalties: { basis_points: 300 },
      },
    },
  });

  assert.equal(verification.verified, true);
  assert.equal(verification.interface, 'MplCoreAsset');
  assert.equal(verification.name, 'BuilderCode Solana 3B');

  const invalid = evaluateMetaplexDasAsset({
    expectedAsset: asset,
    dasAsset: {
      id: asset,
      interface: 'FungibleToken',
      ownership: {},
    },
  });

  assert.equal(invalid.verified, false);
  assert.match(invalid.error, /metaplex_core_interface/);
});

test('builds a complete provider attestation bundle', () => {
  const bundle = buildProviderAttestations({
    asset,
    modelIdentityPda,
    huggingFaceRepo: 'solana-ai/buildercode-3b',
    googleAttestationUri: 'https://storage.googleapis.com/traintoearn-attestations/buildercode/eval.json',
    googleAttestor: 'google:vertex-ai',
  });

  assert.equal(bundle.valid, true);
  assert.equal(bundle.huggingFace.url, 'https://huggingface.co/solana-ai/buildercode-3b');
  assert.equal(bundle.google.valid, true);
  assert.equal(bundle.metaplex.valid, true);
  assert.equal(bundle.solana.valid, true);
});
