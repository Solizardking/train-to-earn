export const PIED_PIPER_SOURCE_ROOT = '/Users/8bit/Downloads/PiedPiper-master';
export const PIED_PIPER_MODEL_TYPE = 'PIEDPIPER_PIPELINE';
export const PIED_PIPER_INTEGRATION_VERSION = '2026-07-04';
export const PIED_PIPER_MAX_INPUT_CHARS = 4096;

export const PIED_PIPER_ATTRIBUTION = Object.freeze({
  project: 'PiedPiper',
  sourceRoot: PIED_PIPER_SOURCE_ROOT,
  upstream: 'https://github.com/vs666/PiedPiper',
  license: 'MIT',
  copyright: 'Copyright (c) 2020 Varul Srivastava',
  contributors: [
    'Varul Srivastava',
    'Akshett Rai Jindal',
    'Ashwin Mittal',
    'Zishan Kazi',
    'Keshav Bansal',
  ],
});

export const PIED_PIPER_CAPABILITIES = Object.freeze([
  {
    id: 'text-compression-huffman-rle',
    name: 'Static Huffman + RLE text compression',
    category: 'compression',
    modelType: PIED_PIPER_MODEL_TYPE,
    runtime: 'ported-js',
    sourcePaths: [
      'Compression/Huffman/Static',
      'Compression/Add-ons/rle.c',
      'Compression/Add-ons/bwt.c',
    ],
    registryUse: 'Compress prompts, dataset rows, model cards, and metadata before storage or reward scoring.',
    trainingSignals: ['symbol-frequency', 'entropy', 'compression-ratio', 'repeat-runs'],
  },
  {
    id: 'arithmetic-compression',
    name: 'Static arithmetic compression',
    category: 'compression',
    modelType: PIED_PIPER_MODEL_TYPE,
    runtime: 'registry-metadata',
    sourcePaths: ['Compression/Arithmetic/Static'],
    registryUse: 'Register as a deterministic compression primitive for larger binary model artifacts.',
    trainingSignals: ['probability-model', 'range-coding', 'bitstream-density'],
  },
  {
    id: 'painting-image-compression',
    name: 'Painting based image compression',
    category: 'image-compression',
    modelType: 'IMAGE_CLASSIFICATION',
    runtime: 'ported-estimator',
    sourcePaths: ['Image Compression/PBIC', 'Image Compression/JPEG Compression', 'Image Compression/K-means'],
    registryUse: 'Score screenshot, chart, and NFT images for stroke-like structure before multimodal ingestion.',
    trainingSignals: ['block-loss', 'stroke-family', 'estimated-bytes', 'compression-class'],
  },
  {
    id: 'pca-feature-compression',
    name: 'PCA dimensionality reduction',
    category: 'feature-compression',
    modelType: 'EMBEDDINGS',
    runtime: 'registry-metadata',
    sourcePaths: ['PCA'],
    registryUse: 'Document feature compression and embedding reduction used before on-chain commitments.',
    trainingSignals: ['variance-retained', 'component-count', 'projection-error'],
  },
  {
    id: 'ca-hash-commitments',
    name: 'Cellular automata hash commitments',
    category: 'hashing',
    modelType: PIED_PIPER_MODEL_TYPE,
    runtime: 'ported-rule30',
    sourcePaths: ['PP_HASH'],
    registryUse: 'Create deterministic content commitments for dataset and inference ledger entries.',
    trainingSignals: ['sha512-digest', 'rule30-stream', 'ledger-commitment'],
  },
  {
    id: 'ca-encryption',
    name: 'Cellular automata encryption research',
    category: 'encryption',
    modelType: PIED_PIPER_MODEL_TYPE,
    runtime: 'registry-metadata',
    sourcePaths: ['Encryption/CA_Password_Protect', 'Encryption/AES-128', 'Encryption/RSA Encryption', 'Encryption/DES Encryption'],
    registryUse: 'Attach cryptographic provenance and security notes to private training and inference sessions.',
    trainingSignals: ['key-schedule', 'block-mode', 'prg-state', 'security-boundary'],
  },
  {
    id: 'pp-ssh-agent-session',
    name: 'PP_SSH agent session protocol',
    category: 'agent-security',
    modelType: PIED_PIPER_MODEL_TYPE,
    runtime: 'registry-metadata',
    sourcePaths: ['PP_SSH'],
    registryUse: 'Map agent handshakes, session proofs, and protocol traces into auditable model services.',
    trainingSignals: ['handshake', 'session-state', 'message-authentication'],
  },
  {
    id: 'cellular-automata-simulations',
    name: 'Game of Life + forest fire simulations',
    category: 'simulation',
    modelType: PIED_PIPER_MODEL_TYPE,
    runtime: 'ported-js',
    sourcePaths: ['GameOfLife', 'ForestFire_Simulation', 'UNIVERSAL_COMPUTER.md'],
    registryUse: 'Use deterministic simulations as explainable state transitions for agent training rounds.',
    trainingSignals: ['live-cell-count', 'burn-front', 'state-transition', 'halting-analogy'],
  },
  {
    id: 'multi-agent-collision-avoidance',
    name: 'Multi-agent collision avoidance',
    category: 'multi-agent',
    modelType: 'CONSENSUS_LEARNING',
    runtime: 'registry-metadata',
    sourcePaths: ['MultiAgent_CollisionAvoidance'],
    registryUse: 'Seed multi-agent planning and reward-safety tasks for decentralized model evaluation.',
    trainingSignals: ['agent-position', 'collision-risk', 'policy-adjustment'],
  },
]);

