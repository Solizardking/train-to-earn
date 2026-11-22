#!/usr/bin/env node
/**
 * traintoearn — official TrainToEarn CLI.
 *
 * Log in with a Solana wallet (signature only — keys never leave this
 * machine), submit training data for Jev rating, upload datasets/models,
 * and register models in the omnichain registry anchored on Solana.
 *
 * Global flags: --api <url> (or TRAINTOEARN_API env), --json, --help.
 */
import fs from "node:fs";
import path from "node:path";

import { ApiClient, ApiError, DEFAULT_API_BASE } from "../lib/api.js";
import { parseArgs, optStr } from "../lib/args.js";
import { loadSession, saveSession, clearSession, sessionExpired, sessionPath } from "../lib/session.js";
import { loadKeypairFile, signMessage, isValidPublicKey } from "../lib/signing.js";
import { hashManifest, proofMessage, memoPayload } from "../lib/manifest.js";

const VERSION = "1.0.0";

class UsageError extends Error {}

// ---------------------------------------------------------------------------

function resolveApiBase(options) {
  return optStr(options, "api") || process.env.TRAINTOEARN_API || DEFAULT_API_BASE;
}

function makeClient(options, session) {
  return new ApiClient({ base: resolveApiBase(options), token: session?.token || null });
}

/** Print a result: JSON in --json mode, human lines otherwise. */
function emit(ctx, jsonObj, humanText) {
  if (ctx.json) {
    console.log(JSON.stringify(jsonObj, null, 2));
  } else if (humanText !== undefined) {
    console.log(humanText);
  }
}

function progress(ctx, line) {
  if (!ctx.json) console.error(line);
}

function requireSession() {
  const session = loadSession();
  if (!session) throw new UsageError("not logged in — run `traintoearn login --keypair <path>` first");
  if (sessionExpired(session)) {
    throw new UsageError(`session for ${session.wallet} expired at ${session.expiresAt} — run \`traintoearn login\` again`);
  }
  return session;
}

function resolveWallet(options, session) {
  const wallet = optStr(options, "wallet") || session?.wallet;
  if (!wallet) {
    throw new UsageError("no wallet — log in first (`traintoearn login`) or pass --wallet <pubkey>");
  }
  if (!isValidPublicKey(wallet)) throw new UsageError(`invalid Solana public key: ${wallet}`);
  return wallet;
}

