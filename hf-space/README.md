---
title: TrainToEarn — Submit Data, Earn $CLAWD
emoji: 🦞
colorFrom: purple
colorTo: green
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: false
license: mit
---

# 🦞 TrainToEarn — Submit Data, Earn $CLAWD

A Hugging Face front door to [TrainToEarn](https://earn.onchainai.fund) — the Solana
train-to-earn platform and home of the **Clawd Omnichain Model Registry**, anchored
natively on Solana.

## What you can do here

- **Submit data** — text, image+caption pairs, video (by reference), bulk datasets
  (by manifest), and robot episode data. Every submission is rated 0–100 by the
  **Jev** decision engine across five checks (Solana-specific, teaches something,
  original, well-formed, safe to train) and mapped to a tier — Bronze · Silver (≥65) ·
  Gold (≥75) · Diamond (≥85) · Platinum (≥92) — plus an estimated $CLAWD reward that
  accrues to your Solana payout wallet.
- **Models & registry** — browse the omnichain registry and register your own model:
  the Space computes your manifest's SHA-256 (canonical JSON) and gives you the exact
  proof message (`clawd-registry:v1:<sha256>`) and Solana memo payload to sign/anchor
  with your own wallet.
- **Rewards** — look up any wallet's earned / pending / claimable $CLAWD, the rewards
  treasury, platform stats, and the public recent-submissions feed.

## How it works

This Space is a thin client over the public TrainToEarn backend
(`TRAINTOEARN_API`, default `https://traintoearn-backend-y6co.onrender.com`). Binary
data is rated **by reference** — images and video stay hosted with you (Hugging Face,
Arweave); the backend stores references, hashes, captions, and ratings, never your
raw files. The backend runs on a free Render tier, so the first call after idle can
take ~30–60s to wake.

## Safety

**This Space never asks for private keys or seed phrases — ever.** Signing (publisher
proofs, Solana anchors, reward claims) always happens in your own wallet tooling.
Rewards are for quality-rated training data; scores are computed by the engine, and
nothing here is financial advice or a promise of profit. When the Jev gateway doesn't
return a verdict, ratings are honestly labelled `heuristic-fallback`.

## Links

- App: https://earn.onchainai.fund
- Code + specs: https://github.com/Solizardking/train-to-earn
- CLI: `cli/` in the repo — wallet login, submissions, and model registration from your terminal
- Agent skill: `skills/traintoearn-omnichain/SKILL.md` in the repo — any agent on any chain can participate
