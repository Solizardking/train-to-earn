#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LORA_DIR = '/Users/8bit/Downloads/solana-clawd/ai-training/outputs/imported-root-outputs-20260704/solana-clawd-1.5b-lora/checkpoint-3';
const NEMOTRON_GGUF_REPO = 'nvidia/NVIDIA-Nemotron-3-Nano-4B-GGUF';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const asJson = args.includes('--json');
const explicitDir = args.find((arg) => !arg.startsWith('--'));
const loraDir = path.resolve(explicitDir || process.env.SOLANA_CLAWD_LORA_DIR || DEFAULT_LORA_DIR);
const expectedBase = process.env.SOLANA_CLAWD_EXPECTED_BASE || null;

const result = {
  loraDir,
  ready: false,
  adapter: null,
  files: {},
  warnings: [],
  issues: [],
};

function fileInfo(name) {
  const filePath = path.join(loraDir, name);
  if (!fs.existsSync(filePath)) {
    return { path: filePath, exists: false, size: 0 };
  }

  const stats = fs.statSync(filePath);
  return { path: filePath, exists: stats.isFile(), size: stats.size };
}

function readJson(name) {
  const info = fileInfo(name);
  result.files[name] = info;

  if (!info.exists) {
    result.issues.push(`missing ${name}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(info.path, 'utf8'));
  } catch (error) {
    result.issues.push(`could not parse ${name}: ${error.message}`);
    return null;
  }
}

if (!fs.existsSync(loraDir)) {
  result.issues.push(`LoRA directory does not exist: ${loraDir}`);
} else {
  const adapterConfig = readJson('adapter_config.json');
  if (adapterConfig) {
    result.adapter = {
      baseModel: adapterConfig.base_model_name_or_path || null,
      peftType: adapterConfig.peft_type || null,
      taskType: adapterConfig.task_type || null,
      rank: adapterConfig.r ?? null,
      loraAlpha: adapterConfig.lora_alpha ?? null,
      targetModules: adapterConfig.target_modules || [],
    };

    if (adapterConfig.peft_type !== 'LORA') {
      result.issues.push(`adapter peft_type is ${adapterConfig.peft_type}, expected LORA`);
    }

    if (adapterConfig.base_model_name_or_path === NEMOTRON_GGUF_REPO) {
      result.warnings.push('adapter base unexpectedly matches the Nemotron GGUF repo');
    } else {
      result.warnings.push(
        `adapter base is ${adapterConfig.base_model_name_or_path}; do not attach it to ${NEMOTRON_GGUF_REPO}`,
      );
    }

    if (expectedBase && adapterConfig.base_model_name_or_path !== expectedBase) {
      result.issues.push(
        `base model mismatch: adapter uses ${adapterConfig.base_model_name_or_path}, expected ${expectedBase}`,
      );
    }
  }

  for (const name of ['README.md', 'chat_template.jinja', 'tokenizer_config.json', 'tokenizer.json']) {
    result.files[name] = fileInfo(name);
  }

  const weightCandidates = ['adapter_model.safetensors', 'adapter_model.bin', 'adapter_model.gguf'];
  const weights = weightCandidates.map((name) => [name, fileInfo(name)]);
  for (const [name, info] of weights) {
    result.files[name] = info;
  }

  if (!weights.some(([, info]) => info.exists && info.size > 0)) {
    result.issues.push('missing adapter weights: expected adapter_model.safetensors, adapter_model.bin, or adapter_model.gguf');
  }

  const tokenizer = result.files['tokenizer.json'];
  if (tokenizer?.exists && tokenizer.size === 0) {
    result.issues.push('tokenizer.json is zero bytes; restore it or remove it and load the base tokenizer');
  }
}

result.ready = result.issues.length === 0;

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Solana CLAWD LoRA: ${result.ready ? 'ready' : 'not ready'}`);
  console.log(`Path: ${result.loraDir}`);

  if (result.adapter) {
    console.log(`Base model: ${result.adapter.baseModel}`);
    console.log(`PEFT type: ${result.adapter.peftType}`);
    console.log(`Rank/alpha: ${result.adapter.rank}/${result.adapter.loraAlpha}`);
    console.log(`Target modules: ${result.adapter.targetModules.join(', ')}`);
  }

  if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    for (const warning of result.warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (result.issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of result.issues) {
      console.log(`- ${issue}`);
    }
  }
}

if (strict && !result.ready) {
  process.exit(1);
}
