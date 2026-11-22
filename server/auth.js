// SIWS-style wallet login for TrainToEarn (earn.onchainai.fund).
//
// The wallet IS the account (same doctrine as the rest of the platform):
// a client asks for a one-time challenge, signs the exact challenge message
// with its Solana wallet (Ed25519, e.g. Phantom signMessage), and exchanges
// the signature for a 7-day HS256 session token. The server never holds
// keys and never signs — it only verifies.
//
// Cryptography is Node's built-in Ed25519 (node:crypto): a Solana wallet
// signature is a plain Ed25519 signature over the message bytes, and the
// 32-byte public key wraps into an SPKI key with a fixed DER prefix. This
// is byte-compatible with @solana/web3.js / tweetnacl verification while
// keeping this module free of package dependencies. JWTs are signed and
// verified directly with HMAC-SHA256 for the same reason.
//
// AUTH_SECRET signs the session tokens. If it is unset, an ephemeral secret
// is generated at boot and sessions simply do not survive restarts.

import crypto from 'node:crypto';

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes to sign
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

let authSecret = process.env.AUTH_SECRET || null;
if (!authSecret) {
  authSecret = crypto.randomBytes(32).toString('hex');
  console.warn(
    '[auth] AUTH_SECRET is not set — generated an ephemeral session secret; ' +
    'logins will not survive server restarts.',
  );
}

// ---------------------------------------------------------------------------
// Base58 (Bitcoin/Solana alphabet) — small local codec so this module needs
// no external packages.
// ---------------------------------------------------------------------------

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((ch, i) => [ch, i]));

export function base58Encode(bytes) {
  const buf = Buffer.from(bytes);
  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros += 1;
  let value = 0n;
  for (const byte of buf) value = value * 256n + BigInt(byte);
  let encoded = '';
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return '1'.repeat(zeros) + encoded;
}

export function base58Decode(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros += 1;
  let value = 0n;
  for (const ch of text) {
    const digit = BASE58_INDEX.get(ch);
    if (digit === undefined) return null;
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = value === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

export function isValidSolanaAddress(address) {
  const decoded = typeof address === 'string' ? base58Decode(address) : null;
  return Boolean(decoded && decoded.length === 32);
}

// ---------------------------------------------------------------------------
// Ed25519 verification (Solana wallet signatures)
// ---------------------------------------------------------------------------

// DER prefix for an Ed25519 SubjectPublicKeyInfo wrapping a raw 32-byte key.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function verifyEd25519({ publicKeyBytes, message, signatureBytes }) {
  try {
    if (!publicKeyBytes || publicKeyBytes.length !== 32) return false;
    if (!signatureBytes || signatureBytes.length !== 64) return false;
    const key = crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyBytes)]),
      format: 'der',
      type: 'spki',
    });
    return crypto.verify(null, Buffer.from(message), key, Buffer.from(signatureBytes));
  } catch {
    return false;
  }
}

// A wallet signature may arrive base64 (Phantom/JSON convention) or base58.
// Decode whichever yields exactly 64 bytes.
export function decodeSignature(signature) {
  if (signature == null) return null;
  if (Buffer.isBuffer(signature)) return signature.length === 64 ? signature : null;
  if (signature instanceof Uint8Array) {
    return signature.length === 64 ? Buffer.from(signature) : null;
  }
  if (Array.isArray(signature)) {
    return signature.length === 64 ? Buffer.from(signature) : null;
  }
  if (typeof signature !== 'string') return null;
  const text = signature.trim();
  try {
    const asBase64 = Buffer.from(text, 'base64');
    if (asBase64.length === 64 && asBase64.toString('base64').replace(/=+$/, '') === text.replace(/=+$/, '')) {
      return asBase64;
    }
  } catch { /* fall through to base58 */ }
  const asBase58 = base58Decode(text);
  if (asBase58 && asBase58.length === 64) return asBase58;
  return null;
}