const DEFAULT_INPUT = 'Train2Earn registers deterministic compression and automata agents on Solana.';

function clampInput(input) {
  const value = String(input ?? '').trim() || DEFAULT_INPUT;
  return value.slice(0, PIED_PIPER_MAX_INPUT_CHARS);
}

function toCharacters(input) {
  return Array.from(String(input ?? ''));
}

function printableSymbol(value) {
  if (value === '\n') return '\\n';
  if (value === '\r') return '\\r';
  if (value === '\t') return '\\t';
  if (value === '\0') return '<EOF>';
  if (value === ' ') return '<space>';
  return value;
}

function printableSequence(value, maxLength = 160) {
  return toCharacters(value)
    .slice(0, maxLength)
    .map(printableSymbol)
    .join('');
}

function estimateBitsForText(text) {
  return Math.max(toCharacters(text).length * 8, 1);
}

export function stableHash32(input) {
  let hash = 0x811c9dc5;
  for (const char of toCharacters(String(input ?? ''))) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function stableHashHex(input) {
  return stableHash32(input).toString(16).padStart(8, '0');
}

function makeSeededRandom(seed) {
  let state = stableHash32(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export function createHuffmanModel(input) {
  const text = clampInput(input);
  const chars = toCharacters(text);
  const frequency = new Map();

  for (const char of chars) {
    frequency.set(char, (frequency.get(char) || 0) + 1);
  }

  let nodes = Array.from(frequency.entries()).map(([char, count]) => ({
    char,
    count,
    sortKey: printableSymbol(char),
  }));

  if (nodes.length === 0) {
    return {
      algorithm: 'static-huffman',
      originalBitLength: 0,
      encodedBitLength: 0,
      compressionRatio: 1,
      encodedBitsPreview: '',
      frequency: [],
      codebook: {},
    };
  }

  while (nodes.length > 1) {
    nodes = nodes.sort((a, b) => a.count - b.count || a.sortKey.localeCompare(b.sortKey));
    const left = nodes.shift();
    const right = nodes.shift();
    nodes.push({
      count: left.count + right.count,
      left,
      right,
      sortKey: `${left.sortKey}${right.sortKey}`,
    });
  }

  const root = nodes[0];
  const codebook = {};
  const visit = (node, prefix) => {
    if (Object.prototype.hasOwnProperty.call(node, 'char')) {
      codebook[node.char] = prefix || '0';
      return;
    }
    visit(node.left, `${prefix}0`);
    visit(node.right, `${prefix}1`);
  };
  visit(root, '');

  const encodedBits = chars.map((char) => codebook[char]).join('');
  const originalBitLength = estimateBitsForText(text);
  const encodedBitLength = Math.max(encodedBits.length, 1);
  const frequencyRows = Array.from(frequency.entries())
    .map(([char, count]) => ({
      symbol: printableSymbol(char),
      value: char,
      count,
      code: codebook[char],
    }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));

  return {
    algorithm: 'static-huffman',
    originalBitLength,
    encodedBitLength,
    compressionRatio: Number((encodedBitLength / originalBitLength).toFixed(4)),
    savingsPercent: Number(Math.max(0, (1 - encodedBitLength / originalBitLength) * 100).toFixed(2)),
    encodedBitsPreview: encodedBits.slice(0, 192),
    frequency: frequencyRows,
    codebook,
  };
}

export function decodeHuffmanBits(bits, codebook) {
  const reverse = new Map(Object.entries(codebook || {}).map(([char, code]) => [code, char]));
  let cursor = '';
  let output = '';

  for (const bit of String(bits || '')) {
    cursor += bit;
    if (reverse.has(cursor)) {
      output += reverse.get(cursor);
      cursor = '';
    }
  }

  if (cursor) {
    throw new Error('Invalid Huffman bitstream: trailing partial code');
  }

  return output;
}

export function runLengthEncode(input) {
  const text = clampInput(input);
  const chars = toCharacters(text);
  const runs = [];

  for (const char of chars) {
    const last = runs[runs.length - 1];
    if (last && last.value === char && last.count < 254) {
      last.count += 1;
    } else {
      runs.push({ value: char, symbol: printableSymbol(char), count: 1 });
    }
  }

  const originalBitLength = estimateBitsForText(text);
  const encodedBitLength = Math.max(runs.length * 16, 1);

  return {
    algorithm: 'run-length-encoding',
    originalBitLength,
    encodedBitLength,
    compressionRatio: Number((encodedBitLength / originalBitLength).toFixed(4)),
    savingsPercent: Number(Math.max(0, (1 - encodedBitLength / originalBitLength) * 100).toFixed(2)),
    runs,
    encodedPreview: runs.slice(0, 48).map((run) => `${run.count}x${run.symbol}`).join(' '),
  };
}

export function runLengthDecode(runs = []) {
  return runs.map((run) => String(run.value ?? '').repeat(Number(run.count) || 0)).join('');
}

export function burrowsWheelerTransform(input) {
  const text = clampInput(input);
  if (text.includes('\0')) {
    throw new Error('BWT input cannot contain the EOF sentinel');
  }

  const source = `${text}\0`;
  const rotations = toCharacters(source).map((_, index) => source.slice(index) + source.slice(0, index));
  rotations.sort();
  const lastColumn = rotations.map((rotation) => rotation[rotation.length - 1]).join('');
  const primaryIndex = rotations.findIndex((rotation) => rotation === source);

  return {
    algorithm: 'burrows-wheeler-transform',
    primaryIndex,
    length: source.length,
    lastColumn,
    lastColumnPreview: printableSequence(lastColumn),
  };
}

function emptyGrid(rows, cols, value = 0) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function countNeighbors(grid, row, col, predicate = (value) => value === 1) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nextRow = row + dr;
      const nextCol = col + dc;
      if (nextRow < 0 || nextCol < 0 || nextRow >= grid.length || nextCol >= grid[0].length) continue;
      if (predicate(grid[nextRow][nextCol])) count += 1;
    }
  }
  return count;
}

