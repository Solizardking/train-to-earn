import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PIED_PIPER_MODEL_TYPE,
  burrowsWheelerTransform,
  createHuffmanModel,
  createPiedPiperAnalysis,
  decodeHuffmanBits,
  estimatePaintingCompression,
  runLengthDecode,
  runLengthEncode,
  runRule30,
  simulateForestFire,
  simulateGameOfLife,
} from '../src/utils/piedPiperToolkit.js';

test('compresses and decodes text with the PiedPiper Huffman model', () => {
  const input = 'aaaabbbccd pied piper compression';
  const model = createHuffmanModel(input);
  const bits = Array.from(input).map((char) => model.codebook[char]).join('');

  assert.equal(model.algorithm, 'static-huffman');
  assert.ok(model.encodedBitLength < model.originalBitLength);
  assert.equal(decodeHuffmanBits(bits, model.codebook), input);
});

test('round-trips run-length encoded input', () => {
  const input = 'aaaaabbbbccccccccccdd';
  const encoded = runLengthEncode(input);

  assert.equal(encoded.runs[0].count, 5);
  assert.equal(runLengthDecode(encoded.runs), input);
});

test('creates deterministic BWT and cellular automata outputs', () => {
  const bwt = burrowsWheelerTransform('banana');
  const rule30 = runRule30('banana', { width: 17, steps: 6 });
  const life = simulateGameOfLife({ seed: 'banana', rows: 8, cols: 8, generations: 3 });
  const forest = simulateForestFire({ seed: 'banana', rows: 8, cols: 8, generations: 3 });

  assert.equal(bwt.length, 7);
  assert.equal(rule30.rows.length, 7);
  assert.equal(life.history.length, 4);
  assert.equal(forest.history.length, 4);
  assert.equal(life.finalGrid.length, 8);
  assert.equal(forest.finalGrid.length, 8);
});

test('estimates PBIC stroke families and builds a registry draft', () => {
  const estimate = estimatePaintingCompression('onchain ai model registry');
  const analysis = createPiedPiperAnalysis('onchain ai model registry', {
    artifactSha256: '0x' + 'ab'.repeat(32),
    sha512: 'cd'.repeat(64),
    generatedAt: '2026-07-04T00:00:00.000Z',
  });

  assert.equal(estimate.block.length, 8);
  assert.ok(estimate.best.estimatedBytes <= 16);
  assert.equal(analysis.registryDraft.modelType, PIED_PIPER_MODEL_TYPE);
  assert.equal(analysis.registryDraft.artifactSha256, '0x' + 'ab'.repeat(32));
  assert.ok(analysis.registryDraft.capabilities.includes('text-compression-huffman-rle'));
});
