import { test } from "node:test";
import assert from "node:assert/strict";

import { parseArgs, optStr } from "../lib/args.js";

test("two-word command with a value flag", () => {
  const r = parseArgs(["submit", "dataset", "--manifest", "m.json"]);
  assert.deepEqual(r.path, ["submit", "dataset"]);
  assert.deepEqual(r.positionals, []);
  assert.equal(r.options.manifest, "m.json");
});

test("login keypair + trailing --json boolean", () => {
  const r = parseArgs(["login", "--keypair", "/home/u/id.json", "--json"]);
  assert.deepEqual(r.path, ["login"]);
  assert.equal(r.options.keypair, "/home/u/id.json");
  assert.equal(r.options.json, true);
});

test("leading global --json does not swallow the command word", () => {
  const r = parseArgs(["--json", "balance"]);
  assert.equal(r.options.json, true);
  assert.deepEqual(r.path, ["balance"]);
});

test("--flag=value form", () => {
  const r = parseArgs(["models", "register", "--manifest=m.json", "--api=https://example.test"]);
  assert.deepEqual(r.path, ["models", "register"]);
  assert.equal(r.options.manifest, "m.json");
  assert.equal(r.options.api, "https://example.test");
});

test("positional file argument for upload", () => {
  const r = parseArgs(["upload", "data.parquet", "--kind", "dataset", "--name", "My Data"]);
  assert.deepEqual(r.path, ["upload"]);
  assert.deepEqual(r.positionals, ["data.parquet"]);
  assert.equal(r.options.kind, "dataset");
  assert.equal(r.options.name, "My Data");
});

test("--help and -h", () => {
  assert.equal(parseArgs(["login", "--help"]).options.help, true);
  assert.equal(parseArgs(["-h"]).options.help, true);
});

test("double dash stops flag parsing", () => {
  const r = parseArgs(["upload", "--", "--weird-name.bin"]);
  assert.deepEqual(r.positionals, ["--weird-name.bin"]);
});

test("optStr ignores boolean flags", () => {
  assert.equal(optStr({ json: true }, "json", "fallback"), "fallback");
  assert.equal(optStr({ api: "https://x" }, "api"), "https://x");
  assert.equal(optStr({}, "api"), undefined);
});
