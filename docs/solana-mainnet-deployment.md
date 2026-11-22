# Solana Mainnet Deployment Runbook

This repo's active Anchor workspace is the repository root:

```bash
cd /Users/8bit/Downloads/traintoearn
```

Do not `cd solana-ai-inference`; that directory does not exist in this
workspace. The deployed program crate is `programs/model-registry`.

## Current Program Identity

- Program name: `model_registry`
- Program id: `A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92`
- Program keypair: `target/deploy/model_registry-keypair.json`
- Rust declaration: `programs/model-registry/src/lib.rs`
- Frontend/server client constant: `MODEL_REGISTRY_PROGRAM_ID`

All four must match before deployment:

```bash
npm run check:registry
anchor keys list
solana-keygen pubkey target/deploy/model_registry-keypair.json
```

If they drift, run:

```bash
npm run anchor:sync
```

Then re-run `npm run check:registry` and review the source diff before deploying.

## Toolchain

`Anchor.toml` pins the Anchor CLI to `0.30.1`, matching
`anchor-lang = "0.30.1"` in `programs/model-registry/Cargo.toml`.

```bash
avm install 0.30.1
avm use 0.30.1
anchor --version
solana --version
```

The local `anchor --version` should report `anchor-cli 0.30.1` for this
workspace. If a newer global Anchor CLI still appears, fix the local AVM setup
before building.

## Local Verification

Run these from the repo root:

```bash
npm test
npm run check:registry
npm run check:docs
npm run build
cargo check
npm run anchor:build
```

`npm run anchor:build` should create:

```text
target/deploy/model_registry.so
target/idl/model_registry.json
```

## Devnet Deployment

Deploy to devnet first with the same program keypair:

```bash
solana config set --url https://api.devnet.solana.com
solana config set --keypair ~/.config/solana/id.json
solana airdrop 2
solana balance
npm run anchor:deploy:devnet
solana program show A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92
anchor idl init -f target/idl/model_registry.json A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92 --provider.cluster https://api.devnet.solana.com
```

If `anchor idl init` reports that the IDL already exists, use `anchor idl
upgrade -f target/idl/model_registry.json --provider.cluster
https://api.devnet.solana.com`.

## Mainnet Deployment

Only run this after devnet verification and a source review. Mainnet deployment
uses real SOL and the configured keypair becomes the upgrade authority unless
you transfer authority afterward.

```bash
solana config set --url https://api.mainnet-beta.solana.com
solana config set --keypair /path/to/mainnet-upgrade-authority.json
solana address
solana balance
npm run check:registry
npm run anchor:build
npm run anchor:deploy:mainnet
solana program show A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92
anchor idl init -f target/idl/model_registry.json A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92 --provider.cluster https://api.mainnet-beta.solana.com
```

For extra control, deploy the compiled artifact directly with Solana CLI while
explicitly passing the program keypair:

```bash
solana program deploy target/deploy/model_registry.so --program-id target/deploy/model_registry-keypair.json --url https://api.mainnet-beta.solana.com
```

## Post-Deploy Checks

```bash
solana program show A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92 --url https://api.mainnet-beta.solana.com
anchor idl fetch -o /tmp/model_registry.mainnet.json A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92 --provider.cluster https://api.mainnet-beta.solana.com
npm run check:registry
```

Update deployment environment variables only after the program id is verified on
chain. The public client id is already set to
`A6b32KvvsqexTY7VXF3hA6N7ciayqDFKQsEa8Mm2mb92`.

## Mainnet Readiness Notes

- `model_cid` and `evaluation_name` are PDA seeds and are capped at 32 bytes.
  Store full IPFS/Arweave artifact addresses in the registration document and
  `metadata_uri`.
- `update_model_stats` is creator-authorized on chain. Add a dedicated config
  authority account before allowing a backend service wallet to update stats for
  other creators.
- `register_model_identity_v1` still treats MPL Core asset and collection
  accounts as unchecked. Add Metaplex Core CPI/plugin validation before relying
  on this as a public trust boundary.
- Keep `target/deploy/model_registry-keypair.json` backed up securely. Losing it
  means losing the ability to deploy upgrades at the same program address.

References:

- Anchor CLI reference: https://www.anchor-lang.com/docs/references/cli
- Anchor.toml toolchain reference: https://www.anchor-lang.com/docs/references/anchor-toml
- Solana program deployment reference: https://solana.com/docs/programs/deploying
