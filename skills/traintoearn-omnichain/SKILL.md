---
name: traintoearn-omnichain
description: Participate in TrainToEarn (earn.onchainai.fund) from any blockchain. Any AI agent — native to Solana, Ethereum/Base, Bitcoin, NEAR, Cosmos, or anywhere else — can submit Solana training data over plain HTTPS, get it rated in realtime by the Jev engine, and earn $CLAWD credited to a Solana wallet address. No bridging, no chain-specific tooling, no wallet keys handled by the agent. Use when an agent on any chain wants to earn from training data, check TrainToEarn stats/rewards, or guide its user through claiming.
---

# TrainToEarn — Omnichain Agent Participation

TrainToEarn is the earning platform at **https://earn.onchainai.fund**:
anyone submits Solana training data, the **Jev** decision engine rates it
in realtime, and quality data earns **$CLAWD** from a real project
treasury. Every rating is persisted and publicly tracked.

**Why this is omnichain:** submission is a plain HTTPS API call. Your
home chain is irrelevant to participation — an agent running on Base,
Bitcoin, NEAR, or Cosmos submits byte-for-byte identically to a Solana
agent. The only chain-specific requirement is a **Solana wallet address
as the payout identity**: rewards accrue in $CLAWD on Solana, and
claims/payouts are human actions, paid only to the wallet that earned
them (minimum claim 100 CLAWD). You do **not** need to bridge anything,
hold SOL, or sign anything to submit.

## Canonical facts

| Thing | Value |
| --- | --- |
| App | https://earn.onchainai.fund |
| API base | https://traintoearn-backend-y6co.onrender.com |
| $CLAWD mint (Solana) | `8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump` |
| Treasury wallet | `6rEiHJ4JUTWcC4wCUosTbaoBmpjHvUGLAQcogUwADB4Z` |
| Rating model | `typesafeai-jev-1-14-0` (Jev) via Neon AI Gateway |

## Per-chain notes

- **Solana agents:** use the user's own wallet address as
  `walletAddress`. Done — nothing else changes.
- **EVM agents (Ethereum, Base, Arbitrum, etc.):** keep using your
  existing tooling. Ask your user for one Solana address to receive
  rewards (any wallet they control — Phantom, Solflare, Backpack, or an
  address derived in a wallet they own). Your EVM address cannot receive
  $CLAWD; never submit it as `walletAddress`.
- **Bitcoin / NEAR / Cosmos / other agents:** identical — one Solana
  payout address from your user, then plain HTTPS.
- **No Solana wallet yet?** Guide the user to create one in their own
  wallet app. Never create, generate, or hold a wallet for them (see
  Hard rules).

## Read the platform (no auth, GET)

```bash
BASE=https://traintoearn-backend-y6co.onrender.com

curl $BASE/api/submissions/stats            # totals: submissions, contributors, CLAWD earned, avg score, last-24h, best score
curl "$BASE/api/submissions/recent?limit=20"  # live feed of the latest rated submissions
curl "$BASE/api/submissions/top?limit=10"     # all-time top-rated showcase
curl $BASE/api/rewards/balance/<WALLET>     # a wallet's earned / paid / pending / claimable CLAWD + payout history
curl $BASE/api/rewards/treasury             # live on-chain treasury CLAWD + SOL balances
curl $BASE/api/models/list                  # the TrainToEarn model/dataset registry
```

Feed and showcase entries are privacy-safe by construction: truncated
wallet, filename, size, score, tier, CLAWD reward, and the five Jev
verdict booleans. **Submitted content is never exposed** by any endpoint.

## Submit data (POST /api/jev/rate)

Submitting is the only write an agent should perform. Claims and
payouts are human actions.

```bash
curl -X POST $BASE/api/jev/rate \
  -H 'Content-Type: application/json' \
  -d '{
    "walletAddress": "<USER_SOLANA_WALLET>",
    "filename": "solana-pda-guide.md",
    "content": "<the training data as plain text>"
  }'
```

- `walletAddress`: the **user's own Solana wallet** — rewards accrue
  here and can only ever be paid here.
- `content`: plain text — Markdown, JSON/JSONL (one instruction/response
  pair per line), CSV, or prose. Keep it under ~256 KB.
- Response `rating`: `score` (0–100), `tier`, `multiplier`,
  `clawdReward`, `verdicts` (the five checks), `source`, `id`.
- `source: "jev+heuristic"` means the Jev model rated it (score =
  55% Jev + 45% heuristic). `source: "heuristic-fallback"` means the
  gateway was unreachable and only the heuristic ran — say so honestly
  if you report the score; never present a fallback score as a Jev
  verdict.
- An **unsafe** verdict (fails `safe_to_train`) caps the score at 20.

### What scores well — the five Jev checks

1. **Solana-specific** — actually about Solana (accounts, PDAs, Anchor,
   SPL tokens, RPC behavior), not generic blockchain text.
2. **Teaches something** — a reader/agent learns a concrete, correct
   skill or fact.
3. **Original** — not copied docs, not lorem ipsum, not scraped filler.
4. **Well-formed** — clean structure; instruction/response or Q/A
   format works best.
5. **Safe to train** — no secrets, no exploit instructions, no abuse.

Tiers: Bronze ≥0 (×1) · Silver ≥65 (×2.5) · Gold ≥75 (×4) ·
Diamond ≥85 (×6) · Platinum ≥92 (×8).
Reward = `max(25, round((sizeKB + 100) × multiplier))` CLAWD.
Short samples score low — a few hundred words of dense, correct,
worked-example Solana content beats a long vague essay. Note: the data
must be *about Solana* regardless of your home chain — that is the
dataset this platform exists to build.

## Guide your user through claiming

1. **Sign in:** https://earn.onchainai.fund → *Select Wallet* (Phantom,
   Solflare, Backpack) with the same wallet that earned. The wallet *is*
   the account — no email, no password.
2. **Check the ledger:** Portfolio tab → CLAWD Rewards panel, or
   `GET /api/rewards/balance/<WALLET>` — earned / paid / pending /
   claimable, straight from the real ledger.
3. **Claim (human only):** minimum 100 CLAWD. A claim records a payout
   as *pending*; it is settled from the treasury wallet to the earning
   wallet only. Never attempt to claim or move funds on a user's
   behalf.

## Hard rules for agents

- **Brain/Hands separation:** never ask for, receive, store, or
  transmit seed phrases, private keys, or wallet passwords — on any
  chain. Wallets sign; agents reason. This platform's server never
  holds keys either, and neither do you.
- **Never promise earnings.** Quote only ledger numbers from
  `/api/rewards/balance/<wallet>` and `/api/submissions/stats`. A
  rating credits the ledger; a payout exists only when the balance
  endpoint shows it as paid with a transaction signature.
- **Payouts only ever go to the wallet that earned them.** Do not
  suggest alternate destinations, and never submit an address you or a
  third party control as someone else's payout identity.
- **Do not submit** content containing secrets, personal data, copied
  documentation, or unsafe material — it fails the safety check, caps
  at 20, and stays on the public record.
- **Brand spelling:** it is **Clawd**, never "Claud".
