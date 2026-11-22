# Contributing to Train2Earn

Thank you for helping build the on-chain AI economy on Solana! This guide covers
everything you need to submit a great contribution.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Workflow](#contribution-workflow)
- [Code Style](#code-style)
- [Areas to Contribute](#areas-to-contribute)
- [Smart Contract Contributions](#smart-contract-contributions)

---

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/traintoearn.git`
3. Add the upstream remote: `git remote add upstream https://github.com/Solizardking/traintoearn.git`

## Development Setup

```bash
# Install dependencies
npm install

# Copy the example env file
cp .env.example .env
# Fill in your own API keys (Helius is required; xAI and Pinata are optional)

# Start frontend + backend together
npm run dev
```

The frontend runs on `http://localhost:3000` (or 5173 via Vite) and the backend
on `http://localhost:5001`.

### Required API Keys

| Key | Purpose | Free tier |
|-----|---------|-----------|
| `HELIUS_API_KEY` | Solana RPC + DAS | ✅ [helius.dev](https://helius.dev) |
| `OPENROUTER_API_KEY` | AI analysis | ✅ [openrouter.ai](https://openrouter.ai) |
| `XAI_API_KEY` | File upload agent (Grok) | [x.ai](https://x.ai) |
| `PINATA_JWT` | IPFS pinning | ✅ [pinata.cloud](https://pinata.cloud) |

---

## Contribution Workflow

1. **Open an issue** first for non-trivial changes to align on approach
2. Create a branch: `git checkout -b feat/my-feature` or `fix/issue-123`
3. Make your changes with clear, focused commits
4. Run the project and verify your changes work end-to-end
5. Open a pull request against `main`

### Commit message format

```
type(scope): short description

feat(models): add live HF search to registration form
fix(server): remove hardcoded DB connection string
docs(readme): update clone URL
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## Code Style

- **JavaScript/JSX**: follow existing patterns; no framework upgrades without discussion
- **React**: functional components with hooks; no class components
- **Server**: Express with ES modules (`import`/`export`); async/await throughout
- **Rust/Anchor**: follow the existing program structure in `programs/`
- **No secrets in code**: use `process.env.VAR` or `import.meta.env.VITE_VAR`

---

## Areas to Contribute

| Area | Location | Complexity |
|------|----------|------------|
| UI components | `src/components/` | Low |
| Backend API endpoints | `server/index.js` | Medium |
| Model registry utilities | `src/utils/modelRegistry.js` | Medium |
| Anchor programs | `programs/model-registry/src/lib.rs` | High |
| Documentation | `docs/` | Low |
| Tests | (add `*.test.js` alongside source) | Medium |

## Smart Contract Contributions

The Anchor program lives in `programs/model-registry/`. To build and test:

```bash
# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor anchor-cli

# Build
anchor build

# Test (requires local validator)
anchor test
```

New instructions must include:
- Checked arithmetic (`.checked_add().ok_or(...)`)
- Correct PDA seeds documented in a comment
- An event emitted on state change
- An entry in `docs/smart-contracts/`

---

## Questions?

Open a [GitHub Discussion](https://github.com/Solizardking/traintoearn/discussions)
or reach us at the community channels linked in the README.