function seedLifeGrid(seed, rows, cols) {
  const random = makeSeededRandom(`life:${seed}`);
  const grid = emptyGrid(rows, cols);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      grid[row][col] = random() > 0.72 ? 1 : 0;
    }
  }

  if (rows > 5 && cols > 7) {
    grid[2][4] = 1;
    grid[3][5] = 1;
    grid[4][3] = 1;
    grid[4][4] = 1;
    grid[4][5] = 1;
  }

  return grid;
}

export function stepGameOfLife(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const next = emptyGrid(rows, cols);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const alive = grid[row][col] === 1;
      const neighbors = countNeighbors(grid, row, col);
      next[row][col] = alive
        ? (neighbors === 2 || neighbors === 3 ? 1 : 0)
        : (neighbors === 3 ? 1 : 0);
    }
  }

  return next;
}

function gridRows(grid, symbols) {
  return grid.map((row) => row.map((value) => symbols[value] ?? '?').join(''));
}

function countGridValues(grid) {
  return grid.flat().reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export function simulateGameOfLife({ seed = DEFAULT_INPUT, rows = 12, cols = 12, generations = 5 } = {}) {
  let grid = seedLifeGrid(seed, rows, cols);
  const history = [];

  for (let generation = 0; generation <= generations; generation += 1) {
    history.push({
      generation,
      liveCells: countGridValues(grid)[1] || 0,
    });
    if (generation < generations) grid = stepGameOfLife(grid);
  }

  return {
    algorithm: 'conway-game-of-life',
    rows,
    cols,
    generations,
    history,
    finalGrid: gridRows(grid, ['.', '#']),
  };
}

function seedForestGrid(seed, rows, cols) {
  const random = makeSeededRandom(`forest:${seed}`);
  const grid = emptyGrid(rows, cols);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const roll = random();
      grid[row][col] = roll > 0.9 ? 3 : roll > 0.26 ? 1 : 0;
    }
  }

  if (rows > 5 && cols > 7) {
    grid[2][4] = 2;
    grid[3][5] = 2;
    grid[4][3] = 2;
    grid[4][4] = 2;
    grid[4][5] = 2;
  }

  return grid;
}