export function verifyWalletSignature({ wallet, message, signature }) {
  const publicKeyBytes = base58Decode(wallet);
  const signatureBytes = decodeSignature(signature);
  if (!publicKeyBytes || !signatureBytes) return false;
  return verifyEd25519({ publicKeyBytes, message, signatureBytes });
}

// ---------------------------------------------------------------------------
// Session tokens — JWT HS256, implemented directly on node:crypto.
// ---------------------------------------------------------------------------

function base64url(data) {
  return Buffer.from(data).toString('base64url');
}

export function signToken(wallet, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: wallet,
    wallet,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', authSecret).update(signingInput).digest();
  return { token: `${signingInput}.${base64url(signature)}`, expiresAt: new Date((nowSeconds + TOKEN_TTL_SECONDS) * 1000).toISOString() };
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = crypto.createHmac('sha256', authSecret).update(`${header}.${payload}`).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!claims || typeof claims.exp !== 'number') return null;
  if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
  const wallet = claims.wallet || claims.sub;
  if (!isValidSolanaAddress(wallet)) return null;
  return { wallet, claims };
}

// ---------------------------------------------------------------------------
// Challenges — one pending challenge per wallet, single-use nonces.
// ---------------------------------------------------------------------------

const challenges = new Map(); // wallet -> { nonce, message, expiresAtMs }

function pruneChallenges(now = Date.now()) {
  for (const [wallet, challenge] of challenges) {
    if (challenge.expiresAtMs <= now) challenges.delete(wallet);
  }
}

export function createChallenge(wallet) {
  if (!isValidSolanaAddress(wallet)) {
    const err = new Error('wallet must be a valid Solana public key (base58, 32 bytes)');
    err.status = 400;
    throw err;
  }
  pruneChallenges();
  const nonce = crypto.randomBytes(16).toString('hex');
  const issued = new Date();
  const message = `TrainToEarn Login\nWallet: ${wallet}\nNonce: ${nonce}\nIssued: ${issued.toISOString()}`;
  const expiresAtMs = Date.now() + CHALLENGE_TTL_MS;
  challenges.set(wallet, { nonce, message, expiresAtMs });
  return { nonce, message, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function completeLogin(wallet, signature) {
  const challenge = challenges.get(wallet);
  if (!challenge) {
    const err = new Error('No pending login challenge for this wallet — request one first');
    err.status = 401;
    throw err;
  }
  // Nonces are single-use: the challenge is consumed by ANY verify attempt.
  challenges.delete(wallet);
  if (challenge.expiresAtMs <= Date.now()) {
    const err = new Error('Login challenge expired — request a new one');
    err.status = 401;
    throw err;
  }
  const ok = verifyWalletSignature({ wallet, message: challenge.message, signature });
  if (!ok) {
    const err = new Error('Signature verification failed');
    err.status = 401;
    throw err;
  }
  const { token, expiresAt } = signToken(wallet);
  return { token, wallet, expiresAt };
}

// ---------------------------------------------------------------------------
// Express surface
// ---------------------------------------------------------------------------

export function requireAuth(req, res, next) {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  const verified = token ? verifyToken(token) : null;
  if (!verified) {
    return res.status(401).json({ error: 'Unauthorized — a valid Bearer session token is required' });
  }
  req.wallet = verified.wallet;
  req.auth = { wallet: verified.wallet };
  return next();
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/challenge', (req, res) => {
    try {
      const wallet = req.body?.wallet || req.body?.walletAddress;
      if (!wallet) return res.status(400).json({ error: 'wallet is required' });
      const challenge = createChallenge(wallet);
      return res.json(challenge);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/auth/verify', (req, res) => {
    try {
      const wallet = req.body?.wallet || req.body?.walletAddress;
      const signature = req.body?.signature;
      if (!wallet || !signature) {
        return res.status(400).json({ error: 'wallet and signature are required' });
      }
      const session = completeLogin(wallet, signature);
      return res.json(session);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ wallet: req.wallet });
  });
}
