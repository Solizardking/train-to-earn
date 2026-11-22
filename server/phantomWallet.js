/**
 * Phantom Server SDK integration — DORMANT / credential-gated.
 *
 * This module stays inert until BOTH of these are true:
 *   1. The `@phantom/server-sdk` package is installed, and
 *   2. PHANTOM_ORG_ID, PHANTOM_PRIVATE_KEY, and PHANTOM_APP_ID are set in the
 *      environment (Render secret env vars — NEVER commit these).
 *
 * Until then every endpoint returns HTTP 503 with a clear reason, so the
 * server boots and runs normally with no Phantom credentials present.
 *
 * SECURITY: PHANTOM_PRIVATE_KEY is a custodial organization key. It must only
 * ever live in server-side secret storage. Do not log it, return it, or expose
 * it to any client. Access to Phantom is gated behind partnerships@phantom.com.
 */

const REQUIRED_ENV = ['PHANTOM_ORG_ID', 'PHANTOM_PRIVATE_KEY', 'PHANTOM_APP_ID'];

let sdkInstance = null;
let sdkModule = null;
let initError = null;

export function phantomConfigured() {
  return REQUIRED_ENV.every((key) => Boolean(process.env[key]));
}

function missingEnv() {
  return REQUIRED_ENV.filter((key) => !process.env[key]);
}

/**
 * Lazily import + instantiate the SDK. Returns the singleton or throws a
 * descriptive error. Never throws at module load time.
 */
async function getSdk() {
  if (sdkInstance) return sdkInstance;
  if (initError) throw initError;

  if (!phantomConfigured()) {
    throw new Error(`Phantom not configured — missing env: ${missingEnv().join(', ')}`);
  }

  try {
    if (!sdkModule) {
      // Dynamic import so a missing package never crashes the server at boot.
      sdkModule = await import('@phantom/server-sdk');
    }
    const { ServerSDK } = sdkModule;
    sdkInstance = new ServerSDK({
      organizationId: process.env.PHANTOM_ORG_ID,
      apiPrivateKey: process.env.PHANTOM_PRIVATE_KEY,
      appId: process.env.PHANTOM_APP_ID,
    });
    return sdkInstance;
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find (module|package)/i.test(error?.message || '')) {
      initError = new Error(
        'Phantom SDK package not installed. Run `npm install @phantom/server-sdk` (requires partner access from partnerships@phantom.com).',
      );
    } else {
      initError = error;
    }
    throw initError;
  }
}

/** Resolve the SOLANA_MAINNET network id across SDK versions. */
async function solanaNetworkId() {
  const mod = sdkModule || (await import('@phantom/server-sdk'));
  return mod.NetworkId?.SOLANA_MAINNET ?? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
}

/**
 * Mount Phantom wallet routes onto an Express app.
 * All routes are safe to expose: when unconfigured they return 503, not 500.
 */
export function registerPhantomRoutes(app) {
  // Status — always safe, never touches the key.
  app.get('/api/phantom/status', (_req, res) => {
    res.json({
      configured: phantomConfigured(),
      missing: phantomConfigured() ? [] : missingEnv(),
      note: 'Phantom Server SDK is experimental. Set PHANTOM_* secrets in Render to enable.',
    });
  });

  const guard = (handler) => async (req, res) => {
    if (!phantomConfigured()) {
      return res.status(503).json({
        error: 'Phantom wallet service not configured',
        missing: missingEnv(),
      });
    }
    try {
      await handler(req, res);
    } catch (error) {
      const status = /not installed|not configured/i.test(error.message) ? 503 : 500;
      res.status(status).json({ error: 'Phantom operation failed', details: error.message });
    }
  };

  // Create a managed wallet for a user.
  app.post('/api/phantom/wallets', guard(async (req, res) => {
    const sdk = await getSdk();
    const name = typeof req.body?.name === 'string' ? req.body.name.slice(0, 120) : undefined;
    const wallet = await sdk.createWallet(name);
    const solana = wallet.addresses?.find((a) => a.addressType === 'Solana')?.address || null;
    res.status(201).json({ walletId: wallet.walletId, addresses: wallet.addresses, solanaAddress: solana });
  }));

  // List managed wallets (paginated). Never returns private keys.
  app.get('/api/phantom/wallets', guard(async (req, res) => {
    const sdk = await getSdk();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await sdk.getWallets(limit, offset);
    res.json({ totalCount: result.totalCount, limit, offset, wallets: result.wallets });
  }));

  // Fetch addresses for a wallet.
  app.get('/api/phantom/wallets/:walletId/addresses', guard(async (req, res) => {
    const sdk = await getSdk();
    const addresses = await sdk.getWalletAddresses(req.params.walletId);
    res.json({ walletId: req.params.walletId, addresses });
  }));

  // Sign an arbitrary message (auth / attestation). Returns signature only.
  app.post('/api/phantom/sign-message', guard(async (req, res) => {
    const { walletId, message } = req.body || {};
    if (!walletId || typeof message !== 'string') {
      return res.status(400).json({ error: 'walletId and message are required' });
    }
    const sdk = await getSdk();
    const signature = await sdk.signMessage({
      walletId,
      message,
      networkId: await solanaNetworkId(),
    });
    res.json({ walletId, signature });
  }));
}
