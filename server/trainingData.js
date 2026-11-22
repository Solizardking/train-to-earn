import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAINING_BASE = path.resolve(__dirname, '..', '..', 'training');

// Map of model key to human-readable info
const MODEL_MAP = {
  'solanaclawd/solana-clawd-core-ai-1.5b-lora': {
    name: 'Solana Clawd Core AI 1.5B LoRA',
    description: 'Primary fine-tune of Qwen2.5-1.5B-Instruct for Solana development, DeFi reasoning, memecoin risk analysis, and agent architecture. ~9M trainable params (LoRA r=16, alpha=32).',
    baseModel: 'Qwen/Qwen2.5-1.5B-Instruct',
    hubUrl: 'https://huggingface.co/solanaclawd/solana-clawd-core-ai-1.5b-lora',
    type: 'LoRA',
    status: 'live',
    tags: ['solana', 'defi', 'agent', 'lora', 'peft', 'constitutional-ai'],
    metrics: { trainLoss: 0.9008, tokenAccuracy: '82.9%', tokens: '24.54M', samplesPerSec: 2.73, epoch: 1, lr: '2.0e-4' },
  },
  'solanaclawd/clawd-fable-lora': {
    name: 'Clawd Fable LoRA',
    description: 'Fable-trace lane for Solana Clawd — trained on Fable-5 traces for reasoning and tool-use chains.',
    baseModel: 'AliesTaha/fable-traces',
    hubUrl: 'https://huggingface.co/solanaclawd/clawd-fable-lora',
    type: 'LoRA',
    status: 'live',
    tags: ['fable', 'traces', 'reasoning'],
  },
  'solanaclawd/solana-tx-foundation-1.5b': {
    name: 'Solana Transaction Foundation Model',
    description: 'Qwen2.5-1.5B fine-tuned in two stages: CPT on 19,542 Solana transactions + SFT on 30K instruction pairs. Custom Solana tokenizer encoding 8 field types.',
    baseModel: 'Qwen/Qwen2.5-1.5B-Instruct',
    hubUrl: 'https://huggingface.co/solanaclawd/solana-tx-foundation-1.5b',
    type: 'Full model (CPT+SFT)',
    status: 'training',
    tags: ['transactions', 'cpt', 'sft', 'nvidia'],
  },
  'solanaclawd/clawd-glm-5-2': {
    name: 'Clawd GLM-5.2',
    description: 'Qwen2.5-7B-Instruct fine-tuned via Fireworks managed SFT on the Clawd instruct dataset.',
    baseModel: 'Qwen/Qwen2.5-7B-Instruct',
    hubUrl: 'https://huggingface.co/solanaclawd/clawd-glm-5-2',
    type: 'LoRA (Fireworks)',
    status: 'live',
    tags: ['fireworks', '7b', 'sft'],
  },
};

const DATASET_MAP = {
  'solanaclawd/solana-clawd-core-ai-instruct': {
    name: 'Core AI Instruct',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-core-ai-instruct',
    examples: 35173,
    type: 'instruction-tuning',
    license: 'cc-by-4.0',
  },
  'solanaclawd/solana-clawd-instruct': {
    name: 'Clawd Instruct (legacy seed)',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-instruct',
    examples: 36109,
    type: 'instruction-tuning',
    license: 'cc-by-4.0',
  },
  'solanaclawd/solana-clawd-realtime-research-instruct': {
    name: 'Realtime Research Instruct',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-realtime-research-instruct',
    examples: 29058,
    type: 'instruction-tuning',
    license: 'cc-by-4.0',
  },
  'solanaclawd/solana-clawd-nvidia-trading-factory-instruct': {
    name: 'NVIDIA Trading Factory Instruct',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-clawd-nvidia-trading-factory-instruct',
    examples: 15000,
    type: 'instruction-tuning',
    license: 'cc-by-4.0',
  },
  'solanaclawd/solana-tx-foundation-cpt': {
    name: 'Transaction Foundation CPT',
    hubUrl: 'https://huggingface.co/datasets/solanaclawd/solana-tx-foundation-cpt',
    examples: 19542,
    type: 'cpt',
    license: 'cc-by-4.0',
  },
};

