// Real $CLAWD rewards ledger.
//
// Earnings are real: every Jev training-data rating persists a clawd_reward
// in Neon (training_ratings). This module turns those earnings into a
// claimable balance backed by the project treasury wallet:
//
//   earned    = SUM(training_ratings.clawd_reward) for the wallet
//   paid      = SUM(reward_payouts.amount_clawd) where status = 'paid'
//   pending   = SUM(reward_payouts.amount_clawd) where status = 'pending'
//   claimable = earned - paid - pending
//
// A claim records a pending payout request for the full claimable amount.
// Payouts are executed by the treasury owner from the treasury wallet
// (the server never holds keys and never signs). Once a payout lands
// on-chain it is marked paid with its transaction signature via the
// admin-key-gated endpoint, which makes the ledger reconcile against chain.

export const CLAWD_MINT =
  process.env.VITE_CLAWD_MINT || '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';

// The project's designated treasury (set by the owner 2026-11-10).
export const TREASURY_ADDRESS =
  process.env.CLAWD_TREASURY_ADDRESS ||
  process.env.VITE_TREASURY_ADDRESS ||
  '6rEiHJ4JUTWcC4wCUosTbaoBmpjHvUGLAQcogUwADB4Z';

export const MIN_CLAIM_CLAWD = 100;

export async function ensureRewardPayoutsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reward_payouts (
      id SERIAL PRIMARY KEY,
      wallet_address VARCHAR(64) NOT NULL,
      amount_clawd NUMERIC NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      tx_signature TEXT,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMPTZ
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reward_payouts_wallet
    ON reward_payouts (wallet_address, status);
  `);
}

export async function getRewardBalance(pool, walletAddress) {
  const earnedRes = await pool.query(
    `SELECT COALESCE(SUM(clawd_reward), 0) AS earned, COUNT(*) AS ratings
     FROM training_ratings WHERE wallet_address = $1`,
    [walletAddress],
  );
  const payoutsRes = await pool.query(
    `SELECT status, COALESCE(SUM(amount_clawd), 0) AS total
     FROM reward_payouts WHERE wallet_address = $1 GROUP BY status`,
    [walletAddress],
  );
  let paid = 0;
  let pending = 0;
  for (const row of payoutsRes.rows) {
    if (row.status === 'paid') paid = Number(row.total);
    if (row.status === 'pending') pending = Number(row.total);
  }
  const earned = Number(earnedRes.rows[0]?.earned || 0);
  return {
    walletAddress,
    earned,
    paid,
    pending,
    claimable: Math.max(0, earned - paid - pending),
    ratingsCount: Number(earnedRes.rows[0]?.ratings || 0),
    minClaim: MIN_CLAIM_CLAWD,
    treasury: TREASURY_ADDRESS,
    mint: CLAWD_MINT,
  };
}

export async function listPayouts(pool, walletAddress, limit = 10) {
  const res = await pool.query(
    `SELECT id, amount_clawd, status, tx_signature, requested_at, paid_at
     FROM reward_payouts WHERE wallet_address = $1
     ORDER BY requested_at DESC LIMIT $2`,
    [walletAddress, limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    amountClawd: Number(r.amount_clawd),
    status: r.status,
    txSignature: r.tx_signature,
    requestedAt: r.requested_at,
    paidAt: r.paid_at,
  }));
}

// Idempotent: an existing pending payout is returned instead of stacking a
// second one. The payout always goes to the earning wallet itself, so an
// unauthenticated claim can never redirect funds.
export async function requestClaim(pool, walletAddress) {
  const existing = await pool.query(
    `SELECT id, amount_clawd, status, requested_at FROM reward_payouts
     WHERE wallet_address = $1 AND status = 'pending'
     ORDER BY requested_at DESC LIMIT 1`,
    [walletAddress],
  );
  if (existing.rows.length > 0) {
    const r = existing.rows[0];
    return {
      alreadyPending: true,
      payout: {
        id: r.id,
        amountClawd: Number(r.amount_clawd),
        status: r.status,
        requestedAt: r.requested_at,
      },
    };
  }
  const balance = await getRewardBalance(pool, walletAddress);
  if (balance.claimable < MIN_CLAIM_CLAWD) {
    const err = new Error(
      `Claimable balance is ${balance.claimable} CLAWD — the minimum claim is ${MIN_CLAIM_CLAWD} CLAWD. Earn more by submitting training data.`,
    );
    err.status = 400;
    throw err;
  }
  const inserted = await pool.query(
    `INSERT INTO reward_payouts (wallet_address, amount_clawd, status)
     VALUES ($1, $2, 'pending') RETURNING id, amount_clawd, status, requested_at`,
    [walletAddress, balance.claimable],
  );
  const r = inserted.rows[0];
  return {
    alreadyPending: false,
    payout: {
      id: r.id,
      amountClawd: Number(r.amount_clawd),
      status: r.status,
      requestedAt: r.requested_at,
    },
  };
}

export async function markPayoutPaid(pool, payoutId, txSignature) {
  const res = await pool.query(
    `UPDATE reward_payouts
     SET status = 'paid', tx_signature = $2, paid_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, wallet_address, amount_clawd, status, tx_signature, paid_at`,
    [payoutId, txSignature],
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    walletAddress: r.wallet_address,
    amountClawd: Number(r.amount_clawd),
    status: r.status,
    txSignature: r.tx_signature,
    paidAt: r.paid_at,
  };
}

// Live on-chain treasury state (public read via the configured Helius RPC).
// Cached briefly so the panel can poll without hammering the RPC.
let treasuryCache = { at: 0, data: null };

async function rpcCall(rpcUrl, method, params) {
  const resp = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await resp.json();
  if (json.error) throw new Error(json.error.message || 'RPC error');
  return json.result;
}

export async function getTreasuryState() {
  const now = Date.now();
  if (treasuryCache.data && now - treasuryCache.at < 60_000) {
    return treasuryCache.data;
  }
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) {
    return {
      treasury: TREASURY_ADDRESS,
      mint: CLAWD_MINT,
      clawdBalance: null,
      solBalance: null,
      error: 'HELIUS_RPC_URL not configured',
    };
  }
  const [tokenAccounts, sol] = await Promise.all([
    rpcCall(rpcUrl, 'getTokenAccountsByOwner', [
      TREASURY_ADDRESS,
      { mint: CLAWD_MINT },
      { encoding: 'jsonParsed' },
    ]),
    rpcCall(rpcUrl, 'getBalance', [TREASURY_ADDRESS]),
  ]);
  let clawd = 0;
  for (const acct of tokenAccounts?.value || []) {
    const amount = acct.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
    if (typeof amount === 'number') clawd += amount;
  }
  const data = {
    treasury: TREASURY_ADDRESS,
    mint: CLAWD_MINT,
    clawdBalance: clawd,
    solBalance: typeof sol?.value === 'number' ? sol.value / 1e9 : null,
    checkedAt: new Date().toISOString(),
  };
  treasuryCache = { at: now, data };
  return data;
}