function readJsonFile(file, what) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (err) {
    throw new UsageError(`cannot read ${what} file ${file}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new UsageError(`${what} file ${file} is not valid JSON`);
  }
}

// ---- rating output ---------------------------------------------------------

function ratingOf(res) {
  return res?.rating || res?.result || res || {};
}

function ratingSummary(r) {
  const lines = [
    `score:  ${r.score ?? "?"}`,
    `tier:   ${r.tier ?? "?"}${r.tierLabel ? ` (${r.tierLabel})` : ""}`,
    `engine: ${r.source ?? r.engine ?? "?"}`,
    `reward: ${r.clawdReward ?? r.reward ?? "?"} CLAWD`,
  ];
  if (r.id !== undefined) lines.push(`id:     ${r.id}`);
  if (r.dataHash) lines.push(`hash:   ${r.dataHash}`);
  if (r.verifiedWeight !== undefined) lines.push(`verified weight: ${r.verifiedWeight}`);
  return lines.join("\n");
}

const JOB_DONE = new Set(["scored", "completed", "complete", "done", "succeeded", "success", "finished"]);
const JOB_FAILED = new Set(["failed", "error", "rejected", "cancelled"]);

async function pollJob(api, jobId, ctx, { timeoutMs = 120_000, intervalMs = 3_000 } = {}) {
  const started = Date.now();
  let lastStatus = null;
  for (;;) {
    const job = await api.jevJob(jobId);
    const status = String(job?.status || job?.state || (job?.rating || job?.result ? "scored" : "")).toLowerCase();
    if (status && status !== lastStatus) {
      progress(ctx, `job ${jobId}: ${status}`);
      lastStatus = status;
    }
    if (JOB_FAILED.has(status)) {
      throw new ApiError(`rating job ${jobId} failed: ${job?.error || job?.reason || "no reason given"}`, { body: job });
    }
    if (JOB_DONE.has(status) || job?.rating || job?.result) {
      return job;
    }
    if (Date.now() - started > timeoutMs) {
      throw new ApiError(`rating job ${jobId} did not finish within ${Math.round(timeoutMs / 1000)}s (last status: ${status || "unknown"})`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// ---- commands ---------------------------------------------------------------

async function cmdLogin(ctx) {
  const { options } = ctx;
  const api = makeClient(options, null);
  const keypairPath = optStr(options, "keypair");
  const walletOpt = optStr(options, "wallet");
  const signatureOpt = optStr(options, "signature");

  if (keypairPath) {
    const kp = await loadKeypairFile(keypairPath);
    const challenge = await api.authChallenge(kp.publicKey);
    const message =
      challenge?.message ||
      `TrainToEarn Login\nWallet: ${kp.publicKey}\nNonce: ${challenge?.nonce}\nIssued: ${challenge?.issuedAt || new Date().toISOString()}`;
    const signature = await signMessage(message, kp.secretKey);
    const verified = await api.authVerify(kp.publicKey, signature.toString("base64"));
    const session = {
      token: verified.token,
      wallet: verified.wallet || kp.publicKey,
      expiresAt: verified.expiresAt || null,
    };
    const file = saveSession(session);
    emit(ctx, { loggedIn: true, ...session, sessionFile: file },
      `Logged in as ${session.wallet}\nSession saved to ${file} (expires ${session.expiresAt || "n/a"})`);
    return;
  }

  if (walletOpt) {
    if (!isValidPublicKey(walletOpt)) throw new UsageError(`invalid Solana public key: ${walletOpt}`);
    if (signatureOpt) {
      // External signer flow, step 2: the signature must be over the exact
      // challenge message from step 1. We deliberately do NOT fetch a fresh
      // challenge here — that could rotate the nonce and invalidate it.
      const verified = await api.authVerify(walletOpt, signatureOpt);
      const session = {
        token: verified.token,
        wallet: verified.wallet || walletOpt,
        expiresAt: verified.expiresAt || null,
      };
      const file = saveSession(session);
      emit(ctx, { loggedIn: true, ...session, sessionFile: file },
        `Logged in as ${session.wallet}\nSession saved to ${file} (expires ${session.expiresAt || "n/a"})`);
      return;
    }
    // External signer flow, step 1: fetch the challenge and show the exact
    // message to sign with any external wallet (browser wallet, hardware…).
    const challenge = await api.authChallenge(walletOpt);
    const message =
      challenge?.message ||
      `TrainToEarn Login\nWallet: ${walletOpt}\nNonce: ${challenge?.nonce}\nIssued: ${challenge?.issuedAt || ""}`;
    emit(ctx, { wallet: walletOpt, nonce: challenge?.nonce, message, expiresAt: challenge?.expiresAt },
      [
        "Sign this exact message with your wallet (it is not a transaction and costs nothing):",
        "",
        message,
        "",
        "Then complete login with:",
        `  traintoearn login --wallet ${walletOpt} --signature <base64-signature>`,
      ].join("\n"));
    return;
  }

  throw new UsageError("login needs --keypair <path> or --wallet <pubkey> (see `traintoearn login --help`)");
}

async function cmdLogout(ctx) {
  const removed = clearSession();
  emit(ctx, { loggedOut: removed }, removed ? "Logged out — session deleted." : "No session found; already logged out.");
}

async function cmdWhoami(ctx) {
  const session = loadSession();
  if (!session) throw new UsageError("not logged in — run `traintoearn login --keypair <path>`");
  const api = makeClient(ctx.options, session);
  let me = null;
  let meError = null;
  try {
    me = await api.authMe();
  } catch (err) {
    meError = err.message;
  }
  const info = {
    wallet: session.wallet,
    expiresAt: session.expiresAt,
    expired: sessionExpired(session),
    sessionFile: sessionPath(),
    server: me,
    ...(meError ? { serverError: meError } : {}),
  };
  emit(ctx, info, [
    `wallet:  ${session.wallet}`,
    `expires: ${session.expiresAt || "n/a"}${info.expired ? " (EXPIRED)" : ""}`,
    `session: ${info.sessionFile}`,
    me ? `server:  ${JSON.stringify(me)}` : `server:  unreachable (${meError})`,
  ].join("\n"));
}

async function cmdSubmitText(ctx) {
  const { options } = ctx;
  const file = optStr(options, "file");
  if (!file) throw new UsageError("submit text needs --file <file>");
  const type = optStr(options, "type");
  if (type && !["sft", "cpt"].includes(type)) throw new UsageError("--type must be sft or cpt");
  const session = loadSession();
  const wallet = resolveWallet(options, session);
  let content;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch (err) {
    throw new UsageError(`cannot read file ${file}: ${err.message}`);
  }
  const ext = path.extname(file).toLowerCase();
  const mimeType = { ".json": "application/json", ".jsonl": "application/jsonl", ".csv": "text/csv", ".md": "text/markdown" }[ext] || "text/plain";
  const api = makeClient(options, session);
  const res = await api.rateText({
    walletAddress: wallet,
    content,
    filename: path.basename(file),
    mimeType,
    metadata: { source: "traintoearn-cli", ...(type ? { type } : {}) },
  });
  const rating = ratingOf(res);
  emit(ctx, res, `Rated ${path.basename(file)} for ${wallet}\n${ratingSummary(rating)}`);
}

async function cmdSubmitImage(ctx) {
  const { options } = ctx;
  const pairsFile = optStr(options, "pairs");
  if (!pairsFile) throw new UsageError("submit image needs --pairs <pairs.json>");
  const session = loadSession();
  const wallet = resolveWallet(options, session);
  const parsed = readJsonFile(pairsFile, "pairs");
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new UsageError("pairs file must be a JSON array of {mediaRef, mediaHash, caption} or an object with an items array");
  }
  if (items.length > 50) throw new UsageError("at most 50 image+caption pairs per submission");
  const api = makeClient(options, session);
  const res = await api.rateMedia({ wallet, walletAddress: wallet, kind: "image", items });
  await finishRating(ctx, api, res, `image submission (${items.length} pairs)`);
}

async function cmdSubmitVideo(ctx) {
  const { options } = ctx;
  const url = optStr(options, "url");
  if (!url) throw new UsageError("submit video needs --url <url>");
  const session = loadSession();
  const wallet = resolveWallet(options, session);
  const api = makeClient(options, session);
  const res = await api.rateMedia({ wallet, walletAddress: wallet, kind: "video", url, mediaRef: url });
  await finishRating(ctx, api, res, `video submission (${url})`);
}

async function cmdSubmitDatasetLike(ctx, kind) {
  const { options } = ctx;
  const manifestFile = optStr(options, "manifest");
  if (!manifestFile) throw new UsageError(`submit ${kind} needs --manifest <manifest.json>`);
  const session = loadSession();
  const wallet = resolveWallet(options, session);
  const manifest = readJsonFile(manifestFile, "manifest");
  const api = makeClient(options, session);
  const res = await api.rateDataset({ wallet, walletAddress: wallet, kind, manifest });
  await finishRating(ctx, api, res, `${kind} submission (${manifestFile})`);
}

/** Shared tail for media/dataset submissions: sync rating or async job. */
async function finishRating(ctx, api, res, label) {
  const jobId = res?.jobId || res?.job?.id || null;
  if (jobId) {
    progress(ctx, `submitted ${label} — job ${jobId}, polling…`);
    const job = await pollJob(api, jobId, ctx);
    const rating = ratingOf(job);
    emit(ctx, job, `Rated ${label}\n${ratingSummary(rating)}`);
    return;
  }
  if (res?.rating || res?.score !== undefined || res?.result) {
    const rating = ratingOf(res);
    emit(ctx, res, `Rated ${label}\n${ratingSummary(rating)}`);
    return;
  }
  throw new ApiError(`unexpected response for ${label}: no rating and no jobId`, { body: res });
}

const UPLOAD_KINDS = new Set(["dataset", "model", "media", "robot"]);

async function cmdUpload(ctx) {
  const { options, positionals } = ctx;
  const session = requireSession();
  const kind = optStr(options, "kind");
  if (!kind || !UPLOAD_KINDS.has(kind)) {
    throw new UsageError("upload needs --kind dataset|model|media|robot");
  }
  const api = makeClient(options, session);
  const url = optStr(options, "url");
  const file = positionals[0];

  if (url) {
    const name = optStr(options, "name") || url;
    const res = await api.uploadJson({ kind, name, description: optStr(options, "desc") || undefined, sourceUrl: url });
    emit(ctx, res, `Uploaded reference "${name}" (${kind})\n${JSON.stringify(res)}`);
    return;
  }
  if (!file) throw new UsageError("upload needs a <file> argument or --url <url>");
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch (err) {
    throw new UsageError(`cannot read file ${file}: ${err.message}`);
  }
  const name = optStr(options, "name") || path.basename(file);
  const form = new FormData();
  form.append("file", new Blob([buf]), path.basename(file));
  form.append("kind", kind);
  form.append("name", name);
  const desc = optStr(options, "desc");
  if (desc) form.append("description", desc);
  const res = await api.uploadForm(form);
  emit(ctx, res, `Uploaded "${name}" (${kind}, ${buf.length} bytes)\n${JSON.stringify(res)}`);
}

async function cmdUploads(ctx) {
  const session = requireSession();
  const api = makeClient(ctx.options, session);
  const res = await api.uploadsMine();
  const list = res?.uploads || res?.items || (Array.isArray(res) ? res : []);
  emit(ctx, res, list.length
    ? list.map((u) => `${u.id ?? "?"}  ${u.kind ?? "?"}  ${u.name ?? u.sourceUrl ?? ""}`).join("\n")
    : "No uploads yet.");
}

async function cmdModelsList(ctx) {
  const api = makeClient(ctx.options, null);
  const [reg, cat] = await Promise.allSettled([api.registryModels(), api.modelsList()]);
  const registry = reg.status === "fulfilled" ? (reg.value?.models || reg.value?.entries || reg.value || []) : null;
  const catalog = cat.status === "fulfilled" ? (cat.value?.models || cat.value?.entries || cat.value || []) : null;
  if (registry === null && catalog === null) {
    throw new ApiError(`both model endpoints failed: ${reg.reason?.message}; ${cat.reason?.message}`);
  }
  const json = {
    registry: registry ?? [],
    catalog: catalog ?? [],
    ...(reg.status === "rejected" ? { registryError: reg.reason.message } : {}),
    ...(cat.status === "rejected" ? { catalogError: cat.reason.message } : {}),
  };
  const lines = [];
  if (Array.isArray(registry)) {
    lines.push(`— omnichain registry (${registry.length}) —`);
    for (const m of registry) {
      const man = m.manifest || m;
      lines.push(`${man.name ?? "?"}@${man.version ?? "?"}  tier ${m.tier ?? man.tier ?? 0}  ${m.manifest_sha256 || man.manifest_sha256 || m.sha256 || ""}`);
    }
  }
  if (Array.isArray(catalog)) {
    lines.push(`— TrainToEarn catalog (${catalog.length}) —`);
    for (const m of catalog) {
      lines.push(`${m.name ?? m.id ?? "?"}  ${m.modality ?? m.model?.modality ?? ""}  ${m.repo_url ?? m.model?.repo_url ?? ""}`);
    }
  }
  emit(ctx, json, lines.join("\n"));
}

async function cmdModelsRegister(ctx) {
  const { options } = ctx;
  const manifestFile = optStr(options, "manifest");
  const keypairPath = optStr(options, "keypair");
  if (!manifestFile) throw new UsageError("models register needs --manifest <manifest.json>");
  if (!keypairPath) throw new UsageError("models register needs --keypair <path> (the publisher proof is signed locally; the key never leaves this machine)");
  const manifest = readJsonFile(manifestFile, "manifest");
  const sha = hashManifest(manifest);
  const message = proofMessage(sha);
  let memo = null;
  try {
    memo = memoPayload(sha, manifest);
  } catch {
    memo = null; // memo needs chain/publisher fields; registration can still proceed
  }
  const kp = await loadKeypairFile(keypairPath);
  const signature = await signMessage(message, kp.secretKey);
  const api = makeClient(options, null);

  let res = null;
  let registerError = null;
  try {
    res = await api.registryRegister({ manifest, manifest_sha256: sha, signature: signature.toString("base64") });
  } catch (err) {
    registerError = err.message;
  }

  const json = {
    manifest_sha256: sha,
    proof_message: message,
    solana_memo: memo,
    registered: !registerError,
    ...(res ? { response: res } : {}),
    ...(registerError ? { error: registerError } : {}),
  };
  const lines = [
    `manifest sha256: ${sha}`,
    `proof message:   ${message}`,
    memo ? `solana memo:     ${memo}` : "solana memo:     (manifest lacks chain/publisher fields — add them to build the memo payload)",
  ];
  if (res) lines.push(`registry:        ${JSON.stringify(res)}`);
  if (registerError) {
    lines.push(`registry:        not registered — ${registerError}`);
    lines.push("Your manifest, proof signature, and memo payload above are still valid: anchor the memo from your Solana wallet and re-run when the registry endpoint is live.");
  } else {
    lines.push("Anchor it on Solana: send a transaction from your Solana wallet carrying the memo above (SPL Memo program).");
  }
  emit(ctx, json, lines.join("\n"));
  if (registerError) process.exitCode = 1;
}

async function cmdBalance(ctx) {
  const session = loadSession();
  const wallet = resolveWallet(ctx.options, session);
  const api = makeClient(ctx.options, session);
  const res = await api.rewardsBalance(wallet);
  emit(ctx, res, [
    `wallet:    ${wallet}`,
    `earned:    ${res.earned ?? "?"} CLAWD`,
    `paid:      ${res.paid ?? "?"}`,
    `pending:   ${res.pending ?? "?"}`,
    `claimable: ${res.claimable ?? "?"} (min claim ${res.minClaim ?? "?"})`,
    `ratings:   ${res.ratingsCount ?? "?"}`,
  ].join("\n"));
}

async function cmdStats(ctx) {
  const api = makeClient(ctx.options, null);
  const res = await api.submissionsStats();
  const stats = res?.stats || res;
  emit(ctx, res, Object.entries(stats || {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("\n"));
}

async function cmdStatus(ctx) {
  const api = makeClient(ctx.options, null);
  const [health, jev] = await Promise.allSettled([api.health(), api.jevStatus()]);
  const json = {
    api: resolveApiBase(ctx.options),
    health: health.status === "fulfilled" ? health.value : { error: health.reason.message },
    jev: jev.status === "fulfilled" ? jev.value : { error: jev.reason.message },
  };
  const h = json.health;
  const j = json.jev;
  emit(ctx, json, [
    `api:    ${json.api}`,
    `health: ${h.status ?? h.error ?? "?"}${h.database ? ` (db ${h.database})` : ""}`,
    `jev:    ${j.error ? j.error : `configured=${j.configured} model=${j.model} gateway=${j.gatewayHost}`}`,
  ].join("\n"));
  if (health.status === "rejected" && jev.status === "rejected") process.exitCode = 1;
}

// ---- help -------------------------------------------------------------------

const HELP = {
  "": [
    `traintoearn ${VERSION} — official TrainToEarn CLI (earn.onchainai.fund)`,
    "",
    "Usage: traintoearn <command> [options]",
    "",
    "Commands:",
    "  login            Log in with a Solana wallet (signature login; keys stay local)",
    "  logout           Delete the local session",
    "  whoami           Show the current session + server identity",
    "  submit text      Rate a text file with Jev        --file <f> [--type sft|cpt]",
    "  submit image     Rate image+caption pairs         --pairs <pairs.json>",
    "  submit video     Rate a video by reference        --url <url>",
    "  submit dataset   Rate a bulk dataset by manifest  --manifest <m.json> (async, polled)",
    "  submit robot     Rate robot episode data          --manifest <m.json> (async, polled)",
    "  upload <file>    Upload a dataset/model/media/robot file (logged in)",
    "  upload --url <u> Register an upload by reference (logged in)",
    "  uploads          List your uploads",
    "  models list      List registry + catalog models",
    "  models register  Register a model manifest        --manifest <m.json> --keypair <path>",
    "  balance          $CLAWD rewards balance           [--wallet <pubkey>]",
    "  stats            Submission pipeline stats",
    "  status           Backend health + Jev engine status",
    "",
    "Global options:",
    "  --api <url>      API base (default: TRAINTOEARN_API env or https://traintoearn-backend-y6co.onrender.com)",
    "  --json           Machine-readable JSON output (for agents)",
    "  --help           Show help (works per command too)",
    "",
    "Exit codes: 0 ok · 1 API/runtime error · 2 usage error",
  ].join("\n"),
  login: [
    "Usage: traintoearn login (--keypair <path> | --wallet <pubkey> [--signature <base64>])",
    "",
    "Keypair login (one step): fetches a challenge, signs it locally with your",
    "Solana keypair file, verifies, and saves the session to",
    "~/.config/traintoearn/session.json (0600). The secret key never leaves",
    "this machine and is never printed — the server only sees the signature.",
    "",
    "External signer login (two steps, e.g. a browser wallet):",
    "  1. traintoearn login --wallet <pubkey>            → prints the exact message to sign",
    "  2. traintoearn login --wallet <pubkey> --signature <base64-of-signature>",
  ].join("\n"),
  "models register": [
    "Usage: traintoearn models register --manifest <manifest.json> --keypair <path>",
    "",
    "Hashes the manifest exactly like scripts/register-model.mjs (SHA-256 over",
    "canonical JSON), signs the proof message clawd-registry:v1:<sha256> with",
    "your keypair locally, posts {manifest, signature} to /api/registry/register,",
    "and prints the Solana memo payload to anchor the registration on-chain.",
  ].join("\n"),
};

function helpFor(path) {
  const key = path.join(" ");
  return HELP[key] || HELP[path[0]] || HELP[""];
}

// ---- dispatch ---------------------------------------------------------------

const COMMANDS = {
  login: cmdLogin,
  logout: cmdLogout,
  whoami: cmdWhoami,
  "submit text": cmdSubmitText,
  "submit image": cmdSubmitImage,
  "submit video": cmdSubmitVideo,
  "submit dataset": (ctx) => cmdSubmitDatasetLike(ctx, "dataset"),
  "submit robot": (ctx) => cmdSubmitDatasetLike(ctx, "robot"),
  upload: cmdUpload,
  uploads: cmdUploads,
  "models list": cmdModelsList,
  "models register": cmdModelsRegister,
  balance: cmdBalance,
  stats: cmdStats,
  status: cmdStatus,
};

async function main() {
  const { path: cmdPath, positionals, options } = parseArgs(process.argv.slice(2));
  const ctx = { options, positionals, json: Boolean(options.json) };

  if (options.version && cmdPath.length === 0) {
    console.log(VERSION);
    return;
  }
  if (options.help || cmdPath.length === 0) {
    console.log(helpFor(cmdPath));
    if (cmdPath.length === 0 && !options.help) process.exitCode = 2;
    return;
  }

  const key = cmdPath.join(" ");
  const fn = COMMANDS[key];
  if (!fn) {
    console.error(`unknown command: ${key}\n`);
    console.error(HELP[""]);
    process.exitCode = 2;
    return;
  }

  try {
    await fn(ctx);
  } catch (err) {
    if (ctx.json) {
      console.log(JSON.stringify({ error: err.message, ...(err.status ? { status: err.status } : {}) }, null, 2));
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exitCode = err instanceof UsageError ? 2 : 1;
  }
}

main();
