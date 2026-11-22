import fs from 'node:fs';
import process from 'node:process';
import { Keypair } from '@solana/web3.js';

const checks = [];

function pass(name, detail) {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail) {
  checks.push({ ok: false, name, detail });
}

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

function extract(pattern, source) {
  const match = source.match(pattern);
  return match?.[1] || null;
}

const anchorToml = read('Anchor.toml');
const rustProgram = read('programs/model-registry/src/lib.rs');
const jsRegistry = read('src/utils/modelRegistry.js');
const serverRegistry = read('server/src/utils/modelRegistry.js');
const providerAttestations = read('src/utils/providerAttestations.js');
const serverApi = read('server/index.js');
const modelRegistryApiTest = read('test/modelRegistryApi.test.mjs');
const envExample = read('.env.example');

const anchorProgramId = extract(/model_registry\s*=\s*"([^"]+)"/, anchorToml);
const anchorVersion = extract(/anchor_version\s*=\s*"([^"]+)"/, anchorToml);
const rustProgramId = extract(/declare_id!\("([^"]+)"\)/, rustProgram);
const jsProgramId = extract(/MODEL_REGISTRY_PROGRAM_ID\s*=\s*new PublicKey\('([^']+)'\)/, jsRegistry);
const serverProgramId = extract(/MODEL_REGISTRY_PROGRAM_ID\s*=\s*new PublicKey\('([^']+)'\)/, serverRegistry);

if (
  anchorProgramId &&
  rustProgramId &&
  jsProgramId &&
  serverProgramId &&
  anchorProgramId === rustProgramId &&
  rustProgramId === jsProgramId &&
  jsProgramId === serverProgramId
) {
  pass('program id consistency', anchorProgramId);
} else {
  fail('program id consistency', 'Anchor.toml, declare_id!, src/utils/modelRegistry.js, and server/src/utils/modelRegistry.js must match');
}

if (anchorVersion === '0.30.1') {
  pass('Anchor toolchain pin', anchorVersion);
} else {
  fail('Anchor toolchain pin', 'Anchor.toml must pin anchor_version = "0.30.1"');
}

const deployKeypairPath = 'target/deploy/model_registry-keypair.json';
if (fs.existsSync(deployKeypairPath)) {
  try {
    const secretKey = Uint8Array.from(JSON.parse(read(deployKeypairPath)));
    const deployProgramId = Keypair.fromSecretKey(secretKey).publicKey.toBase58();
    if (deployProgramId === anchorProgramId) {
      pass('deploy keypair program id', deployProgramId);
    } else {
      fail('deploy keypair program id', `${deployKeypairPath} has ${deployProgramId}; expected ${anchorProgramId}`);
    }
  } catch (error) {
    fail('deploy keypair program id', `${deployKeypairPath} could not be parsed: ${error.message}`);
  }
} else {
  pass('deploy keypair program id', `${deployKeypairPath} not present in this checkout`);
}

for (const [name, path] of [
  ['Anchor workspace', 'Anchor.toml'],
  ['model registry program', 'programs/model-registry/src/lib.rs'],
  ['model registry client utilities', 'src/utils/modelRegistry.js'],
  ['provider attestation utilities', 'src/utils/providerAttestations.js'],
  ['model registry docs', 'docs/model-registry/overview.md'],
  ['model registry API tests', 'test/modelRegistryApi.test.mjs'],
]) {
  if (fs.existsSync(path)) pass(name, path);
  else fail(name, `${path} is missing`);
}

if (providerAttestations.includes('evaluateMetaplexDasAsset')) {
  pass('Metaplex DAS verifier', 'evaluateMetaplexDasAsset');
} else {
  fail('Metaplex DAS verifier', 'src/utils/providerAttestations.js must export evaluateMetaplexDasAsset');
}

if (serverApi.includes('/api/models/metaplex-asset')) {
  pass('Metaplex verification API', '/api/models/metaplex-asset');
} else {
  fail('Metaplex verification API', 'server/index.js must expose /api/models/metaplex-asset');
}

if (modelRegistryApiTest.includes('requireMetaplexVerification')) {
  pass('Metaplex verification tests', 'required verification gate covered');
} else {
  fail('Metaplex verification tests', 'test/modelRegistryApi.test.mjs must cover requireMetaplexVerification');
}

for (const envName of [
  'DATABASE_URL',
  'DATABASE_SSL',
  'HELIUS_RPC_URL',
  'HELIUS_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'VITE_API_URL',
  'VITE_TREASURY_ADDRESS',
]) {
  if (envExample.includes(`${envName}=`)) pass(`env example: ${envName}`, 'documented');
  else fail(`env example: ${envName}`, 'missing from .env.example');
}

const gitignore = read('.gitignore');
if (/^\.env$/m.test(gitignore) && /^\.env\.local$/m.test(gitignore)) {
  pass('secret hygiene', '.env and .env.local are ignored');
} else {
  fail('secret hygiene', '.env and .env.local must be ignored');
}

for (const check of checks) {
  const icon = check.ok ? 'PASS' : 'FAIL';
  console.log(`${icon} ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}

const failures = checks.filter((check) => !check.ok);
if (failures.length > 0) {
  console.error(`\nRegistry readiness failed: ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nRegistry readiness checks passed.');
