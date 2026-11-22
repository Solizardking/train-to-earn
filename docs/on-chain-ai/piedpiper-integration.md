# PiedPiper Integration

Train2Earn integrates the local PiedPiper algorithm bundle as a deterministic
on-chain AI toolkit. The source material remains in
`/Users/8bit/Downloads/PiedPiper-master`; this project ports the parts that fit
the browser and server runtime, and records the rest as registry metadata for
future native workers.

## Source Scope

Integrated source areas:

| PiedPiper source | Train2Earn use |
|------------------|----------------|
| `Compression/Huffman/Static` | Static Huffman text metrics for prompts, dataset rows, and model-card payloads. |
| `Compression/Add-ons/rle.c` and `bwt.c` | RLE and BWT preprocessing signals for storage scoring. |
| `PP_HASH` | SHA-512 and Rule 30 style commitment metadata for inference ledgers. |
| `GameOfLife` and `ForestFire_Simulation` | Deterministic cellular automata simulations for explainable agent state transitions. |
| `Image Compression/PBIC` | Stroke-family image compression estimator for chart, screenshot, and NFT inputs. |
| `PCA` | Registry metadata for embedding and feature compression. |
| `Encryption` and `PP_SSH` | Registry metadata for private-session and protocol-analysis capabilities. |
| `MultiAgent_CollisionAvoidance` | Registry metadata for multi-agent planning and consensus-learning evaluations. |

The PiedPiper project is MIT licensed. The attribution metadata is exposed by
the API and included in the generated registry draft.

## Runtime Modules

The shared toolkit lives in `src/utils/piedPiperToolkit.js`.

It provides:

- Huffman model construction and decoding.
- Run-length encoding and decoding.
- Burrows-Wheeler transform metadata.
- Rule 30 bitstream generation.
- Conway Game of Life simulation.
- Forest-fire cellular automata simulation.
- PBIC-style 8x8 block stroke estimator.
- Registry-draft generation for the `PIEDPIPER_PIPELINE` model type.

## API

List capabilities:

```bash
GET /api/piedpiper/capabilities
```

Run deterministic analysis:

```bash
POST /api/piedpiper/analyze
Content-Type: application/json

{
  "input": "Train2Earn registers compression and automata agents on Solana."
}
```

The response includes compression metrics, cellular automata snapshots, SHA
commitments, PBIC estimates, source attribution, and a registry draft.

The paid inference path also accepts:

```json
{
  "modelType": "PIEDPIPER_PIPELINE",
  "prompt": "dataset or prompt payload",
  "paymentSignature": "dev:piedpiper-demo"
}
```

Mock signatures work only in local development or when mock payments are
explicitly enabled.

## Registry Mapping

The built-in registry seed now includes `PiedPiper Compression Automata Agent`
with model type `PIEDPIPER_PIPELINE`. The registry draft uses:

| Field | Value |
|-------|-------|
| `architecture` | `deterministic-algorithmic-agent` |
| `parameterCount` | `0` |
| `license` | `MIT` |
| `artifactUri` | `ipfs://piedpiper-compression-automata-toolkit` |
| `huggingFaceRepo` | `local/piedpiper-onchain-ai` |
| `trainingDataUri` | `/Users/8bit/Downloads/PiedPiper-master` |

Before mainnet registration, replace placeholder artifact and model-card URIs
with pinned IPFS or Arweave URLs.
