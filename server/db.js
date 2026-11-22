import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const databaseSslMode = process.env.DATABASE_SSL || process.env.PGSSLMODE;
const shouldUseSsl = process.env.NODE_ENV === 'production' ||
  databaseSslMode === 'require' ||
  databaseSslMode === 'true';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
});

// Initialize database schema
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallet_analyses (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(44) NOT NULL,
        assets_count INTEGER DEFAULT 0,
        tokens_count INTEGER DEFAULT 0,
        rewards_total INTEGER DEFAULT 0,
        analysis TEXT,
        analyzed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_claims (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(44) NOT NULL,
        rewards_earned INTEGER DEFAULT 0,
        tier VARCHAR(20),
        claimed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS model_registrations (
        id SERIAL PRIMARY KEY,
        model_id VARCHAR(120),
        name TEXT NOT NULL,
        asset VARCHAR(44) NOT NULL UNIQUE,
        authority VARCHAR(44) NOT NULL,
        model_identity_pda VARCHAR(44) NOT NULL UNIQUE,
        model_registration_uri TEXT NOT NULL,
        model_registry TEXT NOT NULL,
        model_type VARCHAR(80) NOT NULL,
        artifact_uri TEXT NOT NULL,
        artifact_sha256 VARCHAR(120) NOT NULL,
        hugging_face_repo TEXT NOT NULL,
        hugging_face_commit VARCHAR(120) NOT NULL,
        google_attestation_uri TEXT,
        google_attestor VARCHAR(120),
        document JSONB NOT NULL,
        transaction_plan JSONB NOT NULL,
        attestations JSONB NOT NULL,
        status VARCHAR(40) DEFAULT 'prepared',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS model_catalog_entries (
        id VARCHAR(160) PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        model_type VARCHAR(80) NOT NULL,
        storage_type VARCHAR(40) DEFAULT 'unknown',
        artifact_uri TEXT,
        artifact_sha256 VARCHAR(120),
        model_cid TEXT,
        metadata_uri TEXT,
        creator VARCHAR(120),
        authority VARCHAR(44),
        price_sol NUMERIC DEFAULT 0,
        accuracy NUMERIC DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        source VARCHAR(40) DEFAULT 'api',
        document JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(40) DEFAULT 'registered',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_inference_payments (
        signature VARCHAR(120) PRIMARY KEY,
        payer VARCHAR(44),
        model_type VARCHAR(80) NOT NULL,
        model_id VARCHAR(160),
        amount_lamports BIGINT NOT NULL,
        treasury VARCHAR(44) NOT NULL,
        request JSONB NOT NULL DEFAULT '{}'::jsonb,
        response JSONB,
        verified_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dao_proposals (
        id VARCHAR(80) PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        target_param VARCHAR(120),
        training_budget NUMERIC DEFAULT 0,
        creator VARCHAR(44),
        zk_proof_required BOOLEAN DEFAULT FALSE,
        status VARCHAR(40) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW(),
        deadline TIMESTAMP NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dao_votes (
        proposal_id VARCHAR(80) REFERENCES dao_proposals(id) ON DELETE CASCADE,
        voter VARCHAR(120) NOT NULL,
        vote VARCHAR(20) NOT NULL,
        signature VARCHAR(120),
        voting_power NUMERIC DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (proposal_id, voter)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS compute_jobs (
        id VARCHAR(120) PRIMARY KEY,
        model_cid TEXT NOT NULL,
        provider_id VARCHAR(120) NOT NULL,
        provider_name TEXT NOT NULL,
        gpu_type VARCHAR(80),
        price_sol_per_hour NUMERIC DEFAULT 0,
        status VARCHAR(40) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        zk_proof_required BOOLEAN DEFAULT FALSE,
        params JSONB NOT NULL DEFAULT '{}'::jsonb,
        on_chain_record JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        estimated_completion TIMESTAMP
      );
    `);

    // Index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_wallet_analyses_address 
      ON wallet_analyses(wallet_address);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reward_claims_address 
      ON reward_claims(wallet_address);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_model_registrations_authority
      ON model_registrations(authority);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_model_registrations_type
      ON model_registrations(model_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_model_catalog_entries_type
      ON model_catalog_entries(model_type);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dao_proposals_status
      ON dao_proposals(status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_compute_jobs_status
      ON compute_jobs(status);
    `);

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err.message);
    console.log('Continuing without database (queries will still work but not persist)');
  } finally {
    client.release();
  }
}

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() AS current_time');
    client.release();
    console.log(`Database connected: ${result.rows[0].current_time}`);
    return true;
  } catch (err) {
    console.warn('Database not available:', err.message);
    return false;
  }
}

export { pool, initDB, testConnection };
