# Phoenix Vulcan Guide for On-Chain AI Agents

Phoenix perpetual futures and the Vulcan CLI can be useful in Solana financial
agent workflows, but live commands can execute irreversible transactions on
Solana mainnet. Treat this guide as a safety-first template for read-only,
paper, and educational agent behavior.

Official documentation index:

- [Phoenix docs llms.txt](https://docs.phoenix.trade/llms.txt)
- [Vulcan CLI](https://docs.phoenix.trade/cli/index.md)
- [Vulcan installation](https://docs.phoenix.trade/cli/installation.md)
- [Vulcan command reference](https://docs.phoenix.trade/cli/commands.md)
- [Vulcan strategies](https://docs.phoenix.trade/cli/strategies.md)
- [Phoenix risk warning](https://docs.phoenix.trade/phoenix/margin-and-risk/risk-warning.md)

Before exploring Phoenix pages, fetch the documentation index and choose the
specific page needed for the task. Do not assume command flags or market
behavior from memory.

## Beginner Mental Model

Vulcan is a command-line tool for Phoenix perpetual futures on Solana. It is
designed for human operators and AI agents, with JSON output, paper trading,
strategy runners, and a local MCP server.

For Train2Earn, Vulcan belongs in the financial-analysis and agent-tooling layer:

```text
Phoenix market data
  -> Vulcan read-only or paper command
  -> JSON response
  -> AI explanation, risk summary, or chart-vision prompt
  -> optional model evaluation attestation
```

Live order placement is a separate, dangerous path and should never be the
default.

## Safety Rules for AI Agents

- Default to read-only or paper mode.
- Never request, print, export, or infer wallet private keys or wallet passwords.
- Never place live trades without explicit user approval.
- Before live exposure, inspect market data, account health, margin, current
  positions, and open orders.
- Never guess lot sizes. Use a lot-size calculator or an official command path.
- Report every live execution event and transaction signature immediately.
- Keep structured JSON output for agent integrations.

## Paper-Safe System Prompt

Use this as a system prompt for an agent that can discuss Vulcan without taking
live action:

```text
You are a Phoenix/Vulcan analyst for Solana perpetual futures. Default to read-only or paper-trading workflows. Do not place, modify, or cancel live orders unless the user explicitly asks for a live action and confirms the exact market, side, size, margin mode, slippage, take-profit, stop-loss, and risk. Never request wallet private keys, seed phrases, or wallet passwords. Use JSON outputs when commands are intended for automation.
```

## Read-Only Command Planning Template

```json
{
  "mode": "read_only",
  "objective": "summarize SOL-PERP market context",
  "checks": [
    "confirm Phoenix docs page and command group",
    "read exchange status",
    "read market snapshot",
    "read orderbook",
    "read funding overview",
    "summarize risks without giving financial advice"
  ],
  "output": {
    "format": "json",
    "must_include": ["source", "market", "observations", "risk_notes", "missing_context"]
  }
}
```

## Paper Strategy Template

Use paper mode to test strategy loops against live prices without risking real
funds.

```json
{
  "mode": "paper",
  "strategy": "grid",
  "market": "SOL-PERP",
  "preflight": [
    "fetch docs index",
    "confirm current strategy flags",
    "inspect market status",
    "define paper collateral",
    "define max loss for simulation",
    "log every simulated order"
  ],
  "never": [
    "use live wallet signing",
    "set allow-dangerous",
    "reuse paper results as performance guarantees"
  ]
}
```

## Live Action Approval Template

Use this only if a user explicitly asks for live trading. It is a checklist, not
permission by itself.

```json
{
  "requires_explicit_approval": true,
  "live_action": {
    "market": "",
    "side": "",
    "order_type": "",
    "size": "",
    "margin_mode": "",
    "slippage_bps": "",
    "take_profit": "",
    "stop_loss": "",
    "max_loss": ""
  },
  "pre_trade_checks": [
    "account health",
    "available collateral",
    "current positions",
    "open orders",
    "market status",
    "orderbook depth",
    "funding rate",
    "lot size"
  ],
  "approval_text": "I understand this is a live Solana mainnet transaction and accept the trading risk."
}
```

## Model Training Ideas

Good beginner datasets:

- Vulcan JSON output explanation.
- Phoenix risk-term glossary.
- Paper-strategy result summaries.
- Funding-rate explanation.
- Orderbook and candle chart QA.
- Account-health warning explanations.

Avoid training a model to recommend leverage or produce automatic trade
instructions. Train it to explain observations, risks, missing context, and
paper results.

## Chart Vision Use Case

A chart-vision model can read screenshots from Phoenix or Vulcan dashboards and
answer questions such as:

- "Which side of the orderbook is visually deeper?"
- "Is funding positive or negative in this screenshot?"
- "Which visible candle has the largest range?"
- "Can you determine account health from this cropped view?"

The model should answer from visible evidence only and say when the screenshot
is incomplete.

## Registration Notes

If you publish a Phoenix/Vulcan analysis model to Train2Earn, the model card
should disclose:

- Whether the model is read-only, paper-only, or live-capable.
- Exact command families used in training data.
- Safety rules and refusal behavior.
- Evaluation prompts for wallet secrets and live-trade requests.
- Known market-data and chart-reading limitations.
- Artifact hash, Hugging Face commit, and dataset license.

Related docs:

- [Solana Finance AI Templates](solana-finance-templates.md)
- [Chart Vision Guide](chart-vision-guide.md)
- [On-Chain AI for Beginners](beginners-guide.md)
