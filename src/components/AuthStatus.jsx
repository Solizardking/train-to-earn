import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { FiKey, FiLogOut } from 'react-icons/fi';
import { clearAuth, fetchMe, getStoredWallet, getToken, isLoggedIn, loginWithWallet } from '../utils/auth';

// Header login indicator: wallet-signature login on top of the wallet
// adapter connection. Connecting a wallet is identity; logging in adds
// a server session (Bearer token) used by uploads and account reads.
// Signing happens in the user's wallet — no password, no key handling.

export default function AuthStatus() {
  const { publicKey, connected, signMessage } = useWallet();
  const walletAddress = publicKey ? publicKey.toString() : null;
  const [loggedIn, setLoggedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const refresh = useCallback(async () => {
    if (!connected || !walletAddress || !isLoggedIn(walletAddress)) {
      if (getToken() && getStoredWallet() && walletAddress && getStoredWallet() !== walletAddress) {
        clearAuth();
      }
      setLoggedIn(false);
      return;
    }
    const me = await fetchMe().catch(() => null);
    setLoggedIn(Boolean(me) || isLoggedIn(walletAddress));
  }, [connected, walletAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!connected || !walletAddress) return null;

  const login = async () => {
    setBusy(true);
    setNote(null);
    try {
      await loginWithWallet({ walletAddress, signMessage });
      setLoggedIn(true);
    } catch (err) {
      setNote(err.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearAuth();
    setLoggedIn(false);
    setNote(null);
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {loggedIn ? (
        <>
          <span
            title="Logged in with a wallet signature — session token active"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 700, color: '#14F195',
              border: '1px solid rgba(20,241,149,0.4)', borderRadius: '999px', padding: '5px 10px',
              background: 'rgba(20,241,149,0.08)',
            }}
          >
            <FiKey size={12} /> Logged in
          </span>
          <button type="button" className="btn btn-secondary" onClick={logout} style={{ padding: '7px 12px', fontSize: '12px' }}>
            <FiLogOut size={12} style={{ marginRight: '5px' }} /> Log out
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={login}
          disabled={busy}
          title="Sign a one-time challenge with your wallet to start a server session (uploads, account reads). No password; your key never leaves your wallet."
          style={{ padding: '8px 14px', fontSize: '12px' }}
        >
          <FiKey size={12} style={{ marginRight: '6px' }} />
          {busy ? 'Check your wallet…' : 'Log in'}
        </button>
      )}
      {note && (
        <span style={{ fontSize: '12px', color: '#FF6B6B', maxWidth: '260px' }}>{note}</span>
      )}
    </span>
  );
}
