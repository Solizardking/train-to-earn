#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const root = '/Users/8bit/Downloads/solana-clawd/ai-training/data/model_kit';

const artifacts = [
  { kind: 'sft', from: 'clawd_masterpiece_sft.jsonl', to: 'sft/clawd_masterpiece_sft.jsonl', description: 'Masterpiece-lane chat SFT corpus' },
  { kind: 'sft', from: 'clawd_future_drill_sft.jsonl', to: 'sft/clawd_future_drill_sft.jsonl', description: 'Future drill chat SFT corpus' },
  { kind: 'sft', from: 'clawd_future_refinement_sft.jsonl', to: 'sft/clawd_future_refinement_sft.jsonl', description: 'Future refinement chat SFT corpus' },
  { kind: 'sft', from: 'clawd_autoresearch_wiki_sft.jsonl', to: 'sft/clawd_autoresearch_wiki_sft.jsonl', description: 'Autoresearch wiki chat SFT corpus' },
  { kind: 'sft', from: 'solana_clawd_reasoning_tooling_sft.jsonl', to: 'sft/solana_clawd_reasoning_tooling_sft.jsonl', description: 'Unified reasoning/tooling chat SFT corpus' },
  { kind: 'cpt', from: 'tx_foundation_cpt_clean.jsonl', to: 'cpt/tx_foundation_cpt_clean.jsonl', description: 'Clean transaction foundation CPT corpus' },
  { kind: 'cpt', from: 'bigquery_solana_mainnet_cpt.jsonl', to: 'cpt/bigquery_solana_mainnet_cpt.jsonl', description: 'BigQuery Solana mainnet CPT sample' },
  { kind: 'cpt', from: 'bigquery_solana_mainnet_mock_cpt.jsonl', to: 'cpt/bigquery_solana_mainnet_mock_cpt.jsonl', description: 'Mock BigQuery Solana CPT sample' },
  { kind: 'processed', from: 'reasoning_tooling_processed', to: 'processed/reasoning_tooling_processed', description: 'Prepared reasoning/tooling dataset metadata' },
  { kind: 'processed', from: 'clawd_masterpiece_processed', to: 'processed/clawd_masterpiece_processed', description: 'Prepared masterpiece dataset metadata' },
  { kind: 'processed', from: 'clawd_future_drill_processed', to: 'processed/clawd_future_drill_processed', description: 'Prepared future drill dataset metadata' },
  { kind: 'processed', from: 'clawd_future_refinement_processed', to: 'processed/clawd_future_refinement_processed', description: 'Prepared future refinement dataset metadata' },
  { kind: 'processed', from: 'clawd_autoresearch_wiki_processed', to: 'processed/clawd_autoresearch_wiki_processed', description: 'Autoresearch wiki processed dataset placeholder' },
  { kind: 'processed', from: 'tx_foundation_cpt_clean_processed', to: 'processed/tx_foundation_cpt_clean_processed', description: 'Prepared transaction foundation CPT dataset metadata' },
  { kind: 'manifest', from: 'clawd_masterpiece_manifest.json', to: 'manifests/clawd_masterpiece_manifest.json', description: 'Masterpiece dataset provenance manifest' },
  { kind: 'manifest', from: 'clawd_autoresearch_wiki_manifest.json', to: 'manifests/clawd_autoresearch_wiki_manifest.json', description: 'Autoresearch wiki dataset provenance manifest' },
  { kind: 'manifest', from: 'training_data_optimization_manifest.json', to: 'manifests/training_data_optimization_manifest.json', description: 'Training data optimization manifest' },
  { kind: 'manifest', from: 'perps_tool_manifest.json', to: 'manifests/perps_tool_manifest.json', description: 'Perps tool manifest' },
  { kind: 'quality', from: 'clawd_masterpiece_quality_report.json', to: 'quality/clawd_masterpiece_quality_report.json', description: 'Masterpiece quality report' },
  { kind: 'quality', from: 'clawd_future_drill_quality_report.json', to: 'quality/clawd_future_drill_quality_report.json', description: 'Future drill quality report' },
  { kind: 'quality', from: 'clawd_future_refinement_quality_report.json', to: 'quality/clawd_future_refinement_quality_report.json', description: 'Future refinement quality report' },
  { kind: 'card', from: 'clawd_autoresearch_wiki_dataset_card.md', to: 'cards/clawd_autoresearch_wiki_dataset_card.md', description: 'Autoresearch wiki Hugging Face dataset card' },
];