export function stepForestFire(grid) {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const next = emptyGrid(rows, cols);

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const value = grid[row][col];
      const burningNeighbors = countNeighbors(grid, row, col, (state) => state === 2);
      const fuelNeighbors = countNeighbors(grid, row, col, (state) => state === 1);

      if (value === 3) {
        next[row][col] = 3;
      } else if (value === 2) {
        next[row][col] = 3;
      } else if (value === 1 && burningNeighbors > 0) {
        next[row][col] = 2;
      } else if (value === 0 && fuelNeighbors >= 5 && burningNeighbors === 0) {
        next[row][col] = 1;
      } else {
        next[row][col] = value;
      }
    }
  }

  return next;
}

export function simulateForestFire({ seed = DEFAULT_INPUT, rows = 12, cols = 12, generations = 5 } = {}) {
  let grid = seedForestGrid(seed, rows, cols);
  const history = [];

  for (let generation = 0; generation <= generations; generation += 1) {
    const counts = countGridValues(grid);
    history.push({
      generation,
      empty: counts[0] || 0,
      fuel: counts[1] || 0,
      burning: counts[2] || 0,
      burnt: counts[3] || 0,
    });
    if (generation < generations) grid = stepForestFire(grid);
  }

  return {
    algorithm: 'forest-fire-cellular-automaton',
    rows,
    cols,
    generations,
    history,
    finalGrid: gridRows(grid, ['.', 't', 'F', 'x']),
  };
}

