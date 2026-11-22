// Omnichain AI Model Registry API — docs/omnichain-registry.md, Phase 1.
//
// Any publisher, on any chain, registers a signed model manifest; the
// registry stores the manifest, its SHA-256 (computed with the EXACT
// canonicalization scripts/register-model.mjs uses), and a verification
// tier that says precisely how much has been checked — never more.
//
//   tier 1 — manifest hash recomputed here AND the publisher proof
//            (signature over `clawd-registry:v1:<manifest_sha256>`)
//            verifies against the publisher's home-chain address.
//   tier 0 — everything else: schema-valid but unproven, or proven on a
//            chain this backend cannot verify yet (proof_status
//            "unverified-chain" — EVM/EIP-191 recovery needs a dependency
//            this repo does not carry, so EVM proofs are recorded, not
//            silently trusted).
//
// Storage: an in-memory store for the running process, mirrored into the
// existing model_catalog_entries table (modelRegistryStore) when the
// database is connected, and merged on read with the Phase-0 seed file
// registry/registry.json. Reads are public, matching the rest of the API.

import crypto from 'node:crypto';
import fs from 'node:fs';
import { verifyWalletSignature, isValidSolanaAddress } from './auth.js';
import { listModelCatalogEntries, persistModelCatalogEntry } from './modelRegistryStore.js';

// ---------------------------------------------------------------------------
// Manifest hashing — MUST match scripts/register-model.mjs exactly.
// The script canonicalizes with JSON.stringify(manifest, sortedTopLevelKeys)
// (a replacer array of the manifest's own top-level keys, sorted) and hashes
// the UTF-8 bytes with SHA-256. Do not "improve" this into a recursive
// canonicalizer: hashes already anchored on Solana were computed this way.
// ---------------------------------------------------------------------------

export function canonicalManifestJson(manifest) {
  return JSON.stringify(manifest, Object.keys(manifest).sort());
}

export function manifestSha256(manifest) {
  return crypto.createHash('sha256').update(canonicalManifestJson(manifest)).digest('hex');
}

export function publisherProofMessage(sha256) {
  return `clawd-registry:v1:${sha256}`;
}

export function registryMemo({ sha256, chainId, publisher }) {
  return `clawd-registry:v1:register:${sha256}:${chainId}:${publisher}`;
}

// ---------------------------------------------------------------------------
// Manifest shapes — two are in the wild and both are accepted:
//   flat  (scripts/register-model.mjs): { name, version, chain_id, repo,
//          weights_sha256, license, modality, publisher, solana_address }
//   spec  (docs/omnichain-registry.md): { manifest_version, name, version,
//          home_chain: { chain_id, publisher_address }, model: {...},
//          publisher_proof: { method, message, signature }, solana_address }
// ---------------------------------------------------------------------------

export function manifestPublisher(manifest) {
  return manifest?.publisher || manifest?.home_chain?.publisher_address || null;
}

export function manifestChainId(manifest) {
  return manifest?.chain_id || manifest?.home_chain?.chain_id || null;
}

export function manifestSignature(manifest, bodySignature) {
  return bodySignature || manifest?.publisher_proof?.signature || manifest?.signature || null;
}

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return ['manifest must be a JSON object'];
  }
  if (!manifest.name || typeof manifest.name !== 'string') errors.push('manifest.name is required');
  if (!manifest.version || typeof manifest.version !== 'string') errors.push('manifest.version is required');
  if (!manifestChainId(manifest)) errors.push('manifest chain_id is required (CAIP-2, e.g. solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp or eip155:8453)');
  if (!manifestPublisher(manifest)) errors.push('manifest publisher address is required (publisher or home_chain.publisher_address)');
  const weights = manifest.weights_sha256 || manifest.model?.weights_sha256;
  if (!weights || !/^[a-f0-9]{64}$/i.test(String(weights))) {
    errors.push('manifest weights_sha256 must be a 64-char hex SHA-256');
  }
  return errors;
}

