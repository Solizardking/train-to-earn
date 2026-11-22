import { API_BASE_URL } from './api';

// TrainToEarn site login (earn.onchainai.fund).
//
// Login is a wallet signature, not a password:
//   1. POST /api/auth/challenge { wallet }            -> { message }
//   2. The connected wallet signs `message` locally (signMessage).
//      The private key never leaves the user's wallet / machine.
//   3. POST /api/auth/verify { wallet, signature }    -> { token }
//   4. The token is stored in localStorage and sent as
//      `Authorization: Bearer <token>` on authenticated calls
//      (uploads, "my uploads", and any future account reads).
//
// GET /api/auth/me (Bearer) returns the session's wallet profile.

const TOKEN_KEY = 'train2earn.auth.token';
const WALLET_KEY = 'train2earn.auth.wallet';

export function getToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getStoredWallet() {
  try {
    return window.localStorage.getItem(WALLET_KEY) || null;
  } catch {
    return null;
  }
}

export function isLoggedIn(walletAddress) {
  const token = getToken();
  if (!token) return false;
  if (walletAddress && getStoredWallet() && getStoredWallet() !== walletAddress) return false;
  return true;
}

export function clearAuth() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(WALLET_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}

function storeAuth(token, walletAddress) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    if (walletAddress) window.localStorage.setItem(WALLET_KEY, walletAddress);
  } catch {
    // storage unavailable — the session simply will not persist
  }
}

// Uint8Array -> base64 without any extra dependency.
export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return window.btoa(binary);
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }
  return data;
}

/**
 * Full login flow against the connected wallet adapter.
 *
 * @param {object} args
 * @param {string} args.walletAddress - connected wallet public key (base58)
 * @param {(message: Uint8Array) => Promise<Uint8Array>} args.signMessage -
 *   the wallet adapter's signMessage (from useWallet()).
 * @returns {Promise<{ token: string, wallet: string }>}
 */
export async function loginWithWallet({ walletAddress, signMessage }) {
  if (!walletAddress) throw new Error('Connect a wallet first — your wallet is your account.');
  if (typeof signMessage !== 'function') {
    throw new Error('This wallet does not support message signing. Try Phantom or Solflare.');
  }

  const challenge = await readJson(await fetch(`${API_BASE_URL}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: walletAddress, walletAddress }),
  }));
  const message = challenge.message || challenge.challenge;
  if (!message) throw new Error('The server did not return a login challenge.');

  const encoded = new TextEncoder().encode(message);
  const signatureBytes = await signMessage(encoded);
  const signature = bytesToBase64(signatureBytes);

  const verified = await readJson(await fetch(`${API_BASE_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet: walletAddress, walletAddress, signature, message }),
  }));
  const token = verified.token || verified.accessToken;
  if (!token) throw new Error('Login verification did not return a session token.');

  storeAuth(token, walletAddress);
  return { token, wallet: walletAddress };
}

export async function fetchMe(token = getToken()) {
  if (!token) return null;
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    clearAuth();
    return null;
  }
  return readJson(response);
}

export function logout() {
  clearAuth();
}

// Authenticated JSON helpers (Bearer token attached when present).

export async function apiAuthGet(endpoint, token = getToken()) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (response.status === 401) clearAuth();
  return readJson(response);
}

export async function apiAuthPost(endpoint, body, token = getToken()) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401) clearAuth();
  return readJson(response);
}

// Multipart upload: POST /api/uploads (Bearer). Pass either a File
// (sent as multipart form data) or a plain object describing a
// by-reference upload ({ kind, name, description, sourceUrl }).
export async function apiUpload(payload, token = getToken()) {
  let body;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (typeof File !== 'undefined' && payload instanceof File) {
    body = new FormData();
    body.append('file', payload);
  } else if (payload && payload.file instanceof File) {
    body = new FormData();
    body.append('file', payload.file);
    Object.entries(payload).forEach(([key, value]) => {
      if (key !== 'file' && value !== undefined && value !== null && value !== '') {
        body.append(key, String(value));
      }
    });
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(payload || {});
  }
  const response = await fetch(`${API_BASE_URL}/api/uploads`, { method: 'POST', headers, body });
  if (response.status === 401) clearAuth();
  return readJson(response);
}

export default {
  getToken,
  getStoredWallet,
  isLoggedIn,
  clearAuth,
  loginWithWallet,
  fetchMe,
  logout,
  apiAuthGet,
  apiAuthPost,
  apiUpload,
  bytesToBase64,
};