export function runRule30(seed = DEFAULT_INPUT, { width = 33, steps = 16 } = {}) {
  const safeWidth = Math.max(9, Math.min(Number(width) || 33, 65));
  const safeSteps = Math.max(1, Math.min(Number(steps) || 16, 48));
  const random = makeSeededRandom(`rule30:${seed}`);
  let row = Array.from({ length: safeWidth }, (_, index) => (index === Math.floor(safeWidth / 2) ? 1 : 0));

  for (let index = 0; index < safeWidth; index += 1) {
    if (random() > 0.86) row[index] = row[index] ? 0 : 1;
  }

  const rows = [row.join('')];
  for (let step = 0; step < safeSteps; step += 1) {
    const next = Array.from({ length: safeWidth }, (_, index) => {
      const left = row[index - 1] || 0;
      const center = row[index] || 0;
      const right = row[index + 1] || 0;
      const pattern = (left << 2) | (center << 1) | right;
      return (30 >> pattern) & 1;
    });
    row = next;
    rows.push(row.join(''));
  }

  const stream = rows.join('');
  const hexPreview = stream
    .match(/[01]{1,4}/g)
    .slice(0, 32)
    .map((chunk) => parseInt(chunk.padEnd(4, '0'), 2).toString(16))
    .join('');

  return {
    algorithm: 'elementary-cellular-automaton-rule-30',
    width: safeWidth,
    steps: safeSteps,
    rows,
    bitstreamPreview: stream.slice(0, 192),
    hexPreview,
  };
}

function textToBlock(input) {
  const text = clampInput(input);
  const chars = toCharacters(text);
  const block = emptyGrid(8, 8);

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const char = chars[(row * 8 + col) % chars.length] || ' ';
      block[row][col] = char.charCodeAt(0) % 256;
    }
  }

  return block;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function squaredLoss(values, target) {
  return values.reduce((sum, value) => sum + (value - target) ** 2, 0);
}

function pbicStrokeLoss(block, family) {
  const all = block.flat();

  if (family === 'solid-fill') {
    return squaredLoss(all, mean(all));
  }

  if (family === 'horizontal-stroke') {
    return block.reduce((sum, row) => sum + squaredLoss(row, mean(row)), 0);
  }

  if (family === 'vertical-stroke') {
    let loss = 0;
    for (let col = 0; col < 8; col += 1) {
      const values = block.map((row) => row[col]);
      loss += squaredLoss(values, mean(values));
    }
    return loss;
  }

  const groups = new Map();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const key = family === 'down-diagonal-stroke' ? row - col : row + col;
      groups.set(key, [...(groups.get(key) || []), block[row][col]]);
    }
  }

  return Array.from(groups.values()).reduce((sum, values) => sum + squaredLoss(values, mean(values)), 0);
}

export function estimatePaintingCompression(input) {
  const block = textToBlock(input);
  const strokeFamilies = [
    { id: 'solid-fill', estimatedBytes: 2 },
    { id: 'horizontal-stroke', estimatedBytes: 9 },
    { id: 'vertical-stroke', estimatedBytes: 9 },
    { id: 'down-diagonal-stroke', estimatedBytes: 16 },
    { id: 'up-diagonal-stroke', estimatedBytes: 16 },
    { id: 'raw-block', estimatedBytes: 64 },
  ];

  const candidates = strokeFamilies.map((family) => {
    const loss = family.id === 'raw-block' ? 0 : pbicStrokeLoss(block, family.id);
    const weightedLoss = loss * family.estimatedBytes;
    return {
      ...family,
      loss: Number(loss.toFixed(2)),
      weightedLoss: Number(weightedLoss.toFixed(2)),
      compressionRatio: Number((family.estimatedBytes / 64).toFixed(4)),
    };
  });

  const best = [...candidates]
    .filter((candidate) => candidate.id !== 'raw-block')
    .sort((a, b) => a.weightedLoss - b.weightedLoss || a.estimatedBytes - b.estimatedBytes)[0];

  return {
    algorithm: 'painting-based-image-compression-estimator',
    block,
    candidates,
    best,
  };
}