function relativeLink(fromName, toName) {
  const fromDir = path.dirname(path.join(root, fromName));
  const toPath = path.join(root, toName);
  return path.relative(fromDir, toPath);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sameRealpath(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch {
    return false;
  }
}

function moveAndLink(artifact) {
  const src = path.join(root, artifact.from);
  const dst = path.join(root, artifact.to);
  ensureDir(path.dirname(dst));

  if (fs.existsSync(src)) {
    const stat = fs.lstatSync(src);
    if (stat.isSymbolicLink()) {
      if (!sameRealpath(src, dst)) {
        fs.unlinkSync(src);
        fs.symlinkSync(relativeLink(artifact.from, artifact.to), src);
      }
    } else if (!fs.existsSync(dst)) {
      fs.renameSync(src, dst);
      fs.symlinkSync(relativeLink(artifact.from, artifact.to), src);
    } else if (sameRealpath(src, dst)) {
      // Already organized.
    } else {
      throw new Error(`Refusing to overwrite existing destination: ${artifact.to}`);
    }
  } else if (fs.existsSync(dst)) {
    fs.symlinkSync(relativeLink(artifact.from, artifact.to), src);
  } else {
    artifact.missing = true;
  }
}

function listFiles(target) {
  const out = [];
  if (!fs.existsSync(target)) return out;
  const stat = fs.lstatSync(target);
  if (stat.isFile() || stat.isSymbolicLink()) return [target];
  for (const name of fs.readdirSync(target)) {
    if (name === '.DS_Store') continue;
    out.push(...listFiles(path.join(target, name)));
  }
  return out;
}

async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function analyzeJsonl(file) {
  let lines = 0;
  let invalid = 0;
  const keys = new Set();
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.trim()) continue;
    lines += 1;
    try {
      const obj = JSON.parse(line);
      for (const key of Object.keys(obj)) keys.add(key);
    } catch {
      invalid += 1;
    }
  }
  return { lines, invalid_json_lines: invalid, top_level_keys: [...keys].sort() };
}

function countDatasetShards(dir) {
  return listFiles(dir).filter((file) => file.endsWith('.arrow') || file.endsWith('.parquet')).length;
}

async function summarize(artifact) {
  const canonical = path.join(root, artifact.to);
  const compat = path.join(root, artifact.from);
  const exists = fs.existsSync(canonical);
  const info = {
    kind: artifact.kind,
    description: artifact.description,
    compatibility_path: artifact.from,
    canonical_path: artifact.to,
    compatibility_is_symlink: fs.existsSync(compat) ? fs.lstatSync(compat).isSymbolicLink() : false,
    exists,
  };
  if (!exists) return info;
  const stat = fs.lstatSync(canonical);
  info.type = stat.isDirectory() ? 'directory' : 'file';
  info.size_bytes = stat.isDirectory()
    ? listFiles(canonical).reduce((sum, file) => sum + fs.statSync(file).size, 0)
    : stat.size;
  if (stat.isFile()) {
    info.sha256 = await hashFile(canonical);
    if (canonical.endsWith('.jsonl')) Object.assign(info, await analyzeJsonl(canonical));
    if (canonical.endsWith('.json')) {
      try {
        info.json_valid = true;
        info.json_top_level_keys = Object.keys(JSON.parse(fs.readFileSync(canonical, 'utf8'))).sort();
      } catch (error) {
        info.json_valid = false;
        info.json_error = error.message;
      }
    }
  } else {
    info.file_count = listFiles(canonical).length;
    info.dataset_shards = countDatasetShards(canonical);
    info.status = info.dataset_shards > 0 ? 'prepared_dataset' : 'metadata_only';
  }
  return info;
}

function writeReadme() {
  const body = `# Model Kit Data

This directory is organized by training artifact type while preserving the old
flat paths as compatibility symlinks for existing configs and scripts.

## Layout

- \`sft/\`: chat/message SFT JSONL corpora.
- \`cpt/\`: continued-pretraining text JSONL corpora.
- \`processed/\`: prepared dataset directories. Current local folders contain
  metadata only; no Arrow or Parquet shards are present in this tree.
- \`manifests/\`: provenance, optimization, and tool manifests.
- \`quality/\`: quality reports for generated SFT lanes.
- \`cards/\`: Hugging Face dataset cards.

## Compatibility

Existing paths such as \`data/model_kit/tx_foundation_cpt_clean.jsonl\` and
\`data/model_kit/clawd_masterpiece_processed\` are symlinks to the canonical
organized locations. Keep those symlinks unless every config under
\`configs/\`, \`scripts/\`, \`nvidia/\`, and \`model-kit/\` has been migrated.

## Index

\`MODEL_KIT_INDEX.json\` is the machine-readable inventory with canonical paths,
compatibility paths, sizes, JSONL line counts, hashes, and processed-dataset
status.
`;
  fs.writeFileSync(path.join(root, 'README.md'), body, 'utf8');
}

async function main() {
  if (!fs.existsSync(root)) {
    throw new Error(`model_kit root does not exist: ${root}`);
  }
  for (const dir of ['sft', 'cpt', 'processed', 'manifests', 'quality', 'cards']) {
    ensureDir(path.join(root, dir));
  }
  for (const artifact of artifacts) moveAndLink(artifact);
  writeReadme();
  const summarized = [];
  for (const artifact of artifacts) summarized.push(await summarize(artifact));
  const index = {
    generated_at: new Date().toISOString(),
    root,
    compatibility_policy: 'flat data/model_kit paths are preserved as symlinks',
    layout: {
      sft: 'chat/message SFT JSONL corpora',
      cpt: 'continued-pretraining JSONL corpora',
      processed: 'prepared dataset directories or metadata placeholders',
      manifests: 'provenance, optimization, and tool manifests',
      quality: 'quality reports',
      cards: 'dataset cards',
    },
    artifacts: summarized,
  };
  fs.writeFileSync(path.join(root, 'MODEL_KIT_INDEX.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(index, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
