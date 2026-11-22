# Workspace Organization

This checkout is the canonical application workspace. The root project should stay focused on source, tests, deployment config, and documentation. Large local datasets, generated build output, and duplicate checkouts should remain outside normal source-control work.

## Primary Project

Use the repository root for active product work:

- `src/` - frontend app source.
- `server/` - backend/API source.
- `programs/` - Solana/Anchor program source.
- `test/` - JavaScript test suites.
- `scripts/` - maintenance and data utility scripts.
- `docs/` - product and technical documentation.
- `public/` - static public assets.
- `package.json`, `package-lock.json`, `yarn.lock` - Node package metadata.
- `Cargo.toml`, `Cargo.lock`, `Anchor.toml` - Rust/Anchor package metadata.
- `render.yaml`, `vercel.json`, `.vercelignore` - deployment configuration.

## Local And Generated Directories

These directories are local artifacts and should not be treated as source:

- `node_modules/` - installed JavaScript dependencies.
- `dist/` - Vite build output.
- `target/` - Rust/Anchor build output.
- `.mypy_cache/` - Python type-checker cache.
- `.playwright-mcp/` - browser automation logs and snapshots.
- `.vercel/` - local Vercel project metadata.
- `outputs/` - local model/output artifacts.
- `.codex-ai-training-docs/` and `.codex-model-kit-sync/` - local agent sync folders.

Some of these artifacts are already tracked in git history. The ignore rules prevent new files from being added, but they do not remove tracked files from the index. If the repository should be cleaned further, untrack generated files with `git rm --cached` after reviewing the change set.

## Training Workspace

`training/` is a separate 4.7 GB training/data workspace with its own `.git` directory. The root repository ignores it on purpose. Keep model data, processed datasets, training configs, local HF cache, and training-specific notes there.

Current notable training areas:

- `training/configs/` - training configuration.
- `training/data/` - raw, processed, and generated datasets.
- `training/model-kit/` - local model-kit material.
- `training/nvidia/` - NVIDIA-specific training/research material.
- `training/ollama/` - local Ollama material.
- `training/docs/` - training documentation.

The nested training repo currently has local changes in `training/data/strategies/` and untracked combined SFT files. Review or commit those inside `training/` separately.

## Duplicate Checkout

`traintoearn/` is an accidental nested clone of this project and has its own `.git` directory. It is ignored by the root repository. A comparison against the root project shows it is effectively a duplicate except for its `.gitignore` and an untracked `Untitled-1` file.

Recommended cleanup path:

1. Review `traintoearn/Untitled-1`.
2. Copy anything still needed into the root project.
3. Remove or archive the nested clone once confirmed.

## Prototype Material

`Building an On-Chain AI Protocol for Solana 2/` is tracked prototype/reference material. Keep it separate from the active app unless specific files are promoted into the root source tree.

## Practical Working Rule

Work from the repository root unless you are intentionally working in the separate `training/` repo. Treat `traintoearn/`, generated build directories, caches, and local output folders as non-canonical.