export function createPiedPiperRegistryDraft(input = {}, analysis = {}) {
  const content = clampInput(input.prompt || input.content || input.input || DEFAULT_INPUT);
  const artifactSha256 = analysis.artifactSha256 || `fnv1a:${stableHashHex(content)}`;
  const now = analysis.generatedAt || new Date().toISOString();

  return {
    name: input.name || 'PiedPiper Compression Automata Agent',
    description: input.description || 'Deterministic compression, hashing, cellular automata, and protocol-analysis toolkit adapted from PiedPiper for Train2Earn on-chain AI workflows.',
    modelType: PIED_PIPER_MODEL_TYPE,
    architecture: 'deterministic-algorithmic-agent',
    parameterCount: '0',
    license: PIED_PIPER_ATTRIBUTION.license,
    artifactUri: input.artifactUri || 'ipfs://piedpiper-compression-automata-toolkit',
    artifactSha256,
    modelCardUri: input.modelCardUri || 'docs/on-chain-ai/piedpiper-integration.md',
    huggingFaceRepo: input.huggingFaceRepo || 'local/piedpiper-onchain-ai',
    huggingFaceCommit: input.huggingFaceCommit || `local-${PIED_PIPER_INTEGRATION_VERSION}`,
    trainingDataUri: input.trainingDataUri || PIED_PIPER_SOURCE_ROOT,
    price: Number(input.price ?? 0.004),
    royaltyBps: Number(input.royaltyBps ?? 150),
    capabilities: PIED_PIPER_CAPABILITIES.map((capability) => capability.id),
    supportedTrust: [
      'storage-proof',
      'model-lineage',
      'evaluation-attestation',
      'deterministic-replay',
    ],
    provenance: {
      source: PIED_PIPER_ATTRIBUTION.project,
      sourceRoot: PIED_PIPER_ATTRIBUTION.sourceRoot,
      upstream: PIED_PIPER_ATTRIBUTION.upstream,
      license: PIED_PIPER_ATTRIBUTION.license,
      integratedAt: now,
    },
  };
}

export function createPiedPiperAnalysis(input, options = {}) {
  const content = clampInput(input);
  const huffman = createHuffmanModel(content);
  const rle = runLengthEncode(content);
  const bwt = burrowsWheelerTransform(content);
  const life = simulateGameOfLife({ seed: content, generations: options.generations ?? 5 });
  const forestFire = simulateForestFire({ seed: content, generations: options.generations ?? 5 });
  const rule30 = runRule30(content, { steps: options.rule30Steps ?? 16 });
  const pbic = estimatePaintingCompression(content);
  const artifactSha256 = options.artifactSha256 || `fnv1a:${stableHashHex(content)}`;
  const generatedAt = options.generatedAt || new Date().toISOString();
  const compressionWinner = huffman.compressionRatio <= rle.compressionRatio ? 'huffman' : 'rle';

  return {
    generatedAt,
    integrationVersion: PIED_PIPER_INTEGRATION_VERSION,
    attribution: PIED_PIPER_ATTRIBUTION,
    input: {
      characters: toCharacters(content).length,
      fingerprint: stableHashHex(content),
      sample: content.slice(0, 180),
    },
    artifactSha256,
    sha512: options.sha512 || null,
    capabilityIds: PIED_PIPER_CAPABILITIES.map((capability) => capability.id),
    compression: {
      huffman,
      rle,
      bwt,
      recommendation: compressionWinner,
    },
    automata: {
      rule30,
      gameOfLife: life,
      forestFire,
    },
    imageCompression: pbic,
    registryDraft: createPiedPiperRegistryDraft({ input: content }, { artifactSha256, generatedAt }),
  };
}

export function listPiedPiperCapabilities() {
  return {
    attribution: PIED_PIPER_ATTRIBUTION,
    modelType: PIED_PIPER_MODEL_TYPE,
    capabilities: PIED_PIPER_CAPABILITIES,
    integratedAt: PIED_PIPER_INTEGRATION_VERSION,
  };
}
