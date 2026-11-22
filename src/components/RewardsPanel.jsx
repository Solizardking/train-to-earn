import { useCallback, useEffect, useState } from 'react';
import { FaTrophy } from 'react-icons/fa';
import { FiExternalLink } from 'react-icons/fi';
import { apiGet, apiPost } from '../utils/api';

// Real $CLAWD rewards panel. Every number here comes from the Neon ledger:
// earnings are the clawd_reward totals of the wallet's persisted Jev
// training-data ratings; payouts are settled from the project treasury
// wallet and recorded with their transaction signatures. No simulated or
// "calculated" rewards are shown.

function shortAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function RewardsPanel({ walletAddress }) {
  const [balance, setBalance] = useState(null);
  const [treasury, setTreasury] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claimBusy, setClaimBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [bal, tre] = await Promise.all([
        apiGet(`/api/rewards/balance/${walletAddress}`),
        apiGet('/api/rewards/treasury').catch(() => null),
      ]);
      setBalance(bal);
      setTreasury(tre);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const claim = async () => {
    setClaimBusy(true);
    setMessage(null);
    setError(null);
    try {
      const data = await apiPost('/api/rewards/claim', { walletAddress });
      setBalance({ ...data.balance, payouts: balance?.payouts || [] });
      setMessage(
        data.alreadyPending
          ? `A payout of ${data.payout.amountClawd} CLAWD is already pending for your wallet.`
          : `Payout requested: ${data.payout.amountClawd} CLAWD. The treasury settles pending payouts to your wallet — watch this panel for the transaction link.`,
      );
      await fetchAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaimBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="card mb-4" style={styles.panel}>
        <div className="flex-center" style={{ gap: '12px', padding: '20px' }}>
          <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
          <span className="text-secondary">Loading your real rewards…</span>
        </div>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="card mb-4" style={styles.panel}>
        <p className="text-secondary" style={{ margin: 0 }}>
          Rewards ledger unavailable right now. {error || ''}
        </p>
      </div>
    );
  }

  const hasPending = balance.pending > 0;
  const canClaim = balance.claimable >= balance.minClaim && !hasPending;

  return (
    <div className="card mb-4" style={styles.panel}>
      <div style={styles.header}>
        <div className="flex" style={{ alignItems: 'center', gap: '12px' }}>
          <FaTrophy size={24} color="#FFD700" />
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>CLAWD Rewards</h2>
        </div>
        <span className="text-secondary" style={{ fontSize: '12px' }}>
          from {balance.ratingsCount} Jev rating{balance.ratingsCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-2 mt-3" style={{ gap: '16px' }}>
        <div style={styles.statCard}>
          <div className="text-secondary" style={styles.statLabel}>Earned (Jev ratings)</div>
          <div style={styles.statValue}>{balance.earned} <span style={styles.currency}>CLAWD</span></div>
        </div>
        <div style={styles.statCard}>
          <div className="text-secondary" style={styles.statLabel}>Paid out</div>
          <div style={styles.statValue}>{balance.paid} <span style={styles.currency}>CLAWD</span></div>
        </div>
        <div style={styles.statCard}>
          <div className="text-secondary" style={styles.statLabel}>Payout pending</div>
          <div style={styles.statValue}>{balance.pending} <span style={styles.currency}>CLAWD</span></div>
        </div>
        <div style={styles.statCard}>
          <div className="text-secondary" style={styles.statLabel}>Claimable now</div>
          <div style={{ ...styles.statValue, color: '#14F195' }}>
            {balance.claimable} <span style={styles.currency}>CLAWD</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={claim}
          disabled={claimBusy || !canClaim}
        >
          {claimBusy
            ? 'Requesting…'
            : hasPending
              ? 'Payout pending'
              : `Claim ${balance.claimable} CLAWD`}
        </button>
        <span className="text-secondary" style={{ fontSize: '13px' }}>
          {hasPending
            ? 'Your payout is queued for settlement from the treasury.'
            : balance.claimable < balance.minClaim
              ? `Minimum claim is ${balance.minClaim} CLAWD — submit training data in the Jev panel above to earn.`
              : 'Payouts are sent from the project treasury to this wallet.'}
        </span>
      </div>

      {message && <p style={{ color: '#14F195', fontSize: '14px', marginTop: '12px' }}>{message}</p>}
      {error && <p style={{ color: '#FF6B6B', fontSize: '14px', marginTop: '12px' }}>Error: {error}</p>}

      {balance.payouts?.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div className="text-secondary" style={{ fontSize: '13px', marginBottom: '8px' }}>Your payouts</div>
          {balance.payouts.map((p) => (
            <div key={p.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0', fontSize: '14px' }}>
              <span style={{ fontWeight: 600 }}>{p.amountClawd} CLAWD</span>
              <span style={{ color: p.status === 'paid' ? '#14F195' : '#FFD700' }}>{p.status}</span>
              <span className="text-secondary" style={{ fontSize: '12px' }}>
                {new Date(p.requestedAt).toLocaleDateString()}
              </span>
              {p.txSignature && (
                <a
                  href={`https://solscan.io/tx/${p.txSignature}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                >
                  View tx <FiExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={styles.infoBox}>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#E0E0E0' }}>
          Rewards are paid from the project treasury{' '}
          <a
            href={`https://solscan.io/account/${balance.treasury}`}
            target="_blank"
            rel="noreferrer"
          >
            {shortAddress(balance.treasury)}
          </a>
          {treasury && typeof treasury.clawdBalance === 'number' && (
            <> — currently holding <strong>{treasury.clawdBalance.toLocaleString()} CLAWD</strong> (live on-chain)</>
          )}
          . Earnings only come from Jev-rated training-data submissions; there are no
          rewards for simply holding assets.
        </p>
      </div>
    </div>
  );
}

const styles = {
  panel: {
    background: 'linear-gradient(135deg, rgba(153, 69, 255, 0.1) 0%, rgba(20, 241, 149, 0.1) 100%)',
    border: '1px solid rgba(153, 69, 255, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  statCard: {
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px',
    border: '1px solid rgba(153, 69, 255, 0.1)',
  },
  statLabel: {
    fontSize: '13px',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currency: {
    fontSize: '14px',
    color: '#9945FF',
    fontWeight: '600',
  },
  infoBox: {
    marginTop: '20px',
    padding: '16px',
    background: 'rgba(20, 241, 149, 0.07)',
    border: '1px solid rgba(20, 241, 149, 0.25)',
    borderRadius: '12px',
  },
};
