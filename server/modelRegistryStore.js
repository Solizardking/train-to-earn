export function rowToModelRegistration(row) {
  const document = coerceJson(row.document, {});
  const transactionPlan = coerceJson(row.transaction_plan, {});
  const attestations = coerceJson(row.attestations, {});

  return {
    id: row.model_id,
    name: row.name,
    description: document.description || null,
    image: document.image || null,
    asset: row.asset,
    authority: row.authority,
    modelIdentityPda: row.model_identity_pda,
    modelRegistrationUri: row.model_registration_uri,
    modelRegistry: row.model_registry,
    modelType: row.model_type,
    artifactUri: row.artifact_uri,
    artifactSha256: row.artifact_sha256,
    huggingFaceRepo: row.hugging_face_repo,
    huggingFaceCommit: row.hugging_face_commit,
    googleAttestationUri: row.google_attestation_uri,
    googleAttestor: row.google_attestor,
    document,
    transactionPlan,
    attestations,
    status: row.status,
    price: Number(document.pricing?.price || 0),
    royaltyBps: Number(document.pricing?.royaltyBps || 0),
    accuracy: Number(document.evaluations?.[0]?.score || 0),
    downloads: Number(document.downloads || 0),
    storageType: detectModelStorageType(row.artifact_uri || row.model_registration_uri),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function coerceJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function modelIdFromName(name) {
  return String(name || 'model')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'model';
}

export function detectModelStorageType(identifier = '') {
  const value = String(identifier || '').trim();
  if (!value) return 'unknown';
  if (/^ar:\/\//i.test(value) || /^https?:\/\/arweave\.net\//i.test(value) || /^[a-z0-9_-]{43}$/i.test(value)) {
    return 'arweave';
  }
  if (/^ipfs:\/\//i.test(value) || /\/ipfs\//i.test(value) || /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z0-9]+)/.test(value)) {
    return 'ipfs';
  }
  if (/huggingface\.co|hf\.co/i.test(value)) return 'huggingface';
  return 'unknown';
}

export function modelCatalogEntryFromInput(input = {}) {
  const modelCid = input.modelCid || input.cid || input.txId || null;
  const artifactUri = input.artifactUri || (
    input.txId ? `ar://${input.txId}` : input.cid ? `ipfs://${input.cid}` : null
  );
  const metadataUri = input.metadataUri || input.registrationUri || null;
  const name = String(input.name || input.title || modelCid || 'Registered model').trim();
  const id = input.id || input.modelId || modelIdFromName(name);

  return {
    id,
    name,
    description: input.description || '',
    modelType: String(input.modelType || input.type || 'GENERAL').toUpperCase(),
    storageType: input.storageType || detectModelStorageType(modelCid || artifactUri || metadataUri),
    artifactUri,
    artifactSha256: input.artifactSha256 || input.sha256 || input.hash || '',
    modelCid,
    metadataUri,
    creator: input.creator || input.walletAddress || input.authority || 'anonymous',
    authority: input.authority || input.walletAddress || null,
    price: Number(input.price || input.priceSol || input.clawdPrice || 0),
    accuracy: Number(input.accuracy || 0),
    downloads: Number(input.downloads || 0),
    source: input.source || 'api',
    document: input.document || input.metadata || input,
    status: input.status || 'registered',
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function rowToModelCatalogEntry(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    modelType: row.model_type,
    storageType: row.storage_type,
    artifactUri: row.artifact_uri,
    artifactSha256: row.artifact_sha256,
    modelCid: row.model_cid,
    metadataUri: row.metadata_uri,
    creator: row.creator,
    authority: row.authority,
    price: Number(row.price_sol || 0),
    accuracy: Number(row.accuracy || 0),
    downloads: Number(row.downloads || 0),
    source: row.source,
    document: coerceJson(row.document, {}),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function filterAndSortModelEntries(models, {
  type,
  limit = 50,
  offset = 0,
  sortBy = 'recent',
  query,
} = {}) {
  const normalizedType = type ? String(type).toUpperCase() : null;
  const normalizedQuery = query ? String(query).toLowerCase() : null;
  const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const filtered = models.filter((model) => {
    const matchesType = !normalizedType || String(model.modelType || '').toUpperCase() === normalizedType;
    const haystack = `${model.id || ''} ${model.name || ''} ${model.description || ''} ${model.artifactUri || ''} ${model.modelCid || ''}`.toLowerCase();
    return matchesType && (!normalizedQuery || haystack.includes(normalizedQuery));
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'downloads') return Number(b.downloads || 0) - Number(a.downloads || 0);
    if (sortBy === 'accuracy') return Number(b.accuracy || 0) - Number(a.accuracy || 0);
    if (sortBy === 'price') return Number(a.price || 0) - Number(b.price || 0);
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });

  return {
    models: sorted.slice(safeOffset, safeOffset + maxLimit),
    total: sorted.length,
    limit: maxLimit,
    offset: safeOffset,
  };
}

export async function persistModelRegistration(pool, { documentInput, identity, document, transactionPlan, attestations }) {
  const result = await pool.query(
    `INSERT INTO model_registrations (
      model_id,
      name,
      asset,
      authority,
      model_identity_pda,
      model_registration_uri,
      model_registry,
      model_type,
      artifact_uri,
      artifact_sha256,
      hugging_face_repo,
      hugging_face_commit,
      google_attestation_uri,
      google_attestor,
      document,
      transaction_plan,
      attestations,
      status,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, 'prepared', NOW()
    )
    ON CONFLICT (asset) DO UPDATE SET
      model_id = EXCLUDED.model_id,
      name = EXCLUDED.name,
      authority = EXCLUDED.authority,
      model_identity_pda = EXCLUDED.model_identity_pda,
      model_registration_uri = EXCLUDED.model_registration_uri,
      model_registry = EXCLUDED.model_registry,
      model_type = EXCLUDED.model_type,
      artifact_uri = EXCLUDED.artifact_uri,
      artifact_sha256 = EXCLUDED.artifact_sha256,
      hugging_face_repo = EXCLUDED.hugging_face_repo,
      hugging_face_commit = EXCLUDED.hugging_face_commit,
      google_attestation_uri = EXCLUDED.google_attestation_uri,
      google_attestor = EXCLUDED.google_attestor,
      document = EXCLUDED.document,
      transaction_plan = EXCLUDED.transaction_plan,
      attestations = EXCLUDED.attestations,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *`,
    [
      documentInput.id || modelIdFromName(documentInput.name),
      documentInput.name,
      identity.asset,
      identity.authority,
      identity.modelIdentityPda,
      identity.modelRegistrationUri,
      identity.modelRegistry,
      documentInput.modelType,
      documentInput.artifactUri,
      documentInput.artifactSha256,
      documentInput.huggingFaceRepo,
      documentInput.huggingFaceCommit,
      documentInput.googleAttestationUri || null,
      documentInput.googleAttestor || null,
      JSON.stringify(document),
      JSON.stringify(transactionPlan),
      JSON.stringify(attestations),
    ]
  );

  return rowToModelRegistration(result.rows[0]);
}

export async function persistModelCatalogEntry(pool, input) {
  const entry = modelCatalogEntryFromInput(input);
  const result = await pool.query(
    `INSERT INTO model_catalog_entries (
      id,
      name,
      description,
      model_type,
      storage_type,
      artifact_uri,
      artifact_sha256,
      model_cid,
      metadata_uri,
      creator,
      authority,
      price_sol,
      accuracy,
      downloads,
      source,
      document,
      status,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      model_type = EXCLUDED.model_type,
      storage_type = EXCLUDED.storage_type,
      artifact_uri = EXCLUDED.artifact_uri,
      artifact_sha256 = EXCLUDED.artifact_sha256,
      model_cid = EXCLUDED.model_cid,
      metadata_uri = EXCLUDED.metadata_uri,
      creator = EXCLUDED.creator,
      authority = EXCLUDED.authority,
      price_sol = EXCLUDED.price_sol,
      accuracy = EXCLUDED.accuracy,
      downloads = EXCLUDED.downloads,
      source = EXCLUDED.source,
      document = EXCLUDED.document,
      status = EXCLUDED.status,
      updated_at = NOW()
    RETURNING *`,
    [
      entry.id,
      entry.name,
      entry.description,
      entry.modelType,
      entry.storageType,
      entry.artifactUri,
      entry.artifactSha256,
      entry.modelCid,
      entry.metadataUri,
      entry.creator,
      entry.authority,
      entry.price,
      entry.accuracy,
      entry.downloads,
      entry.source,
      JSON.stringify(entry.document),
      entry.status,
    ],
  );

  return rowToModelCatalogEntry(result.rows[0]);
}

export async function listModelCatalogEntries(pool, options = {}) {
  const result = await pool.query(
    `SELECT * FROM model_catalog_entries ORDER BY updated_at DESC LIMIT 500`,
  );
  return filterAndSortModelEntries(result.rows.map(rowToModelCatalogEntry), options);
}
