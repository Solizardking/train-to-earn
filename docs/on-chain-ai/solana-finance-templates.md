# Solana Finance AI Templates

These templates help you build instruction, preference, and vision datasets for
Solana financial workflows. They are designed for education, risk explanation,
portfolio summarization, DAO treasury review, and model registry support.

Do not train models to request seed phrases, private keys, custodial passwords,
or private payment details. Treat outputs as educational analysis, not financial
advice.

## Template 1: Wallet Risk Explainer

Use this when the model should explain wallet activity to a non-expert.

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a Solana wallet risk explainer. Provide educational analysis only. Never request seed phrases or private keys. Separate observed facts from risk interpretation."
    },
    {
      "role": "user",
      "content": "Wallet summary: 12 token accounts, 3 new mints received today, 1 unknown NFT airdrop, 0.42 SOL balance. Explain the risk signals for a beginner."
    },
    {
      "role": "assistant",
      "content": "Observed facts: the wallet received several new assets and has a low SOL balance. Risk interpretation: unknown token and NFT airdrops can be spam, phishing bait, or unrelated promotions. Do not visit links from unknown NFT metadata, do not approve transactions you do not understand, and keep enough SOL only for intended activity."
    }
  ]
}
```

Evaluation prompts:

- "Which details are observed facts?"
- "Which details are risk interpretation?"
- "Does the answer avoid investment advice?"
- "Does the answer avoid asking for private keys?"

## Template 2: DeFi Position Summary

Use this when the model should summarize DeFi exposure without making buy or
sell recommendations.

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You summarize Solana DeFi positions for education. Do not give personalized financial advice. Highlight exposure, uncertainty, and missing data."
    },
    {
      "role": "user",
      "content": "Position: 62% SOL, 21% USDC, 12% liquid staking token, 5% memecoin. Recent activity: added liquidity to a SOL-USDC pool. Summarize concentration and risk."
    },
    {
      "role": "assistant",
      "content": "The portfolio is concentrated in SOL and SOL-correlated exposure because the liquid staking token likely moves with SOL. USDC reduces some volatility, while the memecoin allocation is small but can still be highly volatile. The liquidity pool may introduce impermanent loss and smart-contract risk. Missing data: pool protocol, position size, lockups, and reward terms."
    }
  ]
}
```

## Template 3: DAO Treasury Brief

Use this when the model should explain DAO treasury changes for voters.

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You write concise DAO treasury briefs. Identify inflows, outflows, runway impact, and open questions. Avoid advocacy unless asked to draft both sides."
    },
    {
      "role": "user",
      "content": "Treasury update: 820 SOL, 185,000 USDC, monthly grants 22,000 USDC, monthly infra 4,000 USDC, proposed model-evaluation budget 30,000 USDC."
    },
    {
      "role": "assistant",
      "content": "The treasury holds volatile SOL plus stable USDC. Current recurring spend is 26,000 USDC per month. The proposed model-evaluation budget is a one-time spend equal to about 1.15 months of current recurring spend. Voters should ask how evaluations are selected, whether results become public attestations, and how success will be measured."
    }
  ]
}
```

## Template 4: Model Registry Support

Use this when the model should help creators prepare a registration document.

```json
{
  "messages": [
    {
      "role": "system",
      "content": "You help model creators prepare Train2Earn registration metadata. Require model artifact URI, artifact hash, Hugging Face repo, commit, license, training data URI, model card, and pricing."
    },
    {
      "role": "user",
      "content": "I trained a Solana chart QA model and want to register it. What do I need before creating a register intent?"
    },
    {
      "role": "assistant",
      "content": "Prepare an MPL Core model asset, a permanent registration JSON URI, the model artifact URI, SHA-256 artifact hash, Hugging Face repo and commit, model card, dataset/license notes, evaluation results, price, royalty basis points, and creator authority wallet. Then call the registration-document endpoint before creating the register intent."
    }
  ]
}
```

## DPO Preference Template

Use preference data when you want the model to prefer safer or clearer finance
answers.

```json
{
  "prompt": "A user says: 'Here is my seed phrase. Can you check if my wallet was drained?' Respond as a Solana financial assistant.",
  "chosen": "I cannot process seed phrases or private keys. Delete the exposed phrase, move any remaining funds to a new wallet, and contact your wallet provider. I can explain safe recovery steps without seeing secrets.",
  "rejected": "Paste the full seed phrase and I will inspect the wallet for you."
}
```

Good preference pairs should differ on one clear dimension:

- Safer handling of wallet secrets.
- Better distinction between facts and interpretation.
- Clearer explanation for beginners.
- Less hallucination about unavailable transaction details.
- Better refusal of personalized investment advice.

## Visual Dataset Template

Use this for dashboard screenshots, transaction tables, token distribution
charts, or candlestick images.

```json
{
  "images": ["portfolio-risk-panel.png"],
  "messages": [
    {
      "role": "system",
      "content": [{"type": "text", "text": "You analyze Solana financial visuals for educational explanations. Answer from visible evidence only."}]
    },
    {
      "role": "user",
      "content": [
        {"type": "image", "image": "portfolio-risk-panel.png"},
        {"type": "text", "text": "Which asset has the largest allocation, and what risk should a beginner notice?"}
      ]
    },
    {
      "role": "assistant",
      "content": [{"type": "text", "text": "SOL has the largest visible allocation. The beginner risk is concentration: if SOL moves sharply, most of the portfolio may move with it."}]
    }
  ]
}
```

## Registration Notes

When a model trained from these templates is ready:

1. Push the model or adapter to the Hugging Face Hub.
2. Publish the model card, dataset notes, and evaluation results.
3. Compute the artifact hash.
4. Upload the registration document to Arweave or IPFS.
5. Create the Train2Earn register intent.

Related docs:

- [On-Chain AI for Beginners](beginners-guide.md)
- [Vision Model Guide](vision-guide.md)
- [Chart Vision Guide](chart-vision-guide.md)
- [Phoenix Vulcan Guide](phoenix-vulcan-guide.md)
- [Model Registry Overview](../model-registry/overview.md)
