import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.AUTH_SECRET = 'test-secret-for-registry-suite';

const { base58Encode } = await import('../server/auth.js');
const {
  canonicalManifestJson,
  manifestSha256,
  publisherProofMessage,
  registryMemo,
  registerManifest,
  getRegistryEntry,
  registerRegistryRoutes,
} = await import('../server/registryApi.js');

// The reference canonicalization, copied from scripts/register-model.mjs —
// the server hash MUST match what the CLI (and any Solana memo anchor
// already published) computed for the same manifest.
function scriptManifestSha256(manifest) {
  const canonical = JSON.stringify(manifest, Object.keys(manifest).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function throwawayWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const rawPublicKey = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  return { wallet: base58Encode(rawPublicKey), privateKey };
}

function scriptStyleManifest(publisher) {
  return {
    name: 'hash-match-model',
    version: '1.0.0',
    chain_id: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
    repo: 'https://huggingface.co/example/hash-match-model',
    weights_sha256: 'a'.repeat(64),
    license: 'Apache-2.0',
    modality: 'text',
    publisher,
    solana_address: publisher,
    registered_at: '2026-11-21T00:00:00.000Z',
  };
}

test('manifestSha256 matches scripts/register-model.mjs canonicalization exactly', () => {
  const { wallet } = throwawayWallet();
  const manifest = scriptStyleManifest(wallet);
  assert.equal(canonicalManifestJson(manifest), JSON.stringify(manifest, Object.keys(manifest).sort()));
  assert.equal(manifestSha256(manifest), scriptManifestSha256(manifest));
  assert.match(manifestSha256(manifest), /^[a-f0-9]{64}$/);
});

test('Solana publisher with a valid proof registers at tier 1 with the spec memo', async () => {
  const { wallet, privateKey } = throwawayWallet();
  const manifest = scriptStyleManifest(wallet);
  manifest.name = 'tier-one-model';
  const sha256 = manifestSha256(manifest);
  const signature = base58Encode(
    crypto.sign(null, Buffer.from(publisherProofMessage(sha256), 'utf8'), privateKey),
  );
  const entry = await registerManifest({ manifest, signature }, {});
  assert.equal(entry.manifest_sha256, sha256);
  assert.equal(entry.tier, 1);
  assert.equal(entry.proof_status, 'verified');
  assert.equal(
    entry.memo,
    `clawd-registry:v1:register:${sha256}:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:${wallet}`,
  );
  assert.equal(registryMemo({ sha256, chainId: manifest.chain_id, publisher: wallet }), entry.memo);
  assert.equal(getRegistryEntry(sha256).name, 'tier-one-model');
});

test('Solana publisher with a bad proof stays tier 0 with invalid-signature status', async () => {
  const { wallet, privateKey } = throwawayWallet();
  const manifest = scriptStyleManifest(wallet);
  manifest.name = 'tier-zero-model';
  const signature = base58Encode(
    crypto.sign(null, Buffer.from('clawd-registry:v1:not-the-manifest-hash', 'utf8'), privateKey),
  );
  const entry = await registerManifest({ manifest, signature }, {});
  assert.equal(entry.tier, 0);
  assert.equal(entry.proof_status, 'invalid-signature');
});

test('EVM publisher is accepted at tier 0 with proof_status unverified-chain (no fake verification)', async () => {
  const manifest = {
    name: 'evm-model',
    version: '0.1.0',
    chain_id: 'eip155:8453',
    repo: 'https://huggingface.co/example/evm-model',
    weights_sha256: 'b'.repeat(64),
    license: 'MIT',
    modality: 'text',
    publisher: '0x1234567890abcdef1234567890abcdef12345678',
    solana_address: throwawayWallet().wallet,
    registered_at: '2026-11-21T00:00:00.000Z',
  };
  const entry = await registerManifest({ manifest, signature: '0xdeadbeef' }, {});
  assert.equal(entry.tier, 0);
  assert.equal(entry.proof_status, 'unverified-chain');
  assert.equal(entry.chain_id, 'eip155:8453');
});

test('manifest validation rejects a missing weights hash', async () => {
  const manifest = scriptStyleManifest(throwawayWallet().wallet);
  delete manifest.weights_sha256;
  await assert.rejects(() => registerManifest({ manifest, signature: 'x' }, {}), /weights_sha256/);
});

test('routes: register then read back by hash, 404 for unknown hash', async () => {
  const routes = {};
  const app = {
    get(path, ...handlers) { routes[`GET ${path}`] = handlers; },
    post(path, ...handlers) { routes[`POST ${path}`] = handlers; },
  };
  registerRegistryRoutes(app, {});
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

  const { wallet, privateKey } = throwawayWallet();
  const manifest = scriptStyleManifest(wallet);
  manifest.name = 'route-model';
  const sha256 = manifestSha256(manifest);
  const signature = base58Encode(
    crypto.sign(null, Buffer.from(publisherProofMessage(sha256), 'utf8'), privateKey),
  );

  const created = await run(routes['POST /api/registry/register'], { body: { manifest, signature }, query: {} });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.model.tier, 1);
  assert.equal(created.body.memo, created.body.model.memo);

  const fetched = await run(routes['GET /api/registry/models/:sha256'], { params: { sha256 }, query: {} });
  assert.equal(fetched.statusCode, 200);
  assert.equal(fetched.body.model.name, 'route-model');

  const missing = await run(routes['GET /api/registry/models/:sha256'], { params: { sha256: 'f'.repeat(64) }, query: {} });
  assert.equal(missing.statusCode, 404);

  const list = await run(routes['GET /api/registry/models'], { query: {} });
  assert.equal(list.statusCode, 200);
  assert.ok(list.body.models.some((m) => m.manifest_sha256 === sha256));
});
