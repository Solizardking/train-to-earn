import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.AUTH_SECRET = 'test-secret-for-auth-suite';

const {
  base58Encode,
  base58Decode,
  createChallenge,
  completeLogin,
  verifyToken,
  verifyWalletSignature,
  requireAuth,
} = await import('../server/auth.js');

// A throwaway Ed25519 keypair — the private key never leaves this test.
function throwawayWallet() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const rawPublicKey = Buffer.from(jwk.x, 'base64url');
  assert.equal(rawPublicKey.length, 32);
  return { wallet: base58Encode(rawPublicKey), privateKey };
}

function sign(privateKey, message) {
  return crypto.sign(null, Buffer.from(message, 'utf8'), privateKey);
}

test('base58 codec round-trips a 32-byte public key', () => {
  const bytes = crypto.randomBytes(32);
  const decoded = base58Decode(base58Encode(bytes));
  assert.deepEqual(decoded, bytes);
});

test('challenge message has the exact TrainToEarn Login format', () => {
  const { wallet } = throwawayWallet();
  const challenge = createChallenge(wallet);
  const lines = challenge.message.split('\n');
  assert.equal(lines[0], 'TrainToEarn Login');
  assert.equal(lines[1], `Wallet: ${wallet}`);
  assert.equal(lines[2], `Nonce: ${challenge.nonce}`);
  assert.match(lines[3], /^Issued: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(challenge.expiresAt);
});

test('challenge/verify round-trip issues a token that /me would accept (base58 signature)', () => {
  const { wallet, privateKey } = throwawayWallet();
  const challenge = createChallenge(wallet);
  const signature = base58Encode(sign(privateKey, challenge.message));
  const session = completeLogin(wallet, signature);
  assert.equal(session.wallet, wallet);
  assert.ok(session.token);
  assert.ok(new Date(session.expiresAt).getTime() > Date.now());
  const verified = verifyToken(session.token);
  assert.equal(verified.wallet, wallet);
});

test('challenge/verify round-trip also accepts a base64 signature', () => {
  const { wallet, privateKey } = throwawayWallet();
  const challenge = createChallenge(wallet);
  const signature = sign(privateKey, challenge.message).toString('base64');
  const session = completeLogin(wallet, signature);
  assert.equal(verifyToken(session.token).wallet, wallet);
});

test('nonces are single-use: a second verify with the same signature fails', () => {
  const { wallet, privateKey } = throwawayWallet();
  const challenge = createChallenge(wallet);
  const signature = base58Encode(sign(privateKey, challenge.message));
  completeLogin(wallet, signature);
  assert.throws(() => completeLogin(wallet, signature), /No pending login challenge/);
});

test('a signature over a different message is rejected', () => {
  const { wallet, privateKey } = throwawayWallet();
  createChallenge(wallet);
  const signature = base58Encode(sign(privateKey, 'TrainToEarn Login\nWallet: someone-else'));
  assert.equal(verifyWalletSignature({ wallet, message: 'other', signature }), false);
  assert.throws(() => completeLogin(wallet, signature), /Signature verification failed/);
});

test('requireAuth rejects missing/garbage tokens with 401 and passes a valid one', () => {
  const { wallet, privateKey } = throwawayWallet();
  const challenge = createChallenge(wallet);
  const { token } = completeLogin(wallet, base58Encode(sign(privateKey, challenge.message)));

  const runMiddleware = (headers) => {
    const req = { headers };
    let status = null;
    let nextCalled = false;
    const res = {
      status(code) { status = code; return this; },
      json() { return this; },
    };
    requireAuth(req, res, () => { nextCalled = true; });
    return { req, status, nextCalled };
  };

  const noHeader = runMiddleware({});
  assert.equal(noHeader.status, 401);
  assert.equal(noHeader.nextCalled, false);

  const garbage = runMiddleware({ authorization: 'Bearer not-a-token' });
  assert.equal(garbage.status, 401);
  assert.equal(garbage.nextCalled, false);

  const good = runMiddleware({ authorization: `Bearer ${token}` });
  assert.equal(good.nextCalled, true);
  assert.equal(good.req.wallet, wallet);
});

test('createChallenge rejects a malformed wallet address', () => {
  assert.throws(() => createChallenge('not-a-wallet'), /valid Solana public key/);
});
