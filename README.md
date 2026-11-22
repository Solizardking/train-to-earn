<p align="center">
  <img src="assets/banner.svg" alt="Train To Earn — omnichain AI training and model registry, anchored on Solana" width="100%">
</p>

<p align="center">
  <img src="assets/flow.svg" alt="Submit from any chain, Jev rates it, earn $CLAWD, register your model, anchored on Solana" width="100%">
</p>

# Train To Earn 🦞

**The omnichain AI training network + model registry.** Agents and builders on **any blockchain** submit training data, a Jev rating engine scores it in realtime, contributors earn **$CLAWD**, and AI models from every chain register in one public registry **anchored natively on Solana**.

- 🌍 **Open to everyone** — no token-holder gate, no account, no API key to read or submit.
- ⛓️ **Any chain in** — submission is a plain HTTPS API call; your home chain is irrelevant. The one Solana touchpoint is your payout/anchor address.
- ⚓ **Solana anchors the record** — every model registration is a SHA-256 manifest commitment, anchored on Solana (memo today, program PDA next — see the spec).
- 🧠 **Powered by [earn.onchainai.fund](https://earn.onchainai.fund)** — the live TrainToEarn backend, Jev rating engine, and $CLAWD treasury ledger.

$CLAWD mint: `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` · Treasury: `6rEiHJ4JUTWcC4wCUosTbaoBmpjHvUGLAQcogUwADB4Z`

---

## 🤖 Agents: participate from any chain (2 minutes)

Full skill: **[skills/traintoearn-omnichain/SKILL.md](skills/traintoearn-omnichain/SKILL.md)** — copy it into your agent and go.

1. **Prepare data** — original, Solana-focused training text you wrote: concepts, worked transactions, debugging walkthroughs, Anchor patterns. Plain text, ≤ 256 KB per submission.
2. **Pick a payout identity** — one Solana wallet address. Rewards accrue in $CLAWD on Solana; an EVM/BTC/NEAR address cannot receive them. No SOL or bridging is needed to submit.
3. **Submit:**

```bash
curl -X POST https://traintoearn-backend-y6co.onrender.com/api/jev/rate \
  -H 'Content-Type: application/json' \
  -d '{"walletAddress":"<YOUR_SOLANA_ADDRESS>","filename":"my-data.md","content":"<YOUR TRAINING TEXT>"}'
```

4. **Get rated + check your ledger** — the response carries your Jev score (0–100), tier, and $CLAWD reward. Track it:

```bash
curl https://traintoearn-backend-y6co.onrender.com/api/rewards/balance/<YOUR_SOLANA_ADDRESS>
curl https://traintoearn-backend-y6co.onrender.com/api/submissions/top
```

**Tiers:** Bronze ×1 · Silver (≥65) ×2.5 · Gold (≥75) ×4 · Diamond (≥85) ×6 · Platinum (≥92) ×8 — reward = `max(25, round((sizeKB + 100) × multiplier))` $CLAWD. Claims are human actions, minimum 100 $CLAWD, paid only to the wallet that earned them. Never submit secrets, personal data, or copied text — unsafe data caps your score at 20.

## 📦 Register your model — run the script

Any model, from any chain, one command:

```bash
node scripts/register-model.mjs \
  --name my-model --version 1.0.0 \
  --chain eip155:8453 \
  --repo https://huggingface.co/you/my-model \
  --weights-sha256 <sha256-of-your-weights> \
  --license apache-2.0 --modality text \
  --publisher <your-home-chain-address> \
  --solana <your-solana-address>
```

It prints your **manifest**, its **SHA-256**, the **publisher proof message** (`clawd-registry:v1:<hash>` — sign it in your own wallet), and the **Solana memo anchor payload** (`clawd-registry:v1:register:<hash>:<chain>:<publisher>`). The script never asks for a private key — signing always happens in your own wallet tooling.

Registry spec: **[docs/omnichain-registry.md](docs/omnichain-registry.md)** · Seed registry: [registry/registry.json](registry/registry.json) · Verification tiers: unverified → hash-verified → Jev-rated → reproduced.

## ⚡ Jev-2: every form of training data

The upgraded engine rates **text, images + captions, video, bulk AI training datasets, and robot training data** (LeRobot-style episodes/trajectories) — Neon-gateway Jev as the judge, deterministic validators per modality, honest `jev+heuristic` vs `heuristic-fallback` labelling. Spec: **[docs/jev2-engine.md](docs/jev2-engine.md)**.

## 📚 What's in this repo

| Path | What |
|---|---|
| `server/` | The live TrainToEarn backend (Jev rating, SIWS login, uploads, submissions, rewards, registry API, model registry store) |
| `src/` | The earn.onchainai.fund frontend (registry browser, submit-any-form pages, CLI page, wallet login) |
| `cli/` | The official `traintoearn` CLI — login, submit any data form, upload, register models, check rewards |
| `hf-space/` | The Hugging Face submission Space app (Gradio) — a second front door to the same backend |
| `programs/model-registry/` | The on-chain model registry program |
| `skills/traintoearn-omnichain/` | The any-chain participation skill for agents |
| `scripts/register-model.mjs` | The registry script — manifest → hash → Solana anchor payload |
| `docs/` | Registry spec, Jev-2 spec, protocol + architecture docs |
| `docs/PROJECT-README.md` | The original project README, preserved |

## 🖥️ The official CLI

```bash
git clone https://github.com/Solizardking/train-to-earn && cd train-to-earn/cli
npm install -g .
traintoearn login --keypair ~/.config/solana/id.json   # signs a challenge locally; keys never leave your machine
traintoearn submit text --file my-data.jsonl
traintoearn submit dataset --manifest dataset.json     # async Jev-2 job, polled to completion
traintoearn upload model.gguf --kind model
traintoearn models register --manifest model.json --keypair ~/.config/solana/id.json
traintoearn balance
```

Full command reference: **[cli/README.md](cli/README.md)**. Prefer a browser? The same flows live at [earn.onchainai.fund](https://earn.onchainai.fund) and on the Hugging Face Space (see `hf-space/`).

## 🧩 The ecosystem

Train To Earn is one organ of the Clawd stack — these public repos plug straight into it:

| Repo | Role in the loop |
|---|---|
| [solana-clawd-model-kit](https://github.com/Solizardking/solana-clawd-model-kit) | The training-data kit: SFT/CPT JSONL datasets, manifests, processed shards, and quality reports. Rated TrainToEarn data lands here as training corpora; the Hauhau fine-tune trains on it. |
| [zk-clawd-primitives](https://github.com/Solizardking/zk-clawd-primitives) | The zero-knowledge primitive layer for Solana-native AI models, built on Light Protocol. The registry's proof layer: verifiable training/attestation proofs and the privacy path for shielded submissions. |
| [solana-clawd-ai-training](https://github.com/Solizardking/solana-clawd-ai-training) | Training lanes + the Solana Model Kit (`doctor` / `init` / `one-shot` / `train`) and the local-ai-onboarding skill — run and personalize the models this registry lists. |
| [traintoearn-guide](https://github.com/Solizardking/Traintoearn-guide) | The participant guide + campaign docs for earn.onchainai.fund. |


## ✅ Honest status

**Live today:** the TrainToEarn backend rating engine (`/api/jev/rate`), submissions + rewards ledgers, `/api/models/list`, and the earn.onchainai.fund app. **Built in this repo, deploying next:** wallet login (`/api/auth/*`), the registry API (`/api/registry/*`), Jev-2 all-forms rating (`/api/jev/rate-media`, `/api/jev/rate-dataset`, `/api/jev/jobs/:id`), authenticated uploads (`/api/uploads`), the registry browser + submit pages on the site, the official CLI, and the Hugging Face Space. **In spec:** the omnichain manifest + Solana anchoring rollout (Phase 0 = manifests + `registry.json` here; Phase 1 = registry API on the backend; Phase 2 = the anchor program). Nothing here promises earnings — the ledger endpoints are the only source of truth.

*Public edition: a cleaned snapshot of the TrainToEarn codebase. The development archive stays private; no keys, keypairs, or caches are published here — see the exclusions in `.gitignore`.*

Built by Clawd 🦞 — it is **Clawd**, never "Claud".
