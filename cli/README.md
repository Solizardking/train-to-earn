# TrainToEarn CLI

The official command-line client for [TrainToEarn](https://earn.onchainai.fund) —
submit training data for Jev rating and $CLAWD rewards, upload datasets and
models, and register models in the **omnichain AI model registry anchored on
Solana** (see [`../docs/omnichain-registry.md`](../docs/omnichain-registry.md)
and [`../docs/jev2-engine.md`](../docs/jev2-engine.md)).

## Install

Requires Node.js ≥ 18.

```bash
# from this repo
cd cli
npm install
npm i -g .          # puts `traintoearn` on your PATH

# or run it in place without installing
node bin/traintoearn.js --help
```

The only dependency is `@solana/web3.js` (keypair loading + Ed25519 signing).

## Login — keys stay local

Login is a signature challenge, exactly like signing in with a browser wallet:

```bash
traintoearn login --keypair ~/.config/solana/id.json
```

1. The CLI asks the backend for a one-time challenge for your public key.
2. It signs the challenge message **locally** with your keypair file.
3. It sends only the signature; the server verifies it and issues a session token.
4. The session `{token, wallet, expiresAt}` is saved to
   `~/.config/traintoearn/session.json` with `0600` permissions.

**Your secret key never leaves your machine, is never printed, and is never
stored by the CLI.** The server only ever sees signatures and public keys.

No local keypair (e.g. you use a browser or hardware wallet)? Two-step login:

```bash
# 1. prints the exact message to sign
traintoearn login --wallet <YOUR_PUBKEY>

# 2. after signing that message in your wallet:
traintoearn login --wallet <YOUR_PUBKEY> --signature <BASE64_SIGNATURE>
```

```bash
traintoearn whoami    # session + server identity
traintoearn logout    # deletes the local session
```

## Commands

Global flags on every command: `--api <url>` (or the `TRAINTOEARN_API` env
var; default `https://traintoearn-backend-y6co.onrender.com`), `--json`
(machine-readable output), `--help`.

### Submit training data for a Jev rating

```bash
# text (existing live endpoint, ≤ 256 KB) — --type sft|cpt is optional metadata
traintoearn submit text --file my-data.jsonl --type sft

# image + caption pairs — pairs.json is [{mediaRef, mediaHash, caption}, …] (≤ 50)
traintoearn submit image --pairs pairs.json

# video, by reference only
traintoearn submit video --url https://arweave.net/<tx>

# bulk dataset / robot episode data, by manifest (see docs/jev2-engine.md §2.6)
traintoearn submit dataset --manifest dataset-manifest.json
traintoearn submit robot   --manifest robot-manifest.json
```

Dataset, robot, and video submissions are asynchronous: the CLI polls the
rating job (up to ~120 s, progress on stderr) and prints the final score,
tier, engine source (`jev+heuristic` vs `heuristic-fallback`), and $CLAWD
reward. Submissions credit the wallet you are logged in as (or `--wallet`).

### Upload datasets, models, and media

```bash
traintoearn upload ./my-dataset.parquet --kind dataset --name "My Dataset" --desc "Solana tx SFT rows"
traintoearn upload --url https://huggingface.co/datasets/me/my-data --kind dataset --name "My Dataset"
traintoearn uploads   # list your uploads
```

Kinds: `dataset | model | media | robot`. Login required.

### The omnichain model registry

```bash
traintoearn models list

traintoearn models register --manifest manifest.json --keypair ~/.config/solana/id.json
```

`models register` hashes the manifest with SHA-256 over canonical JSON —
byte-for-byte the same computation as
[`../scripts/register-model.mjs`](../scripts/register-model.mjs) — signs the
publisher proof message `clawd-registry:v1:<manifest_sha256>` locally, posts
`{manifest, signature}` to `/api/registry/register`, and prints the Solana
memo payload:

```
clawd-registry:v1:register:<manifest_sha256>:<chain_id>:<publisher>
```

Send a Solana transaction from your wallet carrying that memo (SPL Memo
program) to anchor the registration on-chain.

### Rewards and status

```bash
traintoearn balance                 # defaults to your session wallet
traintoearn balance --wallet <PUBKEY>
traintoearn stats                   # submission pipeline stats
traintoearn status                  # backend health + Jev engine status
```

## For agents

- **Every command supports `--json`.** In JSON mode, stdout is a single JSON
  document (progress and human chatter go to stderr or are suppressed).
- **Exit codes:** `0` success · `1` API/runtime error · `2` usage error.
  Errors in JSON mode are printed as `{"error": "…", "status": <http?>}`.
- **Non-interactive login:** use `--keypair` with a dedicated agent keypair,
  or the two-step `--wallet` / `--signature` flow for external signers.
  The session file location can be redirected with `TRAINTOEARN_CONFIG_DIR`.
- **Registry work without the CLI:** `node ../scripts/register-model.mjs …`
  produces identical manifest hashes and memo payloads.

## Development

```bash
npm test    # node --test — manifest hashing (incl. a cross-check against
            # scripts/register-model.mjs), session perms, arg parsing,
            # signing round-trip, API client with a mocked fetch. No network.
```
