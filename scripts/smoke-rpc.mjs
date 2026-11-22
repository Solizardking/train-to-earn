import process from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);
const direct = args.includes('--direct') || process.env.SMOKE_RPC_DIRECT === 'true';
const targetArg = args.find((arg) => arg.startsWith('--target='));
const methodArg = args.find((arg) => arg.startsWith('--method='));

function trimSlash(value) {
  return String(value || '').replace(/\/$/, '');
}

function directRpcUrl() {
  if (process.env.CLAWD_ZK_RPC_URL) return process.env.CLAWD_ZK_RPC_URL;
  if (process.env.HELIUS_RPC_URL) return process.env.HELIUS_RPC_URL;
  if (process.env.HELIUS_API_KEY) return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  return '';
}

function proxyRpcUrl() {
  const baseUrl = trimSlash(
    process.env.SMOKE_API_URL ||
    process.env.PUBLIC_API_URL ||
    process.env.VITE_API_URL ||
    'http://localhost:5001',
  );
  return `${baseUrl}/api/solana/rpc`;
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    for (const key of url.searchParams.keys()) {
      url.searchParams.set(key, 'REDACTED');
    }
    return url.toString();
  } catch {
    return String(value).replace(/(api-key=)[^&\s]+/gi, '$1REDACTED');
  }
}

function parseTimeoutMs() {
  const timeoutMs = Number(process.env.SMOKE_RPC_TIMEOUT_MS || 15000);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000;
}

async function postJson(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), parseTimeoutMs());

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  } finally {
    clearTimeout(timeout);
  }
}

const target = targetArg ? targetArg.slice('--target='.length) : (direct ? directRpcUrl() : proxyRpcUrl());
const method = methodArg ? methodArg.slice('--method='.length) : (process.env.SMOKE_RPC_METHOD || 'getVersion');

if (!target) {
  console.error('RPC smoke failed: no RPC target configured. Start the backend proxy or set CLAWD_ZK_RPC_URL/HELIUS_RPC_URL.');
  process.exit(1);
}

const payload = {
  jsonrpc: '2.0',
  id: 'train2earn-rpc-smoke',
  method,
};

try {
  const { response, body } = await postJson(target, payload);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!body || body.error) {
    throw new Error(body?.error?.message || body?.error || 'JSON-RPC response contained an error');
  }

  if (method === 'getVersion' && !body.result?.['solana-core']) {
    throw new Error('getVersion response did not include solana-core');
  }

  console.log(`RPC smoke passed: ${method} via ${redactUrl(target)}`);
  if (body.result?.['solana-core']) {
    console.log(`Solana core: ${body.result['solana-core']}`);
  }
} catch (error) {
  const mode = direct ? 'direct upstream RPC' : 'local backend proxy';
  console.error(`RPC smoke failed against ${mode}: ${error.message}`);
  if (!direct) {
    console.error('Start `npm run server`/`npm run dev`, set SMOKE_API_URL, or run `npm run smoke:rpc -- --direct`.');
  }
  process.exit(1);
}
