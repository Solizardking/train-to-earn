// Authenticated uploads for TrainToEarn (earn.onchainai.fund).
//
// POST /api/uploads (SIWS session required) accepts either:
//   - a multipart file (field "file", same multer pattern as
//     /api/upload/analyze), or
//   - a JSON body with `sourceUrl` for by-reference data (bulk data never
//     transits this backend — docs/jev2-engine.md §2.4).
//
// Every upload is hashed (SHA-256) when bytes are present. When PINATA_JWT
// is configured the file is pinned to IPFS via Pinata and the CID is
// recorded; otherwise the record honestly says storage "local-hash" (file
// hashed, not pinned) or "reference-only" (no bytes ever arrived).
// Data uploads (dataset / media / robot) kick off a Jev-2 rating job and
// return its jobId; model uploads are catalogued for registry linking.
//
// Persistence: the user_uploads table when the database is connected,
// otherwise a per-process in-memory store (records do not survive a
// restart in that mode — same posture as the rest of the no-DB fallback).

import crypto from 'node:crypto';
import { requireAuth } from './auth.js';
import { createRatingJob } from './jev2.js';

const UPLOAD_KINDS = ['dataset', 'model', 'media', 'robot'];
const DATA_KINDS = ['dataset', 'media', 'robot'];

const memoryUploads = []; // used only when the database is disconnected

let tableEnsured = false;
async function ensureUploadsTable(pool) {
  if (tableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_uploads (
      id TEXT PRIMARY KEY,
      wallet_address VARCHAR(64) NOT NULL,
      kind VARCHAR(20) NOT NULL,
      name TEXT,
      description TEXT,
      sha256 VARCHAR(64),
      cid TEXT,
      storage VARCHAR(24) NOT NULL DEFAULT 'reference-only',
      source_url TEXT,
      size_bytes INTEGER DEFAULT 0,
      job_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_uploads_wallet ON user_uploads (wallet_address);
  `);
  tableEnsured = true;
}

async function pinToPinata({ buffer, filename }) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename || 'upload.bin');
  const resp = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!resp.ok) throw new Error(`Pinata pin failed with HTTP ${resp.status}`);
  const body = await resp.json();
  return body.IpfsHash || null;
}

async function saveUpload(pool, isDbConnected, record) {
  if (pool && isDbConnected && isDbConnected()) {
    try {
      await ensureUploadsTable(pool);
      await pool.query(
        `INSERT INTO user_uploads
           (id, wallet_address, kind, name, description, sha256, cid, storage, source_url, size_bytes, job_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          record.id, record.wallet, record.kind, record.name, record.description,
          record.sha256, record.cid, record.storage, record.sourceUrl,
          record.sizeBytes, record.jobId,
        ],
      );
      record.persisted = true;
      return record;
    } catch (error) {
      console.error('Upload persist failed, keeping in memory:', error.message);
    }
  }
  memoryUploads.unshift(record);
  record.persisted = false;
  return record;
}

async function listUploads(pool, isDbConnected, wallet) {
  if (pool && isDbConnected && isDbConnected()) {
    try {
      await ensureUploadsTable(pool);
      const { rows } = await pool.query(
        `SELECT id, wallet_address, kind, name, description, sha256, cid, storage,
                source_url, size_bytes, job_id, created_at
         FROM user_uploads WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT 100`,
        [wallet],
      );
      return rows.map((r) => ({
        id: r.id,
        wallet: r.wallet_address,
        kind: r.kind,
        name: r.name,
        description: r.description,
        sha256: r.sha256,
        cid: r.cid,
        storage: r.storage,
        sourceUrl: r.source_url,
        sizeBytes: Number(r.size_bytes || 0),
        jobId: r.job_id,
        createdAt: r.created_at,
      }));
    } catch (error) {
      console.error('Upload list failed, reading memory store:', error.message);
    }
  }
  return memoryUploads.filter((u) => u.wallet === wallet);
}