const NVIDIA_INTEGRATIONS = [
  {
    name: 'Nemotron-3 Nano 30B A3B',
    description: 'Primary reasoning NIM API — signal verdicts, portfolio narration.',
    type: 'NIM API',
    status: 'external',
    url: 'https://build.nvidia.com/nvidia/nemotron-3-nano-30b-a3b',
  },
  {
    name: 'Nemotron-3 Super 120B A12B',
    description: 'Teacher model — distillation and SFT labeling.',
    type: 'NIM API',
    status: 'external',
    url: 'https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b',
  },
  {
    name: 'Trading Factory Signal Agent',
    description: 'Quantitative signal discovery agent running on Solana market data.',
    type: 'Blueprint',
    status: 'live',
    url: null,
  },
  {
    name: 'Transaction Foundation Model Pipeline',
    description: 'Two-stage CPT + SFT pipeline for Solana transaction understanding.',
    type: 'Blueprint',
    status: 'live',
    url: null,
  },
];

async function readConfigFiles(dir) {
  const configDir = path.join(TRAINING_BASE, dir);
  const configs = [];
  try {
    const entries = await fs.readdir(configDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        const filePath = path.join(configDir, entry.name);
        const content = await fs.readFile(filePath, 'utf8');
        configs.push({
          name: entry.name,
          path: filePath.replace(TRAINING_BASE, ''),
          size: content.length,
          preview: content.split('\n').slice(0, 20).join('\n'),
        });
      }
    }
  } catch {
    // directory doesn't exist
  }
  return configs;
}

async function readDocFiles(dir) {
  const docDir = path.join(TRAINING_BASE, dir);
  const docs = [];
  try {
    const entries = await fs.readdir(docDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.mdx'))) {
        const filePath = path.join(docDir, entry.name);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        const title = lines.find((l) => l.startsWith('# '))?.replace('# ', '').trim() || entry.name.replace(/\.md$/, '');
        docs.push({
          name: entry.name,
          title,
          path: filePath.replace(TRAINING_BASE, ''),
          size: content.length,
          preview: content.split('\n').slice(0, 30).join('\n'),
          lineCount: lines.length,
        });
      }
    }
  } catch {
    // directory doesn't exist
  }
  return docs;
}

async function readDataFiles(dir) {
  const dataDir = path.join(TRAINING_BASE, dir);
  const files = [];
  try {
    const entries = await fs.readdir(dataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !entry.name.startsWith('.')) {
        const filePath = path.join(dataDir, entry.name);
        const stat = await fs.stat(filePath);
        files.push({
          name: entry.name,
          path: filePath.replace(TRAINING_BASE, ''),
          size: stat.size,
          ext: path.extname(entry.name),
        });
      }
    }
  } catch {
    // directory doesn't exist
  }
  return files;
}

async function getTrainingData() {
  const [configs, docs, dataFiles, daoConfigs, daoDocs] = await Promise.all([
    readConfigFiles('configs'),
    readDocFiles('docs'),
    readDataFiles('data'),
    readConfigFiles('dao'),
    readDocFiles('dao'),
  ]);

  return {
    models: MODEL_MAP,
    datasets: DATASET_MAP,
    nvidia: NVIDIA_INTEGRATIONS,
    files: {
      configs,
      docs,
      data: dataFiles,
      dao: {
        configs: daoConfigs,
        docs: daoDocs,
      },
    },
    directories: {
      configs: '/training/configs/',
      docs: '/training/docs/',
      data: '/training/data/',
      dao: '/training/dao/',
    },
    summary: {
      totalConfigs: configs.length,
      totalDocs: docs.length,
      totalDataFiles: dataFiles.length,
      totalModels: Object.keys(MODEL_MAP).length,
      totalDatasets: Object.keys(DATASET_MAP).length,
    },
  };
}

export { getTrainingData, MODEL_MAP, DATASET_MAP, NVIDIA_INTEGRATIONS };