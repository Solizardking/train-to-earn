import { isValidPublicKey } from './modelRegistry.js';

export function normalizeHuggingFaceRepo(repo) {
  const trimmed = String(repo || '').trim();
  const match = trimmed.match(/^(?:https:\/\/huggingface\.co\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/);

  if (!match) {
    return {
      provider: 'huggingface',
      valid: false,
      error: 'Hugging Face repo must look like namespace/model-name',
    };
  }

  return {
    provider: 'huggingface',
    valid: true,
    repo: match[1],
    url: `https://huggingface.co/${match[1]}`,
  };
}

export function validateGoogleAttestation(attestation) {
  const uri = String(attestation?.uri || attestation || '').trim();
  const attestor = String(attestation?.attestor || 'google:vertex-ai').trim();
  const validUri = /^https:\/\/(storage\.googleapis\.com|[A-Za-z0-9.-]+\.googleapis\.com)\//.test(uri) ||
    /^gs:\/\/[A-Za-z0-9._-]+\//.test(uri);

  return {
    provider: 'google',
    valid: Boolean(uri && validUri && attestor.startsWith('google:')),
    attestor,
    uri,
    error: uri && validUri ? null : 'Google attestation must be a gs:// or googleapis.com URI',
  };
}

export function validateMetaplexAsset(asset, collection) {
  const assetValid = isValidPublicKey(asset);
  const collectionValid = !collection || isValidPublicKey(collection);

  return {
    provider: 'metaplex',
    valid: assetValid && collectionValid,
    asset,
    collection: collection || null,
    error: assetValid && collectionValid ? null : 'Metaplex asset and collection must be valid Solana public keys',
  };
}

export function evaluateMetaplexDasAsset({ expectedAsset, expectedCollection, expectedAuthority, dasAsset }) {
  const assetId = dasAsset?.id || dasAsset?.assetId;
  const interfaceName = dasAsset?.interface || dasAsset?.interfaceName || '';
  const owner = dasAsset?.ownership?.owner || dasAsset?.ownership?.delegate || null;
  const grouping = Array.isArray(dasAsset?.grouping) ? dasAsset.grouping : [];
  const collection = grouping.find((group) => group.group_key === 'collection')?.group_value ||
    dasAsset?.grouping?.collection ||
    dasAsset?.collection?.key ||
    null;
  const metadata = dasAsset?.content?.metadata || dasAsset?.metadata || {};
  const plugins = dasAsset?.plugins || dasAsset?.content?.plugins || {};
  const errors = [];

  if (!dasAsset || typeof dasAsset !== 'object') {
    return {
      provider: 'metaplex',
      verified: false,
      valid: false,
      error: 'Metaplex DAS asset response is required',
      checks: [],
    };
  }

  const checks = [
    {
      name: 'asset_exists',
      valid: Boolean(assetId),
      detail: assetId || null,
    },
    {
      name: 'asset_matches_request',
      valid: Boolean(expectedAsset && assetId === expectedAsset),
      detail: { expected: expectedAsset || null, actual: assetId || null },
    },
    {
      name: 'metaplex_core_interface',
      valid: /mpl.?core|core/i.test(interfaceName),
      detail: interfaceName || null,
    },
    {
      name: 'collection_matches_request',
      valid: !expectedCollection || collection === expectedCollection,
      detail: { expected: expectedCollection || null, actual: collection },
    },
    {
      name: 'authority_or_owner_matches_request',
      valid: !expectedAuthority || owner === expectedAuthority || metadata?.updateAuthority === expectedAuthority,
      detail: { expected: expectedAuthority || null, owner, updateAuthority: metadata?.updateAuthority || null },
    },
  ];

  for (const check of checks) {
    if (!check.valid) errors.push(check.name);
  }

  return {
    provider: 'metaplex',
    verified: errors.length === 0,
    valid: errors.length === 0,
    asset: assetId || null,
    interface: interfaceName || null,
    owner,
    collection,
    name: metadata?.name || null,
    symbol: metadata?.symbol || null,
    plugins,
    checks,
    error: errors.length > 0 ? `Metaplex DAS verification failed: ${errors.join(', ')}` : null,
  };
}

export function createSolanaExplorerLinks({ asset, modelIdentityPda, cluster = 'devnet' }) {
  const suffix = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;

  return {
    provider: 'solana',
    valid: isValidPublicKey(asset) && isValidPublicKey(modelIdentityPda),
    cluster,
    assetUrl: `https://explorer.solana.com/address/${asset}${suffix}`,
    modelIdentityUrl: `https://explorer.solana.com/address/${modelIdentityPda}${suffix}`,
  };
}

export function buildProviderAttestations(model) {
  const huggingFace = normalizeHuggingFaceRepo(model.huggingFaceRepo);
  const google = validateGoogleAttestation(model.googleAttestationUri
    ? { uri: model.googleAttestationUri, attestor: model.googleAttestor }
    : model.googleAttestation);
  const metaplex = model.metaplexDasAsset
    ? evaluateMetaplexDasAsset({
      expectedAsset: model.asset || model.mint,
      expectedCollection: model.collection,
      expectedAuthority: model.authority,
      dasAsset: model.metaplexDasAsset,
    })
    : validateMetaplexAsset(model.asset || model.mint, model.collection);
  const solana = createSolanaExplorerLinks({
    asset: model.asset || model.mint,
    modelIdentityPda: model.modelIdentityPda || model.registryPda,
    cluster: model.cluster || 'devnet',
  });

  return {
    huggingFace,
    google,
    metaplex,
    solana,
    valid: huggingFace.valid && metaplex.valid && solana.valid,
  };
}