// Build the Jev-2 job for a data upload. Datasets/robots go through the
// manifest path; media goes through the media path (a bare file upload is
// rated on its declared pairs/metadata — with no pairs it is an image
// reference rated on metadata, which validation will reject honestly if
// it carries no caption).
function kickOffRatingJob({ kind, body, wallet, record }, deps) {
  if (kind === 'dataset' || kind === 'robot') {
    const manifest = body.manifest || {
      manifestVersion: 1,
      kind,
      walletAddress: wallet,
      title: record.name,
      host: { type: record.cid ? 'ipfs' : 'reference', ref: record.sourceUrl || (record.cid ? `ipfs://${record.cid}` : record.sha256) },
      format: body.format || 'jsonl',
      declaredRows: typeof body.declaredRows === 'number' ? body.declaredRows : 0,
      declaredEpisodes: body.declaredEpisodes,
      declaredSteps: body.declaredSteps,
      declaredBytes: record.sizeBytes,
      contentHash: record.sha256 ? `sha256:${record.sha256}` : body.contentHash,
      license: body.license || '',
      taskDescription: body.taskDescription || '',
      captionSample: Array.isArray(body.captionSample) ? body.captionSample : [],
      episodeSample: Array.isArray(body.episodeSample) ? body.episodeSample : undefined,
    };
    const job = createRatingJob({ type: 'dataset', payload: { kind, manifest, walletAddress: wallet } }, deps);
    return job.id;
  }
  if (kind === 'media') {
    const mediaKind = body.mediaKind === 'video' ? 'video' : 'image';
    const payload = {
      walletAddress: wallet,
      kind: mediaKind,
      pairs: Array.isArray(body.pairs) ? body.pairs : undefined,
      items: Array.isArray(body.items) ? body.items : undefined,
      url: body.url || record.sourceUrl || undefined,
      metadata: body.metadata || {},
    };
    const job = createRatingJob({ type: 'media', payload }, deps);
    return job.id;
  }
  return null;
}

export function registerUploadRoutes(app, { pool = null, isDbConnected = null, upload = null } = {}) {
  const deps = { pool, isDbConnected };
  const middlewares = [requireAuth];
  if (upload) middlewares.push(upload.single('file'));

  app.post('/api/uploads', ...middlewares, async (req, res) => {
    try {
      const wallet = req.wallet;
      const body = req.body || {};
      const kind = String(body.kind || '').toLowerCase();
      if (!UPLOAD_KINDS.includes(kind)) {
        return res.status(400).json({ error: `kind must be one of: ${UPLOAD_KINDS.join(', ')}` });
      }
      const file = req.file || null;
      const sourceUrl = body.sourceUrl || body.url || null;
      if (!file && !sourceUrl && !body.manifest) {
        return res.status(400).json({ error: 'Provide a file, a sourceUrl (by reference), or a manifest' });
      }

      let sha256 = null;
      if (file?.buffer) sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

      let cid = null;
      let pinError = null;
      if (file?.buffer && process.env.PINATA_JWT) {
        try {
          cid = await pinToPinata({ buffer: file.buffer, filename: file.originalname });
        } catch (error) {
          pinError = error.message; // recorded, never fatal — the hash still stands
        }
      }

      const record = {
        id: crypto.randomUUID(),
        wallet,
        kind,
        name: body.name || file?.originalname || 'untitled upload',
        description: body.description || '',
        sha256,
        cid,
        storage: cid ? 'ipfs' : file ? 'local-hash' : 'reference-only',
        sourceUrl,
        sizeBytes: file ? file.size : 0,
        jobId: null,
        createdAt: new Date().toISOString(),
        ...(pinError ? { pinError } : {}),
      };

      if (DATA_KINDS.includes(kind)) {
        try {
          record.jobId = kickOffRatingJob({ kind, body, wallet, record }, deps);
        } catch (error) {
          console.error('Jev-2 job kickoff failed for upload:', error.message);
          record.jobError = error.message;
        }
      }

      await saveUpload(pool, isDbConnected, record);
      return res.status(201).json({ upload: record });
    } catch (error) {
      return res.status(500).json({ error: 'Upload failed', details: error.message });
    }
  });

  app.get('/api/uploads/mine', requireAuth, async (req, res) => {
    try {
      const uploads = await listUploads(pool, isDbConnected, req.wallet);
      return res.json({ uploads, total: uploads.length });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to list uploads', details: error.message });
    }
  });
}
