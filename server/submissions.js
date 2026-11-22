// Public submissions pipeline — the realtime tracking + showcase layer over
// the Jev ratings ledger (training_ratings).
//
// Every rated submission (Jev panel paste, Jev panel file upload, and text
// files sent through the CLAWD Agent upload pipeline) lands in
// training_ratings. These queries power the public live feed and the
// top-rated showcase. Privacy by construction: wallet addresses are
// truncated, and no submitted content is ever returned — only the filename,
// size, score, tier, reward, and the Jev verdict booleans.

function shortWallet(address) {
  if (!address) return 'unknown';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function shapeSubmission(row) {
  const verdicts = row.verdicts || {};
  return {
    id: row.id,
    wallet: shortWallet(row.wallet_address),
    filename: row.filename || 'pasted submission',
    dataType: row.data_type,
    dataSize: Number(row.data_size || 0),
    score: Number(row.score),
    tier: row.tier,
    clawdReward: Number(row.clawd_reward || 0),
    source: row.source,
    verdicts: {
      solanaSpecific: verdicts.solana_specific?.value ?? null,
      teachesSomething: verdicts.teaches_something?.value ?? null,
      original: verdicts.original?.value ?? null,
      wellFormed: verdicts.well_formed?.value ?? null,
      safeToTrain: verdicts.safe_to_train?.value ?? null,
    },
    ratedAt: row.created_at,
  };
}

export async function listRecentSubmissions(pool, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const res = await pool.query(
    `SELECT id, wallet_address, filename, data_type, data_size, score, tier,
            clawd_reward, source, verdicts, created_at
     FROM training_ratings
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit],
  );
  return res.rows.map(shapeSubmission);
}

export async function listTopSubmissions(pool, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const res = await pool.query(
    `SELECT id, wallet_address, filename, data_type, data_size, score, tier,
            clawd_reward, source, verdicts, created_at
     FROM training_ratings
     WHERE unsafe = FALSE
     ORDER BY score DESC, created_at DESC
     LIMIT $1`,
    [safeLimit],
  );
  return res.rows.map(shapeSubmission);
}

export async function getSubmissionStats(pool) {
  const res = await pool.query(`
    SELECT
      COUNT(*) AS total_submissions,
      COUNT(DISTINCT wallet_address) AS contributors,
      COALESCE(SUM(clawd_reward), 0) AS total_clawd_earned,
      COALESCE(AVG(score), 0) AS average_score,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
      MAX(score) AS best_score
    FROM training_ratings
  `);
  const row = res.rows[0] || {};
  return {
    totalSubmissions: Number(row.total_submissions || 0),
    contributors: Number(row.contributors || 0),
    totalClawdEarned: Number(row.total_clawd_earned || 0),
    averageScore: Math.round(Number(row.average_score || 0) * 10) / 10,
    submissionsLast24h: Number(row.last_24h || 0),
    bestScore: row.best_score === null ? null : Number(row.best_score),
  };
}