// Classify the publisher's home chain from the address + CAIP-2 id.
export function publisherChainKind(manifest) {
  const publisher = manifestPublisher(manifest) || '';
  const chainId = manifestChainId(manifest) || '';
  if (/^0x[a-fA-F0-9]{40}$/.test(publisher) || chainId.startsWith('eip155:')) return 'evm';
  if (chainId.startsWith('solana:') || isValidSolanaAddress(publisher)) return 'solana';
  return 'other';
}

// Verify the publisher proof. Returns { verified, proofStatus } — an EVM
// proof is honestly reported as unverified (no EIP-191 recovery dependency
// in this repo) rather than rejected or faked.
export function verifyPublisherProof(manifest, sha256, signature) {
  const kind = publisherChainKind(manifest);
  if (!signature) return { verified: false, proofStatus: 'missing-signature', chainKind: kind };
  if (kind === 'solana') {
    const ok = verifyWalletSignature({
      wallet: manifestPublisher(manifest),
      message: publisherProofMessage(sha256),
      signature,
    });
    return { verified: ok, proofStatus: ok ? 'verified' : 'invalid-signature', chainKind: kind };
  }
  if (kind === 'evm') return { verified: false, proofStatus: 'unverified-chain', chainKind: kind };
  return { verified: false, proofStatus: 'unverified-chain', chainKind: kind };
}

// ---------------------------------------------------------------------------
// Store — in-memory primary, DB mirror when connected, seed file merged.
// ---------------------------------------------------------------------------

const registryEntries = new Map(); // manifest_sha256 -> entry

function loadSeedEntries() {
  try {
    const raw = fs.readFileSync(new URL('../registry/registry.json', import.meta.url), 'utf8');
    const seed = JSON.parse(raw);
    return (seed.models || []).map((item) => {
      const manifest = item.manifest || item;
      const sha256 = item.manifest_sha256 || manifestSha256(manifest);
      return shapeEntry({ manifest, sha256, tier: item.tier ?? 0, proofStatus: item.proof_status || 'seed', source: 'seed' });
    });
  } catch {
    return [];
  }
}

function shapeEntry({ manifest, sha256, tier, proofStatus, source, registeredAt }) {
  const chainId = manifestChainId(manifest);
  const publisher = manifestPublisher(manifest);
  return {
    id: sha256,
    manifest_sha256: sha256,
    manifest,
    name: manifest.name || null,
    version: manifest.version || null,
    chain_id: chainId,
    publisher,
    solana_address: manifest.solana_address || null,
    tier,
    proof_status: proofStatus,
    memo: registryMemo({ sha256, chainId, publisher }),
    anchor: null, // memo-tx / PDA anchor attachment is a follow-up step
    source,
    registered_at: registeredAt || manifest.registered_at || manifest.created_at || new Date().toISOString(),
  };
}

export function getRegistryEntry(sha256) {
  if (registryEntries.has(sha256)) return registryEntries.get(sha256);
  return loadSeedEntries().find((entry) => entry.manifest_sha256 === sha256) || null;
}

export async function listRegistryEntries({ pool = null, isDbConnected = null } = {}) {
  const merged = new Map();
  for (const entry of loadSeedEntries()) merged.set(entry.manifest_sha256, entry);
  for (const entry of registryEntries.values()) merged.set(entry.manifest_sha256, entry);
  if (pool && isDbConnected && isDbConnected()) {
    try {
      const { models } = await listModelCatalogEntries(pool, { limit: 100 });
      for (const model of models) {
        const doc = model.document || {};
        const sha256 = doc.manifest_sha256 || model.artifactSha256;
        if (sha256 && !merged.has(sha256)) {
          merged.set(sha256, {
            id: sha256,
            manifest_sha256: sha256,
            manifest: doc.manifest || null,
            name: model.name,
            version: doc.manifest?.version || null,
            chain_id: doc.manifest ? manifestChainId(doc.manifest) : null,
            publisher: model.creator || null,
            solana_address: doc.manifest?.solana_address || null,
            tier: doc.tier ?? 0,
            proof_status: doc.proof_status || 'unverified-chain',
            memo: doc.memo || null,
            anchor: null,
            source: 'model-catalog',
            registered_at: model.createdAt,
          });
        }
      }
    } catch (error) {
      console.error('Registry DB merge failed:', error.message);
    }
  }
  return [...merged.values()].sort((a, b) => String(b.registered_at).localeCompare(String(a.registered_at)));
}

