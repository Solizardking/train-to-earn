import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { test } from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('registry readiness script passes', async () => {
  const { stdout } = await execFileAsync('node', ['scripts/check-registry-readiness.mjs']);

  assert.match(stdout, /PASS program id consistency/);
  assert.match(stdout, /PASS secret hygiene/);
  assert.match(stdout, /Registry readiness checks passed/);
});
