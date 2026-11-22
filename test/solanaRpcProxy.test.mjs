import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { after, before, test } from 'node:test';

let appServer;
let baseUrl;
let rpcServer;
let rpcUrl;
const rpcRequests = [];

function closeServer(server) {
  if (!server?.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }
  return JSON.parse(raw || '{}');
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.HELIUS_API_KEY = '';
  process.env.HELIUS_RPC_URL = '';
  process.env.PINATA_JWT = '';
  process.env.PINATA_API_KEY = '';
  process.env.PINATA_API_SECRET = '';

  rpcServer = http.createServer(async (req, res) => {
    const body = await readJson(req);
    rpcRequests.push({
      method: req.method,
      url: req.url,
      contentType: req.headers['content-type'],
      body,
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        'solana-core': 'test-validator',
        'feature-set': 123456,
      },
    }));
  });
  rpcServer.listen(0, '127.0.0.1');
  await once(rpcServer, 'listening');
  rpcUrl = `http://127.0.0.1:${rpcServer.address().port}/?api-key=private-test-key`;

  process.env.CLAWD_ZK_RPC_URL = rpcUrl;
  process.env.CLAWD_ZK_PHOTON_URL = `${rpcUrl}&photon=true`;

  const { app } = await import('../server/index.js');
  appServer = app.listen(0, '127.0.0.1');
  await once(appServer, 'listening');
  baseUrl = `http://127.0.0.1:${appServer.address().port}`;
});

after(async () => {
  await closeServer(appServer);
  await closeServer(rpcServer);
});

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

function serialized(value) {
  return JSON.stringify(value);
}

test('POST /api/solana/rpc forwards JSON-RPC to the configured private upstream', async () => {
  const payload = {
    jsonrpc: '2.0',
    id: 'rpc-smoke',
    method: 'getVersion',
  };

  const { response, body } = await request('/api/solana/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    jsonrpc: '2.0',
    id: 'rpc-smoke',
    result: {
      'solana-core': 'test-validator',
      'feature-set': 123456,
    },
  });
  assert.equal(rpcRequests.length, 1);
  assert.equal(rpcRequests[0].method, 'POST');
  assert.match(rpcRequests[0].contentType, /application\/json/);
  assert.deepEqual(rpcRequests[0].body, payload);
});

test('public health and agent config keep private RPC credentials hidden', async () => {
  const health = await request('/api/health');
  const config = await request('/api/agents/config');

  assert.equal(health.response.status, 200);
  assert.equal(config.response.status, 200);
  assert.equal(health.body.clawdAgent.rpcUrl, '/api/solana/rpc');
  assert.equal(config.body.access.rpcUrl, '/api/solana/rpc');
  assert.equal(serialized(health.body).includes(rpcUrl), false);
  assert.equal(serialized(config.body).includes(rpcUrl), false);
  assert.equal(serialized(health.body).includes('private-test-key'), false);
  assert.equal(serialized(config.body).includes('private-test-key'), false);
});