export async function registerManifest({ manifest, signature }, { pool = null, isDbConnected = null } = {}) {
  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    const err = new Error(errors.join('; '));
    err.status = 400;
    throw err;
  }
  const sha256 = manifestSha256(manifest);
  const proof = verifyPublisherProof(manifest, sha256, manifestSignature(manifest, signature));
  const tier = proof.verified ? 1 : 0;
  const entry = shapeEntry({
    manifest,
    sha256,
    tier,
    proofStatus: proof.proofStatus,
    source: 'api',
    registeredAt: new Date().toISOString(),
  });
  registryEntries.set(sha256, entry);

  if (pool && isDbConnected && isDbConnected()) {
    try {
      await persistModelCatalogEntry(pool, {
        id: `registry-${sha256.slice(0, 24)}`,
        name: manifest.name,
        description: manifest.description || '',
        modelType: String(manifest.modality || manifest.model?.modality || 'GENERAL').toUpperCase(),
        artifactUri: manifest.repo || manifest.model?.repo_url || null,
        artifactSha256: sha256,
        creator: manifestPublisher(manifest),
        authority: isValidSolanaAddress(manifest.solana_address) ? manifest.solana_address : null,
        source: 'registry',
        document: { manifest, manifest_sha256: sha256, tier, proof_status: proof.proofStatus, memo: entry.memo },
        status: 'registered',
      });
    } catch (error) {
      console.error('Registry DB persist failed:', error.message);
      entry.persisted = false;
    }
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Express surface
// ---------------------------------------------------------------------------

export function registerRegistryRoutes(app, deps = {}) {
  app.get('/api/registry/models', async (req, res) => {
    try {
      let models = await listRegistryEntries(deps);
      const { chain_id: chainId, tier, modality } = req.query || {};
      if (chainId) models = models.filter((m) => m.chain_id === chainId);
      if (tier !== undefined) models = models.filter((m) => m.tier === Number(tier));
      if (modality) {
        models = models.filter((m) => (m.manifest?.modality || m.manifest?.model?.modality) === modality);
      }
      return res.json({ models, total: models.length });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to list registry models', details: error.message });
    }
  });

  app.get('/api/registry/models/:sha256', async (req, res) => {
    try {
      const sha256 = String(req.params.sha256).toLowerCase();
      const entry = getRegistryEntry(sha256)
        || (await listRegistryEntries(deps)).find((m) => m.manifest_sha256 === sha256)
        || null;
      if (!entry) return res.status(404).json({ error: 'Model not found in the registry' });
      return res.json({ model: entry });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to read registry model', details: error.message });
    }
  });

  const handleRegister = async (req, res) => {
    try {
      const manifest = req.body?.manifest;
      const signature = req.body?.signature;
      if (!manifest) return res.status(400).json({ error: 'manifest is required' });
      const entry = await registerManifest({ manifest, signature }, deps);
      return res.status(201).json({ model: entry, memo: entry.memo });
    } catch (error) {
      return res.status(error.status || 500).json({ error: 'Failed to register model', details: error.message });
    }
  };

  app.post('/api/registry/register', handleRegister);
  // Spec-shaped alias (docs/omnichain-registry.md API sketch).
  app.post('/api/registry/models', handleRegister);
}
