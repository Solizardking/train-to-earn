import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { saveSession, loadSession, clearSession, sessionExpired, sessionPath } from "../lib/session.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "traintoearn-cli-test-"));
}

const SESSION = { token: "tok_test_123", wallet: "4Nd1mPzV3QzJ8kYrGJ9xqXwFqV3QzJ8kYrGJ9xqXwFqV", expiresAt: "2999-01-01T00:00:00.000Z" };

test("save/load round-trip", () => {
  const dir = tmpDir();
  saveSession(SESSION, dir);
  assert.deepEqual(loadSession(dir), SESSION);
});

test("session file has 0600 permissions", { skip: process.platform === "win32" }, () => {
  const dir = tmpDir();
  const file = saveSession(SESSION, dir);
  const mode = fs.statSync(file).mode & 0o777;
  assert.equal(mode, 0o600, `expected 0600, got ${mode.toString(8)}`);
  const dirMode = fs.statSync(dir).mode & 0o777;
  assert.ok(dirMode <= 0o755, "config dir should not be world-writable");
});

test("save tightens permissions of a pre-existing loose file", { skip: process.platform === "win32" }, () => {
  const dir = tmpDir();
  const file = sessionPath(dir);
  fs.writeFileSync(file, "{}", { mode: 0o644 });
  fs.chmodSync(file, 0o644);
  saveSession(SESSION, dir);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
});

test("load returns null when logged out or corrupt", () => {
  const dir = tmpDir();
  assert.equal(loadSession(dir), null);
  fs.writeFileSync(sessionPath(dir), "not json");
  assert.equal(loadSession(dir), null);
  fs.writeFileSync(sessionPath(dir), JSON.stringify({ nope: true }));
  assert.equal(loadSession(dir), null);
});

test("clear removes the session", () => {
  const dir = tmpDir();
  saveSession(SESSION, dir);
  assert.equal(clearSession(dir), true);
  assert.equal(loadSession(dir), null);
  assert.equal(clearSession(dir), false);
});

test("expiry check", () => {
  assert.equal(sessionExpired({ expiresAt: "2000-01-01T00:00:00.000Z" }), true);
  assert.equal(sessionExpired({ expiresAt: "2999-01-01T00:00:00.000Z" }), false);
  assert.equal(sessionExpired({}), false);
  assert.equal(sessionExpired(null), false);
});
